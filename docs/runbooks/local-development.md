# Local development runbook

Cross-platform setup for running `apps/cms` against a local Docker-based Postgres.
Targets a developer who has just cloned the monorepo and wants `pnpm dev` in
`apps/cms` to come up cleanly.

## Prerequisites

- **Node 26** — verify with `node -v`; `.nvmrc` pins the current local target
- **pnpm 11** — install with `npm install -g pnpm@11.21.0`
- **Container runtime** — Docker or Podman
- **Git** — for `git clone`

> If Docker Compose is unavailable, use the documented Podman commands in
> Step 2 to run PostgreSQL directly.

## Step 1: Clone and install

```bash
git clone https://github.com/Optidigi/siteinabox.git
cd siteinabox
pnpm install --frozen-lockfile
```

The root `pnpm-lock.yaml` is the only dependency lock for CMS and shared
packages. Do not create an app-local CMS workspace or lockfile; doing so can
give linked UI packages a second React instance.

CMS app work happens under `apps/cms`. From the monorepo root:

```bash
cd apps/cms
```

Or run CMS commands with `pnpm --dir apps/cms <script>`.

## Step 2: Start local Postgres

**Standard (Docker):**
```bash
docker compose -f docker-compose.local.yml up -d
docker compose -f docker-compose.local.yml ps   # status should be "healthy"
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
  postgres:18-alpine
```

> **Password note:** The `.env` `DATABASE_URI` must use the password the volume was initialised with (`change-me`). If they diverge you'll get `password authentication failed` — fix by updating `DATABASE_URI` in `.env` to match.

The container is `siteinabox-cms-postgres-dev`, data lives in the named volume `siteinabox-cms-postgres-dev`, and the host port defaults to `5432`.

## Step 3: Local `.env`

Copy the example and edit:

```bash
cp .env.example .env
```

Values to set:

- `PAYLOAD_SECRET` — generate with one of:
  - `openssl rand -hex 32` (Linux/macOS)
  - `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (any platform)
- `DATABASE_URI=postgres://payload:change-me@localhost:5432/payload` — matches the compose defaults; already set in `.env.example`
- `DATA_DIR=./.data-out` — gitignored; Payload writes per-tenant JSON snapshots here
- `NEXT_PUBLIC_SUPER_ADMIN_DOMAIN=siteinabox.nl` — the current tenant resolver
  treats `localhost` as the super-admin surface in development
- `SIAB_ALLOWED_DEV_ORIGINS=admin.siteinabox.nl` — allows Next dev resources when local browser checks map the production admin hostname to `127.0.0.1`.
- `CLOUDFLARE_EMAIL_SMTP_TOKEN=` — leave empty in dev unless testing live email. Mail sends throw before opening SMTP when unset.
- `EMAIL_FROM=noreply@siteinabox.nl`
- `SIAB_EMAIL_PREFERENCE_SECRET=` — dedicated HMAC secret required only when testing preference/unsubscribe links.
- `APPOINTMENT_CALENDAR_ENCRYPTION_KEY=` and `APPOINTMENT_MANAGEMENT_ENCRYPTION_KEY=` — separate base64-encoded 32-byte keys required when exercising calendar OAuth, booking, or visitor management links; leave appointments disabled when these are absent.
- `SIAB_GOOGLE_CALENDAR_CALLBACK_HOSTS=` and `SIAB_MICROSOFT_CALENDAR_CALLBACK_HOSTS=` — optional callback host allowlists for calendar OAuth; when empty, the existing provider OAuth host allowlists are reused, and development localhost hosts are accepted.
- `SIAB_PUBLIC_POST_RATE_LIMIT_POINTS=10` and `SIAB_PUBLIC_POST_RATE_LIMIT_WINDOW_SECONDS=60` — anonymous POST budget for `/api/forms`, `/api/intake`, `/api/builder/chat`, `/api/contact`, and `/api/users/forgot-password`.
- `SIAB_FORM_TARGET_RATE_LIMIT_POINTS=50` and `SIAB_FORM_TARGET_RATE_LIMIT_WINDOW_SECONDS=3600` — extra anonymous generated-site form budget keyed by tenant/form target.

