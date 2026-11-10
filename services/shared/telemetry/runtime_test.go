package telemetry

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
)

func TestRequestsExportSafeMetricsAndCorrelatedLogs(t *testing.T) {
	var output bytes.Buffer
	runtime, err := New(Config{Service: "test-service", Environment: "test", SampleRatio: 1}, &output)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = runtime.Shutdown(context.Background()) })
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(runtime.Middleware())
	router.GET("/events/:id", func(ctx *gin.Context) {
		runtime.Logger.InfoContext(ctx.Request.Context(), "event read")
		ctx.Status(http.StatusOK)
	})
	request := httptest.NewRequest(http.MethodGet, "/events/private-id?token=secret", nil)
	request.Header.Set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
	router.ServeHTTP(httptest.NewRecorder(), request)
	metrics := httptest.NewRecorder()
	runtime.Metrics.ServeHTTP(metrics, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if !strings.Contains(metrics.Body.String(), `http_route="/events/:id"`) {
		t.Fatalf("missing normalized route: %s", metrics.Body.String())
	}
	if !strings.Contains(output.String(), "4bf92f3577b34da6a3ce929d0e0e4736") {
		t.Fatalf("missing trace correlation: %s", output.String())
	}
	if strings.Contains(metrics.Body.String()+output.String(), "private-id") || strings.Contains(output.String(), "secret") {
		t.Fatal("telemetry leaked request identifiers or query strings")
	}
}

func TestOutboundRequestsPreserveTraceAndDoNotMutateHeaders(t *testing.T) {
	var received string
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		received = request.Header.Get("traceparent")
		writer.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()
	runtime, err := New(Config{Service: "test-service", SampleRatio: 1}, &bytes.Buffer{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = runtime.Shutdown(context.Background()) })
	ctx, span := runtime.Tracer.Start(context.Background(), "parent")
	defer span.End()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/secret?token=private", nil)
	if err != nil {
		t.Fatal(err)
	}
	client := &http.Client{Transport: runtime.Transport(http.DefaultTransport)}
	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if !strings.Contains(received, trace.SpanContextFromContext(ctx).TraceID().String()) {
		t.Fatalf("trace not propagated: %q", received)
	}
	if request.Header.Get("traceparent") != "" {
		t.Fatal("transport mutated caller headers")
	}
}

func TestDomainOutcomesAndDatabaseMetrics(t *testing.T) {
	runtime, err := New(Config{Service: "test", SampleRatio: 1}, &bytes.Buffer{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = runtime.Shutdown(context.Background()) })
	if err := runtime.ObservePool(func() PoolStats { return PoolStats{Acquired: 2, Idle: 3, Total: 5, Max: 10} }); err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.Use(runtime.Middleware())
	router.POST("/api/events/:id/register", func(ctx *gin.Context) { ctx.Status(409) })
	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/events/private/register", nil))
	metrics := httptest.NewRecorder()
	runtime.Metrics.ServeHTTP(metrics, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	for _, expected := range []string{`campus_operations_total\{[^}]*operation="registration"[^}]*outcome="rejected"[^}]*\} 1`, `campus_db_connections\{state="acquired"\} 2`} {
		if !regexp.MustCompile(expected).MatchString(metrics.Body.String()) {
			t.Errorf("missing metric %s: %s", expected, metrics.Body.String())
		}
	}
}
