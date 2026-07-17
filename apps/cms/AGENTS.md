# AGENTS.md

CMS app operating rules for Codex and other coding agents. The monorepo root
`AGENTS.md` is the first stop when working from `siab-platform`; this file adds
CMS-specific rules for `apps/cms`.

Do not duplicate behavioral instructions into `.codex/` or `.agents/`. Those
directories are for runner-specific config and discovery files only. If
monorepo behavior changes, update root `AGENTS.md`; if CMS behavior changes,
update this file.

## What This Repo Is

`apps/cms` is the SIAB multi-tenant CMS app (formerly `siab-payload`), built with
Next.js 16 App Router, PayloadCMS v3, PostgreSQL, React 19, TypeScript,
Tailwind v4, pnpm 11, and Node 26 in Docker/CI. UI primitives are local
shadcn-style source under `src/components/ui/`; app composites live outside that
tree. Customer preview chrome lives in `src/components/preview/`; see
`docs/runbooks/canvas-architecture.md` § Customer preview chrome.

## Required Workflow

- Prefer making the requested change end to end instead of only proposing it.
- Read the relevant backlog before substantive work:
  - `docs/backlog/security/README.md`
  - `docs/backlog/features/README.md`
  - `docs/backlog/infra/README.md`
- When work fixes, obsoletes, or discovers a backlog item, update the backlog in
  the same session. Never call something fixed without reflecting it there.
- Use existing repository patterns and helpers before introducing abstractions.
- Respect user changes already present in the worktree. Do not revert unrelated
  edits unless explicitly asked.

## Commands

```bash
# Development
docker compose -f docker-compose.local.yml up -d
# On Shimmy's Linux dev box, Docker/Compose is not installed; use the Podman
# commands in docs/runbooks/local-dev.md for the local Postgres container.
pnpm dev

# Type generation after collection field changes
pnpm payload generate:types
pnpm payload generate:importmap
pnpm payload:contract

# Type check
pnpm typecheck

# Migrations after collection edits
pnpm payload migrate:create <name>
pnpm payload migrate

# Tests
pnpm test
pnpm test tests/unit/
pnpm test tests/unit/foo.test.ts
pnpm test tests/integration/

# CI gates
pnpm payload:contract
pnpm lint:ui-boundary
pnpm lint:ui-composition
pnpm lint:no-css
```

CI runs Payload dependency contract checks, typecheck, responsive canvas
contract, `lint:ui-boundary`, `lint:ui-composition`, `lint:no-css`, and the
full Vitest suite with Postgres. There is no generic ESLint gate currently
configured.

## UI Source Boundary

- `packages/ui` owns shared shadcn-style primitives, token CSS, `cn`,
  CSP-style helpers, and low-level UI hooks.
- `src/components/ui/`, `src/lib/utils.ts`, `src/components/csp-*.tsx`, and
  `src/hooks/use-mobile.ts` are compatibility re-export shims for the CMS app.
  Edit the source files in `packages/ui`, not the shims.
- Application composites live outside `src/components/ui/`, usually under
  `src/components/`, `src/components/forms/`, `src/components/editor/`, or
  route-local app code.
- Prefer upstream shadcn patterns for primitives, and compose local primitives
  before introducing one-off styling.
- `src/styles/shadcn.css` imports `@siteinabox/ui/styles/shadcn.css`; the
  package CSS is the shadcn/Tailwind token source of truth.
- `src/styles/globals.css` is only the stable import shell, and
  `src/styles/siab.css` is protected app/editor/canvas CSS. Do not point
  shadcn tooling at either file.
- Run `pnpm lint:ui-boundary`, `pnpm lint:ui-composition`, and
  `pnpm lint:no-css` when UI work touches relevant files.
- Use token utilities such as `bg-background`, `text-muted-foreground`,
  `border-border`, and role font/radius tokens.
- Do not hard-code component colors, author arbitrary color Tailwind values, or
  override primitive internals with inline `style` props.
- Per-tenant visible theme tokens are owned by the tenant/site theme pipeline.
  The CMS consumes them through `var()` chains scoped to `.rt-canvas`.
- Primitive overwrite policy is documented in
  `docs/runbooks/ui-overwrite-boundary.md`. Review shadcn diffs one primitive
  at a time; do not bulk-overwrite local primitive forks.

## Completion Gates

