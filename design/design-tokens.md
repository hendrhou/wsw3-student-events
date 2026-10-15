# Campus Pulse — Design Tokens

Design tokens for the two React micro frontends (`student-mfe`, `organiser-mfe`)
and the shell. Source of truth for CSS custom properties and Figma variables.

Brand source: ufp.pt (institutional academic look). Logo: [logo_ufp_site.svg](logo_ufp_site.svg) — reference the file, do not re-host or recolor.

---

## 1. Color palette

### 1.1 Brand colors

| Token | CSS custom property | Figma variable | Hex | Usage |
|---|---|---|---|---|
| `color-brand-primary` | `--cp-brand-primary` | `brand/primary` | `#005947` | UFP green. Primary actions, navbar, active nav state, links on light surfaces |
| `color-brand-primary-hover` | `--cp-brand-primary-hover` | `brand/primary-hover` | `#00473a` | Darkened ~10% for hover/pressed states |
| `color-brand-primary-subtle` | `--cp-brand-primary-subtle` | `brand/primary-subtle` | `#e0efeb` | Tint background for selected rows, badges, recommendation highlights |
| `color-brand-accent` | `--cp-brand-accent` | `brand/accent` | `#fcce4c` | UFP gold. Accent fills only — highlights, recommendation badge, focus decoration. **Never as text on white** (fails 4.5:1) |
| `color-brand-accent-on` | `--cp-brand-accent-on` | `brand/accent-on` | `#202222` | Text/icons placed on gold fills |
| `color-brand-dark` | `--cp-brand-dark` | `brand/dark` | `#202222` | Headings, primary text, footer |
| `color-brand-white` | `--cp-brand-white` | `brand/white` | `#ffffff` | Base surface |

### 1.2 Neutrals

| Token | CSS custom property | Figma variable | Hex | Usage |
|---|---|---|---|---|
| `color-neutral-50` | `--cp-neutral-50` | `neutral/50` | `#f7f8f8` | Page background |
| `color-neutral-100` | `--cp-neutral-100` | `neutral/100` | `#eef0f0` | Subtle section background, table zebra |
| `color-neutral-200` | `--cp-neutral-200` | `neutral/200` | `#dde1e1` | Borders, dividers, input outlines |
| `color-neutral-400` | `--cp-neutral-400` | `neutral/400` | `#9aa3a2` | Placeholder text, disabled icons |
| `color-neutral-600` | `--cp-neutral-600` | `neutral/600` | `#5c6563` | Secondary text (4.6:1 on white) |
| `color-neutral-800` | `--cp-neutral-800` | `neutral/800` | `#333837` | Body text alternative |
| `color-neutral-900` | `--cp-neutral-900` | `neutral/900` | `#202222` | Primary text (= brand dark) |

### 1.3 Semantic colors

Functional color is always paired with an icon or text label — never color alone (WCAG).

| Token | CSS custom property | Figma variable | Hex | Usage |
|---|---|---|---|---|
| `color-success` | `--cp-success` | `semantic/success` | `#1e7e34` | Registration confirmed, credential verified, event published |
| `color-success-subtle` | `--cp-success-subtle` | `semantic/success-subtle` | `#e3f2e8` | Success badge/alert background |
| `color-error` | `--cp-error` | `semantic/error` | `#b3261e` | Form errors, failed verification, destructive actions |
| `color-error-subtle` | `--cp-error-subtle` | `semantic/error-subtle` | `#fbe9e7` | Error alert background |
| `color-warning` | `--cp-warning` | `semantic/warning` | `#9a6a00` | Event almost full, pending states (text-safe dark amber) |
| `color-warning-subtle` | `--cp-warning-subtle` | `semantic/warning-subtle` | `#fdf3d7` | Warning badge background |
| `color-info` | `--cp-info` | `semantic/info` | `#1d5fa8` | Informational alerts, semantic-match explanations |
| `color-info-subtle` | `--cp-info-subtle` | `semantic/info-subtle` | `#e6f0fa` | Info badge background |

### 1.4 Surface & on-surface aliases

