import { expect, test } from "@playwright/test";
import { devUiLogin, uniqueEmail } from "../helpers";

/**
 * Team management (admin only): grant organiser access in-app and revoke it.
 * Roles land in the DB immediately and apply at the person's next sign-in.
 */
test("admin grants and revokes organiser access from the Team screen", async ({ page }) => {
  const email = uniqueEmail("e2e-organiser");

  await devUiLogin(page, "organiser"); // olga is an admin (cumulative roles)
  await page.getByRole("link", { name: "Team" }).click();
  await expect(page).toHaveURL(/\/organiser\/team/);

  await page.getByLabel(/UFP email/).fill(email);
  await page.getByRole("button", { name: "Add organiser" }).click();
  await expect(page.getByText(/Organiser access granted/)).toBeVisible();

  const staff = page.locator('ul[aria-label="Staff"] > li', { hasText: email });
  await expect(staff).toBeVisible();

  await staff.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText(/Organiser access revoked/)).toBeVisible();
  await expect(staff).toBeHidden();
});

test("the Team nav entry is hidden from non-admin organisers", async ({ page }) => {
  // The seeded student is a plain user: organiser routes are off-limits entirely.
  await devUiLogin(page, "student");
  await expect(page.getByRole("link", { name: "Team" })).toBeHidden();
});
