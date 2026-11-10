// ticket-service: issues and verifies digital tickets as verifiable
// credentials (the Web 3.0 component). Ed25519 VC-JWTs with a did:key issuer.
package main

import (
	"context"
	"encoding/hex"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/configuration"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
	"github.com/hendrhou/wsw3-student-events/services/ticket-service/internal/http"
	"github.com/hendrhou/wsw3-student-events/services/ticket-service/internal/store"
	"github.com/hendrhou/wsw3-student-events/services/ticket-service/internal/vc"
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

	issuer := vcIssuer(logger)
	sessionKeys, err := authx.NewIssuer(os.Getenv("JWT_SECRET"), 24*time.Hour)
	if err != nil {
		logger.Error("jwt issuer invalid", "error", err)
		os.Exit(1)
	}

	handlers := &http.Handlers{
		Store:         st,
		Issuer:        issuer,
		SessionKeys:   sessionKeys,
		Logger:        logger,
		PublicBaseURL: envOr("PUBLIC_BASE_URL", "http://localhost:8000"),
	}

	// Sign any seeded-but-unsigned tickets (proves issuance on fresh envs).
	if err := handlers.SignUnsigned(ctx); err != nil {
		logger.Error("seed signing failed", "error", err)
		os.Exit(1)
	}

	if cfg.Env == "prod" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()
	router.Use(httpx.RequestLogger(logger), httpx.Recovery(logger))
	httpx.Healthz(router)
	http.RegisterRoutes(router, handlers)

	logger.Info("ticket-service listening", "port", cfg.Port, "env", cfg.Env, "issuer", issuer.DID)
	if err := router.Run(":" + strconv.Itoa(cfg.Port)); err != nil {
		logger.Error("server failed", "error", err)
		os.Exit(1)
	}
}

// vcIssuer builds the signing identity from VC_SIGNING_SEED (hex). When unset
// (dev), a deterministic seed keeps the DID stable across restarts; prod must
// set the env var (Secrets Manager in AWS).
func vcIssuer(logger *slog.Logger) *vc.Issuer {
	if raw := os.Getenv("VC_SIGNING_SEED"); raw != "" {
		seed, err := hex.DecodeString(raw)
		if err != nil || len(seed) != 32 {
			logger.Error("VC_SIGNING_SEED must be 64 hex chars", "error", err)
			os.Exit(1)
		}
		issuer, err := vc.NewIssuer(seed)
		if err != nil {
			logger.Error("vc issuer invalid", "error", err)
			os.Exit(1)
		}
		return issuer
	}
	// Dev default: deterministic, documented as not-a-secret.
	devSeed := make([]byte, 32)
	for i := range devSeed {
		devSeed[i] = byte(i + 1)
	}
	issuer, err := vc.NewIssuer(devSeed)
	if err != nil {
		logger.Error("vc issuer invalid", "error", err)
		os.Exit(1)
	}
	logger.Warn("VC_SIGNING_SEED unset — using the deterministic dev identity", "did", issuer.DID)
	return issuer
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
