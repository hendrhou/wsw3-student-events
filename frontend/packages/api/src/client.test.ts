import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom-free tests: stub fetch and window/localStorage minimally
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const localStore = new Map<string, string>();
vi.stubGlobal("window", {
  location: { origin: "http://localhost:5000" },
  localStorage: {
    getItem: (k: string) => localStore.get(k) ?? null,
    setItem: (k: string, v: string) => void localStore.set(k, v),
    removeItem: (k: string) => void localStore.delete(k),
  },
});

const { apiFetch, ApiError, setAuthToken, getAuthToken } = await import("./client");
const { resetConfigForTests } = await import("./config");

describe("apiFetch", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    localStore.clear();
    resetConfigForTests();
  });
  afterEach(() => vi.restoreAllMocks());

  it("builds URLs against the gateway root with query params, skipping empty values", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    await apiFetch("/events", { query: { q: "sparql", category: undefined } });
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.toString()).toBe("http://localhost:5000/api/events?q=sparql");
  });

  it("attaches the bearer token when a session exists", async () => {
    setAuthToken("dev-token-student-1");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    await apiFetch("/tickets");
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer dev-token-student-1" });
    expect(getAuthToken()).toBe("dev-token-student-1");
  });

  it("sends JSON bodies with a content-type header", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ bookingRef: "CP-1" }), { status: 201 }));
    await apiFetch("/events/e1/register", { method: "POST", body: {} });
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("normalizes API error messages from the body", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Already registered" }), { status: 409 }));
    await expect(apiFetch("/events/e1/register", { method: "POST" })).rejects.toMatchObject({ status: 409, message: "Already registered" });
  });

  it("falls back to a status-based message for non-JSON errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad gateway", { status: 502 }));
    await expect(apiFetch("/events")).rejects.toMatchObject({ status: 502, message: "Request failed (502)" });
  });

  it("maps network failures to a friendly ApiError(0)", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(apiFetch("/events")).rejects.toMatchObject({ status: 0, message: expect.stringContaining("Network error") });
  });

  it("returns undefined for 204 responses", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiFetch("/events/e1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("is an ApiError instance", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "x" }), { status: 500 }));
    await expect(apiFetch("/events")).rejects.toBeInstanceOf(ApiError);
  });
});
