# syntax=docker/dockerfile:1
# event-service image. Build context: services/ (the Go workspace root).
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY shared ./shared
COPY event-service ./event-service
WORKDIR /src/event-service
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/event-service ./cmd/event-service

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/event-service /event-service
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/event-service"]