- If TS/JS files changed (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`), run
  `pnpm typecheck` before final response.
- If `node_modules/` is missing, report that typecheck was skipped.
- If no TS/JS files changed, typecheck may be skipped.
- If typecheck fails, do not present the work as complete; report the failure and
  relevant output.
- Run focused tests based on risk and changed surface. Report any tests that
  could not be run.

## MCP Servers

Project MCP definitions are mirrored in ten files — keep all lists in sync:

- Monorepo root: `.mcp.json`, `.mcp.toml`, `.codex/config.toml`, `.codex/mcp.toml`, `.cursor/mcp.json`
- `apps/cms/`: the same five filenames

`.codex/` is for Codex-specific config, `.cursor/` is for Cursor-specific config,
and `.agents/` is for generic agent-discovery metadata.

Configured servers:

- `shadcn`: `npx -y shadcn@latest mcp`
- `postgres`: `npx -y @modelcontextprotocol/server-postgres postgresql://payload:payload@localhost:5432/payload`
- `github`: `npx -y @modelcontextprotocol/server-github`
- `docker`: `npx -y mcp-server-docker`
- `sequential-thinking`: `npx -y @modelcontextprotocol/server-sequential-thinking`
- `context7`: `npx -y @upstash/context7-mcp`
- `better-auth`: `https://mcp.better-auth.com/mcp`
- `cloudflare-api`: `https://mcp.cloudflare.com/mcp`
- `posthog`: `https://mcp.posthog.com/mcp`; supply credentials/auth from
  user-scope Codex config or user environment, never repo config.

Do not add API keys, tokens, or secret env values to repo-local MCP files.
Authenticated MCP credentials belong in user-scope config.

### MCP Use Policy

Use the relevant configured MCP when CMS work depends on a vendor, framework, or
external system that has a project MCP. This is a semi-enforced rule: agents
should use the matching MCP before finalizing research, design, or code that
depends on that system, unless the MCP is unavailable or the task is purely
local and the existing source is sufficient. If an expected MCP cannot be used,
say so in the final response and fall back to official docs or repo-local
source.

Task routing:

- Cloudflare DNS, proxy, Workers, Email Sending, Turnstile, analytics, or API
  work: use `cloudflare-api`.
- Better Auth configuration, routes, plugin behavior, session, magic-link, or
  social-auth work: use `better-auth`.
- shadcn primitive discovery or upstream component comparison: use `shadcn`.
- Current third-party library, framework, SDK, or CLI documentation: use
  `context7`, except when a more specific MCP is configured.
- GitHub workflow/release/repository operations: use `github` when available.
- Postgres schema/data inspection: use `postgres` when the local database is
  available.
- Docker/container inspection: use `docker` when available, or the local Docker
  CLI when that is the established path.
- PostHog configuration or analytics verification: use `posthog`.
- Multi-step architecture/debugging where explicit reasoning traces are useful:
  use `sequential-thinking`.

For shadcn discovery work, prefer these shadcn MCP operations when available:

- `list_items_in_registries`
- `search_items_in_registries`
- `view_items_in_registries`
- `get_item_examples_from_registries`
- `get_add_command_for_items`
- `get_project_registries`
- `get_audit_checklist`

Use `context7` for current library documentation when docs are needed. Use
`sequential-thinking` when a task needs explicit multi-step reasoning support.

## Architecture Invariants

- Tenancy is resolved in `src/proxy.ts` from `Host`, setting
  `x-siab-mode` and `x-siab-host`; consumers use `getSiabContext()`.
- Roles are strict: `super-admin` has zero tenants; `owner`, `editor`, and
  `viewer` each have exactly one tenant.
- RSC pages must use `requireAuth()` or `requireRole()` from `@/lib/authGate`.
- Server actions must authenticate explicitly with
  `payload.auth({ headers: await headers() })`.
- For user-triggered Payload Local API operations, pass `user: caller`; reserve
  `overrideAccess: true` for system-internal work only.
- After any Payload collection field/schema change, regenerate types and create a
  migration.
- Auth guards that need original request data belong in `beforeOperation`, before
  field-level access strips data.
- `BOOTSTRAP_TOKEN` enables the one-time super-admin seed endpoint; it must be
  unset after production bootstrap.
- Password rotation clears sessions via `clearSessionsOnPasswordChange`; do not
  disable `useSessions` on Users.
- Rich text is structured `RtRoot` JSONB, not raw HTML or strings. See
  `docs/runbooks/rt-dom-contract.md`.
- Tenant block menus are gated by `tenants.siteManifest.blocks[]` and enforced by
  `enforceTenantBlockMenu`.

## Testing Rules

- Unit tests in `tests/unit/` run without DB and are appropriate for access,
  pure logic, and hook logic.
- Hook tests must import hook functions by reference from `src/hooks/*.ts`; never
  reach into hook arrays by index.
- Integration tests in `tests/integration/` use real Postgres, DB
  `payload_test`, sequential execution, and committed migrations via
  `migrateFresh`.
- Test setup reads `.env` and overrides `DATABASE_URI` to `payload_test`.

## Page Editor Work

Before touching the page editor or preview renderer, read
`docs/runbooks/canvas-architecture.md`. It documents the single shared renderer,
parent-owned sidebar/mobile forms, theme bar, customer preview chrome, selection
events, and frame readiness contract. Do not add a second CMS block renderer or
iframe mutation/geometry bridge.