| Token | CSS custom property | Figma variable | Value | Usage |
|---|---|---|---|---|
| `color-bg-page` | `--cp-bg-page` | `surface/page` | `neutral/50` | App background |
| `color-surface-card` | `--cp-surface-card` | `surface/card` | `brand/white` | Cards, modals, tables |
| `color-text-primary` | `--cp-text-primary` | `text/primary` | `neutral/900` | Body and headings |
| `color-text-secondary` | `--cp-text-secondary` | `text/secondary` | `neutral/600` | Metadata, captions |
| `color-text-on-primary` | `--cp-text-on-primary` | `text/on-primary` | `brand/white` | Text on UFP green |
| `color-focus-ring` | `--cp-focus-ring` | `state/focus-ring` | `#005947` @ 40% + 2px solid offset | Keyboard focus indicator |

---

## 2. Typography

Fonts: **Roboto Condensed** (headings — matches ufp.pt institutional tone) and
**Inter** (body/UI). Load via Google Fonts with `font-display: swap`; preload only Inter 400/600.

| Token | CSS custom property | Figma text style | Font / weight | Size / line-height | Usage |
|---|---|---|---|---|---|
| `font-heading` | `--cp-font-heading` | — | Roboto Condensed | — | Heading family |
| `font-body` | `--cp-font-body` | — | Inter | — | Body/UI family |
| `text-h1` | `--cp-text-h1` | `Heading/H1` | Roboto Condensed 700 | 32px / 40px | Page titles |
| `text-h2` | `--cp-text-h2` | `Heading/H2` | Roboto Condensed 700 | 24px / 32px | Section titles |
| `text-h3` | `--cp-text-h3` | `Heading/H3` | Roboto Condensed 600 | 20px / 28px | Card titles, subsections |
| `text-body` | `--cp-text-body` | `Body/Default` | Inter 400 | 16px / 24px | Body text (min 16px) |
| `text-body-strong` | `--cp-text-body-strong` | `Body/Strong` | Inter 600 | 16px / 24px | Emphasis, table headers |
| `text-small` | `--cp-text-small` | `Body/Small` | Inter 400 | 14px / 20px | Metadata, helper text |
| `text-caption` | `--cp-text-caption` | `Body/Caption` | Inter 500 | 12px / 16px | Badges, tags, overlines (uppercase, +0.5px tracking) |
| `text-mono-data` | `--cp-text-mono-data` | `Data/Tabular` | Inter 400 tabular-nums | 14px / 20px | Dates, seat counts, credential IDs (`font-variant-numeric: tabular-nums`) |

Rules: line-height 1.5 for body; line length 60–75ch on desktop; never truncate without ellipsis + tooltip; no text below 12px.

---

## 3. Spacing (4px base)

| Token | CSS | Figma variable | Value |
|---|---|---|---|
| `space-1` | `--cp-space-1` | `space/1` | 4px |
| `space-2` | `--cp-space-2` | `space/2` | 8px |
| `space-3` | `--cp-space-3` | `space/3` | 12px |
| `space-4` | `--cp-space-4` | `space/4` | 16px |
| `space-6` | `--cp-space-6` | `space/6` | 24px |
| `space-8` | `--cp-space-8` | `space/8` | 32px |
| `space-12` | `--cp-space-12` | `space/12` | 48px |
| `space-16` | `--cp-space-16` | `space/16` | 64px |

Layout: 12-column grid, max content width **1200px**, page gutters 24px (mobile) / 32px (desktop). Card grids: 1 col ≤767px, 2 cols 768–1023px, 3 cols ≥1024px.

---

## 4. Radii, shadows, borders

| Token | CSS | Figma variable/style | Value | Usage |
|---|---|---|---|---|
| `radius-sm` | `--cp-radius-sm` | `radius/sm` | 4px | Badges, tags, inputs |
| `radius-md` | `--cp-radius-md` | `radius/md` | 8px | Cards, buttons |
| `radius-lg` | `--cp-radius-lg` | `radius/lg` | 12px | Modals, drawers |
| `radius-full` | `--cp-radius-full` | `radius/full` | 999px | Pills, avatars, status dots |
| `shadow-1` | `--cp-shadow-1` | Effect style `Elevation/1` | `0 1px 2px rgb(32 34 34 / 0.08)` | Resting cards |
| `shadow-2` | `--cp-shadow-2` | Effect style `Elevation/2` | `0 4px 12px rgb(32 34 34 / 0.12)` | Hover cards, popovers |
| `shadow-3` | `--cp-shadow-3` | Effect style `Elevation/3` | `0 8px 24px rgb(32 34 34 / 0.16)` | Modals, drawers |
| `border-default` | `--cp-border-default` | — | 1px solid `neutral/200` | Card and input borders |

