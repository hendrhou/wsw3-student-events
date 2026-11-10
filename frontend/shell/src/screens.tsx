import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import type { RegistrationResult } from "@campus-pulse/contracts";
import { remote } from "./remote";

/**
 * Route table glue: binds the four domain MFEs' exposed screens to shell
 * routes. Cross-MFE composition points (per design/components.md):
 *  - event detail renders participation-mfe's RegistrationPanel as its actions
 *  - the registration flow renders credentials-mfe's CredentialIssuance on success
 *  - check-in embeds credentials-mfe's CredentialVerifier
 */

const EventCatalogue = remote(() => import("eventsMfe/components").then((m) => m.EventCatalogue));
const EventDetails = remote(() => import("eventsMfe/components").then((m) => m.EventDetails));
const EventEditor = remote(() => import("eventsMfe/components").then((m) => m.EventEditor));
const EventManager = remote(() => import("eventsMfe/components").then((m) => m.EventManager));

const RegistrationFlowScreen = remote(() => import("participationMfe/components").then((m) => m.RegistrationFlow));
const RegistrationPanel = remote(() => import("participationMfe/components").then((m) => m.RegistrationPanel));
const RegistrationList = remote(() => import("participationMfe/components").then((m) => m.RegistrationList));
const CheckInPanel = remote(() => import("participationMfe/components").then((m) => m.CheckInPanel));

const TicketWallet = remote(() => import("credentialsMfe/components").then((m) => m.TicketWallet));
const CredentialIssuance = remote(() => import("credentialsMfe/components").then((m) => m.CredentialIssuance));
const CredentialVerifier = remote(() => import("credentialsMfe/components").then((m) => m.CredentialVerifier));

const ProfilePanel = remote(() => import("peopleMfe/components").then((m) => m.ProfilePanel));
const TeamManager = remote(() => import("peopleMfe/components").then((m) => m.TeamManager));

function useEventId(): string {
  return useParams<{ eventId: string }>().eventId ?? "";
}

// ---------- student area ----------

export function DiscoverPage() {
  return <EventCatalogue />;
}

export function EventPage() {
  const eventId = useEventId();
  return <EventDetails eventId={eventId} actions={<RegistrationPanel eventId={eventId} />} />;
}

export function RegisterPage() {
  const eventId = useEventId();
  return (
    <RegistrationFlowScreen
      eventId={eventId}
      renderCredential={(result: RegistrationResult): ReactNode => <CredentialIssuance {...result} />}
    />
  );
}

export function TicketsPage() {
  return <TicketWallet />;
}

export function ProfilePage() {
  return <ProfilePanel />;
}

// ---------- organiser area ----------

export function ManageEventsPage() {
  return <EventManager />;
}

export function NewEventPage() {
  return <EventEditor mode="create" />;
}

export function EditEventPage() {
  const eventId = useEventId();
  return <EventEditor mode="edit" eventId={eventId} />;
}

export function PreviewEventPage() {
  const eventId = useEventId();
  return <EventDetails eventId={eventId} />;
}

export function RegistrationsPage() {
  const eventId = useEventId();
  return <RegistrationList eventId={eventId} />;
}

export function CheckInPage() {
  const eventId = useEventId();
  return <CheckInPanel eventId={eventId} verifier={<CredentialVerifier />} />;
}

export function TeamPage() {
  return <TeamManager />;
}
