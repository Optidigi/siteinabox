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

This file is production secret state. Agents must not edit the current
production `.env`; the operator sets or rotates these values directly on the
VPS or in the approved secret store and explicitly approves any deploy that
consumes them.

```
POSTGRES_PASSWORD=<openssl rand -hex 24>
PAYLOAD_SECRET=<openssl rand -hex 32>
BETTER_AUTH_SECRET=<openssl rand -hex 32>
BETTER_AUTH_PREVIEW_SECRET=<openssl rand -hex 32>
BETTER_AUTH_ALLOWED_HOSTS=
BETTER_AUTH_API_KEY=
BETTER_AUTH_API_URL=
BETTER_AUTH_KV_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SIAB_GOOGLE_OAUTH_CALLBACK_HOSTS=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
SIAB_MICROSOFT_OAUTH_CALLBACK_HOSTS=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
SIAB_APPLE_OAUTH_CALLBACK_HOSTS=
DATA_HOST_PATH=/srv/data/saas/siab-payload
SUPER_ADMIN_DOMAIN=siteinabox.nl
CLOUDFLARE_EMAIL_API_TOKEN=
CLOUDFLARE_EMAIL_SMTP_TOKEN=
EMAIL_FROM=noreply@siteinabox.nl
SIAB_EMAIL_PREFERENCE_SECRET=<dedicated-random-hmac-secret>
SIAB_PUBLIC_POST_RATE_LIMIT_POINTS=10
SIAB_PUBLIC_POST_RATE_LIMIT_WINDOW_SECONDS=60
SIAB_FORM_TARGET_RATE_LIMIT_POINTS=50
SIAB_FORM_TARGET_RATE_LIMIT_WINDOW_SECONDS=3600
SIAB_LEGAL_MANIFEST_URL=https://www.siteinabox.nl/.well-known/siab-legal-manifest.json
SIAB_GIT_SHA=<deployed-git-sha>
MOLLIE_API_KEY=<mollie-test-or-live-api-key-from-secret-store>
COMMERCE_RELEASE_STAGE=disabled
COMMERCE_RELEASE_EVIDENCE_VERSION=
COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED=
COMMERCE_ORIGIN_ISOLATION_VERIFIED=
COMMERCE_EXISTING_DOMAIN_MIGRATION_ENABLED=
COMMERCE_MIGRATION_SOURCE_CLOUDFLARE_ENABLED=
COMMERCE_MIGRATION_SOURCE_AXFR_ENABLED=
COMMERCE_MIGRATION_SOURCE_CLOUDFLARE_OAUTH_ENABLED=
CLOUDFLARE_SOURCE_OAUTH_CLIENT_ID=
CLOUDFLARE_SOURCE_OAUTH_CLIENT_SECRET=
CLOUDFLARE_SOURCE_OAUTH_REDIRECT_URI=https://preview.siteinabox.nl/api/domain-migration-source/cloudflare/callback
MOLLIE_WEBHOOK_BASE_URL=https://admin.siteinabox.nl
OPENPROVIDER_USERNAME=
OPENPROVIDER_PASSWORD=
OPENPROVIDER_API_BASE_URL=
OPENPROVIDER_TECH_HANDLE=
OPENPROVIDER_BILLING_HANDLE=
OPENPROVIDER_NS_GROUP=
OPENPROVIDER_NAMESERVERS=
OPENPROVIDER_DOMAIN_MAX_COST_AMOUNT=10.00
OPENPROVIDER_DOMAIN_MAX_COST_CURRENCY=EUR
OPENPROVIDER_MIN_BALANCE_EUR=0
OPENPROVIDER_DOMAIN_MAX_OFFER_AMOUNT=
OPENPROVIDER_DOMAIN_MAX_OFFER_CURRENCY=EUR
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_BASE_URL=
CLOUDFLARE_RENDERER_TUNNEL_ID=
CLOUDFLARE_RENDERER_TUNNEL_NAME=siteinabox-renderer
CLOUDFLARE_CMS_TUNNEL_ID=
CLOUDFLARE_CMS_TUNNEL_NAME=siteinabox-cms
CLOUDFLARE_CMS_TUNNEL_TOKEN_FILE=/srv/saas/secrets/siteinabox-cms-tunnel-token
DOMAIN_MIGRATION_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
HOSTNAME=0.0.0.0
SITE_URL=https://admin.siteinabox.nl
SIAB_RENDERER_API_TOKEN=<openssl rand -hex 32>
POSTHOG_ANALYTICS_DISABLED=
POSTHOG_HOST=https://eu.posthog.com
POSTHOG_PUBLIC_HOST=https://r.siteinabox.nl
POSTHOG_PROJECT_TOKEN=
POSTHOG_PROJECT_ID=
POSTHOG_PERSONAL_API_KEY=
POSTHOG_ORGANIZATION_ID=
POSTHOG_ENVIRONMENT=production
```

