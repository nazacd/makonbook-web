# syntax=docker/dockerfile:1

# Both sites, built by Vite, served by one nginx (docker/nginx.conf):
#   /srv/landing  makonbook.uz
#   /srv/app      sat.makonbook.uz

FROM node:22-alpine AS build
WORKDIR /src
# Dependencies first, so a change to the sources doesn't reinstall them.
COPY package.json package-lock.json ./
COPY landing/package.json landing/
COPY app/package.json app/
RUN npm ci
COPY . .
# The Desmos key is read by Vite at build time (app/.env.example). It ends up
# in the app's bundle, as any Desmos key does; it is restricted by domain.
ARG VITE_DESMOS_API_KEY=
ENV VITE_DESMOS_API_KEY=$VITE_DESMOS_API_KEY
RUN npm run build && npm run precompress

# Runs as nginx (uid 101) and keeps its pid and temp files in /tmp, so the
# container runs read-only with a tmpfs on /tmp (deploy/docker-compose.yml).
FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf docker/app-csp.conf /etc/nginx/mb/
COPY --from=build /src/landing/dist /srv/landing
COPY --from=build /src/app/dist /srv/app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
