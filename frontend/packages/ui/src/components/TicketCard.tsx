import type { ReactNode } from "react";
import { cn } from "../utils/cn";
import { Badge, type BadgeType } from "./Badge";

export type TicketStatus = "upcoming" | "past" | "cancelled";

export interface TicketCardProps {
  title: string;
  dateVenueLabel: string;
  bookingRef: string;
  status: TicketStatus;
  statusBadge?: { type: BadgeType; label: string };
  /** Cancelled tickets render no actions. */
  actions?: ReactNode;
}

/** TicketCard (components.md §2): summary + booking ref + credential status badge + action row. */
export function TicketCard({ title, dateVenueLabel, bookingRef, status, statusBadge, actions }: TicketCardProps) {
  return (
    <article className={cn("cp-ticket", `cp-ticket--${status}`)}>
      <div className="cp-ticket__info">
        <h3 className="cp-ticket__title">{title}</h3>
        <span className="cp-ticket__meta">{dateVenueLabel}</span>
        <span className="cp-ticket__ref">{bookingRef}</span>
      </div>
      <div className="cp-ticket__actions">
        {statusBadge ? <Badge type={statusBadge.type}>{statusBadge.label}</Badge> : null}
        {status !== "cancelled" ? actions : null}
      </div>
    </article>
  );
}
