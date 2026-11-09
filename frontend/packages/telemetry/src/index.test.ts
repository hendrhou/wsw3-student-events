import { afterEach, describe, expect, it, vi } from "vitest";
import { flushTelemetry, initializeTelemetry, instrumentedFetch, normalizeRoute, recordError, recordNavigation, shutdownTelemetry } from "./index";
import { surface } from "./routes";

vi.mock("web-vitals", () => ({ onCLS: vi.fn(), onINP: vi.fn(), onLCP: vi.fn() }));

afterEach(async () => {
  await shutdownTelemetry();
  vi.unstubAllGlobals();
});

describe("browser telemetry", () => {
  it("normalizes known routes without retaining identifiers or query strings", () => {
    expect(normalizeRoute("/api/events/private-id/register?token=secret")).toBe("/api/events/:id/register");
    expect(normalizeRoute("/unexpected/secret")).toBe("unmatched");
  });

  it("initializes once across independently loaded MFE bundles", () => {
    const config = { gatewayUrl: "/api", enabled: true };
    expect(initializeTelemetry(config)).toBe(initializeTelemetry(config));
  });

  it("propagates context only to the configured gateway without mutating headers", async () => {
    initializeTelemetry({ gatewayUrl: "/api", enabled: true });
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const headers = { Accept: "application/json" };
    await instrumentedFetch(new URL("/api/events/private-id", location.origin), { headers });
    expect(new Headers(fetch.mock.calls[0][1].headers).get("traceparent")).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
    expect(headers).toEqual({ Accept: "application/json" });
    await instrumentedFetch(new URL("https://example.org/api/events"), {});
    expect(fetch.mock.calls[1][1]).toEqual({});
  });

  it("preserves application behavior when disabled or a network call fails", async () => {
    initializeTelemetry({ gatewayUrl: "/api", enabled: false });
    const error = new TypeError("private network message");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(instrumentedFetch(new URL("/api/events", location.origin), {})).rejects.toBe(error);
  });

  it("records sanitized errors and survives exporter failures", async () => {
    const runtime = initializeTelemetry({ gatewayUrl: "/api", enabled: true, version: "test", environment: "test" })!;
    const logs = vi.spyOn(runtime.logger, "emit");
    window.dispatchEvent(new ErrorEvent("error", { message: "secret@example.org" }));
    window.dispatchEvent(new Event("unhandledrejection"));
    expect(logs).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(logs.mock.calls)).not.toContain("secret@example.org");
    vi.spyOn(runtime.traces, "forceFlush").mockRejectedValue(new Error("unavailable"));
    vi.spyOn(runtime.logs, "forceFlush").mockResolvedValue();
    vi.spyOn(runtime.metrics, "forceFlush").mockResolvedValue();
    window.dispatchEvent(new Event("pagehide"));
    await expect(flushTelemetry()).resolves.toBeUndefined();
  });

  it("records instrumented network failures and server errors without swallowing them", async () => {
    initializeTelemetry({ gatewayUrl: "/api", enabled: true });
    const error = new Error("private network message");
    const fetch = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    await expect(instrumentedFetch(new URL("/api/events/private?token=secret", location.origin), { method: "POST" })).rejects.toBe(error);
    expect((await instrumentedFetch(new URL("/api/events", location.origin), { method: "CUSTOM" })).status).toBe(503);
  });

  it("attributes navigation to each frontend and is safe before initialization", () => {
    recordNavigation("/events");
    recordError("network_error");
    expect(surface("/organiser/events")).toBe("organiser-mfe");
    expect(surface("/events")).toBe("student-mfe");
    expect(surface("/login")).toBe("shell");
    expect(normalizeRoute("/api/events")).toBe("/api/events");
  });

  it("records only bounded Web Vitals attributes", async () => {
    const { onLCP } = await import("web-vitals");
    initializeTelemetry({ gatewayUrl: "/api", enabled: true });
    const callback = vi.mocked(onLCP).mock.calls.at(-1)![0];
    callback({ value: 100 } as Parameters<typeof callback>[0]);
  });
});