Apply and verify the PostHog privacy baseline after configuring the project:

```bash
pnpm --dir apps/cms posthog:sync-settings
pnpm --dir apps/cms posthog:check-settings
```

The sync enforces IP anonymization, disables project-level browser autocapture,
console capture, session recording, heatmaps and dead-click capture, and audits
the 13-month event-retention target. PostHog exposes retention as a plan-managed
read-only setting, so the command cannot enforce it. The daily
`.github/workflows/posthog-privacy-audit.yml` check continues to expose the
difference from the governed target. The current 84-month, unenforced provider
value is an accepted external constraint rather than outstanding implementation
work; see SIAB-002.

Keep Payload job autorun enabled in the long-lived CMS process. Setting
`PAYLOAD_DISABLE_JOBS_AUTORUN=1` disables legal re-acceptance email delivery as
well as other scheduled maintenance and is not valid for the normal VPS
deployment. Legal notices use `EMAIL_FROM` and the configured Cloudflare Email
Sending transport, with `info@siteinabox.nl` as reply-to and support contact.
For a reviewed manual retry after correcting a permanent address/provider
failure, run the production-shipped command with the delivery id or stable key:

```bash
docker exec siteinabox-cms node /app/dist-runtime/retry-legal-notification.bundled.mjs <delivery-id-or-notification-key>
```

The command refuses sent/cancelled deliveries and preserves the attempt count;
the scheduled worker performs the actual resend and records a new mail-log row.

Leave provider credentials blank until the Google, Microsoft, and Apple apps are
registered. A login page renders a provider button only when its credentials
are complete and the exact request host is listed in the matching
`SIAB_<PROVIDER>_OAUTH_CALLBACK_HOSTS` value. Add a host only after registering
`https://<host>/api/auth/callback/<provider>` with that provider. Normal tenant
admin hosts still support magic-link authentication dynamically from Payload;
`BETTER_AUTH_ALLOWED_HOSTS` is not OAuth callback evidence.
Set `BETTER_AUTH_API_KEY` only after connecting the existing SIAB app/project in
the Better Auth Infrastructure dashboard. Leave `BETTER_AUTH_API_URL` and
`BETTER_AUTH_KV_URL` blank unless the dashboard gives environment-specific
overrides. This deploy path enables only the dashboard/audit `dash()` bridge;
Better Auth Infrastructure transactional email, SMS, and Sentinel remain
disabled until the paid plan and production setup are ready.
`BETTER_AUTH_API_KEY` is optional Better Auth Infrastructure integration; it is
not a replacement for `BETTER_AUTH_SECRET`.

Lock the file down:

```bash
chmod 600 /srv/saas/infra/stacks/siteinabox/apps/cms/.env
```

