package http

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/event-service/internal/store"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
)

// ---------- fake store ----------

type fakeStore struct {
	events   []store.Event
	adjusted []string
}

func (f *fakeStore) List(_ context.Context, flt store.Filters) ([]store.Event, error) {
	var out []store.Event
	for _, e := range f.events {
		if e.LifecycleStatus != "Published" {
			continue
		}
		if flt.Category != "" && e.Category != flt.Category {
			continue
		}
		if flt.Query != "" && !strings.Contains(strings.ToLower(e.Title), strings.ToLower(flt.Query)) {
			continue
		}
		out = append(out, e)
	}
	return out, nil
}

func (f *fakeStore) Get(_ context.Context, id string) (*store.Event, error) {
	for _, e := range f.events {
		if e.ID == id {
			return &e, nil
		}
	}
	return nil, store.ErrNotFound
}

func (f *fakeStore) ListMine(_ context.Context, organiserID string) ([]store.Event, error) {
	var out []store.Event
	for _, e := range f.events {
		if e.OrganiserID == organiserID {
			out = append(out, e)
		}
	}
	return out, nil
}

func (f *fakeStore) Create(_ context.Context, e *store.Event) (string, error) {
	e.ID = "evt-new"
	f.events = append(f.events, *e)
	return e.ID, nil
}

func (f *fakeStore) Update(_ context.Context, id, organiserID string, e *store.Event) error {
	for i, ev := range f.events {
		if ev.ID == id && ev.OrganiserID == organiserID {
			f.events[i].Title = e.Title
			return nil
		}
	}
	return store.ErrNotFound
}

func (f *fakeStore) AdjustCounters(_ context.Context, id string, usedDelta, checkedInDelta int) error {
	for i, e := range f.events {
		if e.ID == id {
			f.events[i].CapacityUsed += usedDelta
			f.events[i].CheckedIn += checkedInDelta
			f.adjusted = append(f.adjusted, id)
			return nil
		}
	}
	return store.ErrNotFound
}

// ---------- helpers ----------

const testSecret = "test-secret-key-1234567890"

func fixtureEvent() store.Event {
	return store.Event{
		ID: "evt-sparql", Title: "Intro to SPARQL Workshop", Category: "Workshop",
		ShortDescription: "Hands-on SPARQL.", About: "Longer text.",
		Date: time.Date(2026, 10, 24, 0, 0, 0, 0, time.UTC), StartTime: "14:00", EndTime: "16:00",
		Venue: "Building D", CapacityTotal: 60, CapacityUsed: 42, CheckedIn: 41,
		LifecycleStatus: "Published", OrganiserID: "usr_olga", OrganiserName: "Olga Ribeiro",
		Competences: []string{"SPARQL"}, Schedule: []byte(`[{"time":"14:00","item":"Welcome"}]`),
		Topics: []string{"sparql"},
	}
}

func setup(events ...store.Event) *gin.Engine {
	gin.SetMode(gin.TestMode)
	issuer, _ := authx.NewIssuer(testSecret, time.Hour)
	r := gin.New()
	logger := slog.New(slog.NewJSONHandler(&bytes.Buffer{}, nil))
	r.Use(httpx.RequestLogger(logger), httpx.Recovery(logger))
	RegisterRoutes(r, &Handlers{Store: &fakeStore{events: events}, Issuer: issuer, Logger: logger})
	return r
}

func organiserToken(t *testing.T) string {
	issuer, _ := authx.NewIssuer(testSecret, time.Hour)
	token, err := issuer.Issue("usr_olga", "Olga Ribeiro", "olga@ufp.edu.pt", "staff001", "organiser")
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func userToken(t *testing.T) string {
	issuer, _ := authx.NewIssuer(testSecret, time.Hour)
	token, err := issuer.Issue("usr_vitor", "Vítor", "v@ufp.edu.pt", "20220123", "user")
	if err != nil {
		t.Fatal(err)
	}
	return token
}

// ---------- tests ----------

func TestListEventsReturnsContractShape(t *testing.T) {
	r := setup(fixtureEvent())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/events", nil))
	if w.Code != 200 {
		t.Fatalf("got %d", w.Code)
	}
	var out []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil || len(out) != 1 {
		t.Fatalf("bad payload: %v %q", err, w.Body.String())
	}
	e := out[0]
	for _, key := range []string{"id", "title", "category", "date", "startTime", "endTime", "venue", "coverUrl", "capacity", "full"} {
		if _, ok := e[key]; !ok {
			t.Errorf("summary missing contract key %q", key)
		}
	}
	cap := e["capacity"].(map[string]any)
	if cap["used"] != 42.0 || cap["total"] != 60.0 {
		t.Errorf("capacity mismatch: %v", cap)
	}
}

func TestListFiltersReachTheStore(t *testing.T) {
	fs := &fakeStore{events: []store.Event{fixtureEvent()}}
	gin.SetMode(gin.TestMode)
	issuer, _ := authx.NewIssuer(testSecret, time.Hour)
	r := gin.New()
	logger := slog.New(slog.NewJSONHandler(&bytes.Buffer{}, nil))
	r.Use(httpx.RequestLogger(logger))
	RegisterRoutes(r, &Handlers{Store: fs, Issuer: issuer, Logger: logger})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/events?category=Talk", nil))
	var out []map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if len(out) != 0 {
		t.Errorf("category=Talk must filter the Workshop fixture, got %d rows", len(out))
	}
}

func TestGetEventDetailShape(t *testing.T) {
	r := setup(fixtureEvent())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/events/evt-sparql", nil))
	var d map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &d); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"shortDescription", "about", "organiser", "competences", "schedule", "registrationDeadline", "past"} {
		if _, ok := d[key]; !ok {
			t.Errorf("detail missing contract key %q", key)
		}
	}
	if d["organiser"] != "Olga Ribeiro" {
		t.Errorf("organiser mismatch: %v", d["organiser"])
	}
}

