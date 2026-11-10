import { describe, expect, it } from "vitest";
import { destinationHref } from "./href";

describe("destinationHref", () => {
  it("maps area-level destinations to shell routes", () => {
    expect(destinationHref({ page: "discover" })).toBe("/events");
    expect(destinationHref({ page: "tickets" })).toBe("/tickets");
    expect(destinationHref({ page: "profile" })).toBe("/profile");
    expect(destinationHref({ page: "manageEvents" })).toBe("/organiser");
    expect(destinationHref({ page: "newEvent" })).toBe("/organiser/events/new");
    expect(destinationHref({ page: "team" })).toBe("/organiser/team");
  });

  it("maps event-scoped destinations and encodes ids", () => {
    expect(destinationHref({ page: "event", eventId: "evt 1" })).toBe("/events/evt%201");
    expect(destinationHref({ page: "register", eventId: "e1" })).toBe("/events/e1/register");
    expect(destinationHref({ page: "editEvent", eventId: "e1" })).toBe("/organiser/events/e1/edit");
    expect(destinationHref({ page: "registrations", eventId: "e1" })).toBe("/organiser/events/e1/registrations");
    expect(destinationHref({ page: "checkIn", eventId: "e1" })).toBe("/organiser/events/e1/check-in");
    expect(destinationHref({ page: "previewEvent", eventId: "e1" })).toBe("/organiser/events/e1/preview");
  });
});
