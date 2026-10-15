// Package vc implements the Web 3.0 core: W3C-style verifiable credentials as
// Ed25519-signed JWTs (VC-JWT) with a did:key issuer — verifiable by any third
// party offline, without calling Campus Pulse.
package vc

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Issuer holds the signing identity. The same seed yields the same DID, so
// restarts don't invalidate outstanding credentials.
type Issuer struct {
	priv ed25519.PrivateKey
	DID  string // did:key:<multibase(pubkey)>
}

func NewIssuer(seed []byte) (*Issuer, error) {
	if len(seed) != ed25519.SeedSize {
		return nil, fmt.Errorf("seed must be %d bytes", ed25519.SeedSize)
	}
	priv := ed25519.NewKeyFromSeed(seed)
	pub := priv.Public().(ed25519.PublicKey)
	return &Issuer{priv: priv, DID: "did:key:" + multibaseEncode(pub)}, nil
}

// GenerateSeed creates a random seed (used when VC_SIGNING_SEED is unset —
// printed once at startup so the operator can persist it).
func GenerateSeed() ([]byte, error) {
	seed := make([]byte, ed25519.SeedSize)
	_, err := rand.Read(seed)
	return seed, err
}

// Credential is the W3C VC 2.0 payload carried inside the JWT.
type Credential struct {
	Context           []string         `json:"@context"`
	Type              []string         `json:"type"`
	Issuer            string           `json:"issuer"`
	ValidFrom         string           `json:"validFrom"`
	CredentialSubject map[string]any   `json:"credentialSubject"`
}

// Issue signs a VC-JWT for an event ticket.
func (i *Issuer) Issue(bookingRef, studentNumber, eventID, eventTitle string, now time.Time) (string, map[string]any, error) {
	header := map[string]any{"alg": "EdDSA", "typ": "JWT"}
	credential := Credential{
		Context: []string{"https://www.w3.org/ns/credentials/v2"},
		Type:    []string{"VerifiableCredential", "EventTicket"},
		Issuer:  i.DID,
		ValidFrom: now.UTC().Format(time.RFC3339),
		CredentialSubject: map[string]any{
			"id":            "did:example:student:" + studentNumber,
			"studentNumber": studentNumber,
			"event":         eventID,
			"eventTitle":    eventTitle,
		},
	}
	payload := map[string]any{
		"iss": i.DID,
		"sub": "did:example:student:" + studentNumber,
		"jti": bookingRef,
		"nbf": now.Unix(),
		"vc":  credential,
	}

	h, _ := json.Marshal(header)
	p, _ := json.Marshal(payload)
	signingInput := base64url(h) + "." + base64url(p)
	sig := ed25519.Sign(i.priv, []byte(signingInput))
	jwt := signingInput + "." + base64url(sig)

	credJSON := map[string]any{
		"@context":          credential.Context,
		"type":              credential.Type,
		"issuer":            credential.Issuer,
		"validFrom":         credential.ValidFrom,
		"credentialSubject": credential.CredentialSubject,
	}
	return jwt, credJSON, nil
}

var (
	ErrMalformed   = errors.New("malformed token")
	ErrBadSignature = errors.New("invalid signature")
)

// Verify checks a VC-JWT's structure and Ed25519 signature against the
// embedded did:key public key — no network call, no issuer contact.
func Verify(token string) (payload map[string]any, err error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, ErrMalformed
	}
	headerBytes, err := base64urlDecode(parts[0])
	if err != nil {
		return nil, ErrMalformed
	}
	var header struct {
		Alg string `json:"alg"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil || header.Alg != "EdDSA" {
		return nil, ErrMalformed
	}
	payloadBytes, err := base64urlDecode(parts[1])
	if err != nil {
		return nil, ErrMalformed
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, ErrMalformed
	}
	iss, _ := payload["iss"].(string)
	pub, err := multibaseDecodeDIDKey(iss)
	if err != nil {
		return nil, fmt.Errorf("issuer is not a did:key: %w", err)
	}
	sig, err := base64urlDecode(parts[2])
	if err != nil {
		return nil, ErrMalformed
	}
	if !ed25519.Verify(pub, []byte(parts[0]+"."+parts[1]), sig) {
		return nil, ErrBadSignature
	}
	return payload, nil
}

func base64url(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

func base64urlDecode(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(s)
}
