/**
 * Runtime configuration with fail-fast validation at startup (mirrors the Go
 * services' internal/configuration pattern).
 */
export interface FrontendConfig {
  /** Base URL of the Kong gateway API root, e.g. "http://localhost:8000/api" or "/api". */
  gatewayUrl: string;
}

let cached: FrontendConfig | null = null;

export function getConfig(): FrontendConfig {
  if (cached) return cached;
  const gatewayUrl = import.meta.env.VITE_GATEWAY_URL ?? "/api";
  if (typeof gatewayUrl !== "string" || gatewayUrl.length === 0) {
    throw new Error("VITE_GATEWAY_URL must be a non-empty string (Kong gateway API root)");
  }
  cached = { gatewayUrl: gatewayUrl.replace(/\/$/, "") };
  return cached;
}

/** Test hook: reset the cached config between tests. */
export function resetConfigForTests(): void {
  cached = null;
}
