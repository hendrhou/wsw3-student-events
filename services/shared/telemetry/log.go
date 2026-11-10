package telemetry

import (
	"context"
	"fmt"
	"log/slog"

	"go.opentelemetry.io/otel/trace"
)

type traceHandler struct {
	inner slog.Handler
}

func redact(_ []string, attr slog.Attr) slog.Attr {
	switch attr.Key {
	case "email", "by", "to", "event", "bookingRef", "token", "authorization", "cookie", "studentNumber":
		return slog.Attr{}
	case "error":
		return slog.String("error_type", fmt.Sprintf("%T", attr.Value.Any()))
	default:
		return attr
	}
}

func (handler *traceHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return handler.inner.Enabled(ctx, level)
}

func (handler *traceHandler) Handle(ctx context.Context, record slog.Record) error {
	copy := record.Clone()
	span := trace.SpanContextFromContext(ctx)
	if span.IsValid() {
		copy.AddAttrs(slog.String("trace_id", span.TraceID().String()), slog.String("span_id", span.SpanID().String()))
	}
	return handler.inner.Handle(ctx, copy)
}

func (handler *traceHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &traceHandler{inner: handler.inner.WithAttrs(attrs)}
}

func (handler *traceHandler) WithGroup(name string) slog.Handler {
	return &traceHandler{inner: handler.inner.WithGroup(name)}
}
