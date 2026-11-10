import type { Destination } from "./index";

/**
 * The shell's route table for feature destinations. Lives in the contracts
 * package so the host and standalone MFE dev entries share one mapping.
 */
export function destinationHref(destination: Destination): string {
  switch (destination.page) {
    case "discover": return "/events";
    case "tickets": return "/tickets";
    case "profile": return "/profile";
    case "manageEvents": return "/organiser";
    case "newEvent": return "/organiser/events/new";
    case "team": return "/organiser/team";
    case "event": return `/events/${encodeURIComponent(destination.eventId)}`;
    case "register": return `/events/${encodeURIComponent(destination.eventId)}/register`;
    case "editEvent": return `/organiser/events/${encodeURIComponent(destination.eventId)}/edit`;
    case "registrations": return `/organiser/events/${encodeURIComponent(destination.eventId)}/registrations`;
    case "checkIn": return `/organiser/events/${encodeURIComponent(destination.eventId)}/check-in`;
    case "previewEvent": return `/organiser/events/${encodeURIComponent(destination.eventId)}/preview`;
  }
}
