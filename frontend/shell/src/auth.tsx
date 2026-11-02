import { create } from "zustand";
import { setAuthToken } from "@campus-pulse/api";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

export type Role = "student" | "organiser";

export interface SessionUser {
  name: string;
  studentNumber: string;
  role: Role;
}

interface AuthState {
  user: SessionUser | null;
  signIn: (user: SessionUser) => void;
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
      ((parsed as SessionUser).role === "student" || (parsed as SessionUser).role === "organiser")
    ) {
      return parsed as SessionUser;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Interim session store (zustand) until user-service lands. The shell owns
 * auth; MFEs consume the API client, which attaches the token to requests.
 */
export const useAuth = create<AuthState>((set) => ({
  user: readStoredUser(),
  signIn: (user) => {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    setAuthToken(`dev-token-${user.role}-${user.studentNumber}`);
    set({ user });
  },
  signOut: () => {
    window.localStorage.removeItem(USER_KEY);
    setAuthToken(null);
    set({ user: null });
  },
}));

/** Role gate: 401 → login redirect; 403 → role gate page (cross-screen requirement). */
export function RequireRole({ requiredRole, children }: { requiredRole: Role; children: ReactNode }) {
  const user = useAuth((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role !== requiredRole) return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
}
