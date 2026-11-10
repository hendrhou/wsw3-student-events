# Campus Pulse — Frontend

React micro-frontend implementation (R5) of the design package in
[`../design/`](../design/) (Figma: *Campus Pulse — MFE Design*,
fileKey `0N9qpbkrmqWA075IyiyC9K`).

## Architecture

```
shell (port 3000)            Module Federation host: router, Navbar, auth gate, toasts
├── events-mfe (5001)        remote — discovery, event detail, organiser event CRUD
├── participation-mfe (5002) remote — registration flow, roster, door check-in
├── credentials-mfe (5003)   remote — ticket wallet, credential issuance/verifier
└── people-mfe (5004)        remote — profile interests, team management
packages/
├── ui                     shared components + design tokens (CSS custom properties)
├── api                    typed gateway client + zod contract schemas
├── contracts              host↔MFE contract: useHost, Destination, queryKeys
└── mocks                  MSW fixtures/handlers for dev and tests
e2e/                       Playwright journeys against the composed stack
```

- **Module Federation** via `@module-federation/vite`; React, react-router-dom and
  react-query are shared singletons (never duplicate React across remotes).
- **Tokens**: `packages/ui/src/tokens.css` is generated from `design/design-tokens.md`.
  No hardcoded hex/px outside that file — components consume `var(--cp-*)` only.
- **State**: TanStack Query for server state; zustand for session (shell) and toasts.
- **Auth**: session JWTs from user-service (Google OIDC restricted to @ufp.edu.pt);
  locally the shell's developer access uses the ALLOW_DEV_LOGIN dev-login endpoint.
- **API contract**: `packages/api/src/schema.ts` (zod) is the single source of truth,
  shared by clients, MSW mocks and the live contract tests against the Go services
  (`packages/api/src/live.contract.test.ts`).

## Develop

```sh
cd frontend
pnpm install
pnpm dev          # shell + both MFEs in parallel (MFEs run MSW mocks standalone)
```

Standalone MFE dev (mocked API, no shell): `pnpm --filter @campus-pulse/events-mfe dev`
→ http://localhost:5001. Set `VITE_USE_MSW=false` to hit the real gateway.

## Test / verify

```sh
pnpm test         # unit + screen integration (Vitest + Testing Library + MSW), coverage gates
pnpm typecheck    # tsc --noEmit in every package
pnpm lint         # eslint incl. jsx-a11y
pnpm build        # production builds; shell emits the federation host entry

# Live contract tests — Go services vs the shared Zod schemas (needs the stack):
docker compose up -d --build --wait \
  kong postgres fuseki user-service event-service registration-service semantic-service ticket-service
CP_GATEWAY_URL=http://localhost/api pnpm --filter @campus-pulse/api test:contract

# End-to-end journeys — every business capability via Playwright (full stack):
docker compose up -d --build --wait
pnpm --filter @campus-pulse/e2e exec playwright install chromium   # once
pnpm --filter @campus-pulse/e2e test:e2e
```

## Containers

Orchestrated from the **root** compose file (single start-up command, R3):

```sh
docker compose up --build        # from the repository root
# shell → http://localhost:3000 (remotes on 5001–5004, Kong gateway on :80)
```

The Dockerfiles in each package take the `frontend/` directory as build context
and are wired in [../docker-compose.yml](../docker-compose.yml).

## Definition-of-done notes

- Coverage: lines/statements ≥80% enforced in `ui` and all four MFEs;
  screen packages set `functions: 70` (many trivial navigation closures) — see the
  vitest configs for the rationale.
- Known design-system deviation: none — gold (`--cp-brand-accent`) is used only for
  recommendations and the pending-check-in stat, per the design docs.
