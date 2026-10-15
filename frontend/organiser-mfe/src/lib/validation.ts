import type { EventPayload } from "@campus-pulse/api";

export type EventFormValues = EventPayload;
export type EventFormErrors = Partial<Record<keyof EventPayload, string>>;

/**
 * Pure validation for the event create/edit form (organiser-mfe.md O2):
 * inline on blur, summary with anchors on submit. Mirrors EventPayloadSchema
 * so the client catches errors before the API does.
 */
export function validateEventForm(values: EventFormValues): EventFormErrors {
  const errors: EventFormErrors = {};
  if (!values.title.trim()) errors.title = "Title is required";
  else if (values.title.length > 80) errors.title = "Title must be 80 characters or fewer";
  if (!values.shortDescription.trim()) errors.shortDescription = "Short description is required";
  else if (values.shortDescription.length > 200) errors.shortDescription = "Short description must be 200 characters or fewer";
  if (!values.category) errors.category = "Choose a category";
  if (!values.date) errors.date = "Date is required";
  if (!values.startTime) errors.startTime = "Start time is required";
  if (!values.endTime) errors.endTime = "End time is required";
  if (!values.online && !values.venue.trim()) errors.venue = "Venue is required for on-site events";
  if (values.online && !values.onlineUrl?.trim()) errors.onlineUrl = "URL is required for online events";
  if (!Number.isInteger(values.capacity) || values.capacity < 1) errors.capacity = "Capacity must be at least 1";
  if (values.topics.length === 0) errors.topics = "Add at least one topic tag — these power recommendations";
  return errors;
}

export function hasErrors(errors: EventFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
