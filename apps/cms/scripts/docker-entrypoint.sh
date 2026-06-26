#!/bin/sh
# Container entrypoint. Apply pending DB migrations, then hand off to the
# Next.js standalone server as PID 1 so signals (SIGTERM from `docker stop`)
# reach Node directly.
#
# Migration failure exits non-zero — Docker will restart the container per
# the compose `restart: unless-stopped` policy, surfacing the loop in
# `docker logs siteinabox-cms` and `docker compose ps`.
set -e

echo "[entrypoint] running migrate-on-boot..."
# Use the esbuild-bundled copy (payload + adapters inlined). The Next.js
# standalone runner image does not expose `node_modules/payload`, so the
# unbundled source script (`scripts/migrate-on-boot.mjs`) cannot run here.
node /app/dist-runtime/migrate-on-boot.bundled.mjs

echo "[entrypoint] starting next server..."
exec node /app/apps/cms/server.js
