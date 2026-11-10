import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const directory = new URL("./grafana/dashboards/", import.meta.url);
const selector = 'service_name=~"$service",environment=~"$environment"';
const browser = 'service_name="campus-pulse-browser",mfe=~"$mfe"';
const requestRate = `sum by (service_name) (rate(http_server_requests_total{${selector}}[$__rate_interval]))`;
const duration = `histogram_quantile(0.95, sum by (le, service_name) (rate(http_server_request_duration_seconds_bucket{${selector}}[$__rate_interval])))`;

function panel(title, expression, unit = "short", datasource = "prometheus") {
  return {
    title, type: datasource === "loki" ? "logs" : "timeseries",
    datasource: { type: datasource, uid: datasource },
    targets: [{ refId: "A", expr: expression, legendFormat: "{{service_name}} {{mfe}} {{operation}}", datasource: { type: datasource, uid: datasource } }],
    fieldConfig: { defaults: { unit, min: 0 }, overrides: [] },
    options: { legend: { displayMode: "table", placement: "bottom" } },
  };
}

function dashboard(uid, title, panels) {
  return {
    uid, title: `Campus Pulse / ${title}`, tags: ["campus-pulse", "provisioned"], schemaVersion: 39, version: 1,
    editable: false, timezone: "browser", refresh: "15s", time: { from: "now-1h", to: "now" },
    templating: { list: [
      { name: "environment", type: "custom", query: "local", current: { text: "local", value: "local" } },
      { name: "service", type: "query", datasource: { type: "prometheus", uid: "prometheus" }, query: 'label_values(up{job="campus-services"},service_name)', includeAll: true, allValue: ".*", multi: true, refresh: 1, current: { text: "All", value: "$__all" } },
      { name: "mfe", type: "custom", query: "shell,student-mfe,organiser-mfe", includeAll: true, allValue: ".*", multi: true, current: { text: "All", value: "$__all" } },
    ] },
    panels: panels.map((entry, index) => ({ ...entry, id: index + 1, gridPos: { x: (index % 2) * 12, y: Math.floor(index / 2) * 9, w: 12, h: 9 } })),
  };
}

export const dashboards = [
  dashboard("campus-overview", "Overview", [
    panel("Service availability", `up{job="campus-services",${selector}}`, "percentunit"),
    panel("Requests / second", requestRate, "reqps"),
    panel("Server error ratio", `sum by (service_name) (rate(http_server_requests_total{${selector},http_response_status_code=~"5.."}[$__rate_interval])) / clamp_min(${requestRate}, 0.001)`, "percentunit"),
    panel("Request duration p95", duration, "s"),
    panel("Correlated service logs", '{service_name=~"$service",environment=~"$environment"} | json', "short", "loki"),
    panel("Gateway request rate", 'sum by (service) (rate(kong_http_requests_total[$__rate_interval]))', "reqps"),
  ]),
  dashboard("campus-services", "Services", [
    panel("Request duration p95", duration, "s"),
    panel("Active requests", `sum by (service_name) (http_server_active_requests{${selector}})`),
    panel("Goroutines", `go_goroutines{${selector}}`),
    panel("Resident memory", `process_resident_memory_bytes{${selector}}`, "bytes"),
    panel("CPU cores", `rate(process_cpu_seconds_total{${selector}}[$__rate_interval])`),
    panel("Database pool utilization", `campus_db_connections{${selector},state="acquired"} / clamp_min(campus_db_connections{${selector},state="max"}, 1)`, "percentunit"),
  ]),
  dashboard("campus-browser", "Frontend", [
    panel("Browser errors / second", `sum by (mfe, error_type) (rate(browser_errors_total{${browser}}[$__rate_interval]))`, "ops"),
    panel("Navigations / second", `sum by (mfe) (rate(browser_navigations_total{${browser}}[$__rate_interval]))`, "ops"),
    panel("API duration p95", `histogram_quantile(0.95, sum by (le, mfe) (rate(browser_api_duration_seconds_bucket{${browser}}[$__rate_interval])))`, "s"),
    panel("Largest Contentful Paint p75", `histogram_quantile(0.75, sum by (le, mfe) (rate(browser_web_vital_lcp_milliseconds_bucket{${browser}}[$__rate_interval])))`, "ms"),
    panel("Interaction to Next Paint p75", `histogram_quantile(0.75, sum by (le, mfe) (rate(browser_web_vital_inp_milliseconds_bucket{${browser}}[$__rate_interval])))`, "ms"),
    panel("Cumulative Layout Shift p75", `histogram_quantile(0.75, sum by (le, mfe) (rate(browser_web_vital_cls_ratio_bucket{${browser}}[$__rate_interval])))`),
  ]),
  dashboard("campus-operations", "Domain Operations", [
    panel("Registration outcomes", 'sum by (outcome) (rate(campus_operations_total{operation="registration"}[$__rate_interval]))', "ops"),
    panel("Check-in outcomes", 'sum by (outcome) (rate(campus_operations_total{operation="check_in"}[$__rate_interval]))', "ops"),
    panel("Ticket issuance outcomes", 'sum by (outcome) (rate(campus_operations_total{operation="ticket_issue"}[$__rate_interval]))', "ops"),
    panel("Ticket verification outcomes", 'sum by (outcome) (rate(campus_operations_total{operation="ticket_verify"}[$__rate_interval]))', "ops"),
    panel("Recommendation outcomes", 'sum by (outcome) (rate(campus_operations_total{operation="recommendations"}[$__rate_interval]))', "ops"),
    panel("Event write outcomes", 'sum by (outcome) (rate(campus_operations_total{operation="event_write"}[$__rate_interval]))', "ops"),
  ]),
  dashboard("campus-telemetry", "Telemetry Health", [
    panel("Backend scrape health", 'up{job=~"prometheus|alloy|loki|tempo|grafana|kong"}', "percentunit"),
    panel("Failed trace exports", 'sum by (exporter) (rate(otelcol_exporter_send_failed_spans_total[$__rate_interval]))', "ops"),
    panel("Failed log exports", 'sum by (exporter) (rate(otelcol_exporter_send_failed_log_records_total[$__rate_interval]))', "ops"),
    panel("Exporter queue utilization", 'otelcol_exporter_queue_size / clamp_min(otelcol_exporter_queue_capacity, 1)', "percentunit"),
    panel("Prometheus active series", "prometheus_tsdb_head_series"),
    panel("Loki discarded samples", 'sum by (reason) (rate(loki_discarded_samples_total[$__rate_interval]))', "ops"),
  ]),
];

export function generate(check = false) {
  mkdirSync(directory, { recursive: true });
  for (const entry of dashboards) {
    const path = new URL(`${entry.uid}.json`, directory);
    const content = `${JSON.stringify(entry, null, 2)}\n`;
    if (check) {
      if (readFileSync(path, "utf8") !== content) throw new Error(`Stale dashboard: ${entry.uid}`);
    } else writeFileSync(path, content);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generate(process.argv.includes("--check"));