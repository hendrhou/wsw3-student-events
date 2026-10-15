import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@campus-pulse/ui/tokens.css";
import "@campus-pulse/ui/components.css";
import "./styles.css";

/**
 * The shell owns the MSW bootstrap for the composed app: when remotes load
 * through federation, their own main.tsx never runs, so mocks must start here.
 * Enabled by default until the Go services land; build with VITE_USE_MSW=false
 * to hit the real gateway.
 */
async function bootstrap() {
  if (import.meta.env.VITE_USE_MSW !== "false") {
    const { worker } = await import("@campus-pulse/mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
  }

  const { default: App } = await import("./App");
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
    },
  });

  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("#root element missing from index.html");

  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
