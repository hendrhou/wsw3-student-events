import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listEvents, getMyRecommendations, type EventSummary } from "@campus-pulse/api";
import { Badge, Button, EmptyState, EventCard, FilterChip, RecommendationCard, Skeleton } from "@campus-pulse/ui";

const PAGE_SIZE = 12;
const CATEGORIES = ["Workshop", "Talk", "Hackathon", "Fair", "Seminar", "Social"];

function formatDateLabel(e: EventSummary): string {
  return `${e.date}`.slice(5).split("-").reverse().join("/");
}

/**
 * S1 — Event discovery feed. Recommendations fail-soft: the gold section
 * hides on error and the feed is unaffected (student-mfe.md).
 */
export function DiscoveryFeed() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Debounced search (300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const eventsQuery = useQuery({
    queryKey: ["events", { q: query, category }],
    queryFn: () => listEvents({ q: query, category: category ?? undefined }),
  });

  const recsQuery = useQuery({
    queryKey: ["recommendations", "me"],
    queryFn: getMyRecommendations,
    retry: false,
  });

  const allEvents = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const visible = allEvents.slice(0, page * PAGE_SIZE);
  const hasMore = allEvents.length > visible.length;

  function clearFilters() {
    setSearchInput("");
    setQuery("");
    setCategory(null);
    setPage(1);
  }

  return (
    <div className="cp-page">
      <div className="cp-page__header">
        <h1 className="cp-page__title">Discover events</h1>
        <div style={{ display: "flex", gap: "var(--cp-space-3)", alignItems: "center" }}>
          <div className="cp-search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              aria-label="Search events"
              placeholder="Search events"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput ? (
              <Button variant="ghost" size="sm" aria-label="Clear search" onClick={() => setSearchInput("")}>×</Button>
            ) : null}
          </div>
        </div>
      </div>

      {category || query ? (
        <div className="cp-chips-row" aria-label="Active filters">
          {category ? <FilterChip label={`Category: ${category}`} active onRemove={() => setCategory(null)} /> : null}
          {query ? <FilterChip label={`Search: ${query}`} active onRemove={() => { setSearchInput(""); setQuery(""); }} /> : null}
          <Button variant="ghost" size="sm" onClick={clearFilters}>× Clear all</Button>
        </div>
      ) : (
        <div className="cp-chips-row" aria-label="Filter by category">
          {CATEGORIES.map((c) => (
            <FilterChip key={c} label={c} active={category === c} onClick={() => { setCategory(c); setPage(1); }} />
          ))}
        </div>
      )}

      {recsQuery.data && recsQuery.data.length > 0 ? (
        <section aria-labelledby="recs-heading">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--cp-space-2)", marginBottom: "var(--cp-space-4)" }}>
            <h2 id="recs-heading" className="cp-page__h2">Recommended for you</h2>
            <Badge type="accent">Matched to you</Badge>
          </div>
          <div className="s1-rec-row">
            {recsQuery.data.slice(0, 5).map((rec) => (
              <RecommendationCard
                key={rec.event.id}
                title={rec.event.title}
                category={rec.event.category}
                dateLabel={formatDateLabel(rec.event)}
                venueTimeLabel={`${rec.event.venue} · ${rec.event.startTime}–${rec.event.endTime}`}
                capacity={rec.event.capacity}
                full={rec.event.full}
                matchReason={rec.matchReason}
                whyExplanation={rec.explanation}
                onOpen={() => navigate(`/events/${rec.event.id}`)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="all-heading">
        <h2 id="all-heading" className="cp-page__h2" style={{ marginBottom: "var(--cp-space-4)" }}>All upcoming events</h2>
        {eventsQuery.isLoading ? (
          <div className="cp-card-grid" aria-busy="true" aria-label="Loading events">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={320} />)}
          </div>
        ) : eventsQuery.isError ? (
          <EmptyState
            title="Events could not be loaded"
            guidance="Check your connection and try again."
            action={<Button variant="secondary" onClick={() => eventsQuery.refetch()}>Retry</Button>}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No events match your filters"
            guidance="Try adjusting or clearing your search criteria."
            action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <>
            <div className="cp-card-grid">
              {visible.map((event) => (
                <EventCard
                  key={event.id}
                  title={event.title}
                  category={event.category}
                  dateLabel={formatDateLabel(event)}
                  venueTimeLabel={`${event.venue} · ${event.startTime}–${event.endTime}`}
                  capacity={event.capacity}
                  full={event.full}
                  onOpen={() => navigate(`/events/${event.id}`)}
                  cta={
                    event.full ? (
                      <Button variant="secondary" size="sm" onClick={() => navigate(`/events/${event.id}`)}>Join waitlist</Button>
                    ) : undefined
                  }
                />
              ))}
            </div>
            {hasMore ? (
              <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--cp-space-6)" }}>
                <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>Load more</Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
