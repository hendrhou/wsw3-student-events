// event-service: events, dates, locations, capacities (domain: event catalogue).
// Phase 1 scope: config, logging, health probe, and the router shell with
// /api/events wired to a stub store — persistence lands in the next phase.
package main

import (
	"context"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/event-service/internal/http"
	"github.com/hendrhou/wsw3-student-events/services/event-service/internal/store"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/configuration"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := configuration.Load([]string{"DATABASE_URL", "JWT_SECRET"})
	if err != nil {
		logger.Error("configuration invalid", "error", err)
		os.Exit(1)
	}

	ctx := context.Background()
	st, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database unavailable", "error", err)
		os.Exit(1)
	}
	defer st.Close()
	if err := st.Migrate(ctx); err != nil {
		logger.Error("migrations failed", "error", err)
		os.Exit(1)
	}

	issuer, err := authx.NewIssuer(os.Getenv("JWT_SECRET"), 24*time.Hour)
	if err != nil {
		logger.Error("jwt issuer invalid", "error", err)
		os.Exit(1)
	}

	if cfg.Env == "prod" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()
	router.Use(httpx.RequestLogger(logger), httpx.Recovery(logger))
	httpx.Healthz(router)
	http.RegisterRoutes(router, &http.Handlers{
		Store:       st,
		Issuer:      issuer,
		Logger:      logger,
		SemanticURL: os.Getenv("SEMANTIC_SERVICE_URL"),
	})

	logger.Info("event-service listening", "port", cfg.Port, "env", cfg.Env)
	if err := router.Run(":" + strconv.Itoa(cfg.Port)); err != nil {
		logger.Error("server failed", "error", err)
		os.Exit(1)
	}
}
