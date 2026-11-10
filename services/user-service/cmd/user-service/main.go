// user-service: users, roles, interests (domain: identity). Hosts the Google
// OIDC sign-in restricted to @ufp.edu.pt, plus a dev-only login for local runs.
package main

import (
	"context"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/configuration"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
	"github.com/hendrhou/wsw3-student-events/services/shared/telemetry"
	"github.com/hendrhou/wsw3-student-events/services/user-service/internal/auth"
	"github.com/hendrhou/wsw3-student-events/services/user-service/internal/http"
	"github.com/hendrhou/wsw3-student-events/services/user-service/internal/store"
)

func main() {
	observability, err := telemetry.Start("user-service")
	if err != nil {
		slog.Error("telemetry configuration invalid", "error", err)
		os.Exit(1)
	}
	defer telemetry.Flush(observability)
	logger := observability.Logger
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
	if err := observability.ObservePool(st.Stats); err != nil {
		logger.Error("database metrics setup failed", "error", err)
		os.Exit(1)
	}
	if err := st.Migrate(ctx); err != nil {
		logger.Error("migrations failed", "error", err)
		os.Exit(1)
	}

	// Bootstrap admins from env: the only way to become admin (the Team screen
	// manages organisers, never admins). Idempotent on every boot.
	for _, email := range strings.Split(os.Getenv("ADMIN_EMAILS"), ",") {
		email = strings.ToLower(strings.TrimSpace(email))
		if email == "" {
			continue
		}
		if _, err := st.SetRoleByEmail(ctx, email, "admin"); err != nil {
			logger.Error("admin bootstrap failed", "error", err)
			os.Exit(1)
		}
		logger.Info("admin provisioned")
	}

	issuer, err := authx.NewIssuer(os.Getenv("JWT_SECRET"), 24*time.Hour)
	if err != nil {
		logger.Error("jwt issuer invalid", "error", err)
		os.Exit(1)
	}

	flow, err := auth.NewGoogleFlow(ctx, auth.GoogleConfig{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  os.Getenv("GOOGLE_REDIRECT_URL"),
	})
	if err != nil {
		logger.Error("oidc setup failed", "error", err)
		os.Exit(1)
	}
	if flow == nil {
		logger.Warn("GOOGLE_CLIENT_ID/SECRET unset — Google sign-in disabled; dev-login only")
	}

	if cfg.Env == "prod" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()
	router.Use(observability.Middleware(), httpx.RequestLogger(logger), httpx.Recovery(logger))
	httpx.Healthz(router)
	http.RegisterRoutes(router, &http.Handlers{
		Store:         st,
		Issuer:        issuer,
		Google:        flow,
		FrontendURL:   envOr("FRONTEND_URL", "http://localhost:3000"),
		AllowDevLogin: os.Getenv("ALLOW_DEV_LOGIN") == "true",
		SemanticURL:   os.Getenv("SEMANTIC_SERVICE_URL"),
		Logger:        logger,
	})

	addr := ":" + strconv.Itoa(cfg.Port)
	logger.Info("user-service listening", "port", cfg.Port, "env", cfg.Env, "devLogin", os.Getenv("ALLOW_DEV_LOGIN") == "true")
	if err := observability.Serve(router, addr); err != nil {
		logger.Error("server failed", "error", err)
		os.Exit(1)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
