# Campus Pulse — Student Event Management System

**Semantic Web and Web 3.0 course project (2026/2027)**, Master's in Computer
Engineering, Universidade Fernando Pessoa.

Campus Pulse is a distributed system for university event management: students
discover events and receive **semantic recommendations** driven by an OWL
ontology and SPARQL; organisers publish events and check in attendees by
verifying **verifiable credentials** (the Web 3.0 component) that any third
party can validate without contacting Campus Pulse.

> The authoritative project brief (requirements R1–R10, deliveries, assessment)
> is [project_instructions/project_protocol.md](project_instructions/project_protocol.md).

## Repository layout

```
project_instructions/   Course protocol distilled into the authoritative brief
diagrams/               Architecture diagrams (Mermaid sources + rendered PNGs)
design/                 UI design package: tokens, component inventory, screen
                        specs for both MFEs, UFP brand assets, Figma plan (§6)
frontend/               React micro frontends (this is the runnable app today)
  ├── shell/            Module Federation host: router, navbar, auth gate
  ├── student-mfe/      /events, /tickets, /profile — screens S1–S5
  ├── organiser-mfe/    /organiser/* — screens O1–O4
  └── packages/         ui (design system) · api (gateway client + zod contract)
                        mocks (MSW fixtures for dev & tests)
```

Planned backend (per the agreed architecture in the protocol §2.1): Kong API
gateway + five Go/Gin services (`user`, `event`, `registration`, `semantic`,
`ticket`), each with its own persistence, all orchestrated from a single
root `docker-compose.yml`. Until those land, the frontend runs against
built-in MSW mocks that implement the full API contract.

## Quick start

### Option A — Docker (containers only)

```sh
cd frontend
docker compose up --build
# → http://localhost:5000  (shell composing both MFEs)
```

MFE remotes are served on :5001/:5002 and fetched by the shell cross-origin.
The gateway URL defaults to http://localhost:8000/api (Kong — not built yet;
use Option B for a working demo today).

### Option B — Local dev with mocked API (recommended for now)

```sh
cd frontend
pnpm install
pnpm dev
# → http://localhost:5000 (shell)
# → http://localhost:5001 (student-mfe standalone, MSW-mocked API)
# → http://localhost:5002 (organiser-mfe standalone, MSW-mocked API)
```

Standalone MFE dev servers start with MSW mocks, so every screen — including
registration, credential issuance, and check-in — is demoable with no backend.
Set `VITE_USE_MSW=false` to hit a real gateway instead.

Sign-in is a dev role picker (student / organiser) until `user-service` issues
real JWTs.

## Verify

```sh
cd frontend
pnpm test        # unit/integration tests (Vitest + Testing Library + MSW)
pnpm typecheck   # tsc --noEmit across all packages
pnpm lint        # eslint incl. jsx-a11y
pnpm build       # production builds with Module Federation remote entries
```

Coverage gates are enforced per package (≥80% lines/statements).

## Design system

- Tokens and components come from [design/](design/) — the single source of
  truth. Components consume `var(--cp-*)` custom properties only; no hardcoded
  hex/px in component code.
- Figma file: **Campus Pulse — MFE Design**
  (`https://www.figma.com/design/0N9qpbkrmqWA075IyiyC9K`) — variables, local
  components, and all 9 screens at desktop + mobile.
- UFP green `#005947` is the primary; gold `#fcce4c` is reserved for semantic
  recommendations ("gold = matched to me") and pending-attention items.

## Contributing

- **Never push to `main`** — every change lands via pull request; large
  features are implemented in phases, one PR per phase.
- Conventional commits: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
- Architecture/design decisions must be checked against
  [project_instructions/project_protocol.md](project_instructions/project_protocol.md)
  first; conflicts get flagged, not silently applied.

## Status

| Area | State |
|---|---|
| Protocol, architecture diagrams, design package | ✅ merged |
| Figma screens (S1–S5, O1–O4 + mobile) | ✅ done |
| Frontend: ui/api/mocks/shell/student/organiser + Docker | ✅ PRs #2–#6 (merge in order) |
| Go/Gin services + Kong gateway | ⬜ next |
| OWL ontology (Protégé) + RDF transformation | ⬜ next |
| Web 3.0 credential issuance/verification service | ⬜ next |

