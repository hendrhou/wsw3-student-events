# Campus Pulse — Shared Component Inventory

Components shared by `student-mfe` and `organiser-mfe` (published from the shell's
component package so both MFEs stay visually identical). Tokens:
[design-tokens.md](design-tokens.md). Icons: Lucide only, 16/20/24px, 1.5px stroke,
outline style. No emoji as icons.

Every interactive component must define: **default · hover · focus-visible · active ·
disabled · loading** states, plus keyboard behavior and ARIA semantics. Focus ring:
2px solid `color-brand-primary` + 2px white offset (visible on green and white).

---

## 1. Button

| Variant | Fill / text | Use |
|---|---|---|
| `primary` | `brand-primary` bg, white text; hover `brand-primary-hover` | One per screen — the main action (Register, Publish, Confirm) |
| `secondary` | white bg, `brand-primary` text + 1px `brand-primary` border | Save draft, Export CSV |
| `ghost` | transparent, `brand-primary` text; hover `primary-subtle` bg | Tertiary actions, "Back" |
| `danger` | `error` bg, white text | Destructive actions (always behind confirmation) |

- Sizes: `sm` 32px h / `md` 40px h / `lg` 48px h (mobile default ≥44px); padding `space-4`–`space-6`; radius `radius-md`; text `text-body-strong` (sm uses `text-small` 600).
- **Loading:** spinner replaces label, width locked, `disabled` + `aria-busy`.
- **Disabled:** opacity 0.45, `cursor: not-allowed`, semantic `disabled` attribute (not just visual).
- **With icon:** icon left (16px) + 8px gap; icon-only buttons require `aria-label` and 44×44px hit area.
- Press feedback: scale 0.98, 100ms.

## 2. Card

| Variant | Description |
|---|---|
| `EventCard` | Cover 16:9 (`aspect-ratio`, no CLS) → category Badge + date overline → H3 title → venue · time metadata (`text-small`, secondary) → capacity line + CTA row |
| `RecommendationCard` | EventCard + 3px `brand-accent` left border + "Why this?" expander (gold = recommendation, consistent across product) |
| `StatCard` | H2 tabular figure + caption label; optional trend line; flat, `shadow-1` |
| `TicketCard` | Event summary + booking ref (mono) + credential status Badge + action row; status-colored 3px left border |
| `CredentialCard` | Verifiable-credential preview: issuer, status Badge, expandable JSON-LD viewer |

- Shared anatomy: white bg, 1px `neutral-200` border, `radius-md`, `shadow-1`, padding `space-4`–`space-6`.
- States: hover → `shadow-2` + translateY(-2px), 150ms ease-out (pointer devices only); focus-visible ring; loading → skeleton shimmer of the same anatomy (no spinners); selected → `primary-subtle` bg.
- Whole-card click: single `role="link"` tab stop wrapping content; inner actions remain separately focusable.
- **Never nest cards inside cards.**

## 3. Navbar (shell-owned, UFP branding)

```
┌──────────────────────────────────────────────────────────┐
│ [UFP logo SVG] Campus Pulse | tab links … | [avatar ▾]   │
└──────────────────────────────────────────────────────────┘
```

- Height 64px desktop / 56px mobile; white bg, 1px `neutral-200` bottom border, sticky (`z-index: 10`); content padded below by its height (no overlap).
- Logo: [logo_ufp_site.svg](logo_ufp_site.svg) at 32px height, links to home, alt "Universidade Fernando Pessoa". Never recolor or re-host.
- Nav items: icon + text label, always both; active item = `brand-primary` text + 2px primary underline; inactive = `text-secondary`.
- Right side: app switcher (student ⇄ organiser, visible only to dual-role users), notification bell (badge count, cleared on visit), avatar menu (Profile · Settings · **Log out** — separated, neutral-danger styling).
- Mobile: logo + hamburger; menu opens full-height drawer (`radius-lg` top corners, slide-up 250ms); bottom tab bar with ≤5 items (Discover · Tickets · Profile) if the shell opts for app-style nav — never mix drawer + bottom nav at the same level.

## 4. Form inputs

