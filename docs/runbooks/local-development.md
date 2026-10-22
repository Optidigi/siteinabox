# Local development runbook

Cross-platform setup for running `apps/cms` against a local Docker-based Postgres.
Targets a developer who has just cloned the monorepo and wants `pnpm dev` in
`apps/cms` to come up cleanly.

## Prerequisites

- **Node 24 LTS** — verify with `node -v`; `.nvmrc` pins the current local target
- **pnpm 12** — install `pnpm@12.14.0` into an isolated tools prefix; add
  its `node_modules/.bin` only to the current project shell's `PATH`
- **Container runtime** — Docker or Podman
- **Git** — for `git clone`

> If Docker Compose is unavailable, use the documented Podman commands in
> Step 2 to run PostgreSQL directly.

Use `.nvmrc` in a project-scoped runtime manager or temporary shell `PATH`.
Keep the standard Node used by other applications unchanged. Confirm the exact
version and a nonempty `process.release.lts` before installation. pnpm 12 is a
native CLI, but CMS, renderer and build scripts still execute the pinned Node.
Keep the pnpm-generated environment and project lockfile documents together.

## Step 1: Clone and install

```bash
git clone https://github.com/Optidigi/siteinabox.git
cd siteinabox
pnpm install --frozen-lockfile
```

The root `pnpm-lock.yaml` is the only dependency lock for CMS and shared
packages. Do not create an app-local CMS workspace or lockfile; doing so can
give linked UI packages a second React instance.

Run every command below from the monorepo root. `pnpm --dir apps/cms` selects
the CMS working directory, including its local dotenv files.

## Step 2: Start local Postgres

**Standard (Docker):**
```bash
docker compose -f apps/cms/docker-compose.local.yml up -d
docker compose -f apps/cms/docker-compose.local.yml ps   # status should be "healthy"
```

**Podman without a Compose plugin:**

Use the named container `siteinabox-cms-postgres-dev` for local development. If this machine still has the pre-rename `siab-payload-postgres-dev` container, rename it once with `podman rename siab-payload-postgres-dev siteinabox-cms-postgres-dev`, then start it:
```bash
podman start siteinabox-cms-postgres-dev
podman exec siteinabox-cms-postgres-dev pg_isready -U payload -d payload  # should say "accepting connections"
```

If you ever need to recreate it from scratch (e.g. after `podman rm`):
```bash
podman run -d \
  --name siteinabox-cms-postgres-dev \
  -e POSTGRES_DB=payload \
  -e POSTGRES_USER=payload \
  -e POSTGRES_PASSWORD=change-me \
  -p 5432:5432 \
  -v siteinabox-cms-postgres-dev:/var/lib/postgresql \
  "$(node -p 'require("./docs/infrastructure-images.json").images.postgres.reference')"
```

> **Password note:** The `.env` `DATABASE_URI` must use the password the volume was initialised with (`change-me`). If they diverge you'll get `password authentication failed` — fix by updating `DATABASE_URI` in `.env` to match.

The container is `siteinabox-cms-postgres-dev`, data lives in the named volume `siteinabox-cms-postgres-dev`, and the host port defaults to `5432`.

## Step 3: Local `.env`

Copy the example and edit:

```bash
cp apps/cms/.env.example apps/cms/.env
```

Values to set:

- `PAYLOAD_SECRET` — generate with one of:
  - `openssl rand -hex 32` (Linux/macOS)
  - `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (any platform)
- `DATABASE_URI=postgres://payload:change-me@localhost:5432/payload` — matches the compose defaults; already set in `.env.example`
- `DATA_DIR=./.data-out` — gitignored local projection root. Payload writes
  per-tenant JSON and media here. Production compose bind-mounts the host
  path to `/data-out` instead. Never commit these trees or copy them into
  images:
  - `.data-out/` — local `DATA_DIR`
  - `.data-test-<pid>/` — historical scratch; current tests use the authorized root in Step 7
  - `.data/` — stray Next/tooling cache; not a SIAB `DATA_DIR`
