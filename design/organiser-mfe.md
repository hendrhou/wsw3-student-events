# organiser-mfe — Design Specification

Event management MFE for Campus Pulse organisers (clubs, departments, external
partners). React micro frontend composed into the shell via Module Federation;
consumes `event-service` and `registration-service` through the Kong gateway.
Tokens: [design-tokens.md](design-tokens.md). Components: [components.md](components.md).

**Design direction:** utilitarian tool for repeated workflows — dense, quiet,
scannable. Data tables and forms are the product; no marketing composition.
Gold accent appears only for pending-attention items (e.g. pending check-in count).

---

## Screen inventory

| # | Screen | Route | Primary CTA |
|---|--------|-------|-------------|
| O1 | Dashboard (my events) | `/organiser` | Create event |
| O2 | Event create/edit | `/organiser/events/new`, `/organiser/events/:id/edit` | Publish / Save |
| O3 | Registrations list | `/organiser/events/:id/registrations` | Export / scan mode |
| O4 | Check-in interface | `/organiser/events/:id/check-in` | Confirm check-in |

MFE sub-navigation: tabs **My Events · New Event** (O3/O4 reached via row actions, with breadcrumbs back).

---

## O1 — Dashboard (my events)

**Purpose:** operational overview — what needs attention today.

### Layout (desktop ≥1024px)

```
┌──────────────────────────────────────────────────────────┐
│ Navbar (shell)                                           │
│ MFE tabs: [My Events] New Event                          │
├──────────────────────────────────────────────────────────┤
│ H1 "My events"                    [+ Create event] prim. │
├────────────┬────────────┬────────────┬───────────────────┤
│ StatCard   │ StatCard   │ StatCard   │ StatCard          │
│ Upcoming:4 │ Registr.:  │ Checked-in │ Pending check-in  │
│            │ 183        │ today: 41  │ today: 12 (gold)  │
├──────────────────────────────────────────────────────────┤
│ Filter chips: [All][Draft][Published][Past]  [Search]    │
│ EventsTable (sortable):                                  │
│ Event ▾ │ Date ▾ │ Venue │ Capacity (bar) │ Status │ ⋯  │
│ ...rows, row click → O3 or edit                          │
└──────────────────────────────────────────────────────────┘
```

- StatCards: tabular figures, H2 number + caption label; "Pending check-in" uses gold accent fill to draw the eye to today's job.
- Mobile: stats become 2×2 grid; table becomes stacked Card list (title, date, capacity bar, status badge, chevron).

### Components & states

| Component | States |
|---|---|
| `EventsTable` | loading skeleton rows / empty ("No events yet — create your first") / error with retry; sortable columns with `aria-sort` |
| Capacity cell | mini progress bar + `42/60` tabular text; warning color ≥90% |
| Status badge | `Draft` neutral / `Published` success / `Cancelled` error / `Past` neutral-400 |
| Row overflow menu (⋯) | Edit · View registrations · Check-in · Duplicate · Cancel event (danger, separated) |

### Interactions

- Row click → O3 (most common task); Edit via menu or E key when row focused.
- "Cancel event" → confirmation modal naming registered-count impact ("42 students will be notified") + type-to-confirm for events with registrations.
- Filters + sort + scroll preserved on back navigation. Table virtualized above 50 rows.

---

## O2 — Event create / edit

**Purpose:** publish a well-formed event; the metadata entered here feeds the
RDF transformation (R7), so fields map to ontology properties.

### Layout (centered form, max 720px, fieldset grouping)

```
Breadcrumb: My events / New event
H1 "Create event" (or "Edit — {title}")

Section 1 · Basics
  Title* (input, 80 char max, counter)
  Short description* (textarea, 200 char, counter — shown in cards)
  Full description (rich textarea, collapsible)
  Category* (select — ontology-aligned taxonomy)
  Cover image (upload, 16:9 crop preview, alt text* input)

Section 2 · Date & venue
  Date* + Start/End time* (semantic input types)
  Venue* (combobox from venue catalogue → links to Venue concept)
  [ ] Online event → reveals URL input (progressive disclosure)

Section 3 · Capacity & registration
  Capacity* (number, min 1)  ·  [ ] Waitlist when full
  Registration deadline (date, helper: "defaults to event start")

Section 4 · Competences & topics (drives recommendations)
  Topic tags* (ontology combobox, same component as student S5)
  Helper text: "These tags power semantic recommendations to students."

Sticky footer: [Cancel] ghost   [Save draft] secondary   [Publish] primary
(Edit mode: [Save changes] primary + "Cancel event" danger link, separated left)
```

### States & interactions