| Component | Spec |
|---|---|
| `TextInput` / `TextArea` | Visible label above (never placeholder-only); 1px `neutral-400` border → focus `brand-primary` 2px; `radius-sm`; height 44px; helper text below in `text-small` secondary; char counters where limits exist |
| `Select` / `Combobox` | ARIA combobox pattern; async option loading state; ontology-backed comboboxes show concept label + URI tooltip |
| `Checkbox` / `Toggle` | 20px box, `brand-primary` checked; label clickable; toggle 44px wide |
| `DateInput` / `TimeInput` | Native semantic input types (correct mobile keyboards); tabular figures |
| `FieldError` | Below the field: `error` icon + `text-small` `color-error`, `role="alert"`; summary with anchor links at top of form on submit failure |

- Required marker: `*` in `color-error` + "required" in `aria-label`.
- Validation on blur; disabled = opacity 0.45 + semantic attribute; read-only = `neutral-100` bg, no border change, `aria-readonly` (visually distinct from disabled).

## 5. Badge / Tag / Status dot

| Variant | Fill / text | Use |
|---|---|---|
| `success` | `success-subtle` / `success` text + icon | Published, Confirmed, Issued, Verified |
| `warning` | `warning-subtle` / `warning` text + icon | Waitlisted, Almost full, Pending sync |
| `error` | `error-subtle` / `error` text + icon | Cancelled, Revoked, Failed |
| `info` | `info-subtle` / `info` text + icon | Checked-in, semantic-match explanation |
| `neutral` | `neutral-100` / `neutral-600` text | Draft, Past, categories |
| `accent` | `brand-accent` bg / `accent-on` text | **Reserved for recommendations/attention** — gold meaning is consistent |

- Height 22px, `radius-full` for status, `radius-sm` for category tags; `text-caption` uppercase; 8px horizontal padding.
- Status never conveyed by color alone — always icon or text.
- Removable tag variant (interests, filters): visible × button + Delete-key support.

## 6. Modal / Dialog / Bottom sheet

- Sizes: `sm` 400px (confirmations) / `md` 560px (flows, ticket QR) / `lg` 720px (JSON-LD viewer); `radius-lg`, `shadow-3`, scrim `neutral-900` @ 48% + blur(2px).
- Motion: scale 0.96→1 + fade from trigger, 250ms ease-out in / 200ms ease-in out.
- Header: H2 title + close icon-button (`aria-label="Close"`); footer action cluster right-aligned (primary rightmost); destructive confirmations put the danger button left of Cancel.
- Focus trap, `Esc` closes (unless dirty form → "Discard changes?" confirm), focus returns to trigger on close.
- Mobile: convert to bottom sheet (drag handle, swipe-down dismiss, safe-area padding).
- Scan-result variant (check-in): full-screen, single status color panel, auto-dismiss where specified.

## 7. Table

- Anatomy: header row `text-small` 600 secondary, `neutral-100` bg; rows 48px, 1px `neutral-200` dividers (no zebra on desktop, zebra `neutral-50` optional on dense tables); numeric columns tabular + right-aligned.
- Sortable headers: chevron icon, `aria-sort`, keyboard operable.
- States: loading skeleton rows (5) / empty state with next action / error row with retry.
- Row actions: 44px targets; overflow menu (⋯) for >2 actions; danger action separated at menu bottom.
- Responsive: ≤767px collapse to stacked cards (same data, label: value pairs); never horizontal-scroll a table on mobile.
- Virtualize above 50 rows; pagination footer with tabular counts ("1–12 of 183").

## 8. Supporting components (brief)

| Component | Key spec |
|---|---|
| `Toast` | Top-right, 4s auto-dismiss, icon + message + optional action (Undo/Retry), `aria-live="polite"`, max 3 stacked, `radius-md`, `shadow-2` |
| `ProgressBar` (capacity) | 6px h, `radius-full`, `neutral-200` track; fill `brand-primary` → `warning` ≥90%; label beside in tabular `text-small` |
| `Tabs` | Underline style; active = primary text + 2px primary underline; keyboard arrows; URL-synced where deep-linking matters |
| `EmptyState` | H3 message + `text-small` guidance + one primary/secondary action; no stock illustrations |
| `Skeleton` | `neutral-100` shimmer (opacity pulse 1.5s, disabled under reduced-motion); mirrors target anatomy |
| `Avatar` | Initials on `primary-subtle` bg, `radius-full`, sizes 32/40px |
| `QrCard` | 264×264px QR on white card, 16px quiet zone, `radius-md`, high-contrast only (no brand-colored QR) |
| `FilterChip` | Removable pill; active = `primary-subtle`; clear-all resets |
| `StepIndicator` | Numbered circles + connector line; current = primary fill; done = success check; labels below |
