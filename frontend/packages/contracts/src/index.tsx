import { createContext, useContext, type ReactNode } from "react";
import type { QueryClient } from "@tanstack/react-query";

export type Role = "user" | "organiser" | "admin";
export interface SessionUser {
  readonly name: string;
  readonly studentNumber: string;
  readonly email: string;
  readonly role: Role;
}

export type Destination =
  | { page: "discover" | "tickets" | "profile" | "manageEvents" | "newEvent" | "team" }
  | { page: "event" | "register" | "editEvent" | "registrations" | "checkIn" | "previewEvent"; eventId: string };

export interface Notification {
  type: "success" | "warning" | "error" | "info";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface HostServices {
  readonly user: SessionUser | null;
  navigate: (destination: Destination, options?: { replace?: boolean }) => void;
  href: (destination: Destination) => string;
  notify: (notification: Notification) => void;
}

export interface EventProps { eventId: string }
export interface RegistrationResult { bookingRef: string; eventTitle: string }

const HostContext = createContext<HostServices | null>(null);

export function HostProvider({ value, children }: { value: HostServices; children: ReactNode }) {
  return <HostContext.Provider value={value}>{children}</HostContext.Provider>;
}

export function useHost(): HostServices {
  const host = useContext(HostContext);
  if (!host) throw new Error("Feature components require a HostProvider");
  return host;
}

export { destinationHref } from "./href";

export const queryKeys = {
  event: (eventId: string) => ["events", eventId] as const,
  tickets: ["tickets"] as const,
  organiserEvents: ["organiser", "events"] as const,
  registrations: (eventId: string, tab?: string) =>
    tab ? ["organiser", "registrations", eventId, tab] as const : ["organiser", "registrations", eventId] as const,
};

export async function invalidateParticipation(client: QueryClient, eventId: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["events"] }),
    client.invalidateQueries({ queryKey: queryKeys.tickets }),
    client.invalidateQueries({ queryKey: queryKeys.organiserEvents }),
    client.invalidateQueries({ queryKey: queryKeys.registrations(eventId) }),
  ]);
}