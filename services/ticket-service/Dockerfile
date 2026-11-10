# syntax=docker/dockerfile:1
# ticket-service image. Build context: services/ (the Go workspace root).
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY shared ./shared
COPY ticket-service ./ticket-service
WORKDIR /src/ticket-service
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/ticket-service ./cmd/ticket-service

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/ticket-service /ticket-service
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/ticket-service"]
