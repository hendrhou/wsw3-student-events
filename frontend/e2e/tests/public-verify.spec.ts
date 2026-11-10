import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, API_URL, STUDENT_EMAIL, apiContext, createEvent, devLogin, register, vcJwtFor } from "../helpers";

/**
 * Web 3.0 third-party verification: anyone can check a credential against the
 * public endpoint without an account (R9). Exercised at the API level — the
 * verifier URL on a ticket points here.
 */
test("a third party verifies a credential anonymously; tampering fails", async () => {
  const api = await apiContext();
  const organiserToken = await devLogin(api, ADMIN_EMAIL);
  const event = await createEvent(api, organiserToken, `E2E Verify ${Date.now().toString(36)}`);
  const studentToken = await devLogin(api, STUDENT_EMAIL);
  const bookingRef = await register(api, studentToken, event.id);
  const vcJwt = await vcJwtFor(api, studentToken, event.id);
  await api.dispose();

  // Anonymous context: no Authorization header at all.
  const thirdParty = await apiContext();
  const ok = await thirdParty.get(`${API_URL}/tickets/verify?token=${encodeURIComponent(vcJwt)}`);
  expect(ok.status()).toBe(200);
  const verified = (await ok.json()) as { valid: boolean; bookingRef?: string; eventTitle?: string };
  expect(verified.valid).toBe(true);
  expect(verified.bookingRef).toBe(bookingRef);
  expect(verified.eventTitle).toBe(event.title);

  const tamperedToken = `${vcJwt.slice(0, -4)}xxxx`;
  const tampered = await thirdParty.get(`${API_URL}/tickets/verify?token=${encodeURIComponent(tamperedToken)}`);
  expect(tampered.status()).toBe(200);
  expect(((await tampered.json()) as { valid: boolean }).valid).toBe(false);

  await thirdParty.dispose();
});