`SIAB_RENDERER_API_TOKEN` is the shared bearer token for the generic renderer's
snapshot lookup. Use the same value in the renderer stack. In production, the
CMS snapshot endpoint rejects requests when this token is missing or incorrect.
`SITE_URL` should match the public CMS/admin origin where runtime metadata or
absolute URLs need the CMS origin. Better Auth also uses this value as the
canonical fallback for magic-link URLs when `BETTER_AUTH_URL` is unset.
CMS and preview auth routes normalize forwarded host/proto headers before
handing requests to Better Auth, so Better Auth's native magic-link URL
generation uses the public admin or preview origin instead of the container
bind host.
Cloudflare Email Sending is the canonical mail path. Runtime delivery prefers
Cloudflare's REST Email Sending API over HTTPS using `CLOUDFLARE_ACCOUNT_ID`
and the dedicated mail-scoped `CLOUDFLARE_EMAIL_API_TOKEN`, with `EMAIL_FROM`
as the platform sender. The DNS/zone automation token is never reused to send
mail. SMTP via `CLOUDFLARE_EMAIL_SMTP_TOKEN` is the fallback when the REST mail
token is absent and outbound `smtps://smtp.mx.cloudflare.net:465` is reachable.
This path covers
platform/admin messages, Better Auth CMS and preview magic links, intake
internal notifications, privacy exports, preview handoff mail, and any other
platform-sender mail. Tenant generated-site form notifications use the tenant's
verified sender, normally `noreply@mail.<tenant-domain>`, after
`tenants.emailSending.status` is verified.

The same Cloudflare API env used for DNS automation also provisions and
refreshes optional tenant-branded Email Sending subdomains: set
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and optionally
`CLOUDFLARE_API_BASE_URL`. Sender creation and verification are reconciled
asynchronously and never hold the website offline. Until a tenant sender is
verified, transactional and form-notification mail uses the configured
platform `EMAIL_FROM`; `tenants.emailSending` continues to expose the truthful
pending or failed branded-sender state.

Mail sends write metadata-only `mail-logs` when the caller supplies Payload,
and important or repeated failures upsert `operational-alerts`. These
collections are super-admin-only and must not contain rendered subjects, bodies,
tokens, or secrets.
Mollie checkout uses the hosted Payments API and the webhook route
`/api/payments/mollie/webhook`. Keep `MOLLIE_API_KEY` and any optional webhook
signing secret in deployment secrets only; `.env.example` intentionally contains
no real values. The payment gate is satisfied by Mollie `paid` webhooks or a
super-admin manual waiver. Paid customer checkout provisions the selected
domain through Cloudflare and OpenProvider when the domain order is ready, but
payment completion never publishes or activates a site by itself. The checkout
collects customer holder details and creates OpenProvider owner/admin contact
handles per customer; deployment env only supplies the SIAB/Optidigi
technical/billing contact handles.
Cloudflare edge automation requires an account id, API token, and the two
dedicated Tunnel UUIDs. The token needs Tunnel Edit, Zone Read/Edit, DNS Edit,
and SSL/Certificates Read. The CMS job derives each
`<UUID>.cfargotunnel.com` target, owns exact apex/`www`/`admin` ingress and DNS,
and fails closed on unowned record conflicts.
`RESEND_API_KEY` is obsolete after the Cloudflare Email Sending mail-path change and
should not be carried forward into the production `.env`.

Current production environment requirements:

