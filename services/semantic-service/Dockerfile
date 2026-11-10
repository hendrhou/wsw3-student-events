# syntax=docker/dockerfile:1
# semantic-service image. Build context: services/ (the Go workspace root).
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY shared ./shared
COPY semantic-service ./semantic-service
WORKDIR /src/semantic-service
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/semantic-service ./cmd/semantic-service

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/semantic-service /semantic-service
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/semantic-service"]
