import { Suspense, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Button, Navbar, Skeleton, ToastRegion, type ToastData } from "@campus-pulse/ui";
import { RequireRole, useAuth, googleLoginUrl, devLogin, type Role } from "./auth";

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

function organiserNav(pathname: string, isAdmin: boolean) {
  const items = [
    { label: "My Events", href: "/organiser", active: pathname === "/organiser" || pathname.includes("/registrations") || pathname.includes("/check-in") },
    { label: "New Event", href: "/organiser/events/new", active: pathname.includes("/events/new") || pathname.includes("/edit") },
  ];
  if (isAdmin) {
    items.push({ label: "Team", href: "/organiser/team", active: pathname.includes("/team") });
  }
  return items;
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
        items={navRole === "user" ? studentNav(location.pathname) : organiserNav(location.pathname, user?.role === "admin")}
        onNavigate={(href) => navigate(href)}
        userInitials={initials}
        userMenu={
          <UserMenu
            initials={initials}
            userName={user?.name ?? ""}
            showProfile={navRole === "user"}
            onProfile={() => navigate("/profile")}
            onSignOut={() => {
              signOut();
              navigate("/login");
            }}
          />
        }
      />
      <main>{children}</main>
    </>
  );
}

/**
 * Avatar menu per design/components.md: Profile · Log out (separated, danger).
 * The avatar itself only opens the menu — it must never sign out directly.
 */
function UserMenu({ initials, userName, showProfile, onProfile, onSignOut }: {
  initials: string;
  userName: string;
  showProfile: boolean;
  onProfile: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="cp-usermenu" ref={rootRef}>
      <button
        type="button"
        className="cp-avatar cp-avatar--32"
        aria-label={`${userName} — account menu`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={userName}
        onClick={() => setOpen((v) => !v)}
      >
        {initials}
      </button>
      {open ? (
        <div className="cp-usermenu__pop" role="menu" aria-label="Account">
          {showProfile ? (
            <button type="button" role="menuitem" className="cp-usermenu__item" onClick={() => { setOpen(false); onProfile(); }}>
              Profile
            </button>
          ) : null}
          {showProfile ? <div className="cp-usermenu__sep" role="separator" /> : null}
          <button type="button" role="menuitem" className="cp-usermenu__item cp-usermenu__item--danger" onClick={() => { setOpen(false); onSignOut(); }}>
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LoginPage() {
  const location = useLocation();
  const error = new URLSearchParams(location.search).get("error");
  return (
    <div className="cp-login">
      <img src="/logo_ufp_site.svg" alt="Universidade Fernando Pessoa" height={64} style={{ alignSelf: "center" }} />
      <h1 className="cp-page__title" style={{ textAlign: "center" }}>Campus Pulse</h1>
      <p className="cp-muted" style={{ textAlign: "center" }}>
        Sign in with your UFP Google account.
      </p>
      {error === "only-ufp" ? (
        <p className="cp-error-panel" role="alert">Only @ufp.edu.pt accounts can sign in.</p>
      ) : null}
      {error === "oidc-failed" ? (
        <p className="cp-error-panel" role="alert">Sign-in failed — please try again.</p>
      ) : null}
      <Button size="lg" onClick={() => { window.location.href = googleLoginUrl(); }}>
        Sign in with UFP Google
      </Button>
      <DevAccess />
    </div>
  );
}

/** Local-development access: visible always, but the endpoint only exists when the backend runs with ALLOW_DEV_LOGIN=true. */
function DevAccess() {
  const completeSignIn = useAuth((s) => s.completeSignIn);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function enter(email: string) {
    setError(null);
    try {
      const token = await devLogin(email);
      const user = await completeSignIn(token);
      navigate(user.role === "user" ? "/events" : "/organiser", { replace: true });
    } catch {
      setError("Developer access is unavailable (ALLOW_DEV_LOGIN off or backend down).");
    }
  }

  return (
    <details style={{ marginTop: "var(--cp-space-4)" }}>
      <summary className="cp-muted" style={{ cursor: "pointer", textAlign: "center" }}>
        Developer access (local only)
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--cp-space-2)", marginTop: "var(--cp-space-3)" }}>
        {error ? <p className="cp-error-panel" role="alert">{error}</p> : null}
        <Button variant="secondary" onClick={() => enter("vitor@ufp.edu.pt")}>Enter as Vítor (student)</Button>
        <Button variant="ghost" onClick={() => enter("olga@ufp.edu.pt")}>Enter as Olga (organiser)</Button>
      </div>
    </details>
  );
}

/** OIDC landing: stores the session token, confirms the profile, routes by role. */
function AuthCallbackPage() {
  const completeSignIn = useAuth((s) => s.completeSignIn);
  const navigate = useNavigate();
  const location = useLocation();
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);

  if (!done && !failed) {
    setDone(true);
    const token = new URLSearchParams(location.search).get("token");
    if (!token) {
      setFailed(true);
      return <Navigate to="/login?error=oidc-failed" replace />;
    }
    completeSignIn(token)
      .then((user) => navigate(user.role === "user" ? "/events" : "/organiser", { replace: true }))
      .catch(() => setFailed(true));
  }
  if (failed) return <Navigate to="/login?error=oidc-failed" replace />;
  return <div className="cp-page" aria-busy="true"><Skeleton height={40} /><Skeleton height={200} /></div>;
}

function ForbiddenPage() {
  const user = useAuth((s) => s.user);
  return (
    <div className="cp-page" role="alert">
      <h1 className="cp-page__title">Restricted area</h1>
      <p className="cp-muted">
        {user?.role === "user"
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
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
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
            <RequireRole requiredRole="user">
              <ShellFrame navRole="user">
                <Remote load={() => import("studentMfe/App")} />
              </ShellFrame>
            </RequireRole>
          }
        />
      </Routes>
    </div>
  );
}