| Area | Required action |
| --- | --- |
| Postgres | Keep existing production `POSTGRES_PASSWORD` and derived `DATABASE_URI`; do not recreate the DB. |
| Payload | Keep existing `PAYLOAD_SECRET`. |
| CMS image | Set `SIAB_CMS_IMAGE_DIGEST=sha256:<digest>` from the successful CMS image workflow; never deploy a mutable tag. |
| Data path | Keep `DATA_HOST_PATH=/srv/data/saas/siab-payload`. |
| Super admin | Keep `SUPER_ADMIN_DOMAIN=siteinabox.nl`. |
| PostHog | Keep existing `POSTHOG_*` values; fill missing project token/id/API key only when analytics/admin sync needs them. |
| Better Auth | Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_PREVIEW_SECRET`; `BETTER_AUTH_API_KEY` remains optional Infrastructure dashboard/audit integration. |
| CMS origin | Set `SITE_URL=https://admin.siteinabox.nl`. |
| Renderer token | Set the same `SIAB_RENDERER_API_TOKEN` for the CMS snapshot endpoint and renderer environment. |
| Email | Set `CLOUDFLARE_ACCOUNT_ID`, dedicated `CLOUDFLARE_EMAIL_API_TOKEN`, and `EMAIL_FROM`; keep `CLOUDFLARE_EMAIL_SMTP_TOKEN` only as optional SMTP fallback; never reuse the DNS token; remove obsolete `RESEND_API_KEY`. |
| Rate limits | Keep or tune `SIAB_PUBLIC_POST_RATE_LIMIT_*` and `SIAB_FORM_TARGET_RATE_LIMIT_*` for anonymous public POST and form-target budgets. |
| Mollie | Set `MOLLIE_API_KEY` and the webhook base URL. The classic webhook accepts Mollie's form-encoded payment ID and always retrieves authoritative state through the API; accepted order/payment-attempt amounts are the only monetary authority. |
| Commerce release | Keep `COMMERCE_RELEASE_STAGE=disabled` until the evidence and staged enablement procedure in [commerce-release.md](commerce-release.md) is complete. |
| OpenProvider | Set username/password, SIAB technical/billing handles, and max allowed provider domain cost before enabling paid customer domain registration. |
| Cloudflare DNS/Tunnel/Email API | Set the scoped automation token, account id, renderer/CMS Tunnel UUIDs, and separate mode-0600 runtime token files before enabling domain provisioning. |
| Transfer-code encryption | Set one stable, backed-up `DOMAIN_MIGRATION_ENCRYPTION_KEY`; rotating it without re-encrypting active secrets makes transfer codes unreadable. |
| Bootstrap/debug gates | Keep `BOOTSTRAP_TOKEN` and `ENABLE_GRAPHQL_PLAYGROUND` unset unless there is a temporary operator-approved reason. |

**DO NOT wrap values in quotes.** Compose's dotenv parser strips them, but raw
shell tools like `cut` don't, so any helper script that reads `.env`
(including the one in Step 5) will produce values prefixed/suffixed with quote
characters and silently mis-auth against Postgres. Either store everything
unquoted, or strip quotes when reading (the helper in Step 5 does both).

## Step 3 — Login to GHCR (if image is private) and pull

Record the verified digest emitted by `build-cms-image` in the deployment
environment before pulling:

```bash
SIAB_CMS_IMAGE_DIGEST=sha256:<digest from the successful image workflow>
```

Keep the previous digest in the approved change record for rollback. The image
workflow publishes commit tags, smokes the exact output digest, and does not
publish a mutable `latest` deployment target.

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
the Next standalone server; the bundled migrate runner calls `payload.db.migrate()`
against the running Postgres with the committed migrations inlined, which is a
no-op when no new migration files are present and applies them in order
otherwise.

For an existing production CMS, take an operator-approved Postgres backup and
record the current CMS image ID before pulling or restarting the new image.
Do not hand-edit migration state or run ad hoc SQL. The expected production
sequence is:

1. Operator verifies the redacted `.env` key inventory and fills required
   values.
2. Operator creates a timestamped Postgres backup.
3. Operator records the current `siteinabox-cms` image ID/tag for rollback.
4. Operator pulls the reviewed CMS image and starts the stack.
5. `migrate-on-boot` applies pending committed migrations.
6. Operator reviews logs and health before proceeding to renderer or smoke
   phases.

Final production smoke/review remains blocked until the operator has set the
required production env values and explicitly approved the production deploy.

What this means in practice:

- **Fresh DB:** the first `docker compose up -d` creates the schema. Watch
  `docker logs siteinabox-cms` to see `[migrate-on-boot] N migration(s) applied`.
- **Existing DB:** subsequent boots log `[migrate-on-boot] no pending
  migrations` (sub-second) and proceed to the Next standalone server.