- Inline validation **on blur**, error text below field with icon; on submit error: error summary at top with anchor links + autofocus first invalid field.
- Publish: loading → success toast + redirect to O3 for the new event.
- **Autosave draft** every 30s in edit mode ("Draft saved 14:32" caption in footer); unsaved-changes confirm on route leave.
- Long labels and helper text wrap — fixed-height inputs must not clip at 200% text zoom.
- Danger separation: "Cancel event" is visually/spatially separated from the action cluster, uses `color-error`, always behind a confirmation modal.
- Edit mode on past events: read-only with "Duplicate as new event" action.

---

## O3 — Registrations list

**Purpose:** track who registered; operational hub before the event.

### Layout

```
Breadcrumb: My events / {Event title} / Registrations
H1 "{Event title}" + Status badge        [Open check-in →] primary
Meta line: date · venue · capacity bar (42/60, 70%)

Tabs: [Registered (42)] [Waitlist (6)] [Cancelled]
Toolbar: [Search by name/number]  [Export CSV] secondary

RegistrationsTable (sortable):
  Name ▾ │ Student no. │ Registered at ▾ │ Status │ Actions
  rows…  │ 20220123    │ 2026-10-01 14:22│ Confirmed │ [Check in][✕]
```

### Components & states

| Component | States |
|---|---|
| Status badge | `Confirmed` success / `Waitlisted` warning / `Checked-in` info / `Cancelled` neutral |
| Row actions | "Check in" (primary-small, only on event day) / "Cancel registration" (danger, confirm modal) |
| Export CSV | loading → file download; respects current filter/search |
| Table | skeleton / empty per tab ("No one on the waitlist") / error-retry; `aria-sort`; 44px row action targets |

### Interactions

- Search is instant client-side filter (≤200 rows) with 300ms debounce; highlight match.
- Tabs keep per-tab scroll; URL query param (`?tab=waitlist`) for deep links.
- Check-in action here mirrors O4 for walk-up single check-ins.

---

## O4 — Check-in interface

**Purpose:** event-day throughput — verify the attendee's verifiable credential
and mark attendance (writes to registration-service; verification via
ticket-service, demonstrating the Web 3.0 flow live).

Designed **mobile-first** (organisers use phones at the door), then desktop.

### Layout (mobile 375px baseline)

```
┌──────────────────────────────┐
│ ← {Event title}              │
│ Checked in  41 / 42  (tabular│
│ ▓▓▓▓▓▓▓▓▓▓░░ progress bar)   │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │   Camera viewfinder      │ │  ← 4:3, viewfinder frame,
│ │   (scan credential QR)   │ │    torch toggle top-right
│ └──────────────────────────┘ │
│ [Enter manually] secondary   │
├──────────────────────────────┤
│ Recent check-ins (last 5):   │
│ ✓ Ana S. 20220123  · 14:02   │
│ ✓ Bruno M. 20210456 · 14:01  │
└──────────────────────────────┘
```

### Scan result states (full-screen modal, big and glanceable at arm's length)

| Result | Visual | Action |
|---|---|---|
| **Verified** | success-green panel, large ✓ icon, attendee name + number, credential "Verified ✓" badge | auto-dismiss 2.5s or tap → back to camera; haptic success |
| **Already checked in** | warning panel, "Checked in at 13:58" | [OK] |
| **Invalid / revoked credential** | error panel, reason line ("Credential revoked" / "Wrong event" / "Expired") | [OK] — never silently fail |
| **Verification unavailable** | info panel "Network error — credential unreadable" | [Retry] / [Manual entry] |

### Manual entry

Bottom sheet: search by name/student number → result list → [Check in] confirm.
Same result states as scan.

### Interactions & constraints

- Camera permission denied → inline guidance + fallback to manual entry (never a dead end).
- Each check-in: optimistic update of the counter; rollback + toast on server failure.
- Offline: queue check-ins locally, badge "3 pending sync" on progress bar, auto-sync on reconnect; conflicts resolved server-side with audit note.
- Desktop: camera replaced by "scanner input" field (HID scanner types the VC token) + manual entry side panel; recent list beside it (two columns).
- The verified panel exposes a small "View proof" link opening the credential verification detail — the live demo moment for the defence.

---

## Cross-screen requirements

- **Auth:** organiser role required; students hitting these routes get a 403 page with shell-level account info.
- **Density:** tabular numbers everywhere; line length on forms ≤75ch; no decorative imagery except event covers.
- **Destructive actions:** always `color-error`, always confirmed, always with undo toast where the domain allows (duplicate event is the undo for accidental cancellation only when 0 registrations).
- **Loading/empty/error:** skeletons for tables and stats; every empty state offers the next action; errors state cause + recovery.
- **Motion:** 150–250ms ease-out; the check-in success panel is the one expressive moment (scale 0.95→1.0, 250ms) — still honored under reduced-motion (opacity-only fallback).
