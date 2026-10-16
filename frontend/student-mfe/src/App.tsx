import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ToastRegion } from "@campus-pulse/ui";
import { useToasts } from "./lib/toast";
import { DiscoveryFeed } from "./screens/DiscoveryFeed";
import { EventDetail } from "./screens/EventDetail";
import { RegistrationFlow } from "./screens/RegistrationFlow";
import { MyTickets } from "./screens/MyTickets";
import { ProfileInterests } from "./screens/ProfileInterests";

/**
 * Fallback for unknown student paths. Never navigates when the location is
 * outside the student namespace (e.g. /organiser): during shell transitions
 * (React Router concurrent navigation) this Routes tree still sees the new
 * location while the old tree is mounted — an unconditional redirect would
 * yank the user back and cancel the area switch.
 */
function StudentFallback() {
  const { pathname } = useLocation();
  const foreign = ["/organiser", "/login", "/auth", "/forbidden"].some((p) => pathname.startsWith(p));
  if (foreign) return null;
  return <Navigate to="/events" replace />;
}

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
        <Route path="*" element={<StudentFallback />} />
      </Routes>
    </>
  );
}
