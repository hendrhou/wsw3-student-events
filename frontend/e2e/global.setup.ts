import { ADMIN_EMAIL, API_URL, STUDENT_EMAIL, apiContext, devLogin } from "./helpers";

/**
 * Provisions the demo student behind the shell's dev-access button. olga is
 * seeded as admin by user-service (ADMIN_EMAILS); vitor is provisioned as a
 * plain student via grant → revoke, which creates the account with role "user".
 * Idempotent across runs.
 */
export default async function globalSetup(): Promise<void> {
  const api = await apiContext();
  try {
    const admin = await devLogin(api, ADMIN_EMAIL);
    const grant = await api.post(`${API_URL}/admin/organisers`, {
      headers: { Authorization: `Bearer ${admin}` },
      data: { email: STUDENT_EMAIL },
    });
    if (!grant.ok()) throw new Error(`student provisioning grant failed: ${grant.status()} ${await grant.text()}`);
    const revoke = await api.delete(`${API_URL}/admin/organisers/${encodeURIComponent(STUDENT_EMAIL)}`, {
      headers: { Authorization: `Bearer ${admin}` },
    });
    if (!revoke.ok() && revoke.status() !== 204) {
      throw new Error(`student provisioning revoke failed: ${revoke.status()} ${await revoke.text()}`);
    }
  } finally {
    await api.dispose();
  }
}
