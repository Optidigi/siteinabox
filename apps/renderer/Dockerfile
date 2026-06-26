# syntax=docker/dockerfile:1.7

FROM node:26-alpine AS builder
WORKDIR /repo
RUN apk add --no-cache libc6-compat \
  && npm install -g pnpm@11.5.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/renderer/package.json apps/renderer/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/site-renderer/package.json packages/site-renderer/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm fetch --frozen-lockfile --store-dir=/pnpm/store

COPY apps/renderer apps/renderer
COPY packages/contracts packages/contracts
COPY packages/site-renderer packages/site-renderer
COPY packages/ui packages/ui
RUN pnpm install --frozen-lockfile --offline --filter @siteinabox/renderer... --store-dir=/pnpm/store

ARG SITE_URL=https://renderer.siteinabox.nl
ENV SITE_URL=${SITE_URL}
ENV NODE_ENV=production
RUN pnpm --filter @siteinabox/renderer build \
  && pnpm --filter @siteinabox/renderer deploy --prod --legacy /app \
  && cp -R apps/renderer/dist /app/dist

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
RUN apk add --no-cache wget
COPY --from=builder --chown=node:node /app ./
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --start-period=20s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4321/healthz || exit 1
CMD ["node", "./dist/server/entry.mjs"]
