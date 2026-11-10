import { expect, test } from "@playwright/test";
import { STUDENT_EMAIL, apiContext, devLogin, devUiLogin, register } from "../helpers";

/**
 * Organiser journey (O1→O3): create/publish an event through the real form
 * (topics come from the ontology via semantic-service), then watch a student
 * registration land in the roster.
 */
test("organiser publishes an event and sees the registration arrive", async ({ page }) => {
  const title = `E2E Organiser ${Date.now().toString(36)}`;

  await devUiLogin(page, "organiser");
  await expect(page).toHaveURL(/\/organiser$/);

  await page.getByRole("link", { name: "New Event" }).click();
  await expect(page.getByRole("heading", { name: "Create event" })).toBeVisible();

  await page.getByLabel(/Title/).fill(title);
  await page.getByLabel(/Short description/).fill("Published from the Playwright E2E suite.");
  await page.getByLabel(/Full description/).fill("End-to-end coverage of the organiser journey.");
  await page.getByLabel(/Category/).selectOption("Talk");
  const date = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel(/^Date/).fill(date);
  await page.getByLabel(/Start time/).fill("14:00");
  await page.getByLabel(/End time/).fill("16:00");
  await page.getByLabel(/Venue/).selectOption("Auditorium B");
  await page.getByLabel(/Capacity/).fill("25");

  // Topics come from the ontology (semantic-service + Fuseki). Scope to the
  // Topic tags listbox: native <select> options also expose role=option.
  const topics = page.getByRole("combobox", { name: "Topic tags" });
  await topics.click();
  await topics.fill("semantic");
  const option = page.getByRole("listbox", { name: /Topic tags/ }).getByRole("option").first();
  await expect(option).toBeVisible();
  await option.click();

  await page.getByRole("button", { name: "Publish" }).click();
  await page.waitForURL(/\/organiser\/events\/[^/]+\/registrations/);
  const eventId = page.url().match(/events\/([^/]+)\/registrations/)?.[1] ?? "";
  expect(eventId, "publish navigates to the new event's registrations").toBeTruthy();

  // A student registers through the API; the organiser roster reflects it.
  const api = await apiContext();
  const studentToken = await devLogin(api, STUDENT_EMAIL);
  await register(api, studentToken, eventId);
  await api.dispose();

  await page.reload();
  // The roster shows the seeded demo student (name source varies by provisioning).
  await expect(page.getByRole("main")).toContainText("20220123");
});
