import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { dashboards } from "./dashboards.mjs";

const gateway = process.env.SMOKE_GATEWAY_URL ?? "http://localhost:8000";
const grafana = process.env.SMOKE_GRAFANA_URL ?? "http://localhost:3001";
const prometheus = process.env.SMOKE_PROMETHEUS_URL ?? "http://localhost:9090";
const password = process.env.GRAFANA_ADMIN_PASSWORD;
assert.ok(password, "Set GRAFANA_ADMIN_PASSWORD before running live-stack tests");
const authorization = `Basic ${Buffer.from(`${process.env.GRAFANA_ADMIN_USER ?? "admin"}:${password}`).toString("base64")}`;

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok, `HTTP ${response.status} from ${new URL(url).pathname}`);
  return response.json();
}

async function eventually(assertion) {
  const deadline = Date.now() + 90000;
  let failure;
  while (Date.now() < deadline) {
    try { return await assertion(); } catch (error) { failure = error; }
    await setTimeout(1000);
  }
  throw failure;
}

function proxy(source, path) {
  return `${grafana}/api/datasources/proxy/uid/${source}${path}`;
}

test("all services export metrics and every generated PromQL query is valid", { timeout: 100000 }, async () => {
  await eventually(async () => {
    const data = await json(`${prometheus}/api/v1/query?query=${encodeURIComponent('up{job="campus-services"}')}`);
    assert.equal(data.data.result.length, 5);
    assert.ok(data.data.result.every(({ value }) => value[1] === "1"));
  });
  for (const dashboard of dashboards) {
    for (const panel of dashboard.panels.filter(({ datasource }) => datasource.uid === "prometheus")) {
      const query = panel.targets[0].expr.replaceAll("$__rate_interval", "5m").replaceAll("$service", ".*").replaceAll("$environment", "local").replaceAll("$mfe", ".*");
      const result = await json(`${prometheus}/api/v1/query?query=${encodeURIComponent(query)}`);
      assert.equal(result.status, "success", panel.title);
    }
  }
});

test("Grafana provisions five read-only dashboards and all three datasources", { skip: !password }, async () => {
  const options = { headers: { authorization } };
  const sources = await json(`${grafana}/api/datasources`, options);
  for (const uid of ["prometheus", "loki", "tempo"]) assert.ok(sources.some((source) => source.uid === uid));
  for (const dashboard of dashboards) {
    const result = await json(`${grafana}/api/dashboards/uid/${dashboard.uid}`, options);
    assert.equal(result.meta.provisioned, true);
    assert.equal(result.dashboard.editable, false);
  }
});

test("request traces and JSON container logs share the propagated trace ID without query data", { skip: !password, timeout: 100000 }, async () => {
  const traceId = randomBytes(16).toString("hex");
  const traceparent = `00-${traceId}-${randomBytes(8).toString("hex")}-01`;
  await eventually(() => json(`${gateway}/api/events?private_token=must-not-be-exported`, { headers: { traceparent } }));
  await eventually(async () => {
    const trace = await json(proxy("tempo", `/api/traces/${traceId}`), { headers: { authorization, Accept: "application/json" } });
    const encoded = JSON.stringify(trace);
    assert.ok(encoded.includes("event-service"));
    assert.ok(!encoded.includes("must-not-be-exported"));
  });
  await eventually(async () => {
    const query = `{service_name="event-service"} | json | trace_id="${traceId}"`;
    const result = await json(proxy("loki", `/loki/api/v1/query_range?query=${encodeURIComponent(query)}&since=5m`), { headers: { authorization } });
    assert.ok(result.data.result.length > 0);
    assert.ok(!JSON.stringify(result).includes("must-not-be-exported"));
  });
});

test("browser OTLP ingestion accepts all signals and enforces CORS and payload limits", { timeout: 100000 }, async () => {
  for (const signal of ["traces", "metrics", "logs"]) {
    await eventually(async () => {
      const response = await fetch(`${gateway}/api/telemetry/v1/${signal}`, {
        method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: "{}",
      });
      assert.equal(response.status, 200, signal);
      assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
    });
  }
  const oversized = await fetch(`${gateway}/api/telemetry/v1/traces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "x".repeat(270000),
  });
  assert.equal(oversized.status, 413);
  const preflight = await fetch(`${gateway}/api/events`, {
    method: "OPTIONS", headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "traceparent" },
  });
  assert.equal(preflight.status, 200);
  assert.match(preflight.headers.get("access-control-allow-headers"), /traceparent/i);
});

test("registration produces an event/registration/ticket distributed trace", { skip: process.env.SMOKE_WRITE_TESTS !== "true", timeout: 100000 }, async () => {
  const login = async (email) => json(`${gateway}/api/auth/dev-login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
  });
  const organiser = await login("olga@ufp.edu.pt");
  const student = await login("vitor@ufp.edu.pt");
  const event = await json(`${gateway}/api/organiser/events`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${organiser.token}` },
    body: JSON.stringify({ title: "Telemetry smoke test", shortDescription: "Isolated CI fixture", fullDescription: "", category: "Workshop",
      date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), startTime: "12:00", endTime: "13:00", venue: "Test venue",
      online: false, onlineUrl: null, capacity: 10, waitlist: false, registrationDeadline: null, topics: ["Semantic Web"] }),
  });
  const traceId = randomBytes(16).toString("hex");
  await json(`${gateway}/api/events/${event.id}/register`, {
    method: "POST", headers: { Authorization: `Bearer ${student.token}`, traceparent: `00-${traceId}-${randomBytes(8).toString("hex")}-01` },
  });
  await eventually(async () => {
    const result = await json(proxy("tempo", `/api/traces/${traceId}`), { headers: { authorization, Accept: "application/json" } });
    const encoded = JSON.stringify(result);
    for (const service of ["registration-service", "event-service", "ticket-service"]) assert.ok(encoded.includes(service), service);
  });
});