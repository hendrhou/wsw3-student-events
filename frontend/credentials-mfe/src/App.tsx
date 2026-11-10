import { useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { HostProvider, destinationHref, type HostServices, type Notification } from "@campus-pulse/contracts";
import { ToastRegion, type ToastData } from "@campus-pulse/ui";
import { CredentialVerifier } from "./screens/CredentialVerifier";
import { MyTickets } from "./screens/MyTickets";

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

/** Standalone dev app (MSW-backed): the credential wallet and verifier. */
export default function App() {
  const { host, toasts, dismiss } = useStandaloneHost();
  return (
    <HostProvider value={host}>
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
      <Routes>
        <Route path="/tickets" element={<MyTickets />} />
        <Route path="/verify" element={<CredentialVerifier />} />
        <Route path="*" element={<Navigate to="/tickets" replace />} />
      </Routes>
    </HostProvider>
  );
}
