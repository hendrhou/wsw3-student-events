# student-mfe — Design Specification

Event discovery and participation MFE for Campus Pulse students. React micro
frontend composed into the shell via Module Federation; consumes `event-service`,
`registration-service`, `semantic-service` (recommendations) and `ticket-service`
(credentials) through the Kong gateway. Tokens: [design-tokens.md](design-tokens.md).
Components: [components.md](components.md).

**Design direction:** clean institutional academic (ufp.pt). Dense enough for
repeated daily scanning, calm and content-first. One primary CTA per screen.
Memorable detail: the gold accent is reserved exclusively for the
semantic-recommendation layer — students learn "gold = matched to me".

---

## Screen inventory

| # | Screen | Route | Primary CTA |
|---|--------|-------|-------------|
| S1 | Event discovery feed | `/events` | Open event detail |
| S2 | Event detail | `/events/:eventId` | Register |
| S3 | Registration flow | `/events/:eventId/register` | Confirm registration |
| S4 | My tickets | `/tickets` | Present ticket |
| S5 | Profile & interests | `/profile` | Save interests |

Global shell elements provided by the host: top Navbar (UFP logo, app switcher,
user menu) and auth. The MFE renders inside the shell's content region and owns
its sub-navigation (tabs: Discover · My Tickets · Profile).

---

## S1 — Event discovery feed

**Purpose:** scan upcoming events fast; surface semantic recommendations from the
student's interest profile (R8 — recommendations come from SPARQL over the RDF store).

### Layout (desktop ≥1024px)

```
┌──────────────────────────────────────────────────────────┐
│ Navbar (shell)                                           │
├──────────────────────────────────────────────────────────┤
│ MFE tab bar: [Discover] My Tickets Profile               │
├──────────────────────────────────────────────────────────┤
│ H1 "Discover events"        [Search input] [Filter btn]  │
│ Filter chips row (when active):  [Date▾][Category▾][Venue▾][× Clear] │
├──────────────────────────────────────────────────────────┤
│ ★ "Recommended for you" — gold-accented section          │
│   horizontal scroll row of RecommendationCards (max 5)   │
│   each shows match reason chip ("Matches: Semantic Web") │
├──────────────────────────────────────────────────────────┤
│ H2 "All upcoming events"                                 │
│ 3-col Card grid (EventCard) — paginated, 12/page         │
└──────────────────────────────────────────────────────────┘
```

- Grid: 12-col, max 1200px, gutter 32px; recommendation row spans full width with `space-6` vertical separation.
- Mobile: single column; recommendation row becomes swipeable horizontal scroll with scroll-snap; filters collapse into a Filter button opening a bottom sheet.

### Components & states

| Component | States |
|---|---|
| `EventCard` | default / hover (shadow-2, 150ms) / loading skeleton / full-capacity (badge `Full`, CTA becomes `Join waitlist` secondary) |
| `RecommendationCard` | EventCard variant with gold left border (3px `brand/accent`) + "Why this?" expandable info line |
| Search input | debounced 300ms; clear button; aria-label "Search events" |
| Filter chips | active = `primary-subtle` fill + primary text; removable |
| Feed | skeleton shimmer while loading; error state with retry; empty state ("No events match your filters" + Clear filters action) |

### Interactions

- Card click → S2. Keyboard: full card is one tab stop (`role="link"`), arrow keys move within grid.
- "Why this?" expands inline (250ms, max-height transition) explaining the SPARQL match in plain language, e.g. "Recommended because you follow *Semantic Web* and this event teaches *Linked Data*".
- Filters compose (AND); active filter count badges the Filter button. Filter + scroll state preserved on back navigation.
- Pagination: "Load more" button (no infinite scroll — keeps footer reachable); loading state on button.

### Data