Flat institutional style: no gradients, no glassmorphism, no decorative blobs. Elevation only to express hierarchy.

---

## 5. Motion & breakpoints

| Token | CSS | Value |
|---|---|---|
| `motion-fast` | `--cp-motion-fast` | 150ms ease-out (hover, focus) |
| `motion-base` | `--cp-motion-base` | 250ms ease-out (cards, toasts) |
| `motion-slow` | `--cp-motion-slow` | 350ms ease-out (modals, drawers; exit at 200ms ease-in) |

Respect `prefers-reduced-motion`: disable all non-essential animation.

| Breakpoint | Token | Value |
|---|---|---|
| Mobile | `--cp-bp-sm` | 375px (design baseline) |
| Tablet | `--cp-bp-md` | 768px |
| Desktop | `--cp-bp-lg` | 1024px |
| Wide | `--cp-bp-xl` | 1440px (design baseline) |

Z-index scale: base 0 / sticky nav 10 / overlay 40 / modal 100 / toast 1000.

Touch targets: minimum 44×44px; minimum 8px spacing between targets. Icons: single set (Lucide), 16/20/24px, 1.5px stroke, outline style only. No emoji as icons.

---

## 6. Figma execution plan

> **Status (2026-10-03): EXECUTED.** The file exists: **Campus Pulse — MFE Design**,
> fileKey `0N9qpbkrmqWA075IyiyC9K`,
> https://www.figma.com/design/0N9qpbkrmqWA075IyiyC9K (owner: Vítor's Figma
> account, Starter team "Vítor de Carvalho's team"). Two deviations from the plan
> below, both forced by the Starter plan:
>
> 1. **3 pages max** → structure is `0 — Cover & Tokens`, `1 — Components`,
>    `2 — Screens` (student/organiser × desktop/mobile separated by Figma
>    sections: "Student MFE — Desktop", "Organiser MFE — Desktop",
>    "Student MFE — Mobile (375)", "Organiser MFE — Mobile (375)").
> 2. **MCP tool-call quota was exhausted** before the final visual-fix pass.
>    One known cosmetic issue remains: the `Navbar` component's tab label
>    padding (20/18) makes the tab block 56px + 24px vertical padding exceed
>    the 64px bar, so tab labels overflow slightly above the navbar on screens.
>    Fix when quota resets: on component `5:70`, set each `Tab/*` child's
>    `paddingTop = 12`, `paddingBottom = 10` (or drop navbar vertical padding).
>
> Everything else was completed: both variable collections, all 8 text styles
> (Roboto Condensed Bold/SemiBold + Inter Regular/Medium/Semi Bold verified),
> 3 elevation styles, 13 local components (Logo/UFP from the real SVG, Button
> 4×4 variant set, Badge ×6, Navbar, Input, Select, FilterChip, ProgressBar,
> EventCard, RecommendationCard, StatCard, TicketCard, CredentialCard, Modal,
> Table, Toast, EmptyState), all 9 screens at 1440px plus 375px mobile variants
> (18 wrappers), all colors/radii/paddings bound to variables, UFP logo in
> every navbar instance.

### 6.0 Prerequisites

1. Connect the Figma MCP server and confirm authentication. If auth is required, stop and ask the user to complete it.
2. Create a new file via `/figma-create-new-file` (or `create_new_file`): name **"Campus Pulse — MFE Design"**. Reuse the returned `fileKey` for everything below. *(Done — fileKey `0N9qpbkrmqWA075IyiyC9K`.)*
3. Load the `figma-use` skill before any `use_figma` call; pass `skillNames: "figma-use,figma-generate-design"`.

