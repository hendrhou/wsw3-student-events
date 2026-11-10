import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, getEvent, registerForEvent } from "@campus-pulse/api";
import { Button, Checkbox, Skeleton, StepIndicator } from "@campus-pulse/ui";
import { useHost, invalidateParticipation, type EventProps, type RegistrationResult } from "@campus-pulse/contracts";

type Step = 0 | 1 | 2;

const STEPS = ["Confirm details", "Review", "Done"];

/**
 * S3 — Registration flow: 2 steps + success. Credential issuance is async and
 * never blocks the user (student-mfe.md): Pending → poll → Issued, with a 10s
 * timeout falling back to an info note.
 */
export function RegistrationFlow({ eventId, renderCredential }: EventProps & { renderCredential?: (result: RegistrationResult) => ReactNode }) {
  const { navigate, href, user } = useHost();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>(0);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [policyError, setPolicyError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const eventQuery = useQuery({
    queryKey: ["events", eventId],
    queryFn: () => getEvent(eventId!),
    enabled: Boolean(eventId),
  });

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
      setBookingRef(ref);
      setStep(2);
      void invalidateParticipation(queryClient, eventId);
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
                  <a href={href({ page: "tickets" })} style={{ color: "inherit" }}>View my tickets</a>
                  <a href={href({ page: "event", eventId })} style={{ color: "inherit" }}>Join waitlist</a>
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
            {bookingRef && renderCredential?.({ bookingRef, eventTitle: event.title })}
            <div style={{ display: "flex", gap: "var(--cp-space-2)", justifyContent: "center" }}>
              <Button onClick={() => navigate({ page: "tickets" })}>View my tickets</Button>
              <Button variant="ghost" onClick={() => navigate({ page: "event", eventId })}>Back to event</Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
