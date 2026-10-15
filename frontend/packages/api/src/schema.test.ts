import { describe, expect, it } from "vitest";
import { EventPayloadSchema, EventSummarySchema, TicketSchema } from "./schema";

describe("API contract schemas", () => {
  it("accepts a valid event summary", () => {
    const parsed = EventSummarySchema.parse({
      id: "e1",
      title: "T",
      category: "Workshop",
      date: "2026-10-24",
      startTime: "14:00",
      endTime: "16:00",
      venue: "D",
      coverUrl: null,
      capacity: { used: 1, total: 10 },
      full: false,
    });
    expect(parsed.id).toBe("e1");
  });

  it("rejects malformed events (contract drift detection)", () => {
    expect(() => EventSummarySchema.parse({ id: "e1" })).toThrow();
    expect(() =>
      EventSummarySchema.parse({
        id: "e1", title: "T", category: "C", date: "2026-10-24", startTime: "14:00", endTime: "16:00",
        venue: "D", coverUrl: null, capacity: { used: -1, total: 0 }, full: false,
      }),
    ).toThrow();
  });

  it("rejects tickets with unknown credential status", () => {
    expect(() =>
      TicketSchema.parse({
        id: "t", eventId: "e", eventTitle: "T", dateVenueLabel: "d", bookingRef: "CP-1",
        status: "upcoming", credentialStatus: "Bogus", credential: null, vcJwt: null, verifierUrl: null,
      }),
    ).toThrow();
  });

  it("enforces the event payload limits (title ≤80, description ≤200, capacity ≥1, ≥1 topic)", () => {
    const base = {
      title: "T", shortDescription: "S", fullDescription: "", category: "Workshop",
      date: "2026-10-24", startTime: "14:00", endTime: "16:00", venue: "D",
      online: false, onlineUrl: null, capacity: 10, waitlist: false,
      registrationDeadline: null, topics: ["semantic-web"],
    };
    expect(EventPayloadSchema.parse(base).title).toBe("T");
    expect(() => EventPayloadSchema.parse({ ...base, title: "x".repeat(81) })).toThrow();
    expect(() => EventPayloadSchema.parse({ ...base, shortDescription: "x".repeat(201) })).toThrow();
    expect(() => EventPayloadSchema.parse({ ...base, capacity: 0 })).toThrow();
    expect(() => EventPayloadSchema.parse({ ...base, topics: [] })).toThrow();
  });
});