- `NEXT_PUBLIC_SUPER_ADMIN_DOMAIN=siteinabox.nl` — the current tenant resolver
  treats `localhost` as the super-admin surface in development
- `SIAB_ALLOWED_DEV_ORIGINS=admin.siteinabox.nl` — allows Next dev resources when local browser checks map the production admin hostname to `127.0.0.1`.
- `CLOUDFLARE_EMAIL_SMTP_TOKEN=` — leave empty in dev unless testing live email. Mail sends throw before opening SMTP when unset.
- `EMAIL_FROM=noreply@siteinabox.nl`
- `SIAB_EMAIL_PREFERENCE_SECRET=` — dedicated HMAC secret required only when testing preference/unsubscribe links.
- `APPOINTMENT_CALENDAR_ENCRYPTION_KEY=` and `APPOINTMENT_MANAGEMENT_ENCRYPTION_KEY=` — separate base64-encoded 32-byte keys required when exercising calendar OAuth, booking, or visitor management links; leave appointments disabled when these are absent.
- `SIAB_GOOGLE_CALENDAR_CALLBACK_HOSTS=` and `SIAB_MICROSOFT_CALENDAR_CALLBACK_HOSTS=` — optional callback host allowlists for calendar OAuth; when empty, the existing provider OAuth host allowlists are reused, and development localhost hosts are accepted.
- `SIAB_PUBLIC_POST_RATE_LIMIT_POINTS=10` and `SIAB_PUBLIC_POST_RATE_LIMIT_WINDOW_SECONDS=60` — anonymous POST budget for `/api/forms`, `/api/builder/chat`, `/api/contact`, and `/api/users/forgot-password`.
- `SIAB_FORM_TARGET_RATE_LIMIT_POINTS=50` and `SIAB_FORM_TARGET_RATE_LIMIT_WINDOW_SECONDS=3600` — extra anonymous generated-site form budget keyed by tenant/form target.

## Step 4: Apply committed migrations

The example sets `PAYLOAD_DB_PUSH=false`; opening a page does not initialize
schema through development push. Apply the committed migrations to the local
**development** database before starting CMS:

```bash
pnpm --dir apps/cms payload migrate
pnpm --dir apps/cms dev
```

Production images run the bundled migration entrypoint before `node server.js`.
Local development uses the Payload CLI; `dist-runtime/` is built only for the
image. Never point these development commands at a disposable test resource or
an unrelated/production database. Step 7 defines the separate test lifecycle.

## Step 5: Create a local super-admin

Mail is usually off locally (`CLOUDFLARE_EMAIL_SMTP_TOKEN` empty), so do not
depend on CMS magic-link login. Seed a password user:

```bash
pnpm --dir apps/cms run seed:local-admin
```

That upserts `admin@local.test` / `LocalTest!1234` as `super-admin`. Sign in at
http://localhost:3000/login with those credentials (email + password).

The Payload admin UI is disabled in this repository; `/admin` and its first-user
form are not the setup path. The seed command creates a known local-only user,
or resets that existing user's password. Run it only against your own local
development database, with provider credentials absent.

## Step 6: Preview the AI site builder

Preview is **not a fourth app**. `apps/cms` on `http://localhost:3000` is the
admin, the preview host, and `/builder`. Development treats loopback as a
preview authority, so you do not need a separate preview hostname in `/etc/hosts`
for the builder.

Public funnel (before checkout):

1. Landing: `pnpm --dir apps/landing dev` → typically `http://localhost:4321`
2. **Start gratis** → `http://localhost:3000/login?intent=register`
3. **Inloggen** → `http://localhost:3000/login`
4. CMS/preview already running: `pnpm --dir apps/cms dev` → `http://localhost:3000`

