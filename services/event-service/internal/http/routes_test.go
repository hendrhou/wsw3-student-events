package http

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
)

func setup() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	logger := slog.New(slog.NewJSONHandler(&bytes.Buffer{}, nil))
	r.Use(httpx.RequestLogger(logger), httpx.Recovery(logger))
	RegisterRoutes(r, logger)
	return r
}

func TestListEventsReturnsArray(t *testing.T) {
	w := httptest.NewRecorder()
	setup().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/events", nil))
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if w.Body.String() != "[]" {
		t.Errorf("stub must return an empty array (frontend expects a list), got %q", w.Body.String())
	}
}

func TestGetEvent404sWithEnvelope(t *testing.T) {
	w := httptest.NewRecorder()
	setup().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/events/nope", nil))
	if w.Code != 404 {
		t.Fatalf("expected 404, got %d", w.Code)
	}
	if body := w.Body.String(); body != `{"message":"Event not found"}` {
		t.Errorf("wrong envelope: %q", body)
	}
}

func TestOrganiserRoutesExist(t *testing.T) {
	r := setup()
	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/api/organiser/events"},
		{http.MethodPost, "/api/organiser/events"},
		{http.MethodPatch, "/api/organiser/events/e1"},
	} {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, nil))
		if w.Code == 404 && tc.method != http.MethodGet {
			t.Errorf("%s %s must be routed (got 404)", tc.method, tc.path)
		}
	}
}
