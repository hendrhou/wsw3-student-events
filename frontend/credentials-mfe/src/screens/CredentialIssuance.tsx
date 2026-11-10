import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCredentialStatus } from "@campus-pulse/api";
import type { RegistrationResult } from "@campus-pulse/contracts";
import { Badge } from "@campus-pulse/ui";

export function CredentialIssuance({ bookingRef }: RegistrationResult) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    setTimedOut(false);
    const timer = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(timer);
  }, [bookingRef]);
  const query = useQuery({
    queryKey: ["tickets", "credential-status", bookingRef],
    queryFn: () => getCredentialStatus(bookingRef),
    enabled: !timedOut,
    retry: false,
    refetchInterval: (query) => query.state.data && query.state.data.status !== "Pending" ? false : 1500,
  });
  const status = query.data?.status ?? "Pending";
  return <section aria-label="Credential issuance" aria-live="polite">
    <Badge type={status === "Issued" || status === "Verified" ? "success" : "info"}>{status}</Badge>
    {status === "Pending" && <p className="cp-muted">{timedOut ? "Your credential will appear in My tickets shortly." : "Issuing your verifiable credential…"}</p>}
  </section>;
}