## Step 4: First-boot schema push

The Payload Postgres adapter pushes schema in `NODE_ENV=development` automatically on the first DB query. So the simplest path is:

```bash
pnpm dev
# Open http://localhost:3000/admin → Payload's "Create first user" form appears.
# (the page-load triggers a getPayload() init which pushes the schema)
```

If you'd rather match prod and run explicit migrations:

```bash
pnpm payload migrate
```

The repo ships migrations under `src/migrations/`. In production, the
Docker image's entrypoint runs an esbuild-bundled `migrate-on-boot.bundled.mjs`
automatically before `node server.js` — there's no manual migrate step
on deploy. For local development you keep using the CLI as above; the boot
bundle (and the `dist-runtime/` directory it lives in) is only built and
copied inside the Docker image, not in `pnpm dev`.

## Step 5: Create a local super-admin

Mail is usually off locally (`CLOUDFLARE_EMAIL_SMTP_TOKEN` empty), so do not
depend on CMS magic-link login. Seed a password user:

```bash
pnpm --dir apps/cms run seed:local-admin
```

That upserts `admin@local.test` / `LocalTest!1234` as `super-admin`. Sign in at
http://localhost:3000/login with those credentials (email + password).

You can still use Payload's first-user form if the database has no users yet.

## Step 6: Preview the AI site builder

Preview is **not a fourth app**. `apps/cms` on `http://localhost:3000` is the
admin, the preview host, and `/builder`. Development treats loopback as a
preview authority, so you do not need `preview.siteinabox.nl` in `/etc/hosts`
for the builder.

Public funnel (before checkout):

1. Landing: `pnpm --dir apps/landing dev` → typically `http://localhost:4321`
2. **Start gratis** / **Bouwen** → `http://localhost:3000/builder?intent=register`
3. **Inloggen** → `http://localhost:3000/builder?intent=login`
4. CMS/preview already running: `pnpm --dir apps/cms dev` → `http://localhost:3000`

Do not start `apps/intake` for this funnel. `/intake` only redirects to the
builder. Do not start `apps/renderer` to review the draft canvas; the builder
iframe is `renderer-frame` inside CMS.

Magic-link mail is not required for local builder work. On development
loopback only, open http://localhost:3000/api/builder/dev-session (or the
**open builder zonder e-mail** link on `/builder`). That creates a Better Auth
preview session for `builder@local.test`, stores accepted legal on
`builder-sessions`, and redirects to `/builder`. The route is 404 on every
non-loopback host, including `preview.siteinabox.nl`.

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

Run `pnpm --dir apps/cms payload migrate` after pulling builder-session schema
changes. If the CLI warns that development push already changed the database,
do not accept data loss on a DB you care about. Confirm `builder_sessions`
exists (dev push usually created it) and that the four `preview_auth_*` tables
from `20260626_120000_add_preview_access_grants` exist; create those four if
they are missing. New disposable databases can use `payload migrate` from a
clean volume.

The marketing site's local `astro dev` CTAs point at `http://localhost:3000/builder`.
Production landing and `/intake` keep `https://preview.siteinabox.nl/builder`.

## Step 7: Run the test suite

- **Unit tests:** `pnpm test`
- **Integration tests** (require DB up): `pnpm test tests/integration/` — they skip if the DB isn't reachable; with the local compose up they run.
- **Typecheck:** `pnpm typecheck` — runs `next typegen` first. Next owns the
  generated, gitignored `next-env.d.ts`; do not edit or commit it.
- **Remove abandoned test data:** from the repository root, run
  `pnpm cms:cleanup-test-data` to list matching `apps/cms/.data-test-<pid>`
  directories. Review the list, then rerun with `--apply` to remove them.

## Verify all four applications

