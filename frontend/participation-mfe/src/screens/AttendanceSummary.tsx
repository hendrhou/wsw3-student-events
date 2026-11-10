import { useQuery } from "@tanstack/react-query";
import { listRegistrations } from "@campus-pulse/api";
import { queryKeys, type EventProps } from "@campus-pulse/contracts";
import { Button, Skeleton, StatCard } from "@campus-pulse/ui";

export function AttendanceSummary({ eventId }: EventProps) {
  const query = useQuery({ queryKey: queryKeys.registrations(eventId, "registered"), queryFn: () => listRegistrations(eventId, "registered") });
  if (query.isPending) return <Skeleton height={80} />;
  if (query.isError) return <p role="alert">Attendance unavailable. <Button onClick={() => void query.refetch()}>Retry</Button></p>;
  return <section className="cp-chips-row" aria-label="Attendance summary">
    <StatCard label="Registrations" value={query.data.length} />
    <StatCard label="Checked in" value={query.data.filter((registration) => registration.status === "Checked-in").length} />
  </section>;
}