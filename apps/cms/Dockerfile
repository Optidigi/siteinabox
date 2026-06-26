# syntax=docker/dockerfile:1.7

# 1. Build
FROM node:26-alpine AS builder
WORKDIR /repo
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@11.5.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cms/package.json apps/cms/package.json
COPY packages/contracts/package.json /repo/packages/contracts/package.json
COPY packages/site-renderer/package.json /repo/packages/site-renderer/package.json
COPY packages/ui/package.json /repo/packages/ui/package.json
RUN pnpm fetch --frozen-lockfile --store-dir=/pnpm/store

COPY apps/cms apps/cms
COPY packages/contracts /repo/packages/contracts
COPY packages/site-renderer /repo/packages/site-renderer
COPY packages/ui /repo/packages/ui
RUN pnpm install --frozen-lockfile --offline \
  --filter siab-payload... \
  --filter @siteinabox/site-renderer... \
  --filter @siteinabox/ui... \
  --filter @siteinabox/contracts... \
  --store-dir=/pnpm/store
ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=true
# PAYLOAD_SECRET / DATABASE_URI must be set at runtime, not build time.
# But payload.config.ts throws if they're missing — provide build-time
# placeholders so `next build` (which evaluates the config) can complete.
ENV PAYLOAD_SECRET=build-time-placeholder
ENV DATABASE_URI=postgres://placeholder@placeholder/placeholder
# Payload generates two files at runtime that are .gitignored:
#   - src/payload-types.ts            (TS types for collections; consumed across the app)
#   - src/app/(payload)/admin/importMap.js   (Payload admin layout import)
# Locally they exist from prior dev runs; in CI we must produce both before
# `next build`. Neither command queries the DB — they walk the config —
# so the placeholder DATABASE_URI suffices.
RUN pnpm --filter siab-payload payload generate:types \
 && pnpm --filter siab-payload payload generate:importmap \
 && pnpm --filter siab-payload build \
 && node apps/cms/scripts/build-runtime-bundle.mjs

# 2. Runtime
FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Bind Next.js standalone server to all interfaces. Without this, the server
# binds only to the container hostname, making /api/health (which curls
# localhost:3000) and the Docker healthcheck fail with "connection refused".
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN apk add --no-cache wget
# node:26-alpine ships with a `node` user at UID 1000; reuse it (matches the
# host's serveradmin UID 1000 so the bind-mounted /data-out is writable).
COPY --from=builder --chown=node:node /repo/apps/cms/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/cms/.next/static ./apps/cms/.next/static
COPY --from=builder --chown=node:node /repo/apps/cms/public ./apps/cms/public
# Migrate-on-boot bundle: a single self-contained `.mjs` produced by esbuild
# with payload + db-postgres + drizzle + pg + the config + every migration's
# up/down all INLINED. The runner stage is Next's `.next/standalone` output,
# which traces server.js imports and does NOT preserve `node_modules/payload`
# as a directly-importable package; therefore the migrate script must be
# ESM-bundled. See scripts/build-runtime-bundle.mjs (bundler) and
# scripts/migrate-on-boot-entry.ts (source) for the why.
COPY --from=builder --chown=node:node /repo/apps/cms/dist-runtime ./dist-runtime
COPY --from=builder --chown=node:node /repo/apps/cms/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --start-period=60s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
ENTRYPOINT ["/bin/sh", "/app/scripts/docker-entrypoint.sh"]
