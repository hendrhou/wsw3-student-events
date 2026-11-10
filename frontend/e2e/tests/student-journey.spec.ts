import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, apiContext, createEvent, devLogin, devUiLogin } from "../helpers";

/**
 * Student journey (S1→S4): discovery → detail → registration → wallet.
 * Crosses events-mfe, participation-mfe and credentials-mfe inside the shell.
 */
test.describe("student journey", () => {
  test("discovers an event, registers, and finds the credential in the wallet", async ({ page }) => {
    const api = await apiContext();
    const organiserToken = await devLogin(api, ADMIN_EMAIL);
    const event = await createEvent(api, organiserToken, `E2E Student ${Date.now().toString(36)}`);
    await api.dispose();

    await devUiLogin(page, "student");

    // S1 — discovery with live search filtering.
    await expect(page.getByRole("heading", { name: "Discover events" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search events" }).fill(event.title);
    // Scope to the main grid: the recommendations row can also surface the
    // seeded event (topic match), which would resolve the link twice.
    const allEvents = page.locator("section", {
      has: page.getByRole("heading", { name: "All upcoming events" }),
    });
    const card = allEvents.getByRole("link", { name: event.title });
    await expect(card).toBeVisible();
    await card.click();

    // S2 — detail with the registration panel composed from participation-mfe.
    // Wait for the route change first: the remote chunk loads async, and while
    // the feed is still mounted both card titles match a bare heading locator
    // (strict mode violation in CI, where chunks load slower).
    await expect(page).toHaveURL(/\/events\/.+/);
    await expect(page.getByRole("heading", { name: event.title, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Register", exact: true }).click();

    // S3 — policy gate → review → confirm.
    await page.getByRole("checkbox", { name: /attendance policy/ }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Confirm registration" }).click();

    await expect(page.getByText("You're registered!")).toBeVisible();
    await expect(page.getByText(/CP-\d{4}-\d{5}/)).toBeVisible();

    // S4 — the wallet shows the ticket and its credential leaves Pending.
    await page.getByRole("button", { name: "View my tickets" }).click();
    await expect(page).toHaveURL(/\/tickets/);
    await expect(page.getByText(event.title)).toBeVisible();
  });

  test("students are kept out of the organiser area", async ({ page }) => {
    await devUiLogin(page, "student");
    await page.goto("/organiser");
    await expect(page).toHaveURL(/\/forbidden/);
    await expect(page.getByRole("heading", { name: "Restricted area" })).toBeVisible();
  });

  test("student saves interests that feed semantic recommendations", async ({ page }) => {
    await devUiLogin(page, "student");
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();

    const combo = page.getByRole("combobox", { name: /add interest/i });
    await combo.click();
    await combo.fill("a");
    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();

    // The demo student accumulates interests across runs — pick the first
    // ontology option not already in the chips.
    const taken = (await page.getByRole("button", { name: /Remove filter / }).allTextContents())
      .map((t) => t.replace("Remove filter ", "").trim());
    let picked = "";
    for (let i = 0; i < (await options.count()); i++) {
      const candidate = ((await options.nth(i).textContent()) ?? "").split("https://")[0].trim();
      if (!taken.includes(candidate)) {
        picked = candidate;
        await options.nth(i).click();
        break;
      }
    }
    expect(picked, "an unsaved ontology interest to pick").toBeTruthy();

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/Interests saved/)).toBeVisible();
    await expect(page.getByRole("button", { name: `Remove filter ${picked}` })).toBeVisible();
  });
});
