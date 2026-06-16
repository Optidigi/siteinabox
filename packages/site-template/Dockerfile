# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=lts-alpine
ARG NGINX_VERSION=alpine

FROM node:${NODE_VERSION} AS build
WORKDIR /app

# Install deps with cache-friendly layering
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# Build
COPY . .
ARG SITE_URL=https://example.com
ENV SITE_URL=${SITE_URL}
RUN pnpm check:responsive && pnpm build

FROM nginx:${NGINX_VERSION}
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Healthcheck via curl-less wget bundled with alpine nginx images
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

EXPOSE 80
