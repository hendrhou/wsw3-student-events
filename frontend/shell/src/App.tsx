import { Suspense, useState, type ComponentType, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Button, Navbar, Skeleton, ToastRegion, type ToastData } from "@campus-pulse/ui";
import { RequireRole, useAuth, type Role } from "./auth";

function RemoteFallback() {
  return (
    <div className="cp-page" aria-busy="true" aria-label="Loading module">
      <Skeleton height={40} />
      <Skeleton height={240} />
      <Skeleton height={240} />
    </div>
  );
}

function Remote({ load }: { load: () => Promise<{ default: ComponentType }> }) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState(false);
  if (!Component && !error) {
    load()
      .then((m) => setComponent(() => m.default))
      .catch(() => setError(true));
  }
  if (error) {
    return (
      <div className="cp-page" role="alert">
        <p>This module is unavailable right now.</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }
  return (
    <Suspense fallback={<RemoteFallback />}>
      {Component ? <Component /> : <RemoteFallback />}
    </Suspense>
  );
}

function studentNav(pathname: string) {
  return [
    { label: "Discover", href: "/events", active: pathname.startsWith("/events") },
    { label: "My Tickets", href: "/tickets", active: pathname.startsWith("/tickets") },
    { label: "Profile", href: "/profile", active: pathname.startsWith("/profile") },
  ];
}

function organiserNav(pathname: string) {
  return [
    { label: "My Events", href: "/organiser", active: pathname === "/organiser" || pathname.includes("/registrations") || pathname.includes("/check-in") },
    { label: "New Event", href: "/organiser/events/new", active: pathname.includes("/events/new") || pathname.includes("/edit") },
  ];
}

function ShellFrame({ navRole, children }: { navRole: Role; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const initials = user?.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() ?? "?";
  return (
    <>
      <Navbar
        logoSrc="/logo_ufp_site.svg"
        appName="Campus Pulse"
        items={navRole === "student" ? studentNav(location.pathname) : organiserNav(location.pathname)}
        onNavigate={(href) => navigate(href)}
        userInitials={initials}
        userMenu={
          <button
            type="button"
            className="cp-avatar cp-avatar--32"
            aria-label="Log out"
            title={`${user?.name ?? ""} — log out`}
            onClick={() => {
              signOut();
              navigate("/login");
            }}
          >
            {initials}
          </button>
        }
      />
      <main>{children}</main>
    </>
  );
}

function LoginPage() {
  const signIn = useAuth((s) => s.signIn);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/events";

  function enter(role: Role) {
    signIn({ name: role === "student" ? "Vítor Carvalho" : "Olga Ribeiro", studentNumber: "20220123", role });
    navigate(role === "organiser" ? "/organiser" : from, { replace: true });
  }

  return (
    <div className="cp-login">
      <img src="/logo_ufp_site.svg" alt="Universidade Fernando Pessoa" height={64} style={{ alignSelf: "center" }} />
      <h1 className="cp-page__title" style={{ textAlign: "center" }}>Campus Pulse</h1>
      <p className="cp-muted" style={{ textAlign: "center" }}>
        Dev sign-in (interim until user-service lands). Choose a role:
      </p>
      <Button size="lg" onClick={() => enter("student")}>Enter as student</Button>
      <Button size="lg" variant="secondary" onClick={() => enter("organiser")}>Enter as organiser</Button>
    </div>
  );
}

function ForbiddenPage() {
  const user = useAuth((s) => s.user);
  return (
    <div className="cp-page" role="alert">
      <h1 className="cp-page__title">Restricted area</h1>
      <p className="cp-muted">
        {user?.role === "student"
          ? "This area is for event organisers. Switch accounts if you have an organiser role."
          : "This area is for students."}
      </p>
      <Button variant="secondary" onClick={() => window.history.back()}>Go back</Button>
    </div>
  );
}

/** Toast host shared by the shell; MFEs push toasts via window events (interim). */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  return {
    toasts,
    dismiss: (id: string) => setToasts((t) => t.filter((x) => x.id !== id)),
  };
}

export default function App() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="cp-root">
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />
        <Route path="/" element={<Navigate to="/events" replace />} />
        <Route
          path="/organiser/*"
          element={
            <RequireRole requiredRole="organiser">
              <ShellFrame navRole="organiser">
                <Remote load={() => import("organiserMfe/App")} />
              </ShellFrame>
            </RequireRole>
          }
        />
        <Route
          path="/*"
          element={
            <RequireRole requiredRole="student">
              <ShellFrame navRole="student">
                <Remote load={() => import("studentMfe/App")} />
              </ShellFrame>
            </RequireRole>
          }
        />
      </Routes>
    </div>
  );
}
