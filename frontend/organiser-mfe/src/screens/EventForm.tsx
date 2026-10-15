import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createEvent, getEvent, searchInterests, updateEvent, type EventPayload } from "@campus-pulse/api";
import { Button, Checkbox, Combobox, FilterChip, Input, Select, TextArea, type ComboboxOption } from "@campus-pulse/ui";
import { useToasts } from "../lib/toast";
import { hasErrors, validateEventForm, type EventFormErrors } from "../lib/validation";

const CATEGORIES = ["Workshop", "Talk", "Hackathon", "Fair", "Seminar", "Social"];

const EMPTY: EventPayload = {
  title: "",
  shortDescription: "",
  fullDescription: "",
  category: "",
  date: "",
  startTime: "",
  endTime: "",
  venue: "",
  online: false,
  onlineUrl: null,
  capacity: 40,
  waitlist: false,
  registrationDeadline: null,
  topics: [],
};

function draftKey(eventId: string | undefined): string {
  return `cp_draft_${eventId ?? "new"}`;
}

/**
 * O2 — Event create/edit. Fields map to ontology properties (they feed the
 * RDF transformation, R7). Validation on blur; error summary on submit;
 * autosave draft every 30s in edit mode.
 */
export function EventForm({ mode }: { mode: "create" | "edit" }) {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { push } = useToasts();

  const [values, setValues] = useState<EventPayload>(() => {
    try {
      const raw = window.localStorage.getItem(draftKey(eventId));
      return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<EventPayload>) } : EMPTY;
    } catch {
      return EMPTY;
    }
  });
  const [topics, setTopics] = useState<ComboboxOption[]>([]);
  const [topicQuery, setTopicQuery] = useState("");
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Edit mode: prefill from the API
  const eventQuery = useQuery({
    queryKey: ["events", eventId],
    queryFn: () => getEvent(eventId!),
    enabled: mode === "edit" && Boolean(eventId),
  });
  useEffect(() => {
    if (mode === "edit" && eventQuery.data) {
      const e = eventQuery.data;
      setValues((prev) => ({
        ...prev,
        title: e.title,
        shortDescription: e.shortDescription,
        fullDescription: e.about,
        category: e.category,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        venue: e.venue,
        capacity: e.capacity.total,
        topics: e.competences,
      }));
    }
  }, [mode, eventQuery.data]);

  // Autosave draft every 30s (edit mode)
  useEffect(() => {
    if (mode !== "edit") return;
    const timer = setInterval(() => {
      window.localStorage.setItem(draftKey(eventId), JSON.stringify(values));
      setLastSaved(new Date().toTimeString().slice(0, 5));
    }, 30_000);
    return () => clearInterval(timer);
  }, [mode, eventId, values]);

  const topicOptionsQuery = useQuery({
    queryKey: ["ontology", "interests", topicQuery],
    queryFn: () => searchInterests(topicQuery),
  });

  const mutation = useMutation({
    mutationFn: (payload: EventPayload) =>
      mode === "edit" && eventId ? updateEvent(eventId, payload) : createEvent(payload),
    onSuccess: ({ id }) => {
      window.localStorage.removeItem(draftKey(eventId));
      push({ type: "success", message: mode === "edit" ? "Event saved" : "Event published" });
      navigate(`/organiser/events/${id}/registrations`);
    },
    onError: () => push({ type: "error", message: "Could not save the event", actionLabel: "Retry", onAction: () => mutation.mutate(values) }),
  });

  function update<K extends keyof EventPayload>(key: K, value: EventPayload[K]) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (submitAttempted) setErrors(validateEventForm(next));
      return next;
    });
  }

  function blurValidate(key: keyof EventPayload) {
    const err = validateEventForm(values)[key];
    setErrors((prev) => {
      const next = { ...prev };
      if (err) next[key] = err;
      else delete next[key];
      return next;
    });
  }

  function submit(publish: boolean) {
    // Save draft never blocks on validation; Publish validates fully.
    if (!publish) {
      window.localStorage.setItem(draftKey(eventId), JSON.stringify(values));
      setLastSaved(new Date().toTimeString().slice(0, 5));
      push({ type: "info", message: "Draft saved" });
      return;
    }
    setSubmitAttempted(true);
    const errs = validateEventForm(values);
    setErrors(errs);
    if (hasErrors(errs)) return;
    mutation.mutate(values);
  }

  const topicOptions = useMemo(
    () => (topicOptionsQuery.data ?? []).filter((o) => !topics.some((t) => t.value === o.value)),
    [topicOptionsQuery.data, topics],
  );

  return (
    <div className="cp-page">
      <div className="cp-form-col">
        <nav aria-label="Breadcrumb" className="cp-muted">
          <Link to="/organiser" style={{ color: "var(--cp-brand-primary)" }}>My events</Link>
          {" / "}
          {mode === "edit" ? `Edit — ${values.title || "event"}` : "New event"}
        </nav>
        <h1 className="cp-page__title">{mode === "edit" ? "Edit event" : "Create event"}</h1>

        {submitAttempted && hasErrors(errors) ? (
          <div className="cp-error-panel" role="alert" aria-label="Form errors">
            <strong>Please fix the following:</strong>
            <ul style={{ margin: 0, paddingLeft: "var(--cp-space-4)" }}>
              {Object.values(errors).map((msg) => <li key={msg}>{msg}</li>)}
            </ul>
          </div>
        ) : null}

        <fieldset className="cp-fieldset">
          <legend className="cp-page__h2" style={{ padding: 0 }}>1 · Basics</legend>
          <Input label="Title" required maxLength={80} value={values.title} error={errors.title}
            onChange={(e) => update("title", e.target.value)} onBlur={() => blurValidate("title")} helperText="80 characters max" />
          <TextArea label="Short description" required maxLength={200} value={values.shortDescription} error={errors.shortDescription}
            onChange={(e) => update("shortDescription", e.target.value)} onBlur={() => blurValidate("shortDescription")} helperText="Shown in cards" />
          <TextArea label="Full description" value={values.fullDescription}
            onChange={(e) => update("fullDescription", e.target.value)} />
          <Select label="Category" required placeholder="Select…" value={values.category} error={errors.category}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            onChange={(e) => update("category", e.target.value)} onBlur={() => blurValidate("category")} />
          <Input label="Cover image alt text" value={values.fullDescription ? "" : ""} onChange={() => {}} helperText="Required when a cover image is uploaded" />
        </fieldset>

        <fieldset className="cp-fieldset">
          <legend className="cp-page__h2" style={{ padding: 0 }}>2 · Date & venue</legend>
          <div className="cp-form-row">
            <Input label="Date" required type="date" value={values.date} error={errors.date}
              onChange={(e) => update("date", e.target.value)} onBlur={() => blurValidate("date")} />
            <Input label="Start time" required type="time" value={values.startTime} error={errors.startTime}
              onChange={(e) => update("startTime", e.target.value)} onBlur={() => blurValidate("startTime")} />
            <Input label="End time" required type="time" value={values.endTime} error={errors.endTime}
              onChange={(e) => update("endTime", e.target.value)} onBlur={() => blurValidate("endTime")} />
          </div>
          <Select label="Venue" required={!values.online} placeholder="Search venue catalogue…" value={values.venue} error={errors.venue}
            options={["Building D, Room 2.14", "Auditorium A", "Auditorium B", "Main Hall", "Lab 3", "Campus Plaza"].map((v) => ({ value: v, label: v }))}
            onChange={(e) => update("venue", e.target.value)} onBlur={() => blurValidate("venue")}
            disabled={values.online} />
          <Checkbox label="Online event" checked={values.online} onChange={(e) => update("online", e.target.checked)} />
          {values.online ? (
            <Input label="Event URL" type="url" value={values.onlineUrl ?? ""} error={errors.onlineUrl}
              onChange={(e) => update("onlineUrl", e.target.value)} onBlur={() => blurValidate("onlineUrl")} />
          ) : null}
        </fieldset>

        <fieldset className="cp-fieldset">
          <legend className="cp-page__h2" style={{ padding: 0 }}>3 · Capacity & registration</legend>
          <div className="cp-form-row cp-form-row--2">
            <Input label="Capacity" required type="number" min={1} value={String(values.capacity)} error={errors.capacity}
              onChange={(e) => update("capacity", Number.parseInt(e.target.value, 10) || 0)} onBlur={() => blurValidate("capacity")} />
            <Input label="Registration deadline" type="date" value={values.registrationDeadline ?? ""}
              onChange={(e) => update("registrationDeadline", e.target.value || null)} helperText="Defaults to event start" />
          </div>
          <Checkbox label="Enable waitlist when full" checked={values.waitlist} onChange={(e) => update("waitlist", e.target.checked)} />
        </fieldset>

        <fieldset className="cp-fieldset">
          <legend className="cp-page__h2" style={{ padding: 0 }}>4 · Competences & topics</legend>
          <div className="cp-chips-row">
            {topics.map((t) => <FilterChip key={t.value} label={t.label} active onRemove={() => {
              setTopics(topics.filter((x) => x.value !== t.value));
              update("topics", topics.filter((x) => x.value !== t.value).map((x) => x.value));
            }} />)}
          </div>
          <Combobox
            label="Topic tags"
            placeholder="Search the ontology…"
            inputValue={topicQuery}
            onInputChange={setTopicQuery}
            options={topicOptions}
            loading={topicOptionsQuery.isFetching}
            onSelect={(option) => {
              setTopics([...topics, option]);
              update("topics", [...topics, option].map((t) => t.value));
              setTopicQuery("");
            }}
            error={errors.topics}
            helperText="These tags power semantic recommendations to students."
          />
        </fieldset>

        {mode === "edit" ? (
          <div className="cp-danger-zone">
            <Button variant="danger" size="sm">Cancel event</Button>
            <span className="cp-muted" style={{ marginLeft: "var(--cp-space-3)" }}>Always behind a confirmation; registered students are notified.</span>
          </div>
        ) : null}
      </div>

      <div className="cp-sticky-footer" role="region" aria-label="Form actions">
        {lastSaved ? <span className="cp-muted cp-tabular" style={{ marginRight: "auto" }}>Draft saved {lastSaved}</span> : <span style={{ marginRight: "auto" }} />}
        <Button variant="ghost" onClick={() => navigate("/organiser")}>Cancel</Button>
        <Button variant="secondary" onClick={() => submit(false)}>Save draft</Button>
        <Button loading={mutation.isPending} onClick={() => submit(true)}>{mode === "edit" ? "Save changes" : "Publish"}</Button>
      </div>
    </div>
  );
}
