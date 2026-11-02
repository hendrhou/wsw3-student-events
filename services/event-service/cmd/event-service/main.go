// event-service: events, dates, locations, capacities (domain: event catalogue).
// Phase 1 scope: config, logging, health probe, and the router shell with
// /api/events wired to a stub store — persistence lands in the next phase.
package main

import (
	"log/slog"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/shared/configuration"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
	"github.com/hendrhou/wsw3-student-events/services/event-service/internal/http"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := configuration.Load(nil)
	if err != nil {
		logger.Error("configuration invalid", "error", err)
		os.Exit(1)
	}

	if cfg.Env == "prod" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()
	router.Use(httpx.RequestLogger(logger), httpx.Recovery(logger))
	httpx.Healthz(router)
	http.RegisterRoutes(router, logger)

	logger.Info("event-service listening", "port", cfg.Port, "env", cfg.Env)
	if err := router.Run(":" + strconv.Itoa(cfg.Port)); err != nil {
		logger.Error("server failed", "error", err)
		os.Exit(1)
	}
}
