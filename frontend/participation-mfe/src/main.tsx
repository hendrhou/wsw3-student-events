import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HostProvider, destinationHref, type HostServices, type Notification } from "@campus-pulse/contracts";
import { ToastRegion, type ToastData } from "@campus-pulse/ui";
import "@campus-pulse/ui/tokens.css";
import "@campus-pulse/ui/components.css";
import "./styles.css";
import { CheckIn } from "./screens/CheckIn";
import { RegistrationFlow } from "./screens/RegistrationFlow";
import { Registrations } from "./screens/Registrations";

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

function RegisterRoute() {
  const { eventId = "" } = useParams();
  return <RegistrationFlow eventId={eventId} />;
}

function RegistrationsRoute() {
  const { eventId = "" } = useParams();
  return <Registrations eventId={eventId} />;
}

function CheckInRoute() {
  const { eventId = "" } = useParams();
  return <CheckIn eventId={eventId} />;
}

/** Landing note: participation screens are event-scoped, so there is no index page. */
function DevHome() {
  return (
    <div className="cp-page">
      <h1 className="cp-page__title">Participation MFE (standalone)</h1>
      <p className="cp-muted">
        These screens are event-scoped. Open a flow directly, e.g.{" "}
        <code>/events/&lt;eventId&gt;/register</code> or <code>/organiser/events/&lt;eventId&gt;/check-in</code> —
        or run the composed app via the shell for cross-MFE journeys.
      </p>
    </div>
  );
}

/** Standalone dev app (MSW-backed). Credential issuance/verification compose in via the shell. */
function App() {
  const { host, toasts, dismiss } = useStandaloneHost();
  return (
    <HostProvider value={host}>
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
      <Routes>
        <Route path="/events/:eventId/register" element={<RegisterRoute />} />
        <Route path="/organiser/events/:eventId/registrations" element={<RegistrationsRoute />} />
        <Route path="/organiser/events/:eventId/check-in" element={<CheckInRoute />} />
        <Route path="*" element={<DevHome />} />
      </Routes>
    </HostProvider>
  );
}

/** Standalone dev entry: runs the MFE outside the shell, backed by MSW mocks. */
async function bootstrap() {
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
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
