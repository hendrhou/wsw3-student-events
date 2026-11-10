import { expect, request, type APIRequestContext, type Page } from "@playwright/test";

export const API_URL = (process.env.E2E_API_URL ?? "http://localhost/api").replace(/\/$/, "");
/** Compose-seeded admin (ADMIN_EMAILS); cumulative roles make her an organiser too. */
export const ADMIN_EMAIL = "olga@ufp.edu.pt";
/** Demo student behind the shell's dev-access button; provisioned by global setup. */
export const STUDENT_EMAIL = "vitor@ufp.edu.pt";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@ufp.edu.pt`;
}

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function apiContext(): Promise<APIRequestContext> {
  // No baseURL: a leading-slash path would drop the /api prefix from it.
  return request.newContext();
}

export async function devLogin(api: APIRequestContext, email: string): Promise<string> {
  const response = await api.post(`${API_URL}/auth/dev-login`, { data: { email } });
  expect(response.status(), `dev-login ${email}`).toBe(200);
  const body = (await response.json()) as { token?: string };
  expect(body.token, "dev-login issues a token").toBeTruthy();
  return body.token as string;
}

export interface SeededEvent {
  id: string;
  title: string;
}

/** Creates a published event through the real API (organiser token required). */
export async function createEvent(api: APIRequestContext, organiserToken: string, title: string): Promise<SeededEvent> {
  const date = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);
  const response = await api.post(`${API_URL}/organiser/events`, {
    headers: auth(organiserToken),
    data: {
      title,
      shortDescription: "End-to-end test event",
      fullDescription: "Created by the Playwright E2E suite; safe to ignore.",
      category: "Talk",
      date,
      startTime: "14:00",
      endTime: "16:00",
      venue: "Auditorium B",
      online: false,
      onlineUrl: null,
      capacity: 25,
      waitlist: false,
      registrationDeadline: null,
      topics: ["semantic-web"],
    },
  });
  expect(response.status(), "create event").toBe(201);
  const { id } = (await response.json()) as { id: string };
  return { id, title };
}

export async function register(api: APIRequestContext, token: string, eventId: string): Promise<string> {
  const response = await api.post(`${API_URL}/events/${encodeURIComponent(eventId)}/register`, {
    headers: auth(token),
    data: {},
  });
  expect(response.status(), "register").toBe(201);
  return ((await response.json()) as { bookingRef: string }).bookingRef;
}

/** Fetches the VC-JWT issued at registration from the student's wallet. */
export async function vcJwtFor(api: APIRequestContext, token: string, eventId: string): Promise<string> {
  const response = await api.get(`${API_URL}/tickets`, { headers: auth(token) });
  expect(response.status(), "list tickets").toBe(200);
  const tickets = (await response.json()) as Array<{ eventId: string; vcJwt: string | null }>;
  const ticket = tickets.find((t) => t.eventId === eventId && t.vcJwt);
  expect(ticket, "issued credential for the seeded registration").toBeTruthy();
  return ticket?.vcJwt ?? "";
}

/**
 * Signs in through the shell's developer access (stack runs ALLOW_DEV_LOGIN=true).
 * This exercises the real login UI rather than injecting storage state.
 */
export async function devUiLogin(page: Page, who: "student" | "organiser"): Promise<void> {
  await page.goto("/login");
  await page.getByText("Developer access (local only)").click();
  await page
    .getByRole("button", { name: who === "student" ? "Enter as Vítor (student)" : "Enter as Olga (organiser)" })
    .click();
  await page.waitForURL(who === "student" ? "**/events" : "**/organiser");
}
