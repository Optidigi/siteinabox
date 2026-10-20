# syntax=docker/dockerfile:1.28.0@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b
ARG NODE_VERSION=24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f
ARG NGINX_VERSION=1.31.7-alpine@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d

FROM node:${NODE_VERSION} AS build
WORKDIR /repo
RUN npm install -g pnpm@12.14.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN node -e 'if (!process.release.lts) throw new Error("An actual Node LTS build runtime is required")' \
  && test "$(pnpm --version)" = "$(node -p 'require("./package.json").packageManager.split("@")[1]')"
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
ARG PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAEAdWyBLvR8Rjeaz
ENV SITE_URL=${SITE_URL}
ENV NODE_ENV=production
RUN POSTHOG_PROJECT_TOKEN=${POSTHOG_PROJECT_TOKEN} POSTHOG_PUBLIC_HOST=${POSTHOG_PUBLIC_HOST} POSTHOG_HOST=${POSTHOG_HOST} PUBLIC_TURNSTILE_SITE_KEY=${PUBLIC_TURNSTILE_SITE_KEY} pnpm --filter siteinabox-landing build

FROM nginx:${NGINX_VERSION}
RUN rm -f /etc/nginx/conf.d/default.conf
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/landing/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
EXPOSE 80
