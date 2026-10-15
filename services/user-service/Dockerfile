# syntax=docker/dockerfile:1
# user-service image. Build context: services/ (the Go workspace root).
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY shared ./shared
COPY user-service ./user-service
WORKDIR /src/user-service
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/user-service ./cmd/user-service

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/user-service /user-service
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/user-service"]
