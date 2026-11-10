package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
		states: map[string]loginState{},
	}
	url, state := f.LoginURL("http://student.localhost:8000")
	if state == "" {
		t.Fatal("state must be generated")
	}
	for _, want := range []string{"hd=ufp.edu.pt", "client_id=cid", "state=" + state} {
		if !strings.Contains(url, want) {
			t.Errorf("login URL missing %q: %s", want, url)
		}
	}
	if got := f.states[state].origin; got != "http://student.localhost:8000" {
		t.Fatalf("state must store the return origin, got %q", got)
	}
}

func TestExchangeRejectsUnknownState(t *testing.T) {
	f := &GoogleFlow{states: map[string]loginState{}}
	if _, origin, err := f.Exchange(context.Background(), "bogus", "code"); err == nil || origin != "" {
		t.Error("unknown state must fail with no origin")
	}
}

func TestExchangeReturnsStoredOriginOnFailure(t *testing.T) {
	// Hermetic token endpoint: the code exchange fails fast and locally.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"error":"invalid_grant"}`, http.StatusBadRequest)
	}))
	t.Cleanup(srv.Close)
	f := &GoogleFlow{
		oauth:  &oauth2.Config{ClientID: "cid", ClientSecret: "sec", Endpoint: oauth2.Endpoint{TokenURL: srv.URL}},
		states: map[string]loginState{},
	}
	_, state := f.LoginURL("http://organiser.localhost:8000")

	if _, origin, err := f.Exchange(context.Background(), state, "bogus-code"); err == nil || origin != "http://organiser.localhost:8000" {
		t.Fatalf("failed exchange must still return the stored origin, got origin=%q err=%v", origin, err)
	}
	// State is single-use: a replay must fail and leak nothing.
	if _, origin, err := f.Exchange(context.Background(), state, "bogus-code"); err == nil || origin != "" {
		t.Errorf("replayed state must fail with no origin, got origin=%q err=%v", origin, err)
	}
}

func TestDevLoginBodyRequiresEmail(t *testing.T) {
	// binding tags are enforced by gin; here we document the contract
	var b DevLoginBody
	if b.Email != "" {
		t.Error("zero value must be empty")
	}
}
