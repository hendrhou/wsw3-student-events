import { Navigate, Route, Routes } from "react-router-dom";
import { ToastRegion } from "@campus-pulse/ui";
import { useToasts } from "./lib/toast";
import { Dashboard } from "./screens/Dashboard";
import { EventForm } from "./screens/EventForm";
import { Registrations } from "./screens/Registrations";
import { CheckIn } from "./screens/CheckIn";

/**
 * organiser-mfe routes (organiser-mfe.md). Relative paths: the shell mounts
 * this App at /organiser/* — descendant Routes must not re-declare the parent
 * prefix, or nothing matches and the outlet renders blank.
 */
export default function App() {
  const { toasts, dismiss } = useToasts();
  return (
    <>
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="events/new" element={<EventForm mode="create" />} />
        <Route path="events/:eventId/edit" element={<EventForm mode="edit" />} />
        <Route path="events/:eventId/registrations" element={<Registrations />} />
        <Route path="events/:eventId/check-in" element={<CheckIn />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </>
  );
}
