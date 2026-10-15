import { useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { Badge } from "./Badge";
import { ProgressBar } from "./ProgressBar";

export interface EventCardProps {
  title: string;
  category: string;
  dateLabel: string;
  venueTimeLabel: string;
  capacity: { used: number; total: number };
  coverSrc?: string;
  coverAlt?: string;
  full?: boolean;
  /** Whole card is one tab stop with role="link"; inner actions stay focusable. */
  onOpen: () => void;
  cta?: ReactNode;
}

/** EventCard (components.md §2): cover 16:9 → badge + date → title → meta → capacity + CTA. */
export function EventCard({ title, category, dateLabel, venueTimeLabel, capacity, coverSrc, coverAlt, full = false, onOpen, cta }: EventCardProps) {
  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
  }
  return (
    <div
      className="cp-card cp-card--interactive"
      role="link"
      tabIndex={0}
      aria-label={title}
      onClick={onOpen}
      onKeyDown={onKeyDown}
    >
      {coverSrc ? (
        <img className="cp-card__cover" src={coverSrc} alt={coverAlt ?? ""} loading="lazy" />
      ) : (
        <div className="cp-card__cover" role="img" aria-label={coverAlt ?? "Event cover placeholder"}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <div className="cp-card__body">
        <div className="cp-card__meta">
          <Badge type="neutral">{category}</Badge>
          <span className="cp-card__overline cp-tabular">{dateLabel}</span>
        </div>
        <h3 className="cp-card__title">{title}</h3>
        <span className="cp-card__subtitle">{venueTimeLabel}</span>
        <ProgressBar value={capacity.used} max={capacity.total} label={`${capacity.used}/${capacity.total}`} />
        {full ? <Badge type="warning">Full</Badge> : null}
        {cta ? (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- event-bubbling guard so card-level onOpen does not fire for CTA clicks
          <div
            className="cp-card__cta-row"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {cta}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface RecommendationCardProps extends EventCardProps {
  /** Plain-language SPARQL match explanation, e.g. "Recommended because you follow Semantic Web…". */
  matchReason: string;
  whyExplanation: string;
}

/**
 * RecommendationCard = EventCard + gold left border + expandable "Why this?"
 * (student-mfe S1). Gold marks the semantic-recommendation layer.
 */
export function RecommendationCard({ matchReason, whyExplanation, ...cardProps }: RecommendationCardProps) {
  const [open, setOpen] = useState(false);
  const panelId = `why-${matchReason.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="cp-card--recommendation" style={{ display: "contents" }}>
      <EventCard
        {...cardProps}
        cta={
          <>
            {cardProps.cta}
            <button
              type="button"
              className="cp-card__why"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((v) => !v)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Why this? Matches: {matchReason}
            </button>
          </>
        }
      />
      {/* The expander lives outside the card body for layout; CSS animates max-height. */}
      <div
        id={panelId}
        className={cn("cp-card__why-panel", open && "cp-card__why-panel--open")}
        hidden={!open}
      >
        {whyExplanation}
      </div>
    </div>
  );
}
