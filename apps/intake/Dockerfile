# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=26-alpine
ARG NGINX_VERSION=alpine

FROM node:${NODE_VERSION} AS build
WORKDIR /repo
RUN npm install -g pnpm@11.5.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/intake/package.json apps/intake/package.json
COPY packages/contracts/package.json packages/contracts/package.json

COPY apps/intake apps/intake
COPY packages/contracts packages/contracts
RUN pnpm install --frozen-lockfile \
  --filter siteinabox-intake... \
  --store-dir=/pnpm/store

ARG SITE_URL=https://example.com
ENV SITE_URL=${SITE_URL}
RUN pnpm --filter siteinabox-intake build

FROM nginx:${NGINX_VERSION}
RUN rm -f /etc/nginx/conf.d/default.conf
COPY apps/intake/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/intake/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
EXPOSE 80
