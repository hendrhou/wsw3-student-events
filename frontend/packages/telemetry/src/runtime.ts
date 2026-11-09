import { resourceFromAttributes } from "@opentelemetry/resources";
import { TracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { onCLS, onINP, onLCP } from "web-vitals";
import { normalizeRoute, surface } from "./routes";

export interface TelemetryConfig {
  gatewayUrl: string;
  enabled: boolean;
  version?: string;
  environment?: string;
}

const batch = { maxQueueSize: 128, maxExportBatchSize: 32, scheduledDelayMillis: 5000, exportTimeoutMillis: 3000 };

export function createRuntime(config: TelemetryConfig) {
  const gateway = new URL(config.gatewayUrl, location.origin);
  const endpoint = `${gateway.origin}/api/telemetry/v1`;
  const resource = resourceFromAttributes({
    "service.name": "campus-pulse-browser", "service.version": config.version ?? "dev",
    "deployment.environment.name": config.environment ?? "dev",
  });
  const traces = new TracerProvider({ resource, spanProcessors: [new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url: `${endpoint}/traces`, timeoutMillis: 3000 }), ...batch })] });
  const logs = new LoggerProvider({ resource, processors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: `${endpoint}/logs`, timeoutMillis: 3000 }), ...batch })] });
  const metrics = new MeterProvider({ resource, readers: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter({ url: `${endpoint}/metrics`, timeoutMillis: 3000 }), exportIntervalMillis: 15000, exportTimeoutMillis: 3000 })] });
  const meter = metrics.getMeter("campus-pulse-browser");
  const runtime = {
    lastRoute: "",
    gateway, traces, logs, metrics, tracer: traces.getTracer("campus-pulse-browser"), logger: logs.getLogger("campus-pulse-browser"),
    duration: meter.createHistogram("browser.api.duration", { unit: "s", advice: { explicitBucketBoundaries: [.01, .05, .1, .25, .5, 1, 2.5, 5, 10] } }),
    errors: meter.createCounter("browser.errors"), navigations: meter.createCounter("browser.navigations"),
  };
  for (const [name, register, unit] of [["lcp", onLCP, "ms"], ["inp", onINP, "ms"], ["cls", onCLS, "1"]] as const) {
    const histogram = meter.createHistogram(`browser.web_vital.${name}`, { unit });
    register((value) => histogram.record(value.value, { mfe: surface(), route: normalizeRoute(location.pathname) }));
  }
  return runtime;
}

export type BrowserRuntime = ReturnType<typeof createRuntime>;