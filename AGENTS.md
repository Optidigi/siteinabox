# AGENTS.md

Repository operating rules for Codex and other coding agents in `siteinabox`.

This file is the canonical monorepo entrypoint. Normal agent work starts from
the repository root (`/home/shimmy/Desktop/env/siteinabox/siab-platform`).
App-local `AGENTS.md` files add rules only for work inside that app.

## What This Repo Is

`siteinabox` is the SIAB monorepo shell. It keeps deployable apps isolated
while collecting shared contracts and shared UI in one workspace.

Current surfaces:

- `apps/cms` - Payload CMS app, formerly `siab-payload`.
- `apps/landing` - public Site in a Box marketing site.
- `apps/intake` - public intake app boundary for `www.siteinabox.nl/intake`.
- `apps/renderer` - generic public runtime for generated sites.
- `packages/ui` - shared UI primitives/components.
- `packages/contracts` - shared data contracts.
- `packages/site-renderer` - shared rendering core for CMS preview/canvas and
  the public renderer.

## Workflow Routing

- For CMS app work, read `apps/cms/AGENTS.md` and follow its rules.
- For public marketing site work, work in `apps/landing`.
- For public intake product work, work in `apps/intake`.
- For public generated-site runtime work, use `apps/renderer`.
- For shared rendering logic, use `packages/site-renderer`.
- Do not restore command-driven site generation workflows.

## Architecture Rules

- `apps/landing` is the public marketing site.
- `apps/intake` owns the public intake surface at `/intake`.
- `apps/cms` remains the Payload admin/editor and tenant/content authority.
- `apps/renderer` is the generic public runtime. It resolves tenants by request
  host, loads published tenant snapshots, and serves sites without
  tenant-specific source branches.
- `packages/site-renderer` owns shared rendering logic used by both CMS
  preview/customizer surfaces and `apps/renderer`.
- Do not generate per-client source code for new sites. New self-serve sites
  must become validated tenant, site, page, theme, SEO, and publishing data
  consumed by the approved platform architecture.
- AI must output validated structured data that matches contracts, not
  arbitrary React components, source files, or executable code.
- New generated sites must not create folders under `sites/*`, tenant-specific
  GitHub workflows, or tenant-specific Docker images.
- Do not create or restore source folders under `sites/*`. Tenant-specific app
  source trees have been removed; renderer/CMS data is canonical.
- Shared UI must come from `packages/ui`. Do not import app components from
  one app into another app.
- Shared data shapes belong in `packages/contracts`.
- DNS/domain pointing stays manual or stubbed for the current production-readiness
  pass. Later intake/domain work is expected to use OpenProvider for domain
  purchase and Cloudflare for DNS/proxy automation once that phase is approved.
  A submitted domain is normalized into domain data and used to derive slug,
  preview path, live hostname, and deployment metadata.
- Mollie is the selected payment service provider. Payment work should use a
  clear Mollie adapter boundary, keep payment state explicit in CMS, and must not
  commit API keys, webhook secrets, or other secret values.

## MCP Status

The monorepo root declares project-local MCP servers in `.mcp.json`,
`.mcp.toml`, `.codex/config.toml`, and `.codex/mcp.toml`. `apps/cms` also keeps
matching app-local MCP mirrors for tools started from that directory:
`apps/cms/.mcp.json`, `apps/cms/.mcp.toml`,
`apps/cms/.codex/config.toml`, and `apps/cms/.codex/mcp.toml`.

Keep all eight files' server lists in sync.

Configured root servers:

- `shadcn`: `npx -y shadcn@latest mcp`
- `postgres`: `npx -y @modelcontextprotocol/server-postgres postgresql://payload:payload@localhost:5432/payload`
- `github`: `npx -y @modelcontextprotocol/server-github`
- `context7`: `npx -y @upstash/context7-mcp`
- `better-auth`: `https://mcp.better-auth.com/mcp`
- `docker`: `npx -y mcp-server-docker`
- `sequential-thinking`: `npx -y @modelcontextprotocol/server-sequential-thinking`
- `posthog`: `https://mcp.posthog.com/mcp`

Do not add API keys, tokens, or secret env values to repo-local MCP files.
Authenticated MCP credentials belong in user-scope config. Local services such
as Postgres or Docker must still be running on the workstation for those MCP
servers to be useful.

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

## Agent Tooling State

- `.codex/` exists only for Codex MCP configuration. It must not contain command
  prompt files or behavioral instructions.
- Repo-local command prompt directories and repo-local `skills/` directories are
  not part of the current repo contract.
- User/global Codex skills may exist outside this repo. Do not treat external
  site-generation skills or prompt workflows as current SIAB architecture unless
  the operator explicitly asks for them.
- `apps/cms/components.json` is the only shadcn `components.json` in this repo.
  It points shadcn at CMS-local compatibility shims; shared primitive source
  still lives in `packages/ui`.

## Deploy Invariants

- Platform-owned app images are:
  - `ghcr.io/optidigi/siteinabox-cms`
  - `ghcr.io/optidigi/siteinabox-intake`
  - `ghcr.io/optidigi/siteinabox-site`
  - `ghcr.io/optidigi/siteinabox-renderer`
- Additional app images must be added only when those apps are implemented and
  their deploy contracts are approved.
- Tenant-specific app images must not be restored; generated sites are served
  by `apps/renderer`.
- VPS stack files are organized under
  `/srv/saas/infra/stacks/siteinabox/`.
- Keep Payload tenant data paths stable:
  `/srv/data/saas/siab-payload/tenants/<tenantId>`.
- Traefik is the production edge proxy. Public routing belongs in compose
  labels on the shared external `proxy` network.
- Do not reintroduce Nginx Proxy Manager registration helpers.

## Completion Gates

- If TypeScript or JavaScript changes under `apps/cms`, run
  `pnpm --dir apps/cms typecheck`.
- If tenant snapshot/template code changes, run the relevant build/check
  command for that package.

Respect existing dirty work in imported app/package directories. Do not revert
unrelated changes.
