package telemetry

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

func (runtime *Runtime) Middleware() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		route := ctx.FullPath()
		if route == "" {
			route = "unmatched"
		}
		if route == "/healthz" || route == "/metrics" {
			ctx.Next()
			return
		}
		method := safeMethod(ctx.Request.Method)
		parent := runtime.propagator.Extract(ctx.Request.Context(), propagation.HeaderCarrier(ctx.Request.Header))
		attrs := []attribute.KeyValue{attribute.String("http.route", route), attribute.String("http.request.method", method)}
		requestCtx, span := runtime.Tracer.Start(parent, method+" "+route, trace.WithSpanKind(trace.SpanKindServer), trace.WithAttributes(attrs...))
		defer span.End()
		ctx.Request = ctx.Request.WithContext(requestCtx)
		runtime.inflight.Add(requestCtx, 1, metric.WithAttributes(attrs...))
		start := time.Now()
		ctx.Next()
		runtime.inflight.Add(requestCtx, -1, metric.WithAttributes(attrs...))
		status := ctx.Writer.Status()
		attrs = append(attrs, attribute.Int("http.response.status_code", status))
		span.SetAttributes(attribute.Int("http.response.status_code", status))
		if status >= 500 {
			span.SetStatus(codes.Error, "server error")
		}
		runtime.requests.Add(requestCtx, 1, metric.WithAttributes(attrs...))
		runtime.duration.Record(requestCtx, time.Since(start).Seconds(), metric.WithAttributes(attrs...))
		runtime.recordOperation(requestCtx, method, route, status)
	}
}

func safeMethod(method string) string {
	switch method {
	case "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE":
		return method
	default:
		return "OTHER"
	}
}

type transport struct {
	runtime *Runtime
	base    http.RoundTripper
}

func (runtime *Runtime) Transport(base http.RoundTripper) http.RoundTripper {
	return &transport{runtime: runtime, base: base}
}

func (client *transport) RoundTrip(request *http.Request) (*http.Response, error) {
	method := safeMethod(request.Method)
	ctx, span := client.runtime.Tracer.Start(request.Context(), method+" "+request.URL.Hostname(),
		trace.WithSpanKind(trace.SpanKindClient), trace.WithAttributes(
			attribute.String("http.request.method", method), attribute.String("server.address", request.URL.Hostname())))
	defer span.End()
	copy := request.Clone(ctx)
	client.runtime.propagator.Inject(ctx, propagation.HeaderCarrier(copy.Header))
	response, err := client.base.RoundTrip(copy)
	if err != nil {
		span.SetStatus(codes.Error, "upstream unavailable")
	} else {
		span.SetAttributes(attribute.Int("http.response.status_code", response.StatusCode))
		if response.StatusCode >= 500 {
			span.SetStatus(codes.Error, "upstream error")
		}
	}
	return response, err
}

func Flush(runtime *Runtime) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := runtime.Shutdown(ctx); err != nil {
		runtime.Logger.Warn("telemetry shutdown incomplete")
	}
}