- **Migration failure:** the script exits non-zero, the container restarts
  per `restart: unless-stopped`, and the loop is visible in
  `docker compose ps`. Inspect `docker logs siteinabox-cms` for the SQL error.

Future schema changes flow:

1. Edit collection config in `src/`.
2. `pnpm --dir apps/cms payload migrate:create <name>` (locally, against any throwaway
   Postgres — the CLI just diffs config vs the DB to emit SQL).
3. Commit the new file in `src/migrations/`.
4. Deploy the new image. `docker compose up -d` applies it on container
   start; no manual migrate step.

## Step 6 — Traefik route labels

The compose files are the canonical route declaration. Confirm the
platform-owned public apps have exact host routers with priorities above the
generic renderer catch-all.

Marketing routes belong to `apps/landing/compose.yml` and must serve both the
apex and `www` host. Set `SIAB_SITE_IMAGE_DIGEST=sha256:<digest>` to the
verified digest emitted by the successful `build-site-image` workflow; never
deploy a mutable tag:

```yaml
labels:
  - traefik.enable=true
  - traefik.docker.network=proxy
  - traefik.http.routers.siteinabox-site.rule=Host(`siteinabox.nl`) || Host(`www.siteinabox.nl`)
  - traefik.http.routers.siteinabox-site.entrypoints=websecure
  - traefik.http.routers.siteinabox-site.tls.certresolver=letsencrypt
  - traefik.http.routers.siteinabox-site.middlewares=hsts@docker
  - traefik.http.routers.siteinabox-site.priority=100
  - traefik.http.routers.siteinabox-site.service=siteinabox-site
  - traefik.http.services.siteinabox-site.loadbalancer.server.port=80
```

Public intake belongs to `apps/intake/compose.yml` and must outrank landing for
`/intake` on both apex and `www`. Set
`SIAB_INTAKE_IMAGE_DIGEST=sha256:<digest>` to the verified digest emitted by
the successful `build-intake-image` workflow; never deploy a mutable tag:

```yaml
labels:
  - traefik.enable=true
  - traefik.docker.network=proxy
  - traefik.http.routers.siteinabox-intake.rule=(Host(`siteinabox.nl`) || Host(`www.siteinabox.nl`)) && (Path(`/intake`) || PathPrefix(`/intake/`))
  - traefik.http.routers.siteinabox-intake.entrypoints=websecure
  - traefik.http.routers.siteinabox-intake.tls.certresolver=letsencrypt
  - traefik.http.routers.siteinabox-intake.middlewares=hsts@docker
  - traefik.http.routers.siteinabox-intake.priority=300
  - traefik.http.routers.siteinabox-intake.service=siteinabox-intake
  - traefik.http.services.siteinabox-intake.loadbalancer.server.port=80
```

Confirm the `siteinabox-cms` service keeps Traefik only for the platform admin,
preview hostname, and public CMS API paths. Customer `admin.<domain>` hosts
belong to the private CMS Tunnel:

```yaml
labels:
  - traefik.enable=true
  - traefik.docker.network=proxy
  - traefik.http.routers.siteinabox-cms.rule=Host(`admin.siteinabox.nl`) || Host(`preview.siteinabox.nl`)
  - traefik.http.routers.siteinabox-cms.entrypoints=websecure
  - traefik.http.routers.siteinabox-cms.tls.certresolver=letsencrypt
  - traefik.http.routers.siteinabox-cms.middlewares=hsts@docker
  - traefik.http.routers.siteinabox-cms.service=siteinabox-cms
  - traefik.http.routers.siteinabox-cms-intake-api.rule=(Host(`siteinabox.nl`) || Host(`www.siteinabox.nl`)) && PathPrefix(`/api/intake`)
  - traefik.http.routers.siteinabox-cms-intake-api.priority=250
  - traefik.http.routers.siteinabox-cms-contact-api.rule=(Host(`siteinabox.nl`) || Host(`www.siteinabox.nl`)) && PathPrefix(`/api/contact`)
  - traefik.http.routers.siteinabox-cms-contact-api.priority=250
  - traefik.http.services.siteinabox-cms.loadbalancer.server.port=3000
```

