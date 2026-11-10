package telemetry

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestConfigurationRejectsInvalidValues(t *testing.T) {
	for key, value := range map[string]string{
		"OTEL_TRACES_SAMPLER_ARG": "2", "LOG_LEVEL": "invalid", "OTEL_EXPORTER_OTLP_ENDPOINT": "ftp://example.org",
	} {
		t.Run(key, func(t *testing.T) {
			t.Setenv(key, value)
			if _, err := FromEnv("test"); err == nil {
				t.Fatal("invalid setting accepted")
			}
		})
	}
	t.Setenv("OTEL_TRACES_SAMPLER_ARG", "0.25")
	t.Setenv("LOG_LEVEL", "DEBUG")
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
	config, err := FromEnv("test")
	if err != nil || config.SampleRatio != .25 || config.Level != slog.LevelDebug {
		t.Fatalf("valid config rejected: %v", err)
	}
}

func TestLifecycleExportsTracesAndRedactsLogAttributes(t *testing.T) {
	var exported bool
	collector := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		exported = request.URL.Path == "/v1/traces"
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte("{}"))
	}))
	defer collector.Close()
	var output bytes.Buffer
	runtime, err := New(Config{Service: "test", Endpoint: collector.URL, SampleRatio: 1}, &output)
	if err != nil {
		t.Fatal(err)
	}
	ctx, span := runtime.Tracer.Start(context.Background(), "safe operation")
	runtime.Logger.WithGroup("details").With("email", "private@example.org").ErrorContext(ctx, "lookup failed", "error", errors.New("secret database value"))
	span.End()
	Flush(runtime)
	if !exported || strings.Contains(output.String(), "private@example.org") || strings.Contains(output.String(), "secret database value") {
		t.Fatalf("export or redaction failed: %s", output.String())
	}
}

type failedTransport struct{}

func (failedTransport) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, errors.New("private upstream failure")
}

func TestTransportErrorsAndServerErrorsAreRecorded(t *testing.T) {
	runtime, err := New(Config{Service: "test", SampleRatio: 1}, &bytes.Buffer{})
	if err != nil {
		t.Fatal(err)
	}
	defer Flush(runtime)
	request := httptest.NewRequest("CUSTOM", "http://example.org/private", nil)
	if _, err := runtime.Transport(failedTransport{}).RoundTrip(request); err == nil {
		t.Fatal("transport swallowed application error")
	}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(503) }))
	defer server.Close()
	request = httptest.NewRequest(http.MethodGet, server.URL, nil)
	response, err := runtime.Transport(http.DefaultTransport).RoundTrip(request)
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	router := gin.New()
	router.Use(runtime.Middleware())
	router.GET("/healthz", func(ctx *gin.Context) { ctx.Status(200) })
	router.GET("/broken", func(ctx *gin.Context) { ctx.Status(503) })
	for _, path := range []string{"/healthz", "/broken", "/unknown/private"} {
		router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, path, nil))
	}
}

func TestServiceStartupAndListenerFailure(t *testing.T) {
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
	runtime, err := Start("test")
	if err != nil {
		t.Fatal(err)
	}
	defer Flush(runtime)
	if err := runtime.Serve(gin.New(), "invalid address"); err == nil {
		t.Fatal("listener error was swallowed")
	}
	t.Setenv("LOG_LEVEL", "invalid")
	if _, err := Start("test"); err == nil {
		t.Fatal("invalid startup config accepted")
	}
}

func TestOperationNamesAreBounded(t *testing.T) {
	for route, expected := range map[string]string{
		"/api/events/:id/register": "registration", "/api/organiser/events/:id/check-in": "check_in",
		"/internal/tickets": "ticket_issue", "/internal/tickets/verify": "ticket_verify",
		"/api/recommendations/me": "recommendations", "/api/organiser/events": "event_write",
		"/unknown/secret": "",
	} {
		if actual := operation("POST", route); actual != expected {
			t.Errorf("unexpected operation for %s: %s", route, actual)
		}
	}
	if operation("GET", "/api/organiser/events") != "" {
		t.Fatal("event reads counted as writes")
	}
}