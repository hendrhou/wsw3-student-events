import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, STUDENT_EMAIL, apiContext, createEvent, devLogin, devUiLogin, register, vcJwtFor } from "../helpers";

/**
 * O4 — door check-in: the attendee's verifiable credential is verified by
 * ticket-service (through registration-service) and attendance is recorded.
 * Re-scanning is idempotent, never an error.
 */
test("organiser checks in a verifiable credential; re-scan is idempotent", async ({ page }) => {
  const api = await apiContext();
  const organiserToken = await devLogin(api, ADMIN_EMAIL);
  const event = await createEvent(api, organiserToken, `E2E Check-in ${Date.now().toString(36)}`);
  const studentToken = await devLogin(api, STUDENT_EMAIL);
  await register(api, studentToken, event.id);
  const vcJwt = await vcJwtFor(api, studentToken, event.id);
  await api.dispose();

  await devUiLogin(page, "organiser");
  await page.goto(`/organiser/events/${event.id}/check-in`);
  await expect(page.getByRole("heading", { name: "Checked in" })).toBeVisible();

  const dialog = page.getByRole("alertdialog");
  const scanner = page.getByLabel(/Scanner input/);

  await scanner.fill(vcJwt);
  await scanner.press("Enter");
  await expect(dialog).toBeVisible();

  // Success panels auto-dismiss; a second scan must warn, not fail.
  await expect(dialog).toBeHidden({ timeout: 8_000 });
  await scanner.fill(vcJwt);
  await scanner.press("Enter");
  await expect(dialog).toBeVisible();
});

test("an invalid credential is rejected loudly at the door", async ({ page }) => {
  const api = await apiContext();
  const organiserToken = await devLogin(api, ADMIN_EMAIL);
  const event = await createEvent(api, organiserToken, `E2E Check-in Invalid ${Date.now().toString(36)}`);
  await api.dispose();

  await devUiLogin(page, "organiser");
  await page.goto(`/organiser/events/${event.id}/check-in`);

  const scanner = page.getByLabel(/Scanner input/);
  await scanner.fill("not-a-real-credential");
  await scanner.press("Enter");
  await expect(page.getByRole("alertdialog")).toBeVisible();
});