The steps above cover the database-backed CMS setup. Use the matrix below from
the repository root when verifying a change across the monorepo. These checks
use local fixtures and services only; provider operations, paid checkout,
production smoke, and image publication are separate release activities.

| Surface | Owner | Minimum gate | Extra prerequisite |
| --- | --- | --- | --- |
| Shared contracts and repository policy | `packages/*` and root | `pnpm check:fast` | None |
| Marketing site | `apps/landing` | `pnpm landing:build` and `pnpm landing:test` | Browser checks need Chromium; install it through `pnpm --dir apps/landing exec playwright install --with-deps chromium` |
| Intake (legacy `/intake` redirect) | `apps/intake` | Optional: `pnpm intake:build` and `pnpm intake:test` | Not part of the public create funnel; keep until Traefik `/intake` and the intake image are retired |
| CMS | `apps/cms` | Generate Payload types/import map, then `pnpm --dir apps/cms typecheck` and `pnpm --dir apps/cms test` | Local PostgreSQL, `DATABASE_URI`, and `PAYLOAD_SECRET` |
| Published-site renderer | `apps/renderer` | `pnpm renderer:deploy-contract`, `pnpm renderer:typecheck`, `pnpm renderer:test`, and `pnpm renderer:build` | Browser checks need Chromium; renderer provider checks use local fixtures |

For the complete CI command sequence, run `pnpm check:ci` after installing the
documented prerequisites. The profile does not install PostgreSQL, operating
system packages, or browser binaries for you. Use `pnpm check:toolchain` to
verify the repository's Node, pnpm, workflow, Docker, and verification-matrix
authorities.

## Common operations

- **Reset the local DB (lose all data):**
  ```bash
  docker compose -f docker-compose.local.yml down -v
  docker compose -f docker-compose.local.yml up -d
  ```
- **Reset the local DB with direct Podman (lose all data):**
  ```bash
  podman stop siteinabox-cms-postgres-dev
  podman rm siteinabox-cms-postgres-dev
  podman volume rm siteinabox-cms-postgres-dev
  # Recreate with the podman run command in Step 2.
  ```
- **Tail logs:** `pnpm dev` already streams to stdout. For DB logs: `docker logs -f siteinabox-cms-postgres-dev` or `podman logs -f siteinabox-cms-postgres-dev`.
- **Regenerate Payload types after collection edits:** `pnpm payload generate:types`
- **Generate a new migration after collection edits:** `pnpm payload migrate:create my-change-name`
- **Stop everything:** `Ctrl+C` the dev server, then `docker compose -f docker-compose.local.yml stop` or `podman stop siteinabox-cms-postgres-dev`.

## Platform notes

- **Windows:** Docker Desktop with the WSL2 backend is the recommended setup. PowerShell and Git Bash both work for the commands above.
- **macOS (Apple Silicon):** `postgres:18-alpine` ships an arm64 image — pulls native, no emulation.
- **Linux:** Docker Engine without Desktop is fine. You may need `sudo` for `docker` if your user isn't in the `docker` group.

## Troubleshooting

- **Port 5432 already in use** — another Postgres is running on the host. Either stop it (`brew services stop postgresql` / `sudo systemctl stop postgresql` / Services on Windows), or override the host port: `POSTGRES_HOST_PORT=5433 docker compose -f docker-compose.local.yml up -d` and update `DATABASE_URI` in `.env`.
- **`pnpm dev` errors with "PAYLOAD_SECRET is required"** — copy `.env.example` to `.env` and fill in `PAYLOAD_SECRET`.
- **`relation "users" does not exist`** — the schema didn't push. Hit `/admin` once in the browser to trigger the `getPayload()` init, or run `pnpm payload migrate` explicitly.
- **`/api/health` returns `dataDir: unwritable`** — the `.data-out/` directory needs to be writable by the dev process. On Linux/macOS: `chmod -R 755 .data-out`. On Windows: ensure no antivirus / Defender lock on the folder.
