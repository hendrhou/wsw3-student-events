package telemetry

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

func operation(method, route string) string {
	switch route {
	case "/api/events/:id/register":
		return "registration"
	case "/api/organiser/events/:id/check-in":
		return "check_in"
	case "/internal/tickets":
		return "ticket_issue"
	case "/api/tickets/verify", "/internal/tickets/verify":
		return "ticket_verify"
	case "/api/recommendations/me":
		return "recommendations"
	case "/api/organiser/events", "/api/organiser/events/:id":
		if method == "POST" || method == "PATCH" {
			return "event_write"
		}
	}
	return ""
}

func (runtime *Runtime) recordOperation(ctx context.Context, method, route string, status int) {
	name := operation(method, route)
	if name == "" {
		return
	}
	outcome := "success"
	if status >= 500 {
		outcome = "failure"
	} else if status >= 400 {
		outcome = "rejected"
	}
	runtime.operations.Add(ctx, 1, metric.WithAttributes(attribute.String("operation", name), attribute.String("outcome", outcome)))
}
