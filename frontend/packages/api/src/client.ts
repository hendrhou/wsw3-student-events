import { getConfig } from "./config";
import { instrumentedFetch } from "@campus-pulse/telemetry";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Interim auth: the shell stores the signed-in user here until user-service lands. */
const AUTH_STORAGE_KEY = "cp_auth_token";

export function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token === null) window.localStorage.removeItem(AUTH_STORAGE_KEY);
    else window.localStorage.setItem(AUTH_STORAGE_KEY, token);
  } catch {
    // storage unavailable (private mode) — session becomes memory-only on next load
  }
}

export function apiAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  try {
    return new URL(path).toString();
  } catch {
    const { gatewayUrl } = getConfig();
    const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const gateway = new URL(gatewayUrl, origin);
    const base = new URL(`${gateway.pathname.replace(/\/+$/, "")}/`, gateway.origin);
    const relativePath = path.replace(/^\/+/, "").replace(/^api\//, "");
    return new URL(relativePath, base).toString();
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

/**
 * Fetch wrapper targeting the Kong gateway. Normalizes errors to ApiError —
 * components never inspect raw Responses.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { gatewayUrl } = getConfig();
  const url = new URL(`${gatewayUrl}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const token = getAuthToken();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  let response: Response;
  try {
    response = await instrumentedFetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: isFormData ? options.body as FormData : options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, "Network error — check your connection and retry");
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
        message = body.message;
      }
    } catch {
      // non-JSON error body — keep the status-based message
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