- `GET /events?date=&category=&venue=&q=` (event-service), `GET /recommendations/me` (semantic-service, auth'd). Recommendations fail-soft: section hides on error, feed unaffected.

---

## S2 — Event detail

**Purpose:** everything needed to decide to register.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│ Breadcrumb: Discover / {Event title}                     │
├───────────────────────────────┬──────────────────────────┤
│ Main (8 cols)                 │ Sidebar (4 cols, sticky) │
│  H1 title                     │  EventMetaCard:          │
│  category Badge + competence  │   date/time (tabular)    │
│  Tags                         │   venue + map link       │
│  Hero image (16:9, lazy)      │   organiser (linked)     │
│  H2 About — rich text         │   capacity progress bar  │
│  H2 What you'll gain —        │   "N seats left"         │
│  competence list (chips)      │   [Register] primary btn │
│  H2 Schedule — agenda table   │   [Save] ghost btn       │
├───────────────────────────────┴──────────────────────────┤
│ H2 "Related events" — 3 EventCards (semantic similarity) │
└──────────────────────────────────────────────────────────┘
```

- Mobile: single column; sidebar content moves below About; Register becomes a sticky bottom bar (64px, shadow-2) with safe-area padding.

### Components & states

| Component | States |
|---|---|
| Capacity progress bar | green <70% full · warning ≥70% · `Full` state replaces bar with filled badge |
| `Register` button | default / loading (spinner, disabled) / registered (becomes success-state "You're registered ✓" + secondary "Cancel registration") / full ("Join waitlist") / past event (disabled "Event ended") |
| Hero image | fixed 16:9 `aspect-ratio` box (no CLS); neutral-100 placeholder; alt text required |
| Related events | hidden if none returned |

### Interactions

- Register → S3. Save toggles bookmark (optimistic UI, rollback + toast on failure).
- Organiser link → organiser public page (read-only modal if organiser-mfe not reachable by students).
- Deep-linkable; 404 state if event ID invalid.

---

## S3 — Registration flow

**Purpose:** confirm registration and immediately issue the verifiable credential
(ticket-service, R9). Single-page flow, 2 steps + success — no wizard overhead.

### Layout (centered column, max 560px)

```
Step indicator: ① Confirm details —— ② Review —— ✓ Done

Step 1 "Confirm details"
  Prefilled read-only: name, student number (from auth token)
  [ ] Checkbox: "I agree to the event's attendance policy" (required)
  [Continue →]

Step 2 "Review"
  Summary card: event title, date, venue, seat
  [< Back]  [Confirm registration] (primary)

Success
  ✓ "You're registered!" + booking reference (mono, copyable)
  CredentialCard preview (issued VC, status: Issued)
  [View my tickets] primary   [Back to event] ghost
```

### States & interactions

- Continue disabled until policy checkbox ticked; inline error below checkbox if attempted.
- Confirm: loading spinner; on 409 (already registered / no seats) → error alert with recovery link ("View my tickets" / "Join waitlist").
- Success: confetti-free, calm success panel; credential issuance is async — card shows `Issuing…` spinner → `Issued` badge (poll or websocket; 10s timeout → "Will appear in My tickets" info note). Never block the user on VC issuance.
- Browser back from success → S1 (no resubmission; POST/redirect/GET pattern).
- Abandon with dirty state → confirm dialog ("Discard registration?").

---

## S4 — My tickets

**Purpose:** the student's verifiable credentials wallet (Web 3.0 component —
third-party verifiable without central system).

### Layout

```
H1 "My tickets"
Tabs: [Upcoming (n)] [Past] 
┌─ TicketCard list (1 col, max 760px) ─────────────────────┐
│ Event title · date · venue        Status badge           │
│ Booking ref (mono)   [Present ticket] [View credential]  │
└──────────────────────────────────────────────────────────┘
```

`Present ticket` → full-screen modal:
```
┌──────────────────────────┐
│ Event title, date        │
│  ┌────────────────────┐  │
│  │   QR code (VC-JWT  │  │   ← 264×264px, white card,
│  │   or DID proof)    │  │     high contrast, quiet zone
│  └────────────────────┘  │
│ Credential status badge: │
│  ● Issued / ● Verified / │
│  ● Revoked / ● Expired   │
│ "Verify online" link →   │
│  public verifier URL     │
│ [Download JSON-LD] ghost │
│ [Close]                  │
└──────────────────────────┘
```

### Components & states

| Component | States |
|---|---|
| `TicketCard` | upcoming (green left border) / past (neutral, dimmed 60%) / cancelled (error badge, no actions) |
| Credential status | `Issued` (success), `Verified` (success + check icon, after live verification), `Pending` (info, spinner), `Revoked` (error + explanation text), `Expired` (neutral) |
| QR modal | loading skeleton → QR / error with "Retry" / offline note ("QR works offline; verification needs network") |

### Interactions

- "View credential" → expandable JSON-LD viewer (monospace, collapsed by default, copy button) — showcases the semantic/linked-data artifact for the defence demo.
- "Verify online" opens the third-party verifier in a new tab (proves decentralised verifiability — key defence story).
- Empty state: illustration-free, text "No tickets yet — discover events" + primary button to S1.

---

## S5 — Profile & interests

**Purpose:** manage interest profile that feeds semantic recommendations.

### Layout (two columns, 8+4)

```
Main (8 cols)                          Sidebar (4 cols)
H1 "Profile"                            Profile summary card:
H2 "My interests"                        avatar (initials, neutral),
  Interest chips (removable ×)           name, student number,
  [+ Add interest] → inline combobox     programme, role badge
  with autocomplete from ontology        "Interests power your
  (competence/topic classes)             recommendations" info note
H2 "Programme & courses" (read-only,
  from academic data source → shows
  R7 integration)
[Save changes] primary (sticky footer)
```

### States & interactions

- Combobox suggestions come from the ontology via semantic-service (`GET /ontology/interests?q=`) — free text not allowed; each chip shows the concept label + tooltip with its URI (defence-visible linked-data detail).
- Save: loading → success toast "Interests saved — recommendations updated"; error toast with retry.
- Dirty state: sticky footer bar appears ("Unsaved changes" + Save/Discard); leaving route with unsaved changes → confirm dialog.
- Removing an interest used by an existing recommendation → info note "Your recommendations will update within a few minutes."
- Accessibility: chips removable via keyboard (focus + Delete key AND visible × button); combobox follows ARIA combobox pattern.

---

## Cross-screen requirements

- **Auth:** all screens require the student role; 401 → shell login redirect; 403 → "Students only" page with switch-account link.
- **Loading:** skeletons (not spinners) for all content loading >300ms; shimmer respects reduced-motion.
- **Errors:** inline where possible; page-level error state with retry for hard failures; toasts (top-right, 4s auto-dismiss, `aria-live="polite"`) for async results.
- **Empty states:** every list/feed has a designed empty state with one recovery action.
- **Deep links:** every screen is a shareable URL; back navigation restores scroll + filters.
- **Motion:** card hover lift 150ms; modal scale+fade from trigger 250ms; page crossfade 150ms. Max 1–2 animated elements per view.