Do not start `apps/renderer` to review the draft canvas; the builder
iframe is `renderer-frame` inside CMS. Manual paid-private fixtures and live
Save/Publish use the [canvas capability contract](../contracts/canvas.md).
The canonical built-browser journey covers those modes on this checkout's
built CMS and renderer, using isolated payment records and captured mail; it
does not perform the real M19 payment transition or activate a provider domain.

Magic-link mail is not required for local builder work. On development
loopback only, open http://localhost:3000/api/builder/dev-session (or the
**open builder zonder e-mail** link on `/builder`). That creates a Better Auth
preview session for `builder@local.test`, stores accepted legal on
`builder-sessions`, and redirects to `/builder`. The route is 404 on every
non-loopback host.

If `CLOUDFLARE_EMAIL_SMTP_TOKEN` is empty and you still request a magic link,
mail send fails; use the loopback session bypass instead of expecting SMTP.

For a live builder, set `SITE_GENERATION_PROVIDER=mastra`,
`SITE_GENERATION_MASTRA_MODEL=openai/gpt-5.6-luna`,
`SITE_GENERATION_MASTRA_REASONING_EFFORT=high`,
`SITE_GENERATION_MASTRA_MAINTAIN_REASONING_EFFORT=medium`,
`SITE_GENERATION_MASTRA_CHAT_REASONING_EFFORT=medium`, and a real `OPENAI_API_KEY`.
Keep `SITE_GENERATION_PROVIDER=mock` only when you want the chat + iframe
loop without calling OpenAI.

If port 5432 is already taken, run Postgres on another host port and point
`DATABASE_URI` at it, for example
`postgres://payload:change-me@localhost:5433/payload`.

Run `pnpm --dir apps/cms payload migrate` after pulling schema changes. If an
older development database was changed by push, do not accept data loss to clear
a warning. Use the committed migrations and owning migration rehearsal to
diagnose missing schema; do not create application tables through ad hoc SQL.

The marketing site's local `astro dev` CTAs point at `http://localhost:3000/login`.
Production landing uses `https://admin.siteinabox.nl/login`.