func TestGetEvent404(t *testing.T) {
	r := setup()
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/events/nope", nil))
	if w.Code != 404 || !strings.Contains(w.Body.String(), "Event not found") {
		t.Errorf("got %d %q", w.Code, w.Body.String())
	}
}

func TestOrganiserRoutesRequireAuthAndRole(t *testing.T) {
	r := setup(fixtureEvent())

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/organiser/events", nil))
	if w.Code != 401 {
		t.Errorf("no token: expected 401, got %d", w.Code)
	}

	w = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/organiser/events", nil)
	req.Header.Set("Authorization", "Bearer "+userToken(t))
	r.ServeHTTP(w, req)
	if w.Code != 403 {
		t.Errorf("user role: expected 403, got %d", w.Code)
	}

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/organiser/events", nil)
	req.Header.Set("Authorization", "Bearer "+organiserToken(t))
	r.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("organiser: expected 200, got %d", w.Code)
	}
	var out []map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if len(out) != 1 || out[0]["lifecycleStatus"] != "Published" || out[0]["checkedIn"] != 41.0 {
		t.Errorf("organiser DTO mismatch: %v", out)
	}
}

func TestCreateEventValidation(t *testing.T) {
	r := setup()
	body := `{"title":"","shortDescription":"","category":"","date":"","startTime":"","endTime":"","venue":"","online":false,"capacity":0,"waitlist":false,"topics":[]}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/organiser/events", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+organiserToken(t))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 400 {
		t.Errorf("invalid payload: expected 400, got %d", w.Code)
	}
}

func TestCreateEventHappyPath(t *testing.T) {
	r := setup()
	body := `{"title":"New Event","shortDescription":"Short","fullDescription":"","category":"Talk","date":"2026-12-01","startTime":"10:00","endTime":"12:00","venue":"Main Hall","online":false,"capacity":50,"waitlist":true,"topics":["sparql"]}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/organiser/events", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+organiserToken(t))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 201 || !strings.Contains(w.Body.String(), "evt-new") {
		t.Errorf("got %d %q", w.Code, w.Body.String())
	}
}

func TestUpdateEventNotOwned(t *testing.T) {
	r := setup(fixtureEvent())
	body := `{"title":"Changed","shortDescription":"S","fullDescription":"","category":"Talk","date":"2026-12-01","startTime":"10:00","endTime":"12:00","venue":"A","online":false,"capacity":10,"waitlist":false,"topics":["sparql"]}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/api/organiser/events/evt-sparql", strings.NewReader(body))
	issuer, _ := authx.NewIssuer(testSecret, time.Hour)
	other, _ := issuer.Issue("usr_other", "Other", "o@ufp.edu.pt", "", "organiser")
	req.Header.Set("Authorization", "Bearer "+other)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 404 {
		t.Errorf("editing another organiser's event: expected 404, got %d", w.Code)
	}
}

func TestAdjustCounters(t *testing.T) {
	fs := &fakeStore{events: []store.Event{fixtureEvent()}}
	gin.SetMode(gin.TestMode)
	issuer, _ := authx.NewIssuer(testSecret, time.Hour)
	r := gin.New()
	logger := slog.New(slog.NewJSONHandler(&bytes.Buffer{}, nil))
	r.Use(httpx.RequestLogger(logger))
	RegisterRoutes(r, &Handlers{Store: fs, Issuer: issuer, Logger: logger})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/internal/events/evt-sparql/counters", strings.NewReader(`{"usedDelta":1,"checkedInDelta":1}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 204 {
		t.Fatalf("expected 204, got %d", w.Code)
	}
	if fs.events[0].CapacityUsed != 43 || fs.events[0].CheckedIn != 42 {
		t.Errorf("counters not adjusted: %+v", fs.events[0])
	}
}
