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
- **Tests**: `go test ./...` from `services/`; handlers are tested through
  `httptest` with the real router (middleware included), not in isolation.

## Run locally

```sh
cd services && go test ./...
go run ./event-service/cmd/event-service   # :8080
# through the gateway (full stack): docker compose up -d kong … (profile backend)
```
