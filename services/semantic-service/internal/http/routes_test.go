package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/semantic-service/internal/sparql"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
)

type fakeSPARQL struct {
	rows    []sparql.Binding
	err     error
	loaded  []string
	queries []string
}

func (f *fakeSPARQL) Select(_ context.Context, query string) ([]sparql.Binding, error) {
	f.queries = append(f.queries, query)
	return f.rows, f.err
}

func (f *fakeSPARQL) LoadTurtle(_ context.Context, turtle string) error {
	f.loaded = append(f.loaded, turtle)
	return f.err
}

type fakeEvents struct {
	events map[string]map[string]any
}

func (f *fakeEvents) GetEvent(_ context.Context, id string) (map[string]any, error) {
	if e, ok := f.events[id]; ok {
		return e, nil
	}
	return nil, errors.New("not found")
}

const testSecret = "test-secret-key-1234567890"

func setup(sp SPARQL, ev EventClient) *gin.Engine {
	gin.SetMode(gin.TestMode)
	issuer, _ := authx.NewIssuer(testSecret, time.Hour)
	logger := slog.New(slog.NewJSONHandler(&bytes.Buffer{}, nil))
	r := gin.New()
	r.Use(httpx.RequestLogger(logger), httpx.Recovery(logger))
	RegisterRoutes(r, &Handlers{SPARQL: sp, Events: ev, SessionKeys: issuer, Logger: logger})
	return r
}

func userToken(t *testing.T) string {
	issuer, _ := authx.NewIssuer(testSecret, time.Hour)
	tok, err := issuer.Issue("usr_vitor", "Vítor", "v@ufp.edu.pt", "20220123", "user")
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func TestSearchInterestsReturnsContractShape(t *testing.T) {
	sp := &fakeSPARQL{rows: []sparql.Binding{
		{"topic": "https://campus-pulse.ufp.pt/ontology#SemanticWeb", "label": "Semantic Web"},
	}}
	r := setup(sp, &fakeEvents{})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/ontology/interests?q=sem", nil))
	var out []map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil || len(out) != 1 {
		t.Fatalf("got %v %q", err, w.Body.String())
	}
	if out[0]["value"] != "semantic-web" || out[0]["label"] != "Semantic Web" || !strings.HasSuffix(out[0]["uri"], "#SemanticWeb") {
		t.Errorf("DTO mismatch: %v", out[0])
	}
	if !strings.Contains(sp.queries[0], "sem") {
		t.Errorf("query must carry the search text")
	}
}

func TestRecommendationsJoinCatalogueAndExplain(t *testing.T) {
	sp := &fakeSPARQL{rows: []sparql.Binding{
		{"event": "https://campus-pulse.ufp.pt/events/evt-sparql", "title": "Intro to SPARQL Workshop", "topicLabel": "Semantic Web"},
		{"event": "https://campus-pulse.ufp.pt/events/evt-gone", "title": "Ghost", "topicLabel": "Web 3.0"},
	}}
	ev := &fakeEvents{events: map[string]map[string]any{
		"evt-sparql": {"id": "evt-sparql", "title": "Intro to SPARQL Workshop", "capacity": map[string]any{"used": 42, "total": 60}},
	}}
	r := setup(sp, ev)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/recommendations/me", nil)
	req.Header.Set("Authorization", "Bearer "+userToken(t))
	r.ServeHTTP(w, req)

	var out []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out) != 1 {
		t.Fatalf("ghost events must be skipped: %v", out)
	}
	if out[0]["matchReason"] != "Semantic Web" {
		t.Errorf("matchReason wrong: %v", out[0])
	}
	explanation, _ := out[0]["explanation"].(string)
	if !strings.Contains(explanation, "Semantic Web") {
		t.Errorf("explanation must be plain language: %q", explanation)
	}
	event := out[0]["event"].(map[string]any)
	if event["id"] != "evt-sparql" {
		t.Errorf("event summary not joined: %v", event)
	}
	// the query must target the authenticated user
	if !strings.Contains(sp.queries[0], "users/usr_vitor") {
		t.Errorf("query must be scoped to the caller: %q", sp.queries[0])
	}
}

func TestRecommendationsRequireAuth(t *testing.T) {
	r := setup(&fakeSPARQL{}, &fakeEvents{})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/recommendations/me", nil))
	if w.Code != 401 {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestIngestEventWritesTurtle(t *testing.T) {
	sp := &fakeSPARQL{}
	r := setup(sp, &fakeEvents{})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/internal/ingest/event", strings.NewReader(
		`{"id":"evt-x","title":"New Event","category":"Talk","date":"2026-12-01","venue":"Hall","topics":["semantic-web","web3"]}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 204 {
		t.Fatalf("expected 204, got %d", w.Code)
	}
	if len(sp.loaded) != 1 {
		t.Fatal("no turtle written")
	}
	ttl := sp.loaded[0]
	for _, want := range []string{"cp:Event", `"New Event"`, "cp:hasTopic cp:SemanticWeb", "cp:hasTopic cp:Web3"} {
		if !strings.Contains(ttl, want) {
			t.Errorf("turtle missing %q:\n%s", want, ttl)
		}
	}
}

func TestIngestInterestsWritesTurtle(t *testing.T) {
	sp := &fakeSPARQL{}
	r := setup(sp, &fakeEvents{})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/internal/ingest/interests", strings.NewReader(
		`{"userId":"usr_vitor","interestUris":["https://campus-pulse.ufp.pt/ontology#SemanticWeb"]}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 204 {
		t.Fatalf("expected 204, got %d", w.Code)
	}
	if !strings.Contains(sp.loaded[0], "users/usr_vitor") || !strings.Contains(sp.loaded[0], "cp:SemanticWeb") {
		t.Errorf("turtle wrong: %s", sp.loaded[0])
	}
}

func TestSearchInterestsStoreDown502(t *testing.T) {
	sp := &fakeSPARQL{err: errors.New("connection refused")}
	r := setup(sp, &fakeEvents{})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/ontology/interests?q=x", nil))
	if w.Code != 502 {
		t.Errorf("expected 502, got %d", w.Code)
	}
}
