FROM golang:1.26-alpine AS build
ARG MINIO_VERSION=RELEASE.2025-10-15T17-29-55Z
ENV CGO_ENABLED=0
RUN go install github.com/minio/minio@${MINIO_VERSION}

FROM alpine:3.22
COPY --from=build /go/bin/minio /usr/local/bin/minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]