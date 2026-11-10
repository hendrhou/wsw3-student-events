import { useEffect, useMemo, useState } from "react";
import { useHost } from "@campus-pulse/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiAssetUrl, createEvent, deleteEventCover, getEvent, searchInterests, updateEvent, uploadEventCover, type EventPayload } from "@campus-pulse/api";
import { Button, Checkbox, Combobox, FilterChip, Input, Select, TextArea, type ComboboxOption } from "@campus-pulse/ui";
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
export function EventForm({ mode, eventId }: { mode: "create" | "edit"; eventId?: string }) {
  const { navigate, href, notify: push } = useHost();
  const queryClient = useQueryClient();

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
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverAltText, setCoverAltText] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [savedEventId, setSavedEventId] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    if (typeof URL.createObjectURL !== "function") return;
    const preview = URL.createObjectURL(coverFile);
    setCoverPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [coverFile]);

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
      setCoverAltText(e.coverAltText ?? "");
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
    mutationFn: async (payload: EventPayload) => {
      const event = savedEventId
        ? await updateEvent(savedEventId, payload)
        : mode === "edit" && eventId
          ? await updateEvent(eventId, payload)
          : await createEvent(payload);
      setSavedEventId(event.id);

      const existingCover = eventQuery.data?.coverUrl;
      if (removeCover && existingCover) {
        try {
          await deleteEventCover(event.id);
        } catch {
          throw new Error("cover_delete_failed");
        }
      } else if (coverFile || (existingCover && coverAltText.trim() !== (eventQuery.data?.coverAltText ?? "").trim())) {
        try {
          await uploadEventCover(event.id, coverFile ?? undefined, coverAltText.trim());
        } catch {
          throw new Error("cover_upload_failed");
        }
      }
      return event;
    },
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      void queryClient.invalidateQueries({ queryKey: ["organiser", "events"] });
      window.localStorage.removeItem(draftKey(eventId));
      push({ type: "success", message: mode === "edit" ? "Event saved" : "Event published" });
      navigate({ page: "registrations", eventId: id });
    },
    onError: (error) => push({
      type: "error",
      message: error.message.startsWith("cover_") ? "Event saved, but its cover was not saved" : "Could not save the event",
      actionLabel: "Retry",
      onAction: () => mutation.mutate(values),
    }),
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
    if ((coverFile || (mode === "edit" && eventQuery.data?.coverUrl && coverAltText !== (eventQuery.data.coverAltText ?? ""))) && !coverAltText.trim()) {
      setCoverError("Alt text is required for the event cover.");
      return;
    }
    mutation.mutate(values);
  }

  function selectCover(file: File | undefined) {
    setCoverError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setCoverError("Choose a JPEG, PNG, or WebP image smaller than 5 MiB.");
      return;
    }
    setCoverFile(file);
    setRemoveCover(false);
  }

  const topicOptions = useMemo(
    () => (topicOptionsQuery.data ?? []).filter((o) => !topics.some((t) => t.value === o.value)),
    [topicOptionsQuery.data, topics],
  );
  const coverSrc = removeCover ? null : coverPreview ?? apiAssetUrl(eventQuery.data?.coverUrl);

  return (
    <div className="cp-page">
      <div className="cp-form-col">
        <nav aria-label="Breadcrumb" className="cp-muted">
          <a href={href({ page: "manageEvents" })} style={{ color: "var(--cp-brand-primary)" }}>My events</a>
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
          <label className="cp-field" htmlFor="event-cover-file">
            <span className="cp-field__label">Cover image</span>
            <div className="cp-field__control">
              <input id="event-cover-file" type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(event) => selectCover(event.currentTarget.files?.[0])} />
            </div>
          </label>
          {coverSrc ? <img src={coverSrc} alt={coverAltText || values.title || "Event cover preview"} style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }} /> : null}
          <Input label="Cover image alt text" value={coverAltText} maxLength={200}
            required={Boolean(coverFile || coverSrc)} onChange={(e) => { setCoverAltText(e.target.value); setCoverError(null); }}
            helperText="Describe the image for people using screen readers" />
          {coverSrc ? <Button variant="ghost" size="sm" onClick={() => { setCoverFile(null); setRemoveCover(true); setCoverAltText(""); }}>Remove cover</Button> : null}
          {coverError ? <div className="cp-error-panel" role="alert">{coverError}</div> : null}
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
        <Button variant="ghost" onClick={() => navigate({ page: "manageEvents" })}>Cancel</Button>
        <Button variant="secondary" onClick={() => submit(false)}>Save draft</Button>
        <Button loading={mutation.isPending} onClick={() => submit(true)}>{mode === "edit" ? "Save changes" : "Publish"}</Button>
      </div>
    </div>
  );
}
