# Production Deploy Runbook — `siteinabox-cms`

## Overview

This runbook walks a fresh production VPS to a healthy `https://admin.siteinabox.nl`
serving the Payload-based admin console for SiteInABox. Use it for an initial
deploy, recovery from a wiped VPS, or replicating the stack onto a new VPS.

It captures the gotchas hit during the first production deploy so they don't
bite the next operator.

## Prerequisites

Before running anything in this document, the following must be true:

- A VPS with Docker Engine and the Docker Compose v2 plugin installed.
- A Traefik edge stack already running on the host, attached to a Docker network
  named `proxy` that is marked `external: true`.
- A DNS A record `admin.<your-domain>` (e.g. `admin.siteinabox.nl`) pointing at
  the VPS public IP. SSL issuance (Let's Encrypt via Traefik) needs this
  resolving before Step 6.
- A GHCR account with read access to `ghcr.io/optidigi/siteinabox-cms` (a
  Personal Access Token with `read:packages` is sufficient). Only required if
  the package is private.
- A non-root deploy user on the host (referred to as `serveradmin` below) with
  membership in the `docker` group.

## Architecture quick-reference

Two containers, one Compose project, two networks:

```
                ┌─────────────────────────────────────┐
                │ Traefik edge (existing)             │
                │ network: proxy (external)           │
                └─────────────────────┬───────────────┘
                                      │ HTTP :3000
                                      ▼
   ┌──────────────────────┐    ┌────────────────────────┐
   │ siteinabox-cms       │◀──▶│ siteinabox-cms-postgres│
   │ image: ghcr.io/      │    │ image: postgres:18     │
   │   optidigi/          │    │   -alpine              │
   │   siteinabox-cms     │    │                        │
   │ networks:            │    │ networks: internal     │
   │   proxy, internal    │    │                        │
   └──────────────────────┘    └────────────────────────┘
```

- Compose stack lives at `/srv/saas/infra/stacks/siteinabox/apps/cms/`.
- Per-tenant data is bind-mounted to `/srv/data/saas/siab-payload/` on the
  host and surfaces inside the app container at `/data-out`.
- The Postgres volume is pinned to the legacy Docker volume name
  `siab-payload_postgres-data` so container/project renames never create an
  empty database.
- Source of truth for compose values: the repo's `docker-compose.yml`, copied
  to the VPS as `compose.yml`.

## Step 1 — VPS directories (requires root)

```bash
sudo mkdir -p /srv/saas/infra/stacks/siteinabox/apps/cms /srv/data/saas/siab-payload
sudo chown -R serveradmin:serveradmin /srv/saas/infra/stacks/siteinabox/apps/cms /srv/data/saas/siab-payload
```

The data dir must end up writable by UID 1000 inside the container — see
Gotcha 2 if you're running the host as a different UID.

## Step 2 — Compose + `.env`

Copy the repo's `docker-compose.yml` to the stack dir as `compose.yml`:

```bash
# From a workstation with the repo cloned, or via curl from a tagged release:
scp docker-compose.yml serveradmin@<vps>:/srv/saas/infra/stacks/siteinabox/apps/cms/compose.yml
```

Then write `/srv/saas/infra/stacks/siteinabox/apps/cms/.env` with the following
template. Replace placeholder values; generate the secrets with `openssl`.

```
POSTGRES_PASSWORD=<openssl rand -hex 24>
PAYLOAD_SECRET=<openssl rand -hex 32>
BETTER_AUTH_SECRET=<openssl rand -hex 32>
BETTER_AUTH_ALLOWED_HOSTS=
BETTER_AUTH_API_KEY=
BETTER_AUTH_API_URL=
BETTER_AUTH_KV_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
DATA_HOST_PATH=/srv/data/saas/siab-payload
SUPER_ADMIN_DOMAIN=siteinabox.nl
VPS_IP=<your-vps-ip>
RESEND_API_KEY=
EMAIL_FROM=noreply@siteinabox.nl
HOSTNAME=0.0.0.0
```

Leave provider credentials blank until the Google, Microsoft, and Apple apps are
registered. The login page only renders provider buttons for complete
client-id/client-secret pairs. Normal tenant admin hosts are accepted
dynamically from Payload tenants; use `BETTER_AUTH_ALLOWED_HOSTS` only for
preview or non-tenant admin hosts.
Set `BETTER_AUTH_API_KEY` only after connecting the existing SIAB app/project in
the Better Auth Infrastructure dashboard. Leave `BETTER_AUTH_API_URL` and
`BETTER_AUTH_KV_URL` blank unless the dashboard gives environment-specific
overrides. This deploy path enables only the dashboard/audit `dash()` bridge;
Better Auth Infrastructure transactional email, SMS, and Sentinel remain
disabled until the paid plan and production setup are ready.

Lock the file down:

```bash
chmod 600 /srv/saas/infra/stacks/siteinabox/apps/cms/.env
```

**DO NOT wrap values in quotes.** Compose's dotenv parser strips them, but raw
shell tools like `cut` don't, so any helper script that reads `.env`
(including the one in Step 5) will produce values prefixed/suffixed with quote
characters and silently mis-auth against Postgres. Either store everything
unquoted, or strip quotes when reading (the helper in Step 5 does both).

## Step 3 — Login to GHCR (if image is private) and pull

```bash
# Skip if ghcr.io/optidigi/siteinabox-cms is public.
echo "<github-pat>" | docker login ghcr.io -u <github-user> --password-stdin

docker compose -f /srv/saas/infra/stacks/siteinabox/apps/cms/compose.yml pull
```

## Step 4 — Bring up the stack

```bash
cd /srv/saas/infra/stacks/siteinabox/apps/cms
docker compose up -d
docker compose ps
```

The Postgres container should become healthy within ~10s. The app container
will start but will fail health checks until Step 5 has run on a fresh DB
(see Gotcha 1).

Existing deployments from before 2026-06-17 may still have containers named
`siab-payload` and `siab-payload-postgres`. To migrate those names without
touching the DB volume:

```bash
cd /srv/saas/infra/stacks/siteinabox/apps/cms
docker compose pull
docker stop siab-payload siab-payload-postgres
docker rm siab-payload siab-payload-postgres
docker compose up -d
docker compose ps
```

The compose file deliberately reuses `siab-payload_postgres-data`, so removing
the old containers does not remove the database.

## Step 5 — Apply database migrations

Migrations apply automatically on container start. The image's entrypoint
(`scripts/docker-entrypoint.sh`) runs
`node /app/dist-runtime/migrate-on-boot.bundled.mjs` before handing off to
`node server.js`; the bundled migrate runner calls `payload.db.migrate()`
against the running Postgres with the committed migrations inlined, which is a
no-op when no new migration files are present and applies them in order
otherwise.

What this means in practice:

- **Fresh DB:** the first `docker compose up -d` creates the schema. Watch
  `docker logs siteinabox-cms` to see `[migrate-on-boot] N migration(s) applied`.
- **Existing DB:** subsequent boots log `[migrate-on-boot] no pending
  migrations` (sub-second) and proceed to `node server.js`.
- **Migration failure:** the script exits non-zero, the container restarts
  per `restart: unless-stopped`, and the loop is visible in
  `docker compose ps`. Inspect `docker logs siteinabox-cms` for the SQL error.

Future schema changes flow:

1. Edit collection config in `src/`.
2. `pnpm payload migrate:create <name>` (locally, against any throwaway
   Postgres — the CLI just diffs config vs the DB to emit SQL).
3. Commit the new file in `src/migrations/`.
4. Deploy the new image. `docker compose up -d` applies it on container
   start; no manual migrate step.

## Step 6 — Traefik route labels

The compose file is the canonical route declaration. Confirm the
`siteinabox-cms` service has Traefik labels for each tenant admin hostname:

```yaml
labels:
  - traefik.enable=true
  - traefik.docker.network=proxy
  - traefik.http.routers.siteinabox-cms.rule=Host(`admin.siteinabox.nl`) || Host(`admin.ami-care.nl`)
  - traefik.http.routers.siteinabox-cms.entrypoints=websecure
  - traefik.http.routers.siteinabox-cms.tls.certresolver=letsencrypt
  - traefik.http.routers.siteinabox-cms.middlewares=hsts@docker
  - traefik.http.routers.siteinabox-cms.service=siteinabox-cms
  - traefik.http.services.siteinabox-cms.loadbalancer.server.port=3000
```

DNS for `admin.<your-domain>` must already resolve to the VPS or Let's Encrypt
issuance will fail.

## Step 7 — Verify health

```bash
curl https://admin.<your-domain>/api/health
# Expected: {"status":"ok","db":"connected","dataDir":"writable"}
```

If `dataDir` reports `unwritable`, see Gotcha 2. The current Dockerfile creates
the in-container `app` user with UID 1000 to match the host `serveradmin`
user; if you're deploying as a different host user, you must override.

## Step 8 — Seed first super-admin

The `Users` collection has a hardened bootstrap exception (audit-p1 #6, T2)
that allows unauthenticated super-admin creation **only** when ALL of the
following hold:

1. The `users` table is empty
2. The `BOOTSTRAP_TOKEN` env var is set on the server
3. The request carries an `x-bootstrap-token` header matching the env var
4. The request body has `role: "super-admin"` (no other role may bootstrap)

Use it once, rotate, then unset the env var. Leaving `BOOTSTRAP_TOKEN` set in
production keeps an unauthenticated escalation path armed if the users
table is ever emptied.

```bash
# 1. Set the bootstrap token in the server env (e.g. .env or your secrets manager)
TOKEN=$(openssl rand -hex 32)
echo "BOOTSTRAP_TOKEN=$TOKEN" >> .env
docker compose up -d   # restart with the new env

# 2. Mint the first super-admin
PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-22)
echo "Save this password: $PASSWORD"

curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: $TOKEN" \
  -d "{\"email\":\"admin@<your-domain>\",\"password\":\"$PASSWORD\",\"name\":\"Admin\",\"role\":\"super-admin\"}" \
  https://admin.<your-domain>/api/users

# 3. Remove BOOTSTRAP_TOKEN from .env (or your secrets manager) and redeploy
sed -i '/^BOOTSTRAP_TOKEN=/d' .env
docker compose up -d
```

Log in at `https://admin.<your-domain>/login`, then go to your user record in
the admin UI and rotate the password.

## Step 9 — Create the orchestrator service user

The monorepo orchestrator integration in `packages/tools/siab-orchestrator`
calls Payload via API key. Create a dedicated super-admin service user with
`enableAPIKey: true`.

Easiest path: log in as the super-admin from Step 8, open the Users list, and
use the "Create User" form (Phase A3 added a global create form on `/users`).
Set role `super-admin`, tick "Enable API Key", and save the generated key.

Or via curl:

```bash
KEY=$(node -e "console.log(crypto.randomUUID())")

TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@<your-domain>","password":"<your-password>"}' \
  https://admin.<your-domain>/api/users/login \
  | python -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -X POST -H "Content-Type: application/json" -H "Authorization: JWT $TOKEN" \
  -d "{\"email\":\"orchestrator@<your-domain>\",\"name\":\"Orchestrator\",\"password\":\"$(openssl rand -hex 16)\",\"role\":\"super-admin\",\"enableAPIKey\":true,\"apiKey\":\"$KEY\"}" \
  https://admin.<your-domain>/api/users

echo "Save this API key: $KEY"
```

In `packages/tools/siab-orchestrator/.env`:

```
PAYLOAD_API_URL=https://admin.<your-domain>
PAYLOAD_API_TOKEN=<key>
```

## Common gotchas

### Issue: `relation "users" does not exist` at boot

**Cause:** Migrations failed to apply at container start. The entrypoint
runs `migrate-on-boot.mjs` before `node server.js`, but if Postgres wasn't
healthy yet (or migrate hit a SQL error) the schema isn't there.

**Fix:** Inspect `docker logs siteinabox-cms` for the `[migrate-on-boot]`
lines. If the issue was transient (Postgres slow to come up), `docker
compose restart siteinabox-cms` re-runs migrate. If the SQL itself is the
problem, fix the offending migration file, rebuild and redeploy.

### Issue: `/api/health` returns `dataDir: unwritable`

**Cause:** UID mismatch between the host directory's owner and the in-container
`app` user. The Dockerfile bakes UID 1000.

**Fix:** Either chown the host data dir to UID 1000:

```bash
sudo chown -R 1000:1000 /srv/data/saas/siab-payload
```

…or pin the container's UID to whatever owns the host dir by adding to
`docker-compose.yml` under the `siteinabox-cms` service:

```yaml
    user: "<uid>:<gid>"
```

### Issue: `Connection refused` to `localhost:3000` from inside the container

**Cause:** Next.js standalone output binds to the container hostname (the
container's own ID-derived hostname) by default, not `0.0.0.0`. Anything
hitting `localhost:3000` inside the container — including the healthcheck
script if you customise it — fails.

**Fix:** Set `HOSTNAME=0.0.0.0` in the stack's `.env`. The `docker-compose.yml`
already passes through `HOSTNAME` via the env-file.

### Issue: GHA push to GHCR returns `permission_denied: write_package`

**Cause:** A pre-existing GHCR package (`siab-payload`) was created under a
different repo or owner and isn't linked to the repo running the workflow.
GHA's auto-issued `GITHUB_TOKEN` only has write access to packages explicitly
linked to the calling repo.

**Fix:** Either:

- Delete the existing package on GHCR and let the workflow re-create it on the
  next push (it will be auto-linked to the calling repo), or
- On the package's GHCR page, **Package settings → Manage Actions access →
  Add Repository**, pick the repo, set role to **Write**.

### Issue: Build fails with `Module not found: @/payload-types` or `./admin/importMap.js`

**Cause:** Both files are gitignored — Payload generates them. A clean clone
will not contain them, so `pnpm build` fails before Next.js's compile step.

**Fix:** The Dockerfile must run

```
pnpm payload generate:types
pnpm payload generate:importmap
```

before `pnpm build`. If you're building locally for debugging, run those two
commands by hand first.

### Issue: TypeScript spread inference loses required fields under `next build`

**Cause:** `next build`'s type-checker is stricter than `tsc --noEmit` in some
spread-inference cases, particularly with React component props. Code that
typechecks locally with `tsc` fails the production build.

**Fix:** Avoid `<Component {...obj} />` for components whose prop type demands
specific keys. Pass props explicitly:

```tsx
// Bad — may fail under next build
<Foo {...derived} />

// Good
<Foo a={derived.a} b={derived.b} c={derived.c} />
```

### Issue: `dist-runtime/` appears in build logs but isn't in the repo

**Cause:** This is expected. `dist-runtime/` is a build artifact directory
produced inside the Docker image — it holds the esbuild-bundled
`migrate-on-boot.bundled.mjs` (~5.8 MB, self-contained `.mjs` produced from
`scripts/migrate-on-boot-entry.ts` by `scripts/build-runtime-bundle.mjs`).
The entrypoint runs that bundle before `node server.js` so migrations apply
on container boot.

**Fix:** No action. `dist-runtime/` is gitignored and dockerignored — it's
only generated in the Docker `builder` stage and copied into the `runner`
stage. If you see it in a local checkout, it's because you ran the bundle
script by hand (e.g. for debugging); it's safe to delete.

### Issue: `.env` values with single or double quotes confuse shell scripts

**Cause:** Docker Compose's dotenv parser strips surrounding quotes from values
on read, but raw shell tools (`cut`, `awk` without explicit handling) do not.
A `.env` file written as `POSTGRES_PASSWORD='abc123'` produces `abc123` for
Compose but `'abc123'` for a `cut -d=` based reader, and the resulting
Postgres URI silently fails to authenticate.

**Fix:** Either store every value unquoted, or strip quotes on read:

```bash
read_env() {
  grep "^$1=" /srv/saas/infra/stacks/siteinabox/apps/cms/.env \
    | cut -d= -f2- \
    | sed -e "s/^['\"]//;s/['\"]\$//"
}
```

## Form-submission retention (GDPR)

Audit-p2 #10 (T11) — Form submissions accumulate PII (name, email, message,
pageUrl, ipAddress) and need a bounded retention. The codebase ships a
Payload **task** registered on `payload.config.ts` (`jobs.tasks`) that
deletes form submissions older than `FORMS_RETENTION_DAYS` (default 90).
The task is auto-scheduled daily at 02:00 UTC by `jobs.autoRun`, which
runs an in-process cron worker.

### Operator knobs

- `FORMS_RETENTION_DAYS` — integer days. Default 90 if unset / malformed.
  Set in `.env` alongside `PAYLOAD_SECRET` and friends. Restart the
  Payload container after changing.
- `PAYLOAD_DISABLE_JOBS_AUTORUN=1` — kill switch. Set this to disable
  the in-process cron entirely (e.g. when running migrations or during
  a maintenance window). Unset / any other value = jobs run normally.

### Verifying the purge ran

Tail the Payload container logs and grep for `purge-stale-form-submissions`:

```sh
docker compose -f /srv/saas/infra/stacks/siteinabox/apps/cms/compose.yml logs -f siteinabox-cms | grep purge-stale-form-submissions
```

Expected line on each daily run:

```
[purge-stale-form-submissions] deleted=<N> cutoff=<ISO> retentionDays=<N>
```

### Manual purge (one-off, optional)

The production image does not currently ship a separate one-off purge CLI; it
ships the bundled migration and rich-text recovery tools only. For an urgent
manual purge, either temporarily lower `FORMS_RETENTION_DAYS` and restart the
long-lived app so the scheduled task runs, or add a reviewed bundled one-off
runtime script before relying on a manual command.

### autoRun caveat (read before changing platforms)

`jobs.autoRun` registers a node-cron worker inside the Payload process.
That requires a long-lived process — i.e. our VPS deployment with
`node server.js` is fine, but **a serverless deployment (Vercel,
Cloudflare Workers, Lambda) would silently drop the schedule**. If we
ever migrate, replace the autoRun with an external scheduler (k8s
CronJob, GitHub Actions cron, or system cron on the host) that POSTs
to a Payload jobs endpoint.

## GraphQL playground env-gate (audit-p3 #16)

Audit-p3 #16 (T10) — defense-in-depth env-gate on `/api/graphql-playground`.
Payload v3.84.1's built-in `disablePlaygroundInProduction` default already
returns 404 in production, but a future `payload.config.ts` change setting
that to `false` would silently re-arm anonymous schema enumeration. The
in-repo gate (`src/lib/graphql/playgroundGate.ts`) closes that gap.

### Operator knob

- `ENABLE_GRAPHQL_PLAYGROUND` — leave unset for production. The route
  returns 404 unconditionally when `NODE_ENV === "production"` AND this
  env var is anything other than the literal string `"1"`.
- Strict equality. `"true"`, `"yes"`, `"on"`, `" 1 "` (with whitespace),
  and similar truthy-looking values all keep the playground disabled.
  Only the exact two-character string `"1"` enables it.

### When to enable in production

Almost never. The intended use case is a one-off debug session against
prod — set `ENABLE_GRAPHQL_PLAYGROUND=1`, redeploy, debug, unset, and
redeploy again. Leaving it set keeps `/api/graphql-playground` serving
the introspectable Apollo HTML to anonymous internet.

### Side effect: closes OBS-3

Out-of-batch observation OBS-3 (graphql-playground iframable: middleware
matcher excludes `/api/*` from CSP stamping → no `frame-ancestors` on
the playground HTML) closes as a consequence: in production the route
no longer serves HTML at all.

## Future improvements (out of scope for this runbook)

- **Secrets manager.** Move `RESEND_API_KEY` (and eventually
  `POSTGRES_PASSWORD`, `PAYLOAD_SECRET`) out of `.env` into a secrets
  manager — Doppler, Vault, or a SOPS-encrypted file at minimum.
- **CORS / CSRF allowlist.** Once `packages/tools/siab-orchestrator` calls Payload
  cross-origin (it doesn't yet — currently same-VPS service-to-service),
  add the orchestrator's hostname to `cors` and `csrf` arrays in
  `payload.config.ts`.
