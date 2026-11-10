import { useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { HostProvider, destinationHref, type HostServices, type Notification } from "@campus-pulse/contracts";
import { ToastRegion, type ToastData } from "@campus-pulse/ui";
import { ProfileInterests } from "./screens/ProfileInterests";
import { Team } from "./screens/Team";

/** Standalone host services: dev-mode navigation + local toasts (no shell). */
function useStandaloneHost() {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const host = useMemo<HostServices>(
    () => ({
      user: { name: "Vítor Carvalho", studentNumber: "20220123", email: "vitor@ufp.edu.pt", role: "admin" },
      navigate: (destination, options) => navigate(destinationHref(destination), options),
      href: destinationHref,
      notify: (notification: Notification) =>
        setToasts((current) => [...current, { ...notification, id: crypto.randomUUID() }]),
    }),
    [navigate],
  );
  return { host, toasts, dismiss: (id: string) => setToasts((current) => current.filter((t) => t.id !== id)) };
}

/** Standalone dev app (MSW-backed): profile interests and team management. */
export default function App() {
  const { host, toasts, dismiss } = useStandaloneHost();
  return (
    <HostProvider value={host}>
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
      <Routes>
        <Route path="/profile" element={<ProfileInterests />} />
        <Route path="/organiser/team" element={<Team />} />
        <Route path="*" element={<Navigate to="/profile" replace />} />
      </Routes>
    </HostProvider>
  );
}
