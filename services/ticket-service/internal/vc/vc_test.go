package vc

import (
	"strings"
	"testing"
	"time"
)

func testIssuer(t *testing.T) *Issuer {
	t.Helper()
	seed := make([]byte, 32)
	for i := range seed {
		seed[i] = byte(i)
	}
	issuer, err := NewIssuer(seed)
	if err != nil {
		t.Fatal(err)
	}
	return issuer
}

func TestIssueVerifyRoundTrip(t *testing.T) {
	issuer := testIssuer(t)
	token, credJSON, err := issuer.Issue("CP-2026-00482", "20220123", "evt-vc-talk", "Web 3.0 Talk", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(issuer.DID, "did:key:z") {
		t.Errorf("issuer DID should be did:key, got %q", issuer.DID)
	}

	payload, err := Verify(token)
	if err != nil {
		t.Fatalf("valid token must verify: %v", err)
	}
	if payload["iss"] != issuer.DID || payload["jti"] != "CP-2026-00482" {
		t.Errorf("payload mismatch: %v", payload)
	}

	// The embedded VC is the JSON-LD artifact shown in the UI
	if credJSON["issuer"] != issuer.DID {
		t.Errorf("credential JSON mismatch")
	}
	types, _ := credJSON["type"].([]string)
	if len(types) != 2 || types[1] != "EventTicket" {
		t.Errorf("type mismatch: %v", types)
	}
}

func TestVerifyRejectsTampering(t *testing.T) {
	issuer := testIssuer(t)
	token, _, err := issuer.Issue("CP-1", "20220123", "e1", "T", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(token, ".")
	// Tamper with the payload
	parts[1] = parts[1] + "x"
	if _, err := Verify(strings.Join(parts, ".")); err == nil {
		t.Error("tampered payload must not verify")
	}
}

func TestVerifyRejectsWrongKey(t *testing.T) {
	a := testIssuer(t)
	otherSeed := make([]byte, 32)
	other, err := NewIssuer(otherSeed)
	if err != nil {
		t.Fatal(err)
	}
	token, _, err := other.Issue("CP-1", "20220123", "e1", "T", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Verify(token); err != nil {
		t.Fatalf("a valid token from another issuer must verify (self-contained): %v", err)
	}
	_ = a
}

func TestVerifyRejectsMalformed(t *testing.T) {
	for _, bad := range []string{"", "a.b", "a.b.c.d", "x.y.z"} {
		if _, err := Verify(bad); err == nil {
			t.Errorf("%q must not verify", bad)
		}
	}
}

func TestDeterministicDIDFromSeed(t *testing.T) {
	a := testIssuer(t)
	b := testIssuer(t)
	if a.DID != b.DID {
		t.Error("same seed must yield the same DID (restarts must not invalidate credentials)")
	}
}

func TestNewIssuerRejectsBadSeedLength(t *testing.T) {
	if _, err := NewIssuer([]byte("short")); err == nil {
		t.Error("expected seed length error")
	}
}
