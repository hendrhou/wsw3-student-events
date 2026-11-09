package telemetry

import (
	"fmt"
	"log/slog"
	"math"
	"net/url"
	"os"
	"strconv"
)

type Config struct {
	Service     string
	Version     string
	Environment string
	Endpoint    string
	SampleRatio float64
	Level       slog.Level
}

func FromEnv(service string) (Config, error) {
	config := Config{Service: service, Version: os.Getenv("APP_VERSION"), Environment: os.Getenv("APP_ENV"),
		Endpoint: os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"), SampleRatio: 1}
	if raw := os.Getenv("OTEL_TRACES_SAMPLER_ARG"); raw != "" {
		ratio, err := strconv.ParseFloat(raw, 64)
		if err != nil || math.IsNaN(ratio) || ratio < 0 || ratio > 1 {
			return Config{}, fmt.Errorf("OTEL_TRACES_SAMPLER_ARG must be between 0 and 1")
		}
		config.SampleRatio = ratio
	}
	if raw := os.Getenv("LOG_LEVEL"); raw != "" {
		if err := config.Level.UnmarshalText([]byte(raw)); err != nil {
			return Config{}, fmt.Errorf("LOG_LEVEL must be DEBUG, INFO, WARN or ERROR")
		}
	}
	if config.Endpoint != "" {
		endpoint, err := url.Parse(config.Endpoint)
		if err != nil || endpoint.Host == "" || (endpoint.Scheme != "http" && endpoint.Scheme != "https") || endpoint.User != nil {
			return Config{}, fmt.Errorf("OTEL_EXPORTER_OTLP_ENDPOINT must be an HTTP(S) URL without credentials")
		}
	}
	return config, nil
}
