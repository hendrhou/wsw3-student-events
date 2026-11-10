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

                        Observability configuration, generated dashboards, alert rules, and verification
                        tools live in [observability/](observability/README.md).

The backend described in the protocol §2.1 is implemented: Kong API
gateway + five Go/Gin services (`user`, `event`, `registration`, `semantic`,
`ticket`), each with its own database on one shared Postgres instance, plus a
Jena Fuseki triple store for the semantic layer — all orchestrated from a single root
`docker-compose.yml`.

## Quick start

### Option A — Full stack in Docker (frontend + backend)

Set `GRAFANA_ADMIN_PASSWORD` in your local `.env` first, using a private generated
value (for example, generate one with `openssl rand -hex 24`). The example
environment file intentionally leaves it empty.

```sh
docker compose up --build
# → http://localhost:3000  (shell composing the four MFEs)
# → http://localhost         (Kong gateway on port 80, /api/*)
```

Friendly hostnames are served through the gateway (Kong routes by Host header):

| URL | Area |
| --- | --- |
| http://student.localhost | Student area (discovery, tickets, profile) |
| http://organiser.localhost | Organiser area (events, check-in, team) |
| http://grafana.localhost | Grafana (observability UI) |

`*.localhost` resolves to loopback natively on macOS and Linux — no DNS
server, hosts-file edits, or sudo required.

Exposure model: the browser only ever reaches the shell (:3000), the four MFE
bundle servers (:5001–5004, Module Federation remotes), and Kong (:80). All
Go services, Postgres, MinIO, Fuseki and Grafana are internal to the compose
network — Grafana is reachable exclusively through the Kong host route.
Observability config lives as code in `observability/` (Alloy, Prometheus,
Loki, Tempo, Grafana datasources + dashboards); Prometheus' debug UI binds
localhost only (:9090).

20 containers come up: shell + 4 domain MFEs (events, participation,
credentials, people), Kong, the five Go services, one Postgres instance with
four service databases, MinIO (event cover images), Fuseki, and the
observability stack (Alloy, Prometheus, Loki, Tempo, Grafana). There are no
profiles: `docker compose up` / `down` manage the whole system. The frontend
containers talk to the real backend through Kong (MSW off). Sign in with
**Developer access** on the login page (Vítor = student, Olga = organiser) —
Google OIDC is wired and activates as soon as
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are provided in `.env`. Grafana
signs in with `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD` from `.env`
(dev defaults: admin/admin).

For local Google OIDC, use a **Web application** OAuth client and register
`http://localhost/api/auth/google/callback` as an authorized redirect URI
in Google Cloud Console (adjust the port if `KONG_PORT` changes). Set
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`, then recreate
`user-service` to apply them. Only verified Google Workspace accounts with
the `ufp.edu.pt` hosted-domain claim are accepted. First Google sign-in links
any email-provisioned account, preserving its role, student number and interests.

### Option B — Frontend only in Docker

```sh
VITE_USE_MSW=true docker compose up --build
# → http://localhost:3000  (shell + MFEs against MSW mocks)
```

### Option C — Local dev with mocked API

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
| CI, unified compose + Kong, Terraform skeleton | ✅ PRs #7–#10 |
| Go/Gin services: shared → user → event → registration → ticket → semantic | ✅ PRs #11–#16 (stacked, merge in order) |
| OWL ontology + RDF transformation (Fuseki, SPARQL recommendations) | ✅ PR #16 |
| Web 3.0 VC issuance/verification (VC-JWT, did:key) | ✅ PR #15 |
| AWS deployment (Terraform apply + release pipeline) | ⬜ manual, after merge |
