# syntax=docker/dockerfile:1
# Campus Pulse organiser-mfe (Module Federation remote). Build context: frontend/
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY organiser-mfe ./organiser-mfe
ARG VITE_GATEWAY_URL=/api
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @campus-pulse/organiser-mfe build

FROM nginx:1.27-alpine
COPY --from=build /app/organiser-mfe/dist /usr/share/nginx/html
# CORS-enabled config: the shell origin fetches remoteEntry.js cross-origin
COPY docker/nginx-mfe.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
