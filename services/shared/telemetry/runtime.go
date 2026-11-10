package telemetry

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	otelprom "go.opentelemetry.io/otel/exporters/prometheus"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

type Runtime struct {
	Logger     *slog.Logger
	Tracer     trace.Tracer
	Metrics    http.Handler
	registry   *prometheus.Registry
	provider   *sdktrace.TracerProvider
	meter      *sdkmetric.MeterProvider
	requests   metric.Int64Counter
	duration   metric.Float64Histogram
	inflight   metric.Int64UpDownCounter
	operations metric.Int64Counter
	propagator propagation.TextMapPropagator
}

func New(config Config, output io.Writer) (*Runtime, error) {
	registry := prometheus.NewRegistry()
	registry.MustRegister(collectors.NewGoCollector(), collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))
	exporter, err := otelprom.New(otelprom.WithRegisterer(registry))
	if err != nil {
		return nil, err
	}
	resources := resource.NewSchemaless(attribute.String("service.name", config.Service),
		attribute.String("service.version", config.Version), attribute.String("deployment.environment.name", config.Environment))
	options := []sdktrace.TracerProviderOption{sdktrace.WithResource(resources),
		sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(config.SampleRatio)))}
	if config.Endpoint != "" {
		export, err := otlptracehttp.New(context.Background(), otlptracehttp.WithEndpointURL(config.Endpoint),
			otlptracehttp.WithTimeout(3*time.Second), otlptracehttp.WithRetry(otlptracehttp.RetryConfig{Enabled: false}))
		if err != nil {
			return nil, err
		}
		options = append(options, sdktrace.WithBatcher(export, sdktrace.WithMaxQueueSize(1024)))
	}
	provider := sdktrace.NewTracerProvider(options...)
	meter := sdkmetric.NewMeterProvider(sdkmetric.WithResource(resources), sdkmetric.WithReader(exporter))
	runtime := &Runtime{registry: registry, provider: provider, meter: meter, Tracer: provider.Tracer("campus-pulse"),
		Metrics: promhttp.HandlerFor(registry, promhttp.HandlerOpts{EnableOpenMetrics: true}), propagator: propagation.TraceContext{}}
	runtime.Logger = slog.New(&traceHandler{inner: slog.NewJSONHandler(output, &slog.HandlerOptions{Level: config.Level, ReplaceAttr: redact})}).With(
		"service_name", config.Service, "service_version", config.Version, "environment", config.Environment)
	if err := runtime.instruments(); err != nil {
		_ = runtime.Shutdown(context.Background())
		return nil, err
	}
	return runtime, nil
}

func (runtime *Runtime) instruments() error {
	meter := runtime.meter.Meter("campus-pulse")
	var err error
	runtime.requests, err = meter.Int64Counter("http.server.requests", metric.WithDescription("Completed HTTP requests"))
	if err != nil {
		return err
	}
	runtime.inflight, err = meter.Int64UpDownCounter("http.server.active_requests")
	if err != nil {
		return err
	}
	runtime.duration, err = meter.Float64Histogram("http.server.request.duration", metric.WithUnit("s"),
		metric.WithExplicitBucketBoundaries(.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10))
	if err != nil {
		return err
	}
	runtime.operations, err = meter.Int64Counter("campus.operations")
	return err
}

func (runtime *Runtime) Shutdown(ctx context.Context) error {
	return errors.Join(runtime.provider.Shutdown(ctx), runtime.meter.Shutdown(ctx))
}
