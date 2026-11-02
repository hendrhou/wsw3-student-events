import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getEvent, listEvents } from "@campus-pulse/api";
import { Badge, Button, EmptyState, EventCard, ProgressBar, Skeleton } from "@campus-pulse/ui";

/** Register button states (student-mfe.md S2): default/loading/registered/full/past. */
export function registerCtaState(event: { full: boolean; past: boolean }, registered: boolean): "register" | "registered" | "waitlist" | "ended" {
  if (registered) return "registered";
  if (event.past) return "ended";
  if (event.full) return "waitlist";
  return "register";
}

/** S2 — Event detail. */
export function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  // Registered-state is optimistic UI after returning from S3 (interim: localStorage flag).
  const registeredFlag = eventId ? window.localStorage.getItem(`cp_registered_${eventId}`) === "1" : false;

  const eventQuery = useQuery({
    queryKey: ["events", eventId],
    queryFn: () => getEvent(eventId!),
    enabled: Boolean(eventId),
  });

  const relatedQuery = useQuery({
    queryKey: ["events", "related", eventQuery.data?.category],
    queryFn: () => listEvents({ category: eventQuery.data?.category }),
    enabled: Boolean(eventQuery.data),
  });

  if (eventQuery.isLoading) {
    return (
      <div className="cp-page" aria-busy="true" aria-label="Loading event">
        <Skeleton height={32} width={300} />
        <Skeleton height={400} />
      </div>
    );
  }

  if (eventQuery.isError || !eventQuery.data) {
    return (
      <div className="cp-page">
        <EmptyState
          title="Event not found"
          guidance="The link may be broken or the event was removed."
          action={<Button variant="secondary" onClick={() => navigate("/events")}>Back to discovery</Button>}
        />
      </div>
    );
  }

  const event = eventQuery.data;
  const ctaState = registerCtaState(event, registeredFlag);
  const seatsLeft = event.capacity.total - event.capacity.used;
  const related = (relatedQuery.data ?? []).filter((e) => e.id !== event.id).slice(0, 3);

  return (
    <div className="cp-page">
      <nav aria-label="Breadcrumb" className="cp-muted">
        <Link to="/events" style={{ color: "var(--cp-brand-primary)" }}>Discover</Link>
        {" / "}
        {event.title}
      </nav>

      <div className="cp-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cp-space-4)" }}>
          <h1 className="cp-page__title">{event.title}</h1>
          <div className="cp-chips-row">
            <Badge type="neutral">{event.category}</Badge>
            {event.competences.map((c) => <Badge key={c} type="info">{c}</Badge>)}
          </div>
          <div className="cp-card__cover" role="img" aria-label={`Cover image for ${event.title}`} style={{ borderRadius: "var(--cp-radius-md)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="cp-page__h2">About</h2>
          <p>{event.about}</p>
          <h2 className="cp-page__h2">What you'll gain</h2>
          <div className="cp-chips-row">
            {event.competences.map((c) => <Badge key={c} type="neutral">{c}</Badge>)}
          </div>
          <h2 className="cp-page__h2">Schedule</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cp-space-2)" }}>
            {event.schedule.map((slot) => (
              <div key={slot.time} style={{ display: "flex", gap: "var(--cp-space-4)" }}>
                <span className="cp-tabular cp-muted" style={{ minWidth: 48 }}>{slot.time}</span>
                <span>{slot.item}</span>
              </div>
            ))}
          </div>
        </div>

        <aside aria-label="Event details" style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: "var(--cp-space-3)", background: "var(--cp-surface-card)", border: "var(--cp-border-default)", borderRadius: "var(--cp-radius-md)", padding: "var(--cp-space-6)", boxShadow: "var(--cp-shadow-1)" }}>
          <div className="cp-tabular">{event.date} · {event.startTime}–{event.endTime}</div>
          <div>{event.venue}</div>
          <div className="cp-muted">By <strong style={{ color: "var(--cp-brand-primary)" }}>{event.organiser}</strong></div>
          <ProgressBar value={event.capacity.used} max={event.capacity.total} label={`${event.capacity.used}/${event.capacity.total}`} />
          {ctaState === "ended" ? null : (
            <span className="cp-muted" style={{ color: seatsLeft <= 10 ? "var(--cp-warning)" : undefined }}>
              {seatsLeft} seats left
            </span>
          )}
          {ctaState === "register" && (
            <Button onClick={() => navigate(`/events/${event.id}/register`)}>Register</Button>
          )}
          {ctaState === "registered" && (
            <>
              <Badge type="success">You're registered ✓</Badge>
              <Button variant="secondary" onClick={() => navigate("/tickets")}>View my tickets</Button>
            </>
          )}
          {ctaState === "waitlist" && <Button variant="secondary">Join waitlist</Button>}
          {ctaState === "ended" && <Button disabled>Event ended</Button>}
          <Button variant="ghost">Save</Button>
        </aside>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-heading">
          <h2 id="related-heading" className="cp-page__h2" style={{ marginBottom: "var(--cp-space-4)" }}>Related events</h2>
          <div className="cp-card-grid">
            {related.map((e) => (
              <EventCard
                key={e.id}
                title={e.title}
                category={e.category}
                dateLabel={e.date}
                venueTimeLabel={`${e.venue} · ${e.startTime}`}
                capacity={e.capacity}
                full={e.full}
                onOpen={() => navigate(`/events/${e.id}`)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
