package httpx

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func testRouter(logger *slog.Logger) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestLogger(logger), Recovery(logger))
	Healthz(r)
	return r
}

func TestRequestLoggerEmitsOneLinePerRequest(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	r := testRouter(logger)
	r.GET("/api/things", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/things", nil)
	r.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var entry map[string]any
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("log line is not JSON: %v", err)
	}
	if entry["path"] != "/api/things" || entry["status"] != float64(200) {
		t.Errorf("unexpected log entry: %v", entry)
	}
}

func TestErrorEnvelopeMatchesFrontendContract(t *testing.T) {
	r := testRouter(slog.New(slog.NewJSONHandler(&bytes.Buffer{}, nil)))
	r.GET("/missing", func(c *gin.Context) { NotFound(c, "Event") })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/missing", nil))

	if w.Code != 404 {
		t.Fatalf("expected 404, got %d", w.Code)
	}
	var body ErrorBody
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("error body is not the envelope: %v", err)
	}
	if body.Message != "Event not found" {
		t.Errorf("unexpected message: %q", body.Message)
	}
}

func TestRecoveryReturnsEnvelopeOnPanic(t *testing.T) {
	var buf bytes.Buffer
	r := testRouter(slog.New(slog.NewJSONHandler(&buf, nil)))
	r.GET("/boom", func(c *gin.Context) { panic("kaboom") })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/boom", nil))

	if w.Code != 500 {
		t.Fatalf("expected 500, got %d", w.Code)
	}
	var body ErrorBody
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || body.Message != "internal error" {
		t.Errorf("panic must surface the generic envelope, got %q", w.Body.String())
	}
	if !bytes.Contains(buf.Bytes(), []byte("kaboom")) {
		t.Error("panic detail must be logged, not sent to the client")
	}
}

func TestHealthz(t *testing.T) {
	r := testRouter(slog.New(slog.NewJSONHandler(&bytes.Buffer{}, nil)))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
