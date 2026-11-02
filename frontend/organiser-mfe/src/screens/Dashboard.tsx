import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listOrganiserEvents, type OrganiserEvent } from "@campus-pulse/api";
import { Badge, Button, EmptyState, FilterChip, ProgressBar, StatCard, Table, type BadgeType, type TableColumn } from "@campus-pulse/ui";

type StatusFilter = "All" | "Draft" | "Published" | "Past";

const STATUS_BADGE: Record<OrganiserEvent["lifecycleStatus"], BadgeType> = {
  Draft: "neutral",
  Published: "success",
  Cancelled: "error",
  Past: "neutral",
};

/** Dashboard stats derived from the events list (organiser-mfe.md O1). */
export function computeStats(events: OrganiserEvent[]) {
  const upcoming = events.filter((e) => e.lifecycleStatus === "Published");
  const registrations = events.reduce((sum, e) => sum + e.capacity.used, 0);
  const checkedIn = events.reduce((sum, e) => sum + e.checkedIn, 0);
  return {
    upcoming: upcoming.length,
    registrations,
    checkedInToday: checkedIn,
    pendingCheckIn: Math.max(0, registrations - checkedIn),
  };
}

/** O1 — Dashboard (my events): operational overview. */
export function Dashboard() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [search, setSearch] = useState("");

  const eventsQuery = useQuery({ queryKey: ["organiser", "events"], queryFn: listOrganiserEvents });
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const stats = computeStats(events);

  const filtered = events.filter((e) => {
    if (filter !== "All" && e.lifecycleStatus !== filter) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const columns: Array<TableColumn<OrganiserEvent>> = [
    { key: "title", header: "Event", sortable: true, render: (e) => <strong>{e.title}</strong> },
    { key: "date", header: "Date", sortable: true, render: (e) => <span className="cp-tabular">{e.date}</span> },
    { key: "venue", header: "Venue", render: (e) => e.venue },
    {
      key: "capacity",
      header: "Capacity",
      render: (e) => <ProgressBar value={e.capacity.used} max={e.capacity.total} label={`${e.capacity.used}/${e.capacity.total}`} />,
    },
    {
      key: "status",
      header: "Status",
      render: (e) => (
        <Badge type={e.capacity.used / e.capacity.total >= 0.9 && e.lifecycleStatus === "Published" ? "warning" : STATUS_BADGE[e.lifecycleStatus]}>
          {e.capacity.used / e.capacity.total >= 0.9 && e.lifecycleStatus === "Published" ? "Almost full" : e.lifecycleStatus}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (e) => (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- event-bubbling guard only; the Buttons inside are the interactive elements
        <span
          style={{ display: "flex", gap: "var(--cp-space-1)" }}
          onClick={(ev) => ev.stopPropagation()}
          onKeyDown={(ev) => ev.stopPropagation()}
        >
          <Button variant="ghost" size="sm" onClick={() => navigate(`/organiser/events/${e.id}/edit`)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/organiser/events/${e.id}/check-in`)}>Check-in</Button>
        </span>
      ),
    },
  ];

  return (
    <div className="cp-page">
      <div className="cp-page__header">
        <h1 className="cp-page__title">My events</h1>
        <Button onClick={() => navigate("/organiser/events/new")}>+ Create event</Button>
      </div>

      <div className="o1-stats" aria-label="Overview statistics">
        <StatCard value={stats.upcoming} label="Upcoming" />
        <StatCard value={stats.registrations} label="Registrations" />
        <StatCard value={stats.checkedInToday} label="Checked in today" />
        <StatCard value={stats.pendingCheckIn} label="Pending check-in" accent />
      </div>

      <div className="cp-chips-row">
        {(["All", "Draft", "Published", "Past"] as const).map((f) => (
          <FilterChip key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />
        ))}
        <div className="cp-search" style={{ marginLeft: "auto" }}>
          <input
            type="search"
            aria-label="Search events"
            placeholder="Search events"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Table
        columns={columns}
        rows={filtered}
        rowKey={(e) => e.id}
        loading={eventsQuery.isLoading}
        onRowClick={(e) => navigate(`/organiser/events/${e.id}/registrations`)}
        emptyState={
          <EmptyState
            title="No events yet — create your first"
            action={<Button onClick={() => navigate("/organiser/events/new")}>+ Create event</Button>}
          />
        }
        footerSummary={filtered.length > 0 ? `${filtered.length} of ${events.length} events` : undefined}
      />
    </div>
  );
}
