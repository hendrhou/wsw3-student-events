// Ambient types for the federated remotes (resolved at runtime by Module
// Federation — the packages are not TypeScript project references of the shell).
declare module "eventsMfe/components" {
  import type { ComponentType, ReactNode } from "react";
  export const EventCatalogue: ComponentType;
  export const EventDetails: ComponentType<{ eventId: string; actions?: ReactNode }>;
  export const EventEditor: ComponentType<{ mode: "create" | "edit"; eventId?: string }>;
  export const EventManager: ComponentType;
}

declare module "participationMfe/components" {
  import type { ComponentType, ReactNode } from "react";
  import type { RegistrationResult } from "@campus-pulse/contracts";
  export const RegistrationFlow: ComponentType<{ eventId: string; renderCredential?: (result: RegistrationResult) => ReactNode }>;
  export const RegistrationPanel: ComponentType<{ eventId: string }>;
  export const RegistrationList: ComponentType<{ eventId: string }>;
  export const AttendanceSummary: ComponentType<{ eventId: string }>;
  export const CheckInPanel: ComponentType<{ eventId: string; verifier?: ReactNode }>;
}

declare module "credentialsMfe/components" {
  import type { ComponentType } from "react";
  import type { RegistrationResult } from "@campus-pulse/contracts";
  export const TicketWallet: ComponentType;
  export const CredentialIssuance: ComponentType<RegistrationResult>;
  export const CredentialVerifier: ComponentType<{ onVerified?: (credential: { token: string; bookingRef: string }) => void }>;
}

declare module "peopleMfe/components" {
  import type { ComponentType } from "react";
  export const ProfilePanel: ComponentType;
  export const TeamManager: ComponentType;
}
