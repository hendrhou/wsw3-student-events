import { ROOT_CONTEXT, SpanStatusCode, trace } from "@opentelemetry/api";
import { createRuntime, type BrowserRuntime, type TelemetryConfig } from "./runtime";
import { normalizeRoute, surface } from "./routes";

export { normalizeRoute } from "./routes";
export type { TelemetryConfig } from "./runtime";

const globals = globalThis as typeof globalThis & { __campusPulseTelemetryV1?: BrowserRuntime };

export function initializeTelemetry(config: TelemetryConfig): BrowserRuntime | undefined {
  if (!config.enabled) return undefined;
  if (globals.__campusPulseTelemetryV1) return globals.__campusPulseTelemetryV1;
  const runtime = createRuntime(config);
  globals.__campusPulseTelemetryV1 = runtime;
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("pagehide", onPageHide);
  recordNavigation(location.pathname);
  return runtime;
}

function onError() { recordError("uncaught_error"); }
function onRejection() { recordError("unhandled_rejection"); }
function onPageHide() { void flushTelemetry(); }

export function recordError(kind: "uncaught_error" | "unhandled_rejection" | "network_error") {
  const runtime = globals.__campusPulseTelemetryV1;
  if (!runtime) return;
  const attributes = { mfe: surface(), route: normalizeRoute(location.pathname), "error.type": kind };
  const span = runtime.tracer.startSpan("browser.error", { attributes });
  span.setStatus({ code: SpanStatusCode.ERROR });
  runtime.errors.add(1, attributes);
  runtime.logger.emit({ context: trace.setSpan(ROOT_CONTEXT, span), severityNumber: 17, severityText: "ERROR", body: JSON.stringify({ msg: kind, trace_id: span.spanContext().traceId, ...attributes }), attributes });
  span.end();
}

export function recordNavigation(path: string) {
  const runtime = globals.__campusPulseTelemetryV1;
  if (!runtime) return;
  const attributes = { mfe: surface(path), route: normalizeRoute(path) };
  if (runtime.lastRoute === attributes.route) return;
  runtime.lastRoute = attributes.route;
  runtime.navigations.add(1, attributes);
  runtime.tracer.startSpan("navigation", { attributes }).end();
}

export async function instrumentedFetch(url: URL, options: RequestInit): Promise<Response> {
  const runtime = globals.__campusPulseTelemetryV1;
  if (!runtime || url.origin !== runtime.gateway.origin || !url.pathname.startsWith(`${runtime.gateway.pathname.replace(/\/$/, "")}/`)) return fetch(url, options);
  const method = ["GET", "POST", "PATCH", "PUT", "DELETE"].includes(options.method ?? "GET") ? options.method ?? "GET" : "OTHER";
  const attributes = { mfe: surface(), "http.route": normalizeRoute(url.pathname), "http.request.method": method };
  const span = runtime.tracer.startSpan(`${method} ${attributes["http.route"]}`, { attributes });
  const context = span.spanContext();
  const headers = new Headers(options.headers);
  headers.set("traceparent", `00-${context.traceId}-${context.spanId}-${context.traceFlags.toString(16).padStart(2, "0")}`);
  const start = performance.now();
  try {
    const response = await fetch(url, { ...options, headers });
    span.setAttribute("http.response.status_code", response.status);
    if (response.status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
    runtime.duration.record((performance.now() - start) / 1000, { ...attributes, "http.response.status_code": response.status });
    return response;
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    runtime.duration.record((performance.now() - start) / 1000, { ...attributes, "http.response.status_code": 0 });
    runtime.errors.add(1, { ...attributes, "error.type": "network_error" });
    runtime.logger.emit({ context: trace.setSpan(ROOT_CONTEXT, span), severityNumber: 17, severityText: "ERROR", body: JSON.stringify({ msg: "network_error", trace_id: context.traceId, mfe: attributes.mfe, route: attributes["http.route"] }), attributes });
    throw error;
  } finally {
    span.end();
  }
}

export async function flushTelemetry() {
  const runtime = globals.__campusPulseTelemetryV1;
  if (runtime) await Promise.allSettled([runtime.traces.forceFlush(), runtime.logs.forceFlush(), runtime.metrics.forceFlush()]);
}

export async function shutdownTelemetry() {
  const runtime = globals.__campusPulseTelemetryV1;
  delete globals.__campusPulseTelemetryV1;
  window.removeEventListener("error", onError);
  window.removeEventListener("unhandledrejection", onRejection);
  window.removeEventListener("pagehide", onPageHide);
  if (runtime) await Promise.allSettled([runtime.traces.shutdown(), runtime.logs.shutdown(), runtime.metrics.shutdown()]);
}