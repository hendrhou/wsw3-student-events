// Package auth implements Google OIDC sign-in restricted to @ufp.edu.pt,
// plus the dev-only login used for local development and tests.
package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// GoogleConfig holds the OIDC wiring. Empty ClientID means Google sign-in is
// not configured (local dev) — handlers answer 503 with a clear message.
type GoogleConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

func (g GoogleConfig) Configured() bool { return g.ClientID != "" && g.ClientSecret != "" }

// GoogleFlow manages the Authorization Code flow. State is kept in memory
// (single-replica dev/course deployment; multi-replica would need a store).
type GoogleFlow struct {
	cfg      GoogleConfig
	oauth    *oauth2.Config
	verifier *oidc.IDTokenVerifier
	states   map[string]time.Time
	mu       sync.Mutex
}

// NewGoogleFlow discovers Google's OIDC metadata. Returns (nil, nil) when
// unconfigured so callers can degrade gracefully.
func NewGoogleFlow(ctx context.Context, cfg GoogleConfig) (*GoogleFlow, error) {
	if !cfg.Configured() {
		return nil, nil
	}
	provider, err := oidc.NewProvider(ctx, "https://accounts.google.com")
	if err != nil {
		return nil, fmt.Errorf("oidc discovery: %w", err)
	}
	return &GoogleFlow{
		cfg: cfg,
		oauth: &oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			RedirectURL:  cfg.RedirectURL,
			Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
			Endpoint:     google.Endpoint,
		},
		verifier: provider.Verifier(&oidc.Config{ClientID: cfg.ClientID}),
		states:   map[string]time.Time{},
	}, nil
}

// LoginURL builds the Google consent URL with the hosted-domain hint.
func (f *GoogleFlow) LoginURL() (url, state string) {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	state = hex.EncodeToString(b)
	f.mu.Lock()
	f.states[state] = time.Now().Add(5 * time.Minute)
	f.mu.Unlock()
	return f.oauth.AuthCodeURL(state, oauth2.SetAuthURLParam("hd", "ufp.edu.pt")), state
}

// ErrHDRestriction is returned when the account is outside @ufp.edu.pt.
var ErrHDRestriction = errors.New("only @ufp.edu.pt accounts can sign in")

type Identity struct {
	Subject     string
	Email       string
	Name        string
	EmailVerified bool
}

// Exchange validates the callback: state, code exchange, ID token signature,
// email_verified, and the hosted-domain claim (the actual restriction — the
// login hint is cosmetic).
func (f *GoogleFlow) Exchange(ctx context.Context, state, code string) (*Identity, error) {
	f.mu.Lock()
	expiry, ok := f.states[state]
	delete(f.states, state)
	f.mu.Unlock()
	if !ok || time.Now().After(expiry) {
		return nil, errors.New("invalid or expired state")
	}

	token, err := f.oauth.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("code exchange: %w", err)
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		return nil, errors.New("missing id_token")
	}
	idToken, err := f.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("id_token verification: %w", err)
	}

	var claims struct {
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		HD            string `json:"hd"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return nil, err
	}
	if !claims.EmailVerified {
		return nil, errors.New("google account email is not verified")
	}
	if claims.HD != "ufp.edu.pt" {
		return nil, ErrHDRestriction
	}
	return &Identity{Subject: idToken.Subject, Email: claims.Email, Name: claims.Name, EmailVerified: true}, nil
}

// DevLoginBody is accepted only when ALLOW_DEV_LOGIN=true (local/tests).
type DevLoginBody struct {
	Email string `json:"email" binding:"required,email"`
}

// ErrorResponse mirrors the shared envelope for tests of this package.
func ErrorResponse(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": message})
}
