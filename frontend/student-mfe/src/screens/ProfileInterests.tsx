import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { saveMyInterests, searchInterests } from "@campus-pulse/api";
import { apiFetch } from "@campus-pulse/api";
import { Badge, Button, Combobox, FilterChip, Skeleton, type ComboboxOption } from "@campus-pulse/ui";
import { getStoredUser } from "../lib/session";
import { useToasts } from "../lib/toast";

function sameSets(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** S5 — Profile & interests: the interest profile feeding semantic recommendations. */
export function ProfileInterests() {
  const user = getStoredUser();
  const queryClient = useQueryClient();
  const { push } = useToasts();

  const savedQuery = useQuery({
    queryKey: ["profile", "interests"],
    queryFn: async () => {
      const data = await apiFetch<ComboboxOption[]>("/profile/interests");
      return data;
    },
  });

  const [selected, setSelected] = useState<ComboboxOption[] | null>(null);
  const current = useMemo(() => selected ?? savedQuery.data ?? [], [selected, savedQuery.data]);
  const dirty = selected !== null && !sameSets(selected.map((i) => i.value), (savedQuery.data ?? []).map((i) => i.value));

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const optionsQuery = useQuery({
    queryKey: ["ontology", "interests", debouncedQuery],
    queryFn: () => searchInterests(debouncedQuery),
    enabled: debouncedQuery.length >= 0,
  });
  const options = (optionsQuery.data ?? []).filter((o) => !current.some((c) => c.value === o.value));

  const saveMutation = useMutation({
    mutationFn: (values: string[]) => saveMyInterests(values),
    onSuccess: () => {
      push({ type: "success", message: "Interests saved — recommendations updated" });
      void queryClient.invalidateQueries({ queryKey: ["profile", "interests"] });
      void queryClient.invalidateQueries({ queryKey: ["recommendations"] });
    },
    onError: () => {
      push({ type: "error", message: "Could not save interests", actionLabel: "Retry", onAction: () => saveMutation.mutate(current.map((i) => i.value)) });
    },
  });

  function addInterest(interest: ComboboxOption) {
    setSelected([...current, interest]);
    setQuery("");
  }

  function removeInterest(value: string) {
    const next = current.filter((i) => i.value !== value);
    setSelected(next);
    push({ type: "info", message: "Your recommendations will update within a few minutes." });
  }

  return (
    <div className="cp-page">
      <div className="cp-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cp-space-4)" }}>
          <h1 className="cp-page__title">Profile</h1>
          <h2 className="cp-page__h2">My interests</h2>
          {savedQuery.isLoading ? (
            <Skeleton height={44} />
          ) : (
            <>
              <div className="cp-chips-row" aria-label="Your interests">
                {current.map((interest) => (
                  <FilterChip key={interest.value} label={interest.label} active onRemove={() => removeInterest(interest.value)} />
                ))}
              </div>
              <Combobox
                label="Add interest"
                placeholder="Search the ontology…"
                inputValue={query}
                onInputChange={setQuery}
                options={options}
                loading={optionsQuery.isFetching}
                onSelect={addInterest}
                helperText="Suggestions come from the course ontology — free text is not allowed."
              />
            </>
          )}

          <h2 className="cp-page__h2" style={{ marginTop: "var(--cp-space-6)" }}>Programme & courses</h2>
          <div className="cp-fieldset" style={{ background: "var(--cp-neutral-100)" }}>
            <strong>BSc Computer Science — Year 3</strong>
            <span className="cp-muted">Semantic Web and Web 3.0 · Databases II · Software Engineering</span>
            <span className="cp-muted">Read-only — synced from academic records.</span>
          </div>
        </div>

        <aside aria-label="Profile summary" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--cp-space-2)", background: "var(--cp-surface-card)", border: "var(--cp-border-default)", borderRadius: "var(--cp-radius-md)", padding: "var(--cp-space-6)", boxShadow: "var(--cp-shadow-1)", textAlign: "center" }}>
          <span className="cp-avatar cp-avatar--40" aria-hidden="true" style={{ width: 64, height: 64, fontSize: 20 }}>
            {user?.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
          </span>
          <strong style={{ font: "var(--cp-text-h3)" }}>{user?.name ?? "Student"}</strong>
          <span className="cp-muted cp-tabular">{user?.studentNumber ?? ""}</span>
          <span className="cp-muted">BSc Computer Science</span>
          <Badge type="neutral">Student</Badge>
          <p className="cp-note" style={{ justifyContent: "center" }}>Interests power your recommendations.</p>
        </aside>
      </div>

      {dirty ? (
        <div className="cp-sticky-footer" role="region" aria-label="Unsaved changes">
          <span className="cp-muted" style={{ marginRight: "auto", color: "var(--cp-warning)" }}>Unsaved changes</span>
          <Button variant="ghost" onClick={() => setSelected(null)}>Discard</Button>
          <Button
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate(current.map((i) => i.value))}
          >
            Save changes
          </Button>
        </div>
      ) : null}
    </div>
  );
}
