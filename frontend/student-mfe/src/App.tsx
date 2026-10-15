import { Navigate, Route, Routes } from "react-router-dom";
import { ToastRegion } from "@campus-pulse/ui";
import { useToasts } from "./lib/toast";
import { DiscoveryFeed } from "./screens/DiscoveryFeed";
import { EventDetail } from "./screens/EventDetail";
import { RegistrationFlow } from "./screens/RegistrationFlow";
import { MyTickets } from "./screens/MyTickets";
import { ProfileInterests } from "./screens/ProfileInterests";

/**
 * student-mfe routes (student-mfe.md): absolute paths so the shell can mount
 * this App as a catch-all under the student role.
 */
export default function App() {
  const { toasts, dismiss } = useToasts();
  return (
    <>
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
      <Routes>
        <Route path="/events" element={<DiscoveryFeed />} />
        <Route path="/events/:eventId" element={<EventDetail />} />
        <Route path="/events/:eventId/register" element={<RegistrationFlow />} />
        <Route path="/tickets" element={<MyTickets />} />
        <Route path="/profile" element={<ProfileInterests />} />
        <Route path="*" element={<Navigate to="/events" replace />} />
      </Routes>
    </>
  );
}
