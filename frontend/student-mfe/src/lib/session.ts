/**
 * Interim session reader: the shell persists the dev sign-in to localStorage
 * (cp_auth_user) until user-service issues real JWTs. The MFE never writes it.
 */
export interface StoredUser {
  name: string;
  studentNumber: string;
  role: "user" | "organiser";
}

export function getStoredUser(): StoredUser | null {
  try {
    const raw = window.localStorage.getItem("cp_auth_user");
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "name" in parsed &&
      "studentNumber" in parsed &&
      typeof (parsed as StoredUser).name === "string"
    ) {
      return parsed as StoredUser;
    }
    return null;
  } catch {
    return null;
  }
}
