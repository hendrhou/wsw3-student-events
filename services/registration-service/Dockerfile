# syntax=docker/dockerfile:1
# registration-service image. Build context: services/ (the Go workspace root).
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY shared ./shared
COPY registration-service ./registration-service
WORKDIR /src/registration-service
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/registration-service ./cmd/registration-service

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/registration-service /registration-service
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/registration-service"]
