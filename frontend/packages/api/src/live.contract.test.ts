import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CheckInResultSchema,
  CredentialStatusSchema,
  EventDetailSchema,
  EventSummarySchema,
  InterestSchema,
  OrganiserEventSchema,
  RecommendationSchema,
  RegistrationRowSchema,
  StaffMemberSchema,
  TicketSchema,
} from "./schema";

/**
 * Live contract tests: the Go services behind the real Kong gateway must answer
 * in the shapes declared by the shared Zod schemas (schema.ts is the contract —
 * see frontend/README). These run against a composed stack and self-seed via
 * the public API, so no database fixtures are needed.
 *
 *   docker compose --profile backend up -d --build --wait \
 *     kong postgres fuseki user-service event-service registration-service semantic-service ticket-service
 *   CP_GATEWAY_URL=http://localhost:8000/api pnpm --filter @campus-pulse/api test:contract
 *
 * Without CP_GATEWAY_URL the whole suite skips (unit-test runs stay hermetic).
 */

const GATEWAY = process.env.CP_GATEWAY_URL?.replace(/\/$/, "");
const run = `ct${Date.now().toString(36)}`;

const ErrorEnvelope = z.object({ message: z.string() });

async function request(
  path: string,
  options: { token?: string; method?: string; body?: unknown } = {},
): Promise<Response> {
  const response = await fetch(`${GATEWAY}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  return response;
}

async function devLogin(email: string): Promise<string> {
  const response = await request("/auth/dev-login", { method: "POST", body: { email } });
  expect(response.status, `dev-login ${email}`).toBe(200);
  const body = z.object({ token: z.string().min(1) }).parse(await response.json());
  return body.token;
}

const describeLive = GATEWAY ? describe : describe.skip;

describeLive("gateway live contract", () => {
  let adminToken: string;
  let organiserToken: string;
  let organiserEmail: string;
  let eventId: string;
  let eventTitle: string;
  let bookingRef: string;
  let vcJwt: string;

  beforeAll(async () => {
    // olga@ufp.edu.pt is the compose-seeded admin (ADMIN_EMAILS). A unique
    // organiser per run keeps repeated executions independent.
    adminToken = await devLogin("olga@ufp.edu.pt");
    organiserEmail = `${run}@ufp.edu.pt`;

    const grant = await request("/admin/organisers", {
      token: adminToken,
      method: "POST",
      body: { email: organiserEmail },
    });
    expect(grant.status, "grant organiser").toBe(200);
    const granted = z
      .object({ user: StaffMemberSchema, message: z.string() })
      .parse(await grant.json());
    expect(granted.user).toMatchObject({ email: organiserEmail, role: "organiser" });

    organiserToken = await devLogin(organiserEmail);

    eventTitle = `Contract Test ${run}`;
    const starts = new Date(Date.now() + 30 * 86_400_000);
    const date = starts.toISOString().slice(0, 10);
    const created = await request("/organiser/events", {
      token: organiserToken,
      method: "POST",
      body: {
        title: eventTitle,
        shortDescription: "Live contract-suite event",
        fullDescription: "Created by the live contract tests; safe to ignore.",
        category: "Lecture",
        date,
        startTime: "14:00",
        endTime: "16:00",
        venue: "Auditório B",
        online: false,
        onlineUrl: null,
        capacity: 5,
        waitlist: false,
        registrationDeadline: null,
        topics: ["semantic-web"],
      },
    });
    expect(created.status, "create event").toBe(201);
    eventId = z.object({ id: z.string().min(1) }).parse(await created.json()).id;
  }, 30_000);

  it("rejects anonymous calls to protected routes with the error envelope", async () => {
    for (const path of ["/tickets", "/auth/me", "/organiser/events", "/recommendations/me"]) {
      const response = await request(path);
      expect(response.status, path).toBe(401);
      ErrorEnvelope.parse(await response.json());
    }
  });

  it("answers missing resources with 404 and the error envelope", async () => {
    const response = await request("/events/evt-does-not-exist");
    expect(response.status).toBe(404);
    const body = ErrorEnvelope.parse(await response.json());
    expect(body.message.length).toBeGreaterThan(0);
  });

  it("lists events in the EventSummary shape", async () => {
    const response = await request("/events");
    expect(response.status).toBe(200);
    const events = z.array(EventSummarySchema).parse(await response.json());
    const ours = events.find((e) => e.title === eventTitle);
    expect(ours, "created event is listed").toBeTruthy();
    expect(ours?.capacity.total).toBe(5);
  });

  it("supports the discovery filters", async () => {
    const response = await request(`/events?q=${encodeURIComponent(run)}`);
    expect(response.status).toBe(200);
    const filtered = z.array(EventSummarySchema).parse(await response.json());
    expect(filtered.map((e) => e.id)).toEqual([eventId]);
  });

  it("serves event detail in the EventDetail shape", async () => {
    const response = await request(`/events/${encodeURIComponent(eventId)}`);
    expect(response.status).toBe(200);
    const detail = EventDetailSchema.parse(await response.json());
    expect(detail).toMatchObject({ id: eventId, title: eventTitle, organiser: expect.any(String) });
  });

  it("lists organiser events with lifecycle and check-in counters", async () => {
    const response = await request("/organiser/events", { token: organiserToken });
    expect(response.status).toBe(200);
    const mine = z.array(OrganiserEventSchema).parse(await response.json());
    const ours = mine.find((e) => e.id === eventId);
    expect(ours).toMatchObject({ lifecycleStatus: "Published", checkedIn: 0 });
  });

  it("registers and returns a booking reference", async () => {
    // The organiser role is cumulative (organiser ⊃ user), so the same account registers.
    const response = await request(`/events/${encodeURIComponent(eventId)}/register`, {
      token: organiserToken,
      method: "POST",
      body: {},
    });
    expect(response.status).toBe(201);
    bookingRef = z.object({ bookingRef: z.string().min(1) }).parse(await response.json()).bookingRef;

    const duplicate = await request(`/events/${encodeURIComponent(eventId)}/register`, {
      token: organiserToken,
      method: "POST",
      body: {},
    });
    expect(duplicate.status, "duplicate registration").toBe(409);
    ErrorEnvelope.parse(await duplicate.json());
  });

  it("lists the ticket wallet in the Ticket shape", async () => {
    const response = await request("/tickets", { token: organiserToken });
    expect(response.status).toBe(200);
    const tickets = z.array(TicketSchema).parse(await response.json());
    const ours = tickets.find((t) => t.bookingRef === bookingRef);
    expect(ours, "wallet contains the new ticket").toBeTruthy();
    expect(ours).toMatchObject({ eventId, eventTitle, status: "upcoming" });
    expect(ours?.vcJwt, "credential issued at registration").toBeTruthy();
    vcJwt = ours?.vcJwt ?? "";

    const status = await request(`/tickets/${encodeURIComponent(ours?.bookingRef ?? "")}/credential-status`, {
      token: organiserToken,
    });
    expect(status.status).toBe(200);
    z.object({ status: CredentialStatusSchema }).parse(await status.json());
  });

  it("verifies the credential publicly, without authentication", async () => {
    const response = await request(`/tickets/verify?token=${encodeURIComponent(vcJwt)}`);
    expect(response.status).toBe(200);
    const result = z
      .object({
        valid: z.boolean(),
        bookingRef: z.string().optional(),
        reason: z.string().optional(),
        eventTitle: z.string().optional(),
      })
      .parse(await response.json());
    expect(result).toMatchObject({ valid: true, bookingRef, eventTitle });

    const bogus = await request(`/tickets/verify?token=${encodeURIComponent(vcJwt.slice(0, -4) + "xxxx")}`);
    expect(bogus.status).toBe(200);
    expect(z.object({ valid: z.boolean() }).parse(await bogus.json()).valid).toBe(false);
  });

  it("lists event registrations per tab for the organiser", async () => {
    const response = await request(
      `/organiser/events/${encodeURIComponent(eventId)}/registrations?tab=registered`,
      { token: organiserToken },
    );
    expect(response.status).toBe(200);
    const rows = z.array(RegistrationRowSchema).parse(await response.json());
    // The run-specific organiser registered; provisioned accounts have the email prefix as name.
    expect(rows.some((r) => r.name === run && r.status === "Confirmed")).toBe(true);
  });

  it("checks in the credential and reports re-scans idempotently", async () => {
    const first = await request(`/organiser/events/${encodeURIComponent(eventId)}/check-in`, {
      token: organiserToken,
      method: "POST",
      body: { vcToken: vcJwt },
    });
    expect(first.status).toBe(200);
    const firstResult = CheckInResultSchema.parse(await first.json());
    expect(firstResult.outcome).toBe("verified");

    const again = await request(`/organiser/events/${encodeURIComponent(eventId)}/check-in`, {
      token: organiserToken,
      method: "POST",
      body: { vcToken: vcJwt },
    });
    expect(CheckInResultSchema.parse(await again.json()).outcome).toBe("already_checked_in");
  });

  it("exports the registrations CSV", async () => {
    const response = await request(`/organiser/events/${encodeURIComponent(eventId)}/export.csv`, {
      token: organiserToken,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type") ?? "").toContain("text/csv");
    expect(await response.text()).toContain(bookingRef);
  });

  it("searches the ontology for interests", async () => {
    const response = await request("/ontology/interests?q=web");
    expect(response.status).toBe(200);
    z.array(InterestSchema).parse(await response.json());
  });

  it("saves profile interests and reads them back", async () => {
    const saved = await request("/profile/interests", {
      token: organiserToken,
      method: "POST",
      body: { interests: ["semantic-web"] },
    });
    expect(saved.status).toBe(200);
    expect(z.object({ saved: z.number() }).parse(await saved.json()).saved).toBe(1);

    const mine = await request("/profile/interests", { token: organiserToken });
    const interests = z.array(InterestSchema).parse(await mine.json());
    expect(interests.map((i) => i.value)).toContain("semantic-web");
  });

  it("serves recommendations in the contract shape", async () => {
    const response = await request("/recommendations/me", { token: organiserToken });
    expect(response.status).toBe(200);
    // Fresh stacks may return zero recommendations; the shape is the contract.
    z.array(RecommendationSchema).parse(await response.json());
  });

  it("supports admin team management end to end", async () => {
    const staff = await request("/admin/organisers", { token: adminToken });
    expect(staff.status).toBe(200);
    const members = z.array(StaffMemberSchema).parse(await staff.json());
    expect(members.some((m) => m.email === "olga@ufp.edu.pt" && m.role === "admin")).toBe(true);
    expect(members.some((m) => m.email === organiserEmail && m.role === "organiser")).toBe(true);

    // Non-admins are forbidden from team management.
    const forbidden = await request("/admin/organisers", { token: organiserToken });
    expect(forbidden.status).toBe(403);

    // Cleanup: demote the run-specific organiser back to a plain user.
    const revoke = await request(`/admin/organisers/${encodeURIComponent(organiserEmail)}`, {
      token: adminToken,
      method: "DELETE",
    });
    expect(revoke.status).toBe(204);
  });
});