### 6.1 File & page structure

| Page | Contents |
|---|---|
| `0 — Cover & Tokens` | Project title, UFP logo (import [logo_ufp_site.svg](logo_ufp_site.svg) via `figma.createNodeFromSvg`), version, date, token swatches + type ramp |
| `1 — Components` | Local components from [components.md](components.md): Button, Card, Navbar, Input, Select, Badge/Tag, Modal, Table, Toast, EmptyState, CredentialCard |
| `2 — Screens` | Student S1–S5 + Organiser O1–O4 at 1440px and 375px, grouped in 4 sections (Starter plan allows only 3 pages) |

### 6.2 Variables & styles (create first — one `use_figma` call per collection)

1. Variable collection **"Campus Pulse / Colors"**, mode `Default`: every row in §1 with the Figma variable names listed (`brand/primary`, `neutral/50`, `semantic/success`, `surface/page`, …). Alias semantic tokens to brand/neutral primitives where indicated.
2. Variable collection **"Campus Pulse / Spacing & Radius"**: `space/1..16` (FLOAT) and `radius/sm..full` (FLOAT) from §3–§4.
3. Text styles: the 9 styles in §2 (`Heading/H1..H3`, `Body/Default`, `Body/Strong`, `Body/Small`, `Body/Caption`, `Data/Tabular`). Ensure **Roboto Condensed** (700/600) and **Inter** (400/500/600) are loaded in the Figma file before assigning fonts.
4. Effect styles: `Elevation/1..3` from §4.

### 6.3 Components (page `2 — Components`)

There is no published design system in a new file, so Code Connect / library discovery (Step 2a-i/2a-ii of the skill) resolves to **N/A** — build local components once with `figma.createComponent()` and instance them everywhere:

1. Create master components in this order: `Button` (variant set: primary/secondary/ghost/danger × default/hover/disabled/loading), `Badge`, `Input`, `Card`, `Navbar`, `Modal`, `Table`, `Toast`, `CredentialCard`, `EmptyState`.
2. Bind all fills to color variables via `setBoundVariableForPaint`, paddings/gaps/radii to spacing/radius variables via `setBoundVariable`, text to text styles. No hardcoded hex or px.
3. Import icons from Lucide SVG sources with `createNodeFromSvg` (explicit `width`/`height` + `viewBox`, substitute `currentColor`); never rebuild icons from primitives.
4. Import the UFP logo SVG once into a `Logo/UFP` component; instance it in Navbar.

### 6.4 Screens (pages 3–4)

Per screen, follow the skill workflow:

1. **Wrapper first**: `figma.createAutoLayout("VERTICAL")`, `resize(1440, 100)`, `layoutSizingHorizontal = "FIXED"`, positioned `maxX + 200` right of existing content. Name per the screen list in the MFE specs.
2. **Build sections inside the wrapper** in retry-safe phases: fetch wrapper by ID at the start of each call, `appendChild` sections, then set `layoutSizingHorizontal = "FILL"` after appending.
3. Sections per screen are enumerated in [student-mfe.md](student-mfe.md) and [organiser-mfe.md](organiser-mfe.md) ("Layout" blocks map 1:1 to auto-layout sections).
4. Because the UFP logo is a content image used by the app, and this is not a rendered web app, skip `generate_figma_design`; the logo is already imported as SVG in §6.3.4.
5. **Validate** (Step 5 of the skill): read back wrapper descendant counts, assert fonts are Roboto Condensed/Inter (not defaults), take one composition screenshot per wrapper, fix defects with targeted edits, one post-fix screenshot max.
6. Mobile variants: duplicate each wrapper, `resize(375, 100)`, apply the responsive rules noted per screen.

### 6.5 Definition of done (Figma)

- [ ] All colors/radii/spacing bound to variables; zero hardcoded hex in component or screen layers
- [ ] All text uses the 9 text styles; fonts verified as Roboto Condensed + Inter
- [ ] 9 screens (5 student + 4 organiser) at 1440px, plus 375px variants
- [ ] Every screen composed of component instances from page 2 — no flattened screenshots
- [ ] UFP logo present in Navbar instances on all screens
