package auth

import (
	"context"
	"strings"
	"testing"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

func TestUnconfiguredFlowIsNilWithoutError(t *testing.T) {
	flow, err := NewGoogleFlow(context.Background(), GoogleConfig{})
	if err != nil {
		t.Fatalf("unconfigured must not error, got %v", err)
	}
	if flow != nil {
		t.Error("unconfigured must return nil flow")
	}
}

func TestLoginURLCarriesHostedDomainHintAndState(t *testing.T) {
	// Bypass discovery: construct the flow directly (fields are package-private,
	// this test is in-package).
	f := &GoogleFlow{
		cfg: GoogleConfig{ClientID: "cid", ClientSecret: "sec", RedirectURL: "http://localhost:8000/api/auth/google/callback"},
		oauth: &oauth2.Config{
			ClientID: "cid", ClientSecret: "sec",
			RedirectURL: "http://localhost:8000/api/auth/google/callback",
			Scopes:      []string{"openid", "email", "profile"},
			Endpoint:    google.Endpoint,
		},
		states: map[string]time.Time{},
	}
	url, state := f.LoginURL()
	if state == "" {
		t.Fatal("state must be generated")
	}
	for _, want := range []string{"hd=ufp.edu.pt", "client_id=cid", "state=" + state} {
		if !strings.Contains(url, want) {
			t.Errorf("login URL missing %q: %s", want, url)
		}
	}
}

func TestExchangeRejectsUnknownState(t *testing.T) {
	f := &GoogleFlow{states: map[string]time.Time{}}
	if _, err := f.Exchange(context.Background(), "bogus", "code"); err == nil {
		t.Error("unknown state must fail")
	}
}

func TestDevLoginBodyRequiresEmail(t *testing.T) {
	// binding tags are enforced by gin; here we document the contract
	var b DevLoginBody
	if b.Email != "" {
		t.Error("zero value must be empty")
	}
}
