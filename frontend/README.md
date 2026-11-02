# Campus Pulse — Frontend

React micro-frontend implementation (R5) of the design package in
[`../design/`](../design/) (Figma: *Campus Pulse — MFE Design*,
fileKey `0N9qpbkrmqWA075IyiyC9K`).

## Architecture

```
shell (port 5000)          Module Federation host: router, Navbar, auth gate, toasts
├── student-mfe (5001)     remote — /events, /tickets, /profile (screens S1–S5)
└── organiser-mfe (5002)   remote — /organiser/* (screens O1–O4)
packages/
├── ui                     shared components + design tokens (CSS custom properties)
├── api                    typed gateway client + zod contract schemas
└── mocks                  MSW fixtures/handlers for dev and tests
```

- **Module Federation** via `@module-federation/vite`; React, react-router-dom and
  react-query are shared singletons (never duplicate React across remotes).
- **Tokens**: `packages/ui/src/tokens.css` is generated from `design/design-tokens.md`.
  No hardcoded hex/px outside that file — components consume `var(--cp-*)` only.
- **State**: TanStack Query for server state; zustand for session (shell) and toasts.
- **Auth (interim)**: dev sign-in in the shell persists a role to localStorage and the
  API client attaches it as a bearer token. Replaced by real JWTs when user-service lands.
- **API contract**: `packages/api/src/schema.ts` (zod) is the single source of truth,
  shared by clients, MSW mocks and — later — contract tests against the Go services.

## Develop

```sh
cd frontend
pnpm install
pnpm dev          # shell + both MFEs in parallel (MFEs run MSW mocks standalone)
```

Standalone MFE dev (mocked API, no shell): `pnpm --filter @campus-pulse/student-mfe dev`
→ http://localhost:5001. Set `VITE_USE_MSW=false` to hit the real gateway.

## Test / verify

```sh
pnpm test         # unit + integration (Vitest + Testing Library + MSW), coverage gates
pnpm typecheck    # tsc --noEmit in every package
pnpm lint         # eslint incl. jsx-a11y
pnpm build        # production builds; shell emits the federation host entry
```

## Containers

Orchestrated from the **root** compose file (single start-up command, R3):

```sh
docker compose up --build        # from the repository root
# shell → http://localhost:3000 (remotes on 5001/5002, Kong gateway on :8000)
```

The Dockerfiles in each package take the `frontend/` directory as build context
and are wired in [../docker-compose.yml](../docker-compose.yml).

## Definition-of-done notes

- Coverage: lines/statements ≥80% enforced in `ui`, `student-mfe`, `organiser-mfe`;
  screen packages set `functions: 70` (many trivial navigation closures) — see the
  vitest configs for the rationale.
- Known design-system deviation: none — gold (`--cp-brand-accent`) is used only for
  recommendations and the pending-check-in stat, per the design docs.