There is no renderer or customer-admin Traefik catch-all. The exclusive
commerce reconciler installs exact Cloudflare Tunnel routes and blocks handoff
until DNS, certificate coverage, Tunnel health, and service identity verify.

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

## Step 9 — Create an automation service user

Create a dedicated super-admin service user with `enableAPIKey: true` for
approved platform automation that needs to call Payload server-to-server.

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
  -d "{\"email\":\"automation@<your-domain>\",\"name\":\"Automation\",\"password\":\"$(openssl rand -hex 16)\",\"role\":\"super-admin\",\"enableAPIKey\":true,\"apiKey\":\"$KEY\"}" \
  https://admin.<your-domain>/api/users

echo "Save this API key: $KEY"
```

Store this key in the calling service's secret store. Do not commit it to the
repo or to project-local MCP/config files.

## Common gotchas

### Issue: `relation "users" does not exist` at boot

**Cause:** Migrations failed to apply at container start. The entrypoint
runs `migrate-on-boot.mjs` before the Next standalone server, but if Postgres wasn't
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
pnpm --dir apps/cms payload generate:types
pnpm --dir apps/cms payload generate:importmap
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
The entrypoint runs that bundle before the Next standalone server so migrations apply
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

## Generic Renderer Deployment Contract

The generic public renderer is a platform-owned app. It serves published CMS
snapshots by request host; do not create tenant-specific source folders,
workflows, or images for new generated sites.

Renderer image and stack template:

- Image: `ghcr.io/optidigi/siteinabox-renderer@<approved-sha256-digest>`
- Repo compose template: `apps/renderer/compose.yml`
- VPS compose target:
  `/srv/saas/infra/stacks/siteinabox/apps/renderer/compose.yml`

Required renderer environment:

```
NODE_ENV=production
HOST=0.0.0.0
PORT=4321
SIAB_CMS_URL=https://admin.siteinabox.nl
SIAB_RENDERER_IMAGE_DIGEST=sha256:<digest from the successful image workflow>
SIAB_RENDERER_API_TOKEN_FILE=/srv/saas/secrets/siteinabox-renderer-api-token
CLOUDFLARE_TUNNEL_TOKEN_FILE=/srv/saas/secrets/siteinabox-renderer-tunnel-token
DATA_DIR=/data
SITE_URL=https://<renderer-host-or-default-public-origin>
SIAB_RENDERER_FIXTURE_MODE=
```

- `SIAB_CMS_URL` must be the reachable CMS origin. The renderer calls
  `/api/renderer/snapshot?host=<public-host>`.
- `SIAB_RENDERER_IMAGE_DIGEST` is immutable release evidence. Record the
  previous and new digests before deployment; tags such as `latest` are not
  valid production inputs.
- The value stored at `SIAB_RENDERER_API_TOKEN_FILE` must match the CMS
  `SIAB_RENDERER_API_TOKEN`.
- The secret `*_FILE` values are host paths to mode-`0600` files. Compose mounts
  them as container secrets; none of their contents belongs in the environment
  or repository.
- `DATA_DIR` is the tenant data root mounted read-only. Public snapshot media is
  served through `/siab-media/<tenantId>/<filename>` only after host/snapshot
  authorization; missing files fall back to the authenticated CMS renderer
  media endpoint.
- `SIAB_RENDERER_FIXTURE_MODE=1` is local-development only and is ignored when
  `NODE_ENV=production`.
- `SITE_URL` is Astro's canonical site origin for renderer metadata/build
  configuration.
- `HOST` and `PORT` must stay aligned with the Astro standalone start command
  and Docker healthcheck: `node ./dist/server/entry.mjs` on port `4321`.

The renderer and its pinned `cloudflared` sidecar share only the private
`renderer-origin` bridge. The renderer publishes no host port and has no
Traefik labels. Cloudflare terminates public TLS and the Tunnel forwards the
original public `Host` to port `4321`; the CMS resolver treats
`site-settings.aliases` as additional explicit hosts for the same tenant
snapshot. There is no inferred `www` mapping or canonical-domain redirect.

The production renderer owns generated-site tenant domains. `ami-care.nl` is
served from the same canonical provider-block snapshot contract as every other
tenant; `amicare.optidigi.nl` may be used only as an alias/staging host for that
snapshot. The exact approval-gated Cloudflare setup, probes, rotation
constraints, and rollback sequence are in
[Renderer origin isolation](./renderer-origin-isolation.md). Keep
`COMMERCE_ORIGIN_ISOLATION_VERIFIED` unset until that runbook's evidence is
complete for the deployment environment.

## Customer Domain Provisioning Workflow

Paid customer checkout now owns the first automated domain path:

1. The customer opens the magic-link gated preview checkout.
2. The checkout collects domain holder details, checks availability through
   OpenProvider, includes normal domains up to
   `OPENPROVIDER_DOMAIN_MAX_COST_AMOUNT`, shows a one-time customer surcharge for
   normal available domains above that included cost, rejects premium domains,
   and stores the selected domain on the generation run's `domainOrder` state.
3. Mollie checkout is created only after the selected domain is ready to
   register. The first payment establishes the customer mandate. Long-lived
   Mollie Subscription creation is disabled; later billing uses
   application-created recurring payments.
4. Only after the production commerce release gate is satisfied, the paid
   order job creates a
   Cloudflare zone, creates the customer owner/admin contact
   handle in OpenProvider, registers the domain with Cloudflare nameservers and
   auto-renew enabled, creates the renderer DNS records, starts best-effort
   tenant-branded Email Sending reconciliation, and records tenant domain and
   sender verification state. Provider sandbox writes require the sandbox release
   stage and explicit non-production provider API hosts.
5. Publish and activate snapshots only after payment, approval, authoritative
   DNS, website/admin HTTPS, and edge routing are verified. Optional branded
   sender verification continues independently.

Manual domain verification remains an operator fallback for domains handled
outside this automated checkout path. Manual activation bypasses
approval/payment only; run-linked generated-site activation still requires a
verified domain and a tenant that is not suspended or archived. Branded sender
verification is never a publication override.

Before recording manual domain verification, confirm primary domains and
aliases resolve through the dedicated Tunnel and preserve the public `Host`.
Record `failed` with notes when DNS/proxy checks are not ready; do not mark a
domain verified merely to bypass activation gates.

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
the containerized Next standalone server is fine, but **a serverless deployment (Vercel,
Cloudflare Workers, Lambda) would silently drop the schedule**. If we
ever migrate, replace the autoRun with an external scheduler (k8s
CronJob, GitHub Actions cron, or system cron on the host) that POSTs
to a Payload jobs endpoint.

## GraphQL playground environment gate

The in-repository gate provides defense in depth for
`/api/graphql-playground`. Payload's built-in
`disablePlaygroundInProduction` default already
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

The gate also prevents the production playground from returning iframable HTML
without relying on CSP middleware for `/api/*` routes.

## Future improvements (out of scope for this runbook)

- **Secrets manager.** Move `CLOUDFLARE_EMAIL_API_TOKEN`,
  `CLOUDFLARE_EMAIL_SMTP_TOKEN`, `CLOUDFLARE_API_TOKEN`, and eventually
  `POSTGRES_PASSWORD`, `PAYLOAD_SECRET`
  out of `.env` into a secrets
  manager — Doppler, Vault, or a SOPS-encrypted file at minimum.
- **CORS / CSRF allowlist.** Once approved automation calls Payload
  cross-origin, add the calling service hostname to `cors` and `csrf` arrays in
  `payload.config.ts`.
