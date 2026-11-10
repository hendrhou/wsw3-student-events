import { useQuery } from "@tanstack/react-query";
import { getEvent, listMyTickets } from "@campus-pulse/api";
import { useHost, queryKeys, type EventProps } from "@campus-pulse/contracts";
import { Badge, Button, Skeleton } from "@campus-pulse/ui";

export function RegistrationPanel({ eventId }: EventProps) {
  const { navigate } = useHost();
  const event = useQuery({ queryKey: queryKeys.event(eventId), queryFn: () => getEvent(eventId) });
  const tickets = useQuery({ queryKey: queryKeys.tickets, queryFn: listMyTickets });
  if (event.isPending || tickets.isPending) return <Skeleton height={48} />;
  if (event.isError || tickets.isError) return <p role="alert">Registration status unavailable. <Button onClick={() => { void event.refetch(); void tickets.refetch(); }}>Retry</Button></p>;
  const registered = tickets.data.some((ticket) => ticket.eventId === eventId && ticket.status !== "cancelled");
  if (registered) return <><Badge type="success">You're registered ✓</Badge><Button onClick={() => navigate({ page: "tickets" })}>View my tickets</Button></>;
  if (event.data.past) return <Button disabled>Event ended</Button>;
  if (event.data.full) return <Button variant="secondary" disabled>Join waitlist</Button>;
  return <Button onClick={() => navigate({ page: "register", eventId })}>Register</Button>;
}