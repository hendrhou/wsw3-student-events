import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { exportRegistrationsCsv, getEvent, listRegistrations, type RegistrationRow } from "@campus-pulse/api";
import { Badge, Button, EmptyState, ProgressBar, Table, type BadgeType, type TableColumn } from "@campus-pulse/ui";
import { useToasts } from "../lib/toast";

type Tab = "registered" | "waitlist" | "cancelled";

const STATUS_BADGE: Record<RegistrationRow["status"], BadgeType> = {
  Confirmed: "success",
  Waitlisted: "warning",
  "Checked-in": "info",
  Cancelled: "neutral",
};

/** O3 — Registrations list: operational hub before the event. */
export function Registrations() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { push } = useToasts();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab | null) ?? "registered";
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const eventQuery = useQuery({
    queryKey: ["events", eventId],
    queryFn: () => getEvent(eventId!),
    enabled: Boolean(eventId),
  });

  const regsQuery = useQuery({
    queryKey: ["organiser", "registrations", eventId, tab],
    queryFn: () => listRegistrations(eventId!, tab),
    enabled: Boolean(eventId),
  });

  const rows = useMemo(() => {
    const data = regsQuery.data ?? [];
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((r) => r.name.toLowerCase().includes(q) || r.studentNumber.includes(q));
  }, [regsQuery.data, search]);

  function setTab(next: Tab) {
    setSearchParams({ tab: next }, { replace: true });
  }

  async function exportCsv() {
    if (!eventId) return;
    setExporting(true);
    try {
      const blob = await exportRegistrationsCsv(eventId, search);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `registrations-${eventId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      push({ type: "success", message: "CSV exported" });
    } catch {
      push({ type: "error", message: "Export failed — retry", actionLabel: "Retry", onAction: () => void exportCsv() });
    } finally {
      setExporting(false);
    }
  }

  const columns: Array<TableColumn<RegistrationRow>> = [
    { key: "name", header: "Name", sortable: true, render: (r) => <strong>{r.name}</strong> },
    { key: "studentNumber", header: "Student no.", render: (r) => <span className="cp-tabular">{r.studentNumber}</span> },
    { key: "registeredAt", header: "Registered at", sortable: true, render: (r) => <span className="cp-tabular">{r.registeredAt}</span> },
    { key: "status", header: "Status", render: (r) => <Badge type={STATUS_BADGE[r.status]}>{r.status}</Badge> },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <span style={{ display: "flex", gap: "var(--cp-space-1)" }}>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/organiser/events/${eventId}/check-in`)}>Check in</Button>
          <Button variant="ghost" size="sm" aria-label={`Cancel registration of ${r.name}`}>Cancel</Button>
        </span>
      ),
    },
  ];

  const event = eventQuery.data;

  return (
    <div className="cp-page">
      <nav aria-label="Breadcrumb" className="cp-muted">
        <Link to="/organiser" style={{ color: "var(--cp-brand-primary)" }}>My events</Link>
        {" / "}
        {event?.title ?? "…"}
        {" / Registrations"}
      </nav>

      <div className="cp-page__header">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--cp-space-3)" }}>
          <h1 className="cp-page__title">{event?.title ?? "Registrations"}</h1>
          {event ? <Badge type={event.past ? "neutral" : "success"}>{event.past ? "Past" : "Published"}</Badge> : null}
        </div>
        <Button onClick={() => navigate(`/organiser/events/${eventId}/check-in`)}>Open check-in →</Button>
      </div>

      {event ? (
        <div className="cp-muted" style={{ display: "flex", alignItems: "center", gap: "var(--cp-space-3)" }}>
          <span className="cp-tabular">{event.date} · {event.startTime}–{event.endTime} · {event.venue}</span>
          <ProgressBar value={event.capacity.used} max={event.capacity.total} label={`${event.capacity.used}/${event.capacity.total}`} />
        </div>
      ) : null}

      <div className="cp-tabs" role="tablist" aria-label="Registration groups">
        {(["registered", "waitlist", "cancelled"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "cp-tab cp-tab--active" : "cp-tab"}
            onClick={() => setTab(t)}
          >
            {t === "registered" ? "Registered" : t === "waitlist" ? "Waitlist" : "Cancelled"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--cp-space-3)", flexWrap: "wrap" }}>
        <div className="cp-search">
          <input
            type="search"
            aria-label="Search by name or number"
            placeholder="Search by name or number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="secondary" loading={exporting} onClick={exportCsv}>Export CSV</Button>
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={regsQuery.isLoading}
        emptyState={
          <EmptyState
            title={tab === "waitlist" ? "No one on the waitlist" : tab === "cancelled" ? "No cancellations" : "No registrations yet"}
            guidance={search ? "Try a different search." : undefined}
          />
        }
        footerSummary={rows.length > 0 ? `${rows.length} shown` : undefined}
      />
    </div>
  );
}
