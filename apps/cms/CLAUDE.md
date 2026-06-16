# CLAUDE.md

Guidance for Claude Code when working in this repository. Rules first, architecture second, deep internals in `docs/runbooks/`.

## Commands

```bash
# Development
pnpm dev                                          # start dev server (http://localhost:3000)
docker compose -f docker-compose.local.yml up -d  # start local Postgres (required first)

# Type generation — run after any collection field change
pnpm payload generate:types
pnpm payload generate:importmap

# Type check
pnpm typecheck

# Migrations
pnpm payload migrate:create <name>                # create migration after collection edits
pnpm payload migrate                              # apply pending migrations

# Tests
pnpm test                                         # full vitest suite (unit + integration; DB must be up)
pnpm test tests/unit/                             # unit tests only (no DB required)
pnpm test tests/unit/foo.test.ts                  # single test file
pnpm test tests/integration/                      # integration tests (real DB — compose must be up)
pnpm test:e2e                                     # Playwright E2E (dev server must be running)

# Lint gates — frontend boundary and zero-authored-CSS rules (CI-blocking)
pnpm lint:ui-boundary
pnpm lint:ui-composition
pnpm lint:no-css
```

CI runs typecheck, lint:ui-boundary, lint:ui-composition, lint:no-css, responsive canvas checks, **and the full vitest suite** (unit + integration with a Postgres service container). `pnpm lint` is non-functional today (OBS-28 in infra backlog).

## UI authoring

The private `@siab/*` shadcn registry is no longer the source of truth for this app. The installed components are now local source in this repository.

**Workflow for any UI work:**

1. Use `@/components/ui/` for local shadcn-style primitives and UI building blocks.
2. Put app-specific workflows and composites outside `src/components/ui/`, usually under `src/components/`, `src/components/forms/`, or `src/components/editor/`.
3. Prefer upstream shadcn patterns for primitives, then tailor locally with SIAB tokens.
4. Keep color, radius, and font usage token-driven; do not hard-code visual values into components.

**CI enforces this:**
- `pnpm lint:ui-boundary` — `components.json` must target `src/styles/shadcn.css`, `globals.css` must remain the stable import shell, and no new custom files may be added under `src/components/ui/`
- `pnpm lint:ui-composition` — direct Radix imports stay inside `src/components/ui`, inline style objects are blocked, and new native-button files are rejected unless reviewed
- `pnpm lint:no-css` — three rules: no `.css` in `src/` outside approved style files; no hex/rgb literals in components; no arbitrary color Tailwind values

**Style ownership:** `src/styles/shadcn.css` is the shadcn/Tailwind entrypoint and the only CSS file shadcn tooling may overwrite. `src/styles/globals.css` only imports `shadcn.css` then `siab.css`. `src/styles/siab.css` is protected SIAB app/editor/canvas CSS and should later move with the shared frontend package if the monorepo introduces `packages/ui` or `packages/cms-ui`.

**Primitive overwrites:** see `docs/runbooks/ui-overwrite-boundary.md`. Use `pnpm dlx shadcn@latest add @shadcn/<item> --diff` and review one primitive at a time. Do not bulk-overwrite local primitive forks.

**Local hooks enforce this:** `.claude/settings.json` runs `pnpm typecheck` before Stop.