The CMS framework security upgrade adds
`20261020_181335_cms_framework_security`: a nullable password-reset throttle
column. Use the committed migration index; do not patch a running database by
hand. See [framework upgrade and rollback guidance](../dependency-policy.md#cms-framework-security-group).
Generators own Payload types, the admin import map and migration snapshots.
When generating the index, include dated migration files, excluding the
`sitegenLegacyData.ts` helper. Historical snapshots predate some later committed
migrations; diff an upgrade against a snapshot generated by the baseline adapter
rather than accepting unrelated rename/drop suggestions.

Infrastructure version checks run with `pnpm infrastructure:check`. Offline
connector checks run with `pnpm infrastructure:tunnel` using the pinned image
and Docker network `none`. Without Docker, a checksum-verified publisher binary
can be supplied explicitly: `pnpm infrastructure:tunnel --binary /verified/cloudflared`.
No login, tunnel connection or provider credential is required. The full populated
PostgreSQL container replacement remains part of `pnpm image:verify cms` and needs
Docker plus committed clean source; it does not adopt an existing dev volume.

## Step 7: Authorize disposable verification, then run tests

CMS tests can reset schema and collection data. Use an expressly disposable,
fresh PostgreSQL 18 database (`payload_test`, or `siab_migration_test` for a
separate rehearsal) on a dedicated local/CI service. The authorization command
creates it from `template0` under your approved resource lifecycle; the service
account needs database-creation permission and access to the `postgres` maintenance database. A localhost address or test-like name
alone does not authorize destroying existing data.

In a dedicated test checkout, supply the exact connection and synthetic secret,
disable jobs and use mock AI. Resolve local `.env`, `.env.local`, `.env.test` and
`.env.test.local` in that order, then shell values take precedence. The guard
validates this complete effective environment before application initialization.
Parsing uses the same dotenv parser as the owning CLI commands. Alternate
`DOTENV_*` paths/override flags, dotenv CLI controls and env-file preloads are
rejected; application initialization must run from `apps/cms`, so later default
dotenv imports use the already-resolved files without overriding validated keys.
Production/development-mode test children resolve the corresponding mode files
before validation; env files cannot change their selected runtime mode.
Any real provider configuration or unsafe database/storage override is an error;
credentials are rejected rather than silently removed. Inject synthetic provider
values through the existing test doubles instead of inheriting account credentials.

```bash
export DATABASE_URI=postgres://payload:test-only-password@127.0.0.1:5432/payload_test
export PAYLOAD_SECRET=siab-test-local-synthetic-secret
export PAYLOAD_DISABLE_JOBS_AUTORUN=1
export SITE_GENERATION_PROVIDER=mock
pnpm cms:test:authorize --create-database /absolute/private/siab-test-cms
export SIAB_TEST_RESOURCE_FILE=/absolute/private/siab-test-cms/resource.json
pnpm --dir apps/cms test
```

The explicit authorization command refuses every existing database without its
matching private resource record, even an empty database, and refuses nonempty
unowned storage. It checks the newly created database for schema dependencies
and other user objects before recording a database ownership marker and a private resource file
binding the exact connection to its storage root. Keep this file outside tracked
source: it contains the connection credential. Repeated runs require that same
file/marker pair. A changed tunnel, missing server, wrong marker, symlink,
unowned directory or inherited provider credential fails before Payload can
initialize, migrate or reset data. Never fabricate a marker on an existing
customer/developer database to make a test pass.

Tests require real BIND `named-checkzone` and the package-owned Playwright
Chromium. Install `bind9-utils` and run
`pnpm --dir apps/cms exec playwright install --with-deps chromium` before the
suite. Missing prerequisites fail explicitly. `SIAB_TEST_BIND_VALIDATOR_PATH`
can name an isolated real BIND binary for focused local verification; the full
provider-acquisition suite still exercises its deployed `/usr/bin/named-checkzone`
default or an explicitly injected validator path. No fake validator substitutes
for authoritative DNS evidence.

Each test worker receives a private directory below the authorized storage root;
child processes inherit the validated target. Direct integration helpers validate
again and apply the validated environment before importing Payload, resetting or
seeding. Test children that execute a CMS operational script use
`tests/_helpers/runGuardedCli.mjs` to check their final environment first. The
existing missing-schema CLI failure fixture may set only its fixed search-path
option; host/identity overrides and other URI options remain forbidden. Committed migrations define
the schema; teardown closes over the worker's original path and marker and cannot
use a later `DATA_DIR` value to remove another directory. Only the current run's
storage is removed. Preserve the resource file/root for the next approved run.

- **Pure safety fixtures:** `pnpm cms:test:guard` (no PostgreSQL/provider connection).
- **CMS unit/integration tests:** `pnpm --dir apps/cms test` (authorized environment required).
- **Focused integration:** `pnpm --dir apps/cms test tests/integration/`.
- **Typecheck:** `pnpm --dir apps/cms typecheck` (runs owning Next type generation).
- **Historical scratch cleanup:** `pnpm cms:cleanup-test-data` inventories older
  `.data-test-<pid>` trees; its separate `--apply` operation still requires review.
  It does not own the new resource root or any database.

## Verify the applications

Account-link tests use the same marked resource and synthetic mail boundary.
The focused suite is `pnpm --dir apps/cms test tests/integration/account-link-dispatch.test.ts`;
it includes independent guarded child processes, committed migrations and real
SDK consumption. It does not send provider mail. The canonical built-browser
journey also checks burst coalescing, callback substitution and replay through
its captured transport. Keep local jobs disabled; tests invoke the recovery
worker explicitly. Production requires the existing default queue worker to
run for queued password-reset delivery, normally within its one-minute schedule.

The additive account-link migration owns its tables, counters, activation policy
and task enum values. Its generated DOWN refuses existing protocol records;
do not delete them to force rollback. Prefer a forward fix. Reverting dispatch
guards would discard durable admission/uncertain-send protection, so pause the
affected issuance/worker paths during a separately reviewed code rollback and
preserve the database, cutover policy and outstanding SDK/Payload token expiry.
This is application recovery guidance, not a server-recovery protocol.

The steps above cover the database-backed CMS setup. Use the matrix below from
the repository root when verifying a change across the monorepo. These checks
use local fixtures and services only; provider operations, paid checkout,
production smoke, and image publication are separate release activities.

The [verification matrix](../verification-matrix.md) owns command coverage,
arguments, settings and pass/fail rules. Use `pnpm check:fast` for repository
contracts and `pnpm check:ci` for the full sequence after installing its
prerequisites. The latter uses CI browser settings and this checkout's fresh
landing build/server. Stop any existing listener on its configured test port
before running; the CI profile deliberately refuses to reuse it.

The matrix does not install PostgreSQL, BIND, Chromium/system libraries or Docker.
An isolated BIND binary can satisfy focused tests with explicit injection, while
the provider-acquisition suite still invokes the deployed absolute validator
path. If that path or Docker is unavailable, report the affected local checks
as blocked/partial and identify actual hosted source/run evidence separately.
Never report a focused or hosted pass as a full local profile pass.

## Common operations

- **Reset the local DB (lose all data):**
  ```bash
  docker compose -f apps/cms/docker-compose.local.yml down -v
  docker compose -f apps/cms/docker-compose.local.yml up -d
  ```
- **Reset the local DB with direct Podman (lose all data):**
  ```bash
  podman stop siteinabox-cms-postgres-dev
  podman rm siteinabox-cms-postgres-dev
  podman volume rm siteinabox-cms-postgres-dev
  # Recreate with the podman run command in Step 2.
  ```
- **Tail logs:** `pnpm --dir apps/cms dev` already streams to stdout. For DB logs: `docker logs -f siteinabox-cms-postgres-dev` or `podman logs -f siteinabox-cms-postgres-dev`.
- **Regenerate Payload types after collection edits:** `pnpm --dir apps/cms payload generate:types`
- **Generate a new migration after collection edits:** `pnpm --dir apps/cms payload migrate:create my-change-name`
- **Stop everything:** `Ctrl+C` the dev server, then `docker compose -f apps/cms/docker-compose.local.yml stop` or `podman stop siteinabox-cms-postgres-dev`.

## Platform notes

- **Windows:** Docker Desktop with the WSL2 backend is the recommended setup. PowerShell and Git Bash both work for the commands above.
- **macOS (Apple Silicon):** The reviewed PostgreSQL index includes an arm64 manifest. This change's runtime proof is Linux AMD64; use the same pinned reference from the inventory.
- **Linux:** Docker Engine without Desktop is fine. You may need `sudo` for `docker` if your user isn't in the `docker` group.

## Troubleshooting

- **Port 5432 already in use** — another Postgres is running on the host. Either stop it (`brew services stop postgresql` / `sudo systemctl stop postgresql` / Services on Windows), or override the host port: `POSTGRES_HOST_PORT=5433 docker compose -f apps/cms/docker-compose.local.yml up -d` and update `DATABASE_URI` in `.env`.
- **CMS dev errors with "PAYLOAD_SECRET is required"** — copy `apps/cms/.env.example` to `apps/cms/.env` and fill in `PAYLOAD_SECRET`.
- **`relation "users" does not exist`** — run `pnpm --dir apps/cms payload migrate` against the intended local development database; page loads do not replace migrations.
- **`/api/health` returns `dataDir: unwritable`** — the `.data-out/` directory needs to be writable by the dev process. On Linux/macOS: `chmod -R 755 apps/cms/.data-out`. On Windows: ensure no antivirus / Defender lock on the folder.


### Real built application browser journey

After Step 7 authorizes the disposable resource and the pinned toolchain is
active, run `pnpm --dir apps/cms test:built-browser` from the repository root.
It requires the existing PostgreSQL 18/BIND/Playwright prerequisites, Python 3
for trace redaction and OpenSSL for a temporary local TLS certificate. Missing
prerequisites fail; the command does not install services or skip assertions.
Run it serially against the dedicated test resource: it resets that database
with committed migrations and initializes fresh synthetic fixtures.

The command builds this checkout's CMS through the existing invitation-action
negative check, then builds the actual renderer. CI/full verification runs the
invitation check first and uses the matrix's exact `--reuse-built` argument.
Reuse requires a clean checkout and a matching source/configuration/toolchain,
public/CI build settings, build ID and immutable artifact-byte receipt. It
cannot attach to an existing server or silently accept an old build. Both
applications restart from those same verified artifacts during the journey.

Synthetic tenants, all existing roles, an unpublished private page and synthetic
legacy routing-adoption fields represent existing supported behavior. These
fixture fields are not actual entitlement, DNS or Amicare-adoption proof.
The browser uses genuine password login, cookies, the real editor Save route,
read-only PostgreSQL assertions, password rotation and the real renderer.
Anonymous, other-tenant and revoked-session access must deny. For streamed
[Next not-found responses](https://nextjs.org/docs/app/api-reference/file-conventions/not-found),
HTTP 200 alone is insufficient: the check requires the real not-found boundary,
no foreign editor/content, a forbidden save and an unchanged foreign row.
The same published-marker assertion must also reject a deliberately saved but
unpublished change through the real API, proving the persistence/publication
boundary detects a broken result.

The verified-customer extension uses real registration, captured magic-link
verification and separate browser sessions in NL/EN at phone/desktop viewports.
It exercises the existing mock generation path and checks one stored account,
workspace and original verification anchor, including restart, unverified state,
substituted requests and account revocation. Identity, renewal and historical
mapping rules remain in the
[authentication contract](../contracts/authentication.md#verified-customer-workspace-authority).

Production-mode origin/bearer checks stay active. A loopback TLS/edge gateway
and an owned CONNECT proxy forward actual application responses, including
redirects, with the production browser origin intact. Chromium trusts only the
run's generated certificate key. Proxy authorities are an exact allowlist and
every tunnel ends at the loopback edge; the runner changes no machine proxy or
certificate settings. Backend fetch/HTTP transports use explicit deny doubles outside
loopback. Jobs stay disabled, AI stays mock and inherited provider credentials
remain forbidden. The runner supplies synthetic inline renderer secrets and a
complete mail-test pair: zero account ID plus a `siab-test-` token of at least
32 characters. The closed mail double accepts only the synthetic customer's
verification messages and the fixed synthetic intake's internal notification.
It stores verification links privately and returns a captured
receipt without making a Cloudflare request. Other accounts/tokens and all
secret-file references remain forbidden. Capture counts must match recorded
mail logs. No live email, AI, calendar, payment, domain or production proof is
inferred from this journey.

Redacted traces, credential-free screenshots, sanitized server logs and a
source/artifact/assertion summary go to `apps/cms/test-results/built-browser-*/`.
Raw traces, verification links, synthetic passwords, TLS private keys and projection files stay in
the private owned worker directory and are removed after owned servers stop.
Cleanup targets only recorded child processes, owned tunnels and that marked worker; it does
not remove the resource authorization or unrelated directories. A failed
assertion, missing startup or cleanup/evidence failure exits nonzero.

Feature PRs extend this journey with meaningful user-visible and served-state
assertions at existing routes. Keep component/browser and visual contracts as
separate evidence; `test:checkout-browser` remains its narrower Vite fixture
harness, not authenticated database-backed application proof. This journey is
not live provider verification, production recovery or deployment clearance.
