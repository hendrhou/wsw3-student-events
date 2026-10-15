import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, grantOrganiser, listStaff, revokeOrganiser } from "@campus-pulse/api";
import { Badge, Button, EmptyState, Input, Skeleton } from "@campus-pulse/ui";
import { useToasts } from "../lib/toast";

function validateEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Enter a valid email";
  if (!email.endsWith("@ufp.edu.pt")) return "Only @ufp.edu.pt accounts can be organisers";
  return null;
}

/**
 * Team access (admin only): grant and revoke the organiser role in-app.
 * Roles land in the database immediately and reach the person's JWT at their
 * next sign-in — the UI says so explicitly.
 */
export function Team() {
  const { push } = useToasts();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const staffQuery = useQuery({ queryKey: ["admin", "staff"], queryFn: listStaff });
  const staff = staffQuery.data ?? [];

  const grant = useMutation({
    mutationFn: (value: string) => grantOrganiser(value),
    onSuccess: (data) => {
      push({ type: "success", message: data.message });
      setEmail("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not grant access");
    },
  });

  const revoke = useMutation({
    mutationFn: (value: string) => revokeOrganiser(value),
    onSuccess: (_data, value) => {
      push({ type: "info", message: `Organiser access revoked for ${value} — applies at their next sign-in` });
      void queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
    onError: (err) => {
      push({ type: "error", message: err instanceof ApiError ? err.message : "Could not revoke access" });
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    const invalid = validateEmail(value);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (staff.some((m) => m.email === value)) {
      setError("This person already has staff access");
      return;
    }
    setError(null);
    grant.mutate(value);
  }

  return (
    <div className="cp-page">
      <div className="cp-page__header">
        <div>
          <h1 className="cp-page__title">Team access</h1>
          <p className="cp-muted">
            Organisers can create events and run check-in. Changes apply at the person's next sign-in.
            Admins are managed by the platform team.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ display: "flex", gap: "var(--cp-space-3)", alignItems: "flex-start", maxWidth: 520 }}>
        <div style={{ flex: 1 }}>
          <Input
            label="UFP email"
            placeholder="colleague@ufp.edu.pt"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error ?? undefined}
          />
        </div>
        <Button type="submit" disabled={grant.isPending}>Add organiser</Button>
      </form>

      {staffQuery.isLoading ? (
        <Skeleton height={120} />
      ) : staff.length === 0 ? (
        <EmptyState title="No organisers yet" guidance="Add a colleague above to give them organiser access." />
      ) : (
        <ul aria-label="Staff" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--cp-space-2)" }}>
          {staff.map((member) => (
            <li
              key={member.email}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--cp-space-4)",
                padding: "var(--cp-space-3) var(--cp-space-4)", border: "var(--cp-border-default)",
                borderRadius: "var(--cp-radius-md)", background: "var(--cp-brand-white)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--cp-space-3)" }}>
                <span className="cp-avatar cp-avatar--32" aria-hidden>
                  {member.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <div>{member.name}</div>
                  <div className="cp-muted" style={{ fontSize: 14 }}>{member.email}</div>
                </div>
                <Badge type={member.role === "admin" ? "accent" : "success"}>{member.role === "admin" ? "Admin" : "Organiser"}</Badge>
              </div>
              {member.role === "organiser" ? (
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(member.email)} disabled={revoke.isPending}>
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
