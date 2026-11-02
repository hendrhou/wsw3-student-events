import { z } from "zod";

/**
 * API contract shared by the shell, both MFEs and the MSW mocks. When a Go
 * service lands, these schemas are the contract test target — update them only
 * together with the service.
 */

export const EventSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  venue: z.string(),
  coverUrl: z.string().nullable(),
  capacity: z.object({ used: z.number().int().nonnegative(), total: z.number().int().positive() }),
  full: z.boolean(),
});
export type EventSummary = z.infer<typeof EventSummarySchema>;

export const EventDetailSchema = EventSummarySchema.extend({
  shortDescription: z.string(),
  about: z.string(),
  organiser: z.string(),
  competences: z.array(z.string()),
  schedule: z.array(z.object({ time: z.string(), item: z.string() })),
  registrationDeadline: z.string().nullable(),
  past: z.boolean(),
});
export type EventDetail = z.infer<typeof EventDetailSchema>;

export const RecommendationSchema = z.object({
  event: EventSummarySchema,
  matchReason: z.string(),
  explanation: z.string(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const CredentialStatusSchema = z.enum(["Issued", "Verified", "Pending", "Revoked", "Expired"]);
export type CredentialStatus = z.infer<typeof CredentialStatusSchema>;

export const TicketSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  eventTitle: z.string(),
  dateVenueLabel: z.string(),
  bookingRef: z.string(),
  status: z.enum(["upcoming", "past", "cancelled"]),
  credentialStatus: CredentialStatusSchema,
  credential: z.record(z.string(), z.unknown()).nullable(),
  vcJwt: z.string().nullable(),
  verifierUrl: z.string().url().nullable(),
});
export type Ticket = z.infer<typeof TicketSchema>;

export const InterestSchema = z.object({
  value: z.string(),
  label: z.string(),
  uri: z.string(),
});
export type Interest = z.infer<typeof InterestSchema>;

export const RegistrationRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  studentNumber: z.string(),
  registeredAt: z.string(),
  status: z.enum(["Confirmed", "Waitlisted", "Checked-in", "Cancelled"]),
});
export type RegistrationRow = z.infer<typeof RegistrationRowSchema>;

export const OrganiserEventSchema = EventSummarySchema.extend({
  lifecycleStatus: z.enum(["Draft", "Published", "Cancelled", "Past"]),
  checkedIn: z.number().int().nonnegative(),
});
export type OrganiserEvent = z.infer<typeof OrganiserEventSchema>;

export const CheckInResultSchema = z.object({
  outcome: z.enum(["verified", "already_checked_in", "invalid", "unavailable"]),
  name: z.string().optional(),
  studentNumber: z.string().optional(),
  detail: z.string().optional(),
});
export type CheckInResult = z.infer<typeof CheckInResultSchema>;

export const EventPayloadSchema = z.object({
  title: z.string().min(1).max(80),
  shortDescription: z.string().min(1).max(200),
  fullDescription: z.string(),
  category: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  venue: z.string().min(1),
  online: z.boolean(),
  onlineUrl: z.string().nullable(),
  capacity: z.number().int().min(1),
  waitlist: z.boolean(),
  registrationDeadline: z.string().nullable(),
  topics: z.array(z.string()).min(1),
});
export type EventPayload = z.infer<typeof EventPayloadSchema>;

/** Staff member returned by the admin team-management endpoints. */
export const StaffMemberSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["organiser", "admin"]),
});
export type StaffMember = z.infer<typeof StaffMemberSchema>;
