import { Navigate, Route, Routes } from "react-router-dom";
import { ToastRegion } from "@campus-pulse/ui";
import { useToasts } from "./lib/toast";
import { Dashboard } from "./screens/Dashboard";
import { EventForm } from "./screens/EventForm";
import { Registrations } from "./screens/Registrations";
import { CheckIn } from "./screens/CheckIn";

/** organiser-mfe routes (organiser-mfe.md), mounted by the shell at /organiser. */
export default function App() {
  const { toasts, dismiss } = useToasts();
  return (
    <>
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
      <Routes>
        <Route path="/organiser" element={<Dashboard />} />
        <Route path="/organiser/events/new" element={<EventForm mode="create" />} />
        <Route path="/organiser/events/:eventId/edit" element={<EventForm mode="edit" />} />
        <Route path="/organiser/events/:eventId/registrations" element={<Registrations />} />
        <Route path="/organiser/events/:eventId/check-in" element={<CheckIn />} />
        <Route path="*" element={<Navigate to="/organiser" replace />} />
      </Routes>
    </>
  );
}