**Token system:** colors / radii / fonts are CSS custom properties (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--destructive`, role tokens `--font-{title,heading,text}`, `--radius-{sm,md,lg}`, etc.). Dark mode via the `.dark` class. Reference tokens through Tailwind utility classes (`bg-background`, `text-muted-foreground`); never hard-code colors or override primitive internals via inline `style` props.

**Per-tenant theming:** the canvas's tenant tokens come from a separate channel — `ThemeBar` writes role tokens to `Tenant.theme`, the tenant's compiled `cms-editor.css` is loaded via `loadTenantCss`, and they scope to `.rt-canvas` only. **The CMS never owns visible token values — it consumes them through `var()` chains.** Site-side tokens belong to the site repo + the tenant's saved theme; never invent CMS-side utility classes that wrap those tokens.

**Registry transition:** Phase D previously made the private registry the source of truth. As of 2026-06-15, that decision is superseded: SIAB UI source is local to this repo until the planned monorepo can move shared pieces into packages such as `packages/ui` or `packages/cms-ui`.

## Backlogs

`docs/backlog/` is the canonical source of truth for all open, deferred, and closed work items. **Read the relevant backlog file before starting any work** — the "Suggested fix shape" and "Why deferred" fields exist to prevent re-discovering context.

- **`docs/backlog/security/README.md`** — security findings, access control gaps, auth hardening
- **`docs/backlog/features/README.md`** — product features, UI improvements (layered by `frontend` / `full-stack` / `multi-repo`)
- **`docs/backlog/infra/README.md`** — CI, deployment, operational, and scaling concerns

IDs: `FE-N` for frontend-only items (current high water mark: FE-54); `OBS-N` for full-stack/multi-repo/security/infra items (shared sequence; current high water mark: OBS-69). Each file's preamble carries the next-id counter.

**Rules:**
- When you discover a bug, gap, or deferred item during work, append it to the appropriate backlog before closing the session — even a one-liner latent observation.
- When something is fixed, move it to `## Closed` with the resolving commit/PR. Never delete entries.
- Never describe something as "done" or "fixed" without updating the backlog to reflect it.
- **Incidental fixes / obsolesces.** While doing unrelated work, if your change happens to close, fix, or obsolete an existing backlog entry, update the backlog in the **same** commit/session — not later. Two branches:
  - **Confident** (the code path the entry referenced no longer exists, the symptom can no longer reproduce, or the entry's premise is invalidated): move the entry to `## Closed` with the resolving commit ref + a one-line note explaining the side-effect.
  - **Unsure** (entry description is vague, you can't verify the repro, or the entry's scope is wider than what your change touches): flag it to the operator before editing the backlog. One quick check-in beats a wrongly-closed entry.
- Same applies in reverse: if your change *introduces* a new gap or makes a related entry's "Suggested fix shape" obsolete, update the entry's body in the same session.

## Architecture

### Stack
Next.js 15 App Router + PayloadCMS v3 (3.84.x) + PostgreSQL. React 19, TypeScript, Tailwind v4, local shadcn-style UI source. pnpm 10, Node 24 (Dockerfile + CI; `package.json` engines accept >=22 for backwards compat).

### Multi-tenant routing
Tenancy is resolved from the HTTP `Host` header in `src/middleware.ts`. The middleware stamps two headers onto every matched request:
- `x-siab-mode`: `"super-admin"` | `"tenant"`
- `x-siab-host`: the bare domain (strip `admin.` prefix)

These are consumed by `getSiabContext()` (`src/lib/context.ts`), which resolves the `SiabContext` type:

```ts
type SiabContext =
  | { mode: "super-admin"; tenant: null }
  | { mode: "tenant"; tenant: Tenant }
```

In dev, `admin.localhost` is treated as the super-admin host. For tenant testing add `admin.t1.test` to `/etc/hosts`.

### Role model
Four roles with hard invariants enforced in `src/collections/Users.ts` and `src/lib/gateDecision.ts`:

| Role | Tenants |
|------|---------|
| `super-admin` | zero (validated) |
| `owner` | exactly one |
| `editor` | exactly one |
| `viewer` | exactly one |

A user may never have more or fewer tenants than their role requires. Enforced by `validateTenants` (field-level) and `evaluateGate` (request-level).

### Auth patterns

**RSC pages** — always call `requireAuth()` or `requireRole()` from `@/lib/authGate`:
```ts
const { user, ctx } = await requireAuth()
const { user, ctx } = await requireRole(["super-admin", "owner"])
```

**Server actions** (`"use server"` files) — Next.js provides no built-in auth for server actions. Every action must resolve the caller explicitly:
```ts
const { user: caller } = await payload.auth({ headers: await headers() })
if (!caller) throw new Error("Forbidden: authentication required")
```
See `src/lib/actions/inviteUser.ts` for the reference implementation.

**Payload Local API** — use `user: caller` (not `overrideAccess: true`) for user-triggered operations so collection and field-level access rules apply. Reserve `overrideAccess: true` for system-internal operations (jobs, lifecycle hooks).

### Collections
Defined in `src/collections/`. All tenant-scoped data collections (`pages`, `media`, `site-settings`, `forms`, `block-presets`) are registered with `@payloadcms/plugin-multi-tenant`. `Tenants` and `Users` are super-admin-managed.

After any field or collection change: run `pnpm payload generate:types` and create a migration with `pnpm payload migrate:create <name>`.

### Access control
`src/access/` contains shared access functions used across collections:
- `isSuperAdmin` / `isSuperAdminField` — collection/field-level super-admin gates
- `canManageUsers` — combined owner/super-admin read+update gate for Users
- `isOwnerInTenant`, `isTenantMember` — tenant-scoped gates
- `authSignals` — detects auth headers without validating them (used for the forgot-password rate-limit bypass guard)

**Security hook order**: `beforeOperation` fires before any field-level access strip, making it the correct place for auth-level guards that need to see the original request data. `beforeValidate` (collection-level) runs after field strips. `beforeChange` runs after that.

### Data queries
`src/lib/queries/` contains typed query functions for each collection. Server components should use these rather than calling `payload.find()` directly. `src/lib/api.ts` contains `parsePayloadError()` for extracting structured errors from Payload REST responses in client-side forms.

### Projection and disk output
`src/lib/projection/` serialises Pages and SiteSettings documents to JSON files on disk (`DATA_DIR` env). Tenant lifecycle hooks in `src/hooks/tenantLifecycle.ts` manage per-tenant directories on create/archive/restore/delete.

### Canvas / editor internals
The page editor (`PageForm`) has two views (canvas / sidebar), a per-tenant theming pipeline, and a dedicated mobile path. The internals — selection model, app-shell layout, theme bar, sidebar drill-down, block renderers, inline-edit primitives, mobile bottom sheet — are documented in `docs/runbooks/canvas-architecture.md`. Read that before touching `src/components/editor/canvas/` or any of the canvas registry items (`canvas-mode`, `canvas-mobile`, `sidebar-inspector`, `mobile-inspector`, `theme-bar`, etc.).

### Testing
- **Unit tests** (`tests/unit/`): Vitest, `environment: "node"`, no DB. `server-only` is stubbed via the alias in `vitest.config.ts`. Fast; suitable for access functions, pure logic, hook logic. **Hook functions live in `src/hooks/*.ts` and are imported by reference in tests** — never accessed positionally via `Collection.hooks.beforeValidate[N]`. Index-into-array drifts silently when new hooks are prepended (see OBS-29 closure for the canonical incident).
- **Integration tests** (`tests/integration/`): real Postgres, DB name `payload_test`. Sequential (single fork — see `vitest.config.ts`). Do not mock the database in integration tests; prior incidents showed mock/prod divergence masks real failures. `tests/integration/_helpers.ts:getTestPayload()` calls `payload.db.migrateFresh({ forceAcceptWarning: true })` once per process so the schema comes from committed migrations (not Payload's push-mode auto-sync) — production-behaviour parity. `seedFixture()` provides a baseline t1/t2 + super-admin/owner/editor/viewer fixture for tests opting in.
- **E2E tests** (`tests/e2e/`): Playwright, requires a running dev server.

Test setup reads `.env` and overrides `DATABASE_URI` to `payload_test` automatically (`tests/setup.ts`). Migration files use `import type` for `MigrateUpArgs`/`MigrateDownArgs` so vitest's vite-node dynamic-import resolves them (`@payloadcms/db-postgres` exports those as type-only).

## Key invariants

- `src/components/ui/` is local shadcn-style source in this repo. Keep primitives token-driven and prefer app-specific workflows outside that tree.
- **Always** regenerate types (`pnpm payload generate:types`) and create a migration after collection field changes.
- Super-admins have zero tenants; every other role has exactly one. Violating this breaks `evaluateGate` and the multi-tenant plugin's filter.
- Server actions must authenticate the caller from cookies/headers explicitly — there is no middleware-injected user on the server-action path.
- `beforeOperation` hooks (not `beforeChange` or `beforeValidate`) are the only reliable place to gate on the caller's original request data before field-level access strips it.
- The `BOOTSTRAP_TOKEN` env var enables the one-time super-admin seed endpoint. Unset it after first boot in production.
- Sessions are cleared on every password rotation via the `clearSessionsOnPasswordChange` `beforeValidate` hook. Do not disable `useSessions` on the Users collection.
- **Rich text storage is structured, not stringly typed.** All rich text content lives in `jsonb` columns as `RtRoot` values (validated against the tenant's `siteManifest`). No raw HTML reaches the database, and the projection emits `RtRoot` verbatim. The shared DOM emission contract lives at `docs/runbooks/rt-dom-contract.md` — both the CMS editor and the Astro renderer emit the same class names per node type.
- **Per-tenant block menu is gated by `tenants.siteManifest.blocks[]`.** When present, `BlockPresetsContext` filters the "Add block" menu to the declared slugs and the `enforceTenantBlockMenu` hook (Pages.beforeValidate) rejects saves that introduce non-declared block types. When omitted, the CMS falls back to all 7 block types visible (backwards-compatible default). The canonical authoring convention + valid slug list lives in `packages/site-template/README.md` § "`siteManifest.blocks[]` — the per-tenant CMS block menu"; downstream integration docs live in `packages/tools/siab-orchestrator/workflows/cms/agents/payload-seeder.md` (Phase 4 seed) and `packages/tools/siab-orchestrator/workflows/sitegen/agents/reviewer.md` (Phase 7 gate).

## MCP credentials

The project's `.mcp.json` ships **anonymous-tier MCP server definitions only**. Per-machine API keys / tokens are configured at user scope via `claude mcp add -s user`, so secrets live in `~/.claude.json` (outside any repo, never committed) and the project config stays portable.

**Why this pattern**: project-scope (`.mcp.json`) entries always shadow user-scope ones with the same name. So secrets cannot ride in `.mcp.json` env-var references — if the project entry exists, it wins, and the user-scope key is ignored. Anonymous tier in the project config + user-scope override for credentials is the only setup that works for both fresh clones (anonymous tier just works) and authenticated single-machine use.

### To upgrade context7 from anonymous to authenticated (free key from https://context7.com)

```bash
claude mcp add -s user context7 -e CONTEXT7_API_KEY=ctx7sk-... -- npx -y @upstash/context7-mcp
```

Then restart Claude Code. Verify with `claude mcp get context7` — `Scope: User config` confirms the user-scope version is active.

### To upgrade github MCP from anonymous to authenticated (PAT with `repo` + `read:org`)

```bash
claude mcp add -s user github -e GITHUB_PERSONAL_ACCESS_TOKEN=ghp_... -- npx -y @modelcontextprotocol/server-github
```

Note: this is separate from the `gh` CLI's keyring auth; the MCP server reads its env var explicitly.

### Anonymous tier is what fresh clones get

Anyone cloning this repo gets context7 (rate-limited) and github MCP (public-repo read only) out of the box, no setup needed. Upgrade only if you hit those limits.

### Argument ordering gotcha (commander.js variadic)

The `-e` flag is variadic and greedily eats the next positional arg if placed *before* the server name. The order that works is: `claude mcp add -s user <name> -e KEY=VAL -- <command> <args...>` — env after the name, terminated by `--`.

## Forward-looking notes

- **OBS-62** (in features backlog, multi-repo section): tenant sites will adopt a container-query authoring contract so the CMS canvas can render responsive previews at any pane width. When `@siab/responsive-canvas-lint` ships, this section should reference the package README as the canonical contract — for now the backlog entry is the source of truth.
