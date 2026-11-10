import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getConfig } from "@campus-pulse/api";
import { initializeTelemetry } from "@campus-pulse/telemetry";
import { TelemetryNavigation } from "@campus-pulse/telemetry/react";
import "@campus-pulse/ui/tokens.css";
import "@campus-pulse/ui/components.css";

/** Standalone dev entry: runs the MFE outside the shell, backed by MSW mocks. */
async function bootstrap() {
  initializeTelemetry({ gatewayUrl: getConfig().gatewayUrl, enabled: import.meta.env.VITE_TELEMETRY_ENABLED === "true", version: import.meta.env.VITE_APP_VERSION, environment: import.meta.env.MODE });
  if (import.meta.env.VITE_USE_MSW !== "false") {
    const { worker } = await import("@campus-pulse/mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
  }

  const { default: App } = await import("./App");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
  });
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("#root element missing from index.html");
  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TelemetryNavigation />
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
