# Local development runbook

Cross-platform setup for running `apps/cms` against a local Docker-based Postgres.
Targets a developer who has just cloned the monorepo and wants `pnpm dev` in
`apps/cms` to come up cleanly.

## Prerequisites

- **Node 26** — verify with `node -v`; `.nvmrc` pins the current local target
- **pnpm 11** — install with `npm install -g pnpm@11.5.0`
- **Container runtime** — Docker or Podman
- **Git** — for `git clone`

> If Docker Compose is unavailable, use the documented Podman commands in
> Step 2 to run PostgreSQL directly.

## Step 1: Clone and install

```bash
git clone https://github.com/Optidigi/siteinabox.git
cd siteinabox
pnpm install
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
- `SIAB_PUBLIC_POST_RATE_LIMIT_POINTS=10` and `SIAB_PUBLIC_POST_RATE_LIMIT_WINDOW_SECONDS=60` — anonymous POST budget for `/api/forms`, `/api/intake`, `/api/contact`, and `/api/users/forgot-password`.
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

Either:

- Use Payload's "Create first user" form (open while no users exist), or
- Curl it:

  ```bash
  curl -X POST -H "Content-Type: application/json" \
    -d '{"email":"dev@local","password":"change-me","name":"Dev","role":"super-admin"}' \
    http://localhost:3000/api/users
  ```

Then sign in at http://localhost:3000/login.

## Step 6: Run the test suite

- **Unit tests:** `pnpm test`
- **Integration tests** (require DB up): `pnpm test tests/integration/` — they skip if the DB isn't reachable; with the local compose up they run.
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
