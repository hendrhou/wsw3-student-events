// Package configuration loads and validates environment-driven config.
// Services fail fast at startup when a required variable is missing.
package configuration

import (
	"fmt"
	"os"
	"strconv"
)

// Config is the minimal shared shape every service needs.
type Config struct {
	Port        int
	DatabaseURL string // empty for services without a database (none today, but kept uniform)
	Env         string // "dev" | "prod"
}

// Load reads env vars, applying defaults, and returns an error naming every
// missing required variable.
func Load(required []string) (Config, error) {
	var missing []string
	for _, key := range required {
		if os.Getenv(key) == "" {
			missing = append(missing, key)
		}
	}
	if len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required env vars: %v", missing)
	}

	port := 8080
	if raw := os.Getenv("PORT"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 65535 {
			return Config{}, fmt.Errorf("PORT must be a valid TCP port, got %q", raw)
		}
		port = parsed
	}

	return Config{
		Port:        port,
		DatabaseURL: os.Getenv("DATABASE_URL"),
		Env:         envOr("APP_ENV", "dev"),
	}, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
