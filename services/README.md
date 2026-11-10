# Campus Pulse — Go microservices

One directory per service (R1/R2 — Go/Gin, REST/JSON, own persistence), sharing
`_shared` (config, HTTP envelope, logging) via a Go workspace.

```
services/
├── go.work                 workspace (add each service here as it lands)
├── _shared/                configuration · httpx (error envelope, request
│                           logging, recovery, healthz) — imported by all
└── event-service/          first service (skeleton in this PR)
    ├── cmd/event-service/  main.go
    ├── internal/http/      routes + handlers (paths mirror gateway/kong.yml)
    └── Dockerfile          build context is services/ (the workspace root)
```

Conventions:

- **Error shape**: `{"message": "..."}` — the frontend's ApiError parser depends
  on it; always via `httpx.Abort/NotFound/Conflict/…`, never ad-hoc JSON.
- **Logging (R4)**: one structured JSON line per request via slog; panics are
  logged with detail and answered with a generic envelope.
- **Config**: fail fast at startup on missing required env vars
  (`configuration.Load([]string{...})`).
- **Tests**: `go test ./shared/... ./event-service/... ./user-service/... ./registration-service/... ./ticket-service/... ./semantic-service/...`
  from `services/` (go.work has no root module, so `./...` does not work there).
  Handlers are tested through `httptest` with the real router (middleware
  included), not in isolation.

## Run locally

```sh
cd services && go test ./...
go run ./event-service/cmd/event-service   # :8080
# through the gateway (full stack): docker compose up -d --build (repo root)
```

### Local event-cover storage

Starting the backend profile also starts MinIO. The event service creates the
`event-covers` bucket on startup and streams uploads/reads through its API, so
the browser never receives MinIO credentials. The MinIO API is available at
`http://localhost:9000` and its console at `http://localhost:9001`; local-only
credentials and port overrides are listed in `.env.example`. Cover objects
persist in the Compose `minio-data` volume across container restarts. The local
image is built from a pinned MinIO Community Edition source release because
official community binaries/images are no longer published; review its AGPLv3
terms before redistributing or deploying it.

### PostgreSQL-backed store integration tests

user-service, event-service and registration-service have store integration
tests gated on `TEST_DATABASE_URL` (a migrated database). They use
connection-local temporary tables, never touching real rows. Coverage:

- **user-service** — Google account linking for provisioned users/organisers/admins,
  profile/interest preservation, repeat sign-in, email changes, wrong-subject rejection.
- **event-service** — create/get/update round-trip incl. organiser ownership,
  discovery filters (query/category/venue), unpublished/past hiding, capacity
  counter accumulation with floor-at-zero, ListMine across lifecycle states.
- **registration-service** — booking-ref format, duplicate-active rejection,
  cancellation → re-registration, atomic check-in exactly once, cancelled
  check-in rejection, status-filtered event/user listings.

```sh
cd services
TEST_DATABASE_URL='postgres://USER:PASSWORD@HOST:5432/users?sslmode=disable'         go test ./user-service/internal/store -count=1
TEST_DATABASE_URL='postgres://USER:PASSWORD@HOST:5432/events?sslmode=disable'        go test ./event-service/internal/store -count=1
TEST_DATABASE_URL='postgres://USER:PASSWORD@HOST:5432/registrations?sslmode=disable' go test ./registration-service/internal/store -count=1
```

Without `TEST_DATABASE_URL`, these integration tests are skipped. CI runs them
against a throwaway postgres:16 container (see `.github/workflows/ci.yml`).
