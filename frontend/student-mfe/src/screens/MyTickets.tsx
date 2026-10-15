import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listMyTickets, type Ticket } from "@campus-pulse/api";
import { Badge, Button, CredentialCard, EmptyState, Modal, QrCard, Skeleton, TicketCard } from "@campus-pulse/ui";

type Tab = "upcoming" | "past";

function downloadJsonLd(ticket: Ticket) {
  if (!ticket.credential) return;
  const blob = new Blob([JSON.stringify(ticket.credential, null, 2)], { type: "application/ld+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ticket.bookingRef}.jsonld`;
  a.click();
  URL.revokeObjectURL(url);
}

/** S4 — My tickets: the student's verifiable-credentials wallet. */
export function MyTickets() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [presenting, setPresenting] = useState<Ticket | null>(null);
  const [viewingCredential, setViewingCredential] = useState<Ticket | null>(null);

  const ticketsQuery = useQuery({ queryKey: ["tickets"], queryFn: listMyTickets });

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const upcoming = tickets.filter((t) => t.status === "upcoming");
  const past = tickets.filter((t) => t.status !== "upcoming");
  const shown = tab === "upcoming" ? upcoming : past;

  return (
    <div className="cp-page">
      <div className="cp-page__header">
        <h1 className="cp-page__title">My tickets</h1>
        <div className="cp-tabs" role="tablist" aria-label="Ticket filters">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "upcoming"}
            className={tab === "upcoming" ? "cp-tab cp-tab--active" : "cp-tab"}
            onClick={() => setTab("upcoming")}
          >
            Upcoming ({upcoming.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "past"}
            className={tab === "past" ? "cp-tab cp-tab--active" : "cp-tab"}
            onClick={() => setTab("past")}
          >
            Past
          </button>
        </div>
      </div>

      {ticketsQuery.isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cp-space-3)", maxWidth: 760 }} aria-busy="true">
          <Skeleton height={96} /><Skeleton height={96} />
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          title="No tickets yet — discover events"
          guidance="Your registrations and credentials will appear here."
          action={<Button onClick={() => navigate("/events")}>Discover events</Button>}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cp-space-3)", maxWidth: 760 }}>
          {shown.map((ticket) => (
            <TicketCard
              key={ticket.id}
              title={ticket.eventTitle}
              dateVenueLabel={ticket.dateVenueLabel}
              bookingRef={ticket.bookingRef}
              status={ticket.status}
              statusBadge={{ type: ticket.credentialStatus === "Issued" || ticket.credentialStatus === "Verified" ? "success" : ticket.credentialStatus === "Revoked" ? "error" : ticket.credentialStatus === "Pending" ? "info" : "neutral", label: ticket.credentialStatus }}
              actions={
                <>
                  <Button variant="secondary" size="sm" onClick={() => setPresenting(ticket)}>Present ticket</Button>
                  <Button variant="ghost" size="sm" onClick={() => setViewingCredential(ticket)}>View credential</Button>
                </>
              }
            />
          ))}
        </div>
      )}

      <Modal open={presenting !== null} onClose={() => setPresenting(null)} title={presenting?.eventTitle ?? "Ticket"} size="md">
        {presenting ? (
          <div className="s4-modal-qr">
            <span className="cp-muted cp-tabular">{presenting.dateVenueLabel}</span>
            {presenting.vcJwt ? <QrCard value={presenting.vcJwt} /> : <p className="cp-muted">Credential unavailable for this ticket.</p>}
            <Badge
              type={presenting.credentialStatus === "Verified" || presenting.credentialStatus === "Issued" ? "success" : presenting.credentialStatus === "Revoked" ? "error" : "info"}
            >
              {presenting.credentialStatus}
            </Badge>
            {presenting.verifierUrl ? (
              <a href={presenting.verifierUrl} target="_blank" rel="noreferrer" style={{ color: "var(--cp-brand-primary)", font: "var(--cp-text-small)" }}>
                Verify online ↗
              </a>
            ) : null}
            <p className="cp-muted">QR works offline; verification needs network.</p>
            <Button variant="ghost" size="sm" onClick={() => downloadJsonLd(presenting)} disabled={!presenting.credential}>
              Download JSON-LD
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal open={viewingCredential !== null} onClose={() => setViewingCredential(null)} title="Verifiable credential" size="lg">
        {viewingCredential?.credential ? (
          <CredentialCard
            issuer="Campus Pulse Ticket Service"
            status={viewingCredential.credentialStatus}
            jsonLd={viewingCredential.credential}
          />
        ) : (
          <p className="cp-muted">No credential payload stored for this ticket.</p>
        )}
      </Modal>
    </div>
  );
}
