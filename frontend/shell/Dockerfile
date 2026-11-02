# syntax=docker/dockerfile:1
# Campus Pulse shell (Module Federation host). Build context: frontend/
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY shell ./shell
# The browser fetches remotes from these origins — they must be reachable from
# the host, not the compose network (see docker-compose.yml port mappings).
ARG VITE_STUDENT_MFE_URL=http://localhost:5001
ARG VITE_ORGANISER_MFE_URL=http://localhost:5002
ARG VITE_GATEWAY_URL=/api
# MSW mocks are for local pnpm dev/tests; container builds default to the real
# backend through Kong. Override with --build-arg VITE_USE_MSW=true.
ARG VITE_USE_MSW=false
ENV VITE_STUDENT_MFE_URL=$VITE_STUDENT_MFE_URL \
    VITE_ORGANISER_MFE_URL=$VITE_ORGANISER_MFE_URL \
    VITE_GATEWAY_URL=$VITE_GATEWAY_URL \
    VITE_USE_MSW=$VITE_USE_MSW
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @campus-pulse/shell build

FROM nginx:1.27-alpine
COPY --from=build /app/shell/dist /usr/share/nginx/html
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
