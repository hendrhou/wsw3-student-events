import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ApiError, getCredentialStatus, getEvent, registerForEvent } from "@campus-pulse/api";
import { Button, Checkbox, CredentialCard, Skeleton, StepIndicator } from "@campus-pulse/ui";
import { getStoredUser } from "../lib/session";

type Step = 0 | 1 | 2;

const STEPS = ["Confirm details", "Review", "Done"];

/**
 * S3 — Registration flow: 2 steps + success. Credential issuance is async and
 * never blocks the user (student-mfe.md): Pending → poll → Issued, with a 10s
 * timeout falling back to an info note.
 */
export function RegistrationFlow() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const user = getStoredUser();

  const [step, setStep] = useState<Step>(0);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [policyError, setPolicyError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [credentialStatus, setCredentialStatus] = useState<"Pending" | "Issued">("Pending");
  const [credentialTimedOut, setCredentialTimedOut] = useState(false);

  const eventQuery = useQuery({
    queryKey: ["events", eventId],
    queryFn: () => getEvent(eventId!),
    enabled: Boolean(eventId),
  });

  // Poll credential issuance after success (10s timeout → soft note)
  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    const startedAt = Date.now();
    async function poll() {
      while (!cancelled && Date.now() - startedAt < 10_000) {
        try {
          const { status } = await getCredentialStatus(bookingRef ?? "");
          if (status === "Issued" || status === "Verified") {
            if (!cancelled) setCredentialStatus("Issued");
            return;
          }
        } catch {
          // transient — keep polling until the timeout
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!cancelled) setCredentialTimedOut(true);
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [step, bookingRef]);

  if (eventQuery.isLoading || !eventQuery.data) {
    return <div className="cp-page cp-center-col" aria-busy="true"><Skeleton height={400} /></div>;
  }
  const event = eventQuery.data;

  function onContinue() {
    if (!policyAccepted) {
      setPolicyError("You must accept the attendance policy to continue");
      return;
    }
    setPolicyError(undefined);
    setStep(1);
  }

  async function onConfirm() {
    if (!eventId) return;
    setSubmitting(true);
    setConflictMessage(null);
    try {
      const { bookingRef: ref } = await registerForEvent(eventId);
      window.localStorage.setItem(`cp_registered_${eventId}`, "1");
      setBookingRef(ref);
      setStep(2);
      // POST/redirect/GET: browser Back from success returns to the feed
      navigate(`/events/${eventId}/register?done=1`, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflictMessage(error.message);
      } else {
        setConflictMessage("Registration failed — please retry.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cp-page">
      <div className="cp-center-col">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <StepIndicator steps={STEPS} current={step} />
        </div>

        {step === 0 ? (
          <>
            <h1 className="cp-page__title">Confirm details</h1>
            <div className="cp-fieldset">
              <div className="cp-field">
                <span className="cp-field__label">Name</span>
                <div className="cp-field__control cp-field--readonly">{user?.name ?? "—"}</div>
              </div>
              <div className="cp-field">
                <span className="cp-field__label">Student number</span>
                <div className="cp-field__control cp-field--readonly cp-tabular">{user?.studentNumber ?? "—"}</div>
              </div>
              <Checkbox
                label="I agree to the event's attendance policy"
                checked={policyAccepted}
                error={policyError}
                onChange={(e) => {
                  setPolicyAccepted(e.target.checked);
                  if (e.target.checked) setPolicyError(undefined);
                }}
              />
            </div>
            <Button onClick={onContinue}>Continue →</Button>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1 className="cp-page__title">Review</h1>
            <div className="cp-fieldset" aria-label="Registration summary">
              <strong>{event.title}</strong>
              <span className="cp-muted cp-tabular">{event.date} · {event.startTime}–{event.endTime}</span>
              <span className="cp-muted">{event.venue}</span>
            </div>
            {conflictMessage ? (
              <div className="cp-error-panel" role="alert">
                <strong>{conflictMessage}</strong>
                <div style={{ display: "flex", gap: "var(--cp-space-2)" }}>
                  <Link to="/tickets" style={{ color: "inherit" }}>View my tickets</Link>
                  <Link to={`/events/${event.id}`} style={{ color: "inherit" }}>Join waitlist</Link>
                </div>
              </div>
            ) : null}
            <div style={{ display: "flex", gap: "var(--cp-space-2)" }}>
              <Button variant="ghost" onClick={() => setStep(0)}>← Back</Button>
              <Button loading={submitting} onClick={onConfirm}>Confirm registration</Button>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="cp-success-panel">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="var(--cp-success)" strokeWidth="1.5" />
                <path d="m9 12 2 2 4-4" stroke="var(--cp-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h2>You're registered!</h2>
              <span>
                Booking reference: <strong className="cp-tabular">{bookingRef}</strong>
              </span>
            </div>
            <CredentialCard
              issuer="Campus Pulse Ticket Service"
              status={credentialStatus}
              jsonLd={{
                "@context": ["https://www.w3.org/ns/credentials/v2"],
                type: ["VerifiableCredential", "EventTicket"],
                issuer: "did:web:campus-pulse.ufp.pt",
                credentialSubject: { event: event.title, bookingRef },
              }}
            />
            {credentialStatus === "Pending" && !credentialTimedOut ? (
              <p className="cp-muted" aria-live="polite">Issuing your verifiable credential…</p>
            ) : null}
            {credentialTimedOut ? (
              <p className="cp-note" role="status">Your credential will appear in My tickets shortly.</p>
            ) : null}
            <div style={{ display: "flex", gap: "var(--cp-space-2)", justifyContent: "center" }}>
              <Button onClick={() => navigate("/tickets")}>View my tickets</Button>
              <Button variant="ghost" onClick={() => navigate(`/events/${event.id}`)}>Back to event</Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
