import { apiFetch } from "./client";
import {
  CheckInResultSchema,
  CredentialStatusSchema,
  EventDetailSchema,
  EventPayloadSchema,
  EventSummarySchema,
  InterestSchema,
  OrganiserEventSchema,
  RecommendationSchema,
  RegistrationRowSchema,
  StaffMemberSchema,
  TicketSchema,
  type CheckInResult,
  type EventDetail,
  type EventPayload,
  type EventSummary,
  type Interest,
  type OrganiserEvent,
  type Recommendation,
  type RegistrationRow,
  type StaffMember,
  type Ticket,
} from "./schema";
import { z } from "zod";

/**
 * Typed endpoint functions — the single place that knows API paths.
 * Every response is validated against the contract before reaching a screen.
 */

export interface EventFilters {
  q?: string;
  date?: string;
  category?: string;
  venue?: string;
  page?: number;
}

export async function listEvents(filters: EventFilters): Promise<EventSummary[]> {
  const data = await apiFetch<unknown>("/events", { query: { ...filters } });
  return z.array(EventSummarySchema).parse(data);
}

export async function getEvent(id: string): Promise<EventDetail> {
  const data = await apiFetch<unknown>(`/events/${encodeURIComponent(id)}`);
  return EventDetailSchema.parse(data);
}

/** Recommendations fail-soft: callers catch and hide the section (S1). */
export async function getMyRecommendations(): Promise<Recommendation[]> {
  const data = await apiFetch<unknown>("/recommendations/me");
  return z.array(RecommendationSchema).parse(data);
}

export async function registerForEvent(eventId: string): Promise<{ bookingRef: string }> {
  const data = await apiFetch<unknown>(`/events/${encodeURIComponent(eventId)}/register`, { method: "POST", body: {} });
  return z.object({ bookingRef: z.string() }).parse(data);
}

export async function listMyTickets(): Promise<Ticket[]> {
  const data = await apiFetch<unknown>("/tickets");
  return z.array(TicketSchema).parse(data);
}

export async function getCredentialStatus(ticketId: string) {
  const data = await apiFetch<unknown>(`/tickets/${encodeURIComponent(ticketId)}/credential-status`);
  return z.object({ status: CredentialStatusSchema }).parse(data);
}

export async function searchInterests(q: string): Promise<Interest[]> {
  const data = await apiFetch<unknown>("/ontology/interests", { query: { q } });
  return z.array(InterestSchema).parse(data);
}

export async function saveMyInterests(values: string[]): Promise<{ saved: number }> {
  const data = await apiFetch<unknown>("/profile/interests", { method: "POST", body: { interests: values } });
  return z.object({ saved: z.number() }).parse(data);
}

// ---------- organiser ----------

export async function listOrganiserEvents(): Promise<OrganiserEvent[]> {
  const data = await apiFetch<unknown>("/organiser/events");
  return z.array(OrganiserEventSchema).parse(data);
}

export async function createEvent(payload: EventPayload): Promise<{ id: string }> {
  const data = await apiFetch<unknown>("/organiser/events", { method: "POST", body: EventPayloadSchema.parse(payload) });
  return z.object({ id: z.string() }).parse(data);
}

export async function updateEvent(id: string, payload: EventPayload): Promise<{ id: string }> {
  const data = await apiFetch<unknown>(`/organiser/events/${encodeURIComponent(id)}`, { method: "PATCH", body: EventPayloadSchema.parse(payload) });
  return z.object({ id: z.string() }).parse(data);
}

export async function listRegistrations(eventId: string, tab: "registered" | "waitlist" | "cancelled"): Promise<RegistrationRow[]> {
  const data = await apiFetch<unknown>(`/organiser/events/${encodeURIComponent(eventId)}/registrations`, { query: { tab } });
  return z.array(RegistrationRowSchema).parse(data);
}

export async function checkIn(eventId: string, vcToken: string): Promise<CheckInResult> {
  const data = await apiFetch<unknown>(`/organiser/events/${encodeURIComponent(eventId)}/check-in`, {
    method: "POST",
    body: { vcToken },
  });
  return CheckInResultSchema.parse(data);
}

/** CSV export is a blob, not JSON — separate path. */
export async function exportRegistrationsCsv(eventId: string, query: string): Promise<Blob> {
  const { getConfig } = await import("./config");
  const { getAuthToken } = await import("./client");
  const { gatewayUrl } = getConfig();
  const url = new URL(`${gatewayUrl}/organiser/events/${encodeURIComponent(eventId)}/export.csv`, window.location.origin);
  if (query) url.searchParams.set("q", query);
  const token = getAuthToken();
  const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new Error(`Export failed (${response.status})`);
  return response.blob();
}

// ---------- admin (team management) ----------

export async function listStaff(): Promise<StaffMember[]> {
  const data = await apiFetch<unknown>("/admin/organisers");
  return z.array(StaffMemberSchema).parse(data);
}

/** Grants organiser access; the role reaches the person at their next sign-in. */
export async function grantOrganiser(email: string): Promise<{ user: StaffMember; message: string }> {
  const data = await apiFetch<unknown>("/admin/organisers", { method: "POST", body: { email } });
  return z.object({ user: StaffMemberSchema, message: z.string() }).parse(data);
}

export async function revokeOrganiser(email: string): Promise<void> {
  await apiFetch<unknown>(`/admin/organisers/${encodeURIComponent(email)}`, { method: "DELETE" });
}
