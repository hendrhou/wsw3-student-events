import { create } from "zustand";
import { setAuthToken, getConfig, apiFetch } from "@campus-pulse/api";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

export type Role = "user" | "organiser";

export interface SessionUser {
  name: string;
  studentNumber: string;
  email: string;
  role: Role;
}

interface AuthState {
  user: SessionUser | null;
  /** Complete a sign-in: store the session JWT, fetch the profile, set state. */
  completeSignIn: (token: string) => Promise<SessionUser>;
  signOut: () => void;
}

const USER_KEY = "cp_auth_user";

function readStoredUser(): SessionUser | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "name" in parsed &&
      "studentNumber" in parsed &&
      "role" in parsed &&
      ((parsed as SessionUser).role === "user" || (parsed as SessionUser).role === "organiser")
    ) {
      return parsed as SessionUser;
    }
    return null;
  } catch {
    return null;
  }
}

interface MeResponse {
  id: string;
  name: string;
  email: string;
  studentNumber: string;
  role: Role;
}

/**
 * Session store. Tokens come from user-service: Google OIDC (production) or
 * the dev-login endpoint (local). Profile is always confirmed with /api/auth/me.
 */
export const useAuth = create<AuthState>((set) => ({
  user: readStoredUser(),
  completeSignIn: async (token) => {
    setAuthToken(token);
    const me = await apiFetch<MeResponse>("/auth/me");
    const user: SessionUser = { name: me.name, studentNumber: me.studentNumber, email: me.email, role: me.role };
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
    return user;
  },
  signOut: () => {
    window.localStorage.removeItem(USER_KEY);
    setAuthToken(null);
    set({ user: null });
  },
}));

export function googleLoginUrl(): string {
  return `${getConfig().gatewayUrl}/auth/google/login`;
}

/** Dev-only login (local): the endpoint exists only when ALLOW_DEV_LOGIN=true. */
export async function devLogin(email: string): Promise<string> {
  const { gatewayUrl } = getConfig();
  const response = await fetch(`${gatewayUrl}/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new Error(`dev login failed (${response.status})`);
  const body = (await response.json()) as { token?: string };
  if (!body.token) throw new Error("Dev login failed — is ALLOW_DEV_LOGIN enabled?");
  return body.token;
}

/** Role gate: 401 → login redirect; 403 → role gate page (cross-screen requirement). */
export function RequireRole({ requiredRole, children }: { requiredRole: Role; children: ReactNode }) {
  const user = useAuth((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role !== requiredRole) return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
}
