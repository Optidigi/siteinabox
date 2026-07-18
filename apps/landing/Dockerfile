# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=26-alpine
ARG NGINX_VERSION=alpine

FROM node:${NODE_VERSION} AS build
WORKDIR /repo
RUN npm install -g pnpm@11.5.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing/package.json apps/landing/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/legal-content/package.json packages/legal-content/package.json

COPY apps/landing apps/landing
COPY packages/contracts packages/contracts
COPY packages/legal-content packages/legal-content
RUN pnpm install --frozen-lockfile \
  --filter siteinabox-landing... \
  --store-dir=/pnpm/store

ARG SITE_URL=https://example.com
ARG POSTHOG_PROJECT_TOKEN=
ARG POSTHOG_PUBLIC_HOST=https://r.siteinabox.nl
ARG POSTHOG_HOST=https://eu.posthog.com
ENV SITE_URL=${SITE_URL}
RUN POSTHOG_PROJECT_TOKEN=${POSTHOG_PROJECT_TOKEN} POSTHOG_PUBLIC_HOST=${POSTHOG_PUBLIC_HOST} POSTHOG_HOST=${POSTHOG_HOST} pnpm --filter siteinabox-landing build

FROM nginx:${NGINX_VERSION}
RUN rm -f /etc/nginx/conf.d/default.conf
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/landing/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
EXPOSE 80
