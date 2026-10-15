// semantic-service: integrates sources into RDF and serves the ontology +
// SPARQL (recommendations). Domain: knowledge/recommendation.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	shttp "github.com/hendrhou/wsw3-student-events/services/semantic-service/internal/http"
	"github.com/hendrhou/wsw3-student-events/services/semantic-service/internal/ontology"
	"github.com/hendrhou/wsw3-student-events/services/semantic-service/internal/sparql"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/configuration"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := configuration.Load([]string{"JWT_SECRET", "SPARQL_ENDPOINT", "SPARQL_UPDATE_ENDPOINT"})
	if err != nil {
		logger.Error("configuration invalid", "error", err)
		os.Exit(1)
	}

	ctx := context.Background()
	user := os.Getenv("FUSEKI_USER")
	password := os.Getenv("FUSEKI_PASSWORD")

	// Ensure the dataset exists, then load ontology + seeds on an empty store.
	fusekiBase := strings.TrimSuffix(os.Getenv("SPARQL_ENDPOINT"), "/campus-pulse/sparql")
	if err := waitForFuseki(ctx, fusekiBase, user, password, logger); err != nil {
		logger.Error("fuseki unavailable", "error", err)
		os.Exit(1)
	}
	if err := sparql.EnsureDataset(ctx, fusekiBase, "campus-pulse", user, password); err != nil {
		logger.Error("dataset setup failed", "error", err)
		os.Exit(1)
	}

	client := sparql.NewClient(os.Getenv("SPARQL_ENDPOINT"), os.Getenv("SPARQL_UPDATE_ENDPOINT"), user, password)
	empty, err := client.IsEmpty(ctx)
	if err != nil {
		logger.Error("store check failed", "error", err)
		os.Exit(1)
	}
	if empty {
		if err := client.LoadTurtle(ctx, ontology.OntologyTTL); err != nil {
			logger.Error("ontology load failed", "error", err)
			os.Exit(1)
		}
		if err := client.LoadTurtle(ctx, ontology.SeedEventsTTL); err != nil {
			logger.Error("seed load failed", "error", err)
			os.Exit(1)
		}
		logger.Info("ontology + seeds loaded into empty store")
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
	shttp.RegisterRoutes(router, &shttp.Handlers{
		SPARQL:      client,
		Events:      shttp.NewEventClient(os.Getenv("EVENT_SERVICE_URL")),
		SessionKeys: issuer,
		Logger:      logger,
	})

	logger.Info("semantic-service listening", "port", cfg.Port, "env", cfg.Env)
	if err := router.Run(":" + strconv.Itoa(cfg.Port)); err != nil {
		logger.Error("server failed", "error", err)
		os.Exit(1)
	}
}

// waitForFuseki polls the admin API until Fuseki answers (compose boot order).
func waitForFuseki(ctx context.Context, base, user, password string, logger *slog.Logger) error {
	for i := 0; i < 30; i++ {
		req, err := http.NewRequestWithContext(ctx, "GET", base+"/$/ping", nil)
		if err != nil {
			return err
		}
		if user != "" {
			req.SetBasicAuth(user, password)
		}
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode == 200 {
				return nil
			}
		}
		logger.Info("waiting for fuseki", "attempt", i+1)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
	return errors.New("fuseki did not become ready in 60s")
}
