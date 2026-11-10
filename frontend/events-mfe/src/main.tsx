import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getConfig } from "@campus-pulse/api";
import { initializeTelemetry } from "@campus-pulse/telemetry";
import { TelemetryNavigation } from "@campus-pulse/telemetry/react";
import { HostProvider, destinationHref, type HostServices, type Notification } from "@campus-pulse/contracts";
import { ToastRegion, type ToastData } from "@campus-pulse/ui";
import "@campus-pulse/ui/tokens.css";
import "@campus-pulse/ui/components.css";
import "./styles.css";
import { Dashboard } from "./screens/Dashboard";
import { DiscoveryFeed } from "./screens/DiscoveryFeed";
import { EventDetail } from "./screens/EventDetail";
import { EventForm } from "./screens/EventForm";

/** Standalone host services: dev-mode navigation + local toasts (no shell). */
function useStandaloneHost() {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const host = useMemo<HostServices>(
    () => ({
      user: null,
      navigate: (destination, options) => navigate(destinationHref(destination), options),
      href: destinationHref,
      notify: (notification: Notification) =>
        setToasts((current) => [...current, { ...notification, id: crypto.randomUUID() }]),
    }),
    [navigate],
  );
  return { host, toasts, dismiss: (id: string) => setToasts((current) => current.filter((t) => t.id !== id)) };
}

function EventDetailRoute() {
  const { eventId = "" } = useParams();
  return <EventDetail eventId={eventId} />;
}

function EditEventRoute() {
  const { eventId = "" } = useParams();
  return <EventForm mode="edit" eventId={eventId} />;
}

/**
 * Standalone dev app (MSW-backed). Only this MFE's screens route here —
 * cross-MFE flows (registration panel, credential issuance) run in the shell.
 */
function App() {
  const { host, toasts, dismiss } = useStandaloneHost();
  return (
    <HostProvider value={host}>
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
      <Routes>
        <Route path="/events" element={<DiscoveryFeed />} />
        <Route path="/events/:eventId" element={<EventDetailRoute />} />
        <Route path="/organiser" element={<Dashboard />} />
        <Route path="/organiser/events/new" element={<EventForm mode="create" />} />
        <Route path="/organiser/events/:eventId/edit" element={<EditEventRoute />} />
        <Route path="*" element={<Navigate to="/events" replace />} />
      </Routes>
    </HostProvider>
  );
}

/** Standalone dev entry: runs the MFE outside the shell, backed by MSW mocks. */
async function bootstrap() {
  initializeTelemetry({ gatewayUrl: getConfig().gatewayUrl, enabled: import.meta.env.VITE_TELEMETRY_ENABLED === "true", version: import.meta.env.VITE_APP_VERSION, environment: import.meta.env.MODE });
  if (import.meta.env.VITE_USE_MSW !== "false") {
    const { worker } = await import("@campus-pulse/mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
  }

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
