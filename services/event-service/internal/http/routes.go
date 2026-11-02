// Package http wires the REST surface. Paths match gateway/kong.yml and the
// frontend contract (frontend/packages/api/src/endpoints.ts).
package http

import (
	"log/slog"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
)

// RegisterRoutes attaches every event-service endpoint. Handlers are stubs in
// this phase — they exist so the route table, middleware chain and gateway
// wiring are testable before persistence lands.
func RegisterRoutes(r *gin.Engine, logger *slog.Logger) {
	r.GET("/api/events", func(c *gin.Context) {
		// Stub: the real handler returns filtered, upcoming-only events.
		c.JSON(200, []any{})
	})
	r.GET("/api/events/:id", func(c *gin.Context) {
		httpx.NotFound(c, "Event")
	})
	r.GET("/api/organiser/events", func(c *gin.Context) {
		c.JSON(200, []any{})
	})
	r.POST("/api/organiser/events", func(c *gin.Context) {
		httpx.Abort(c, 501, "event creation lands with persistence")
	})
	r.PATCH("/api/organiser/events/:id", func(c *gin.Context) {
		httpx.Abort(c, 501, "event editing lands with persistence")
	})
}
