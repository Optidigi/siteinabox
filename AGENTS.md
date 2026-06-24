# AGENTS.md

Repository operating rules for Codex and other coding agents in `siteinabox`.

## What This Repo Is

`siteinabox` is the SIAB monorepo shell. It keeps deployable apps isolated
while collecting shared contracts, UI, legacy generated-site assets, and
orchestration tools in one workspace.

Current and planned surfaces:

- `apps/cms` - Payload CMS app, formerly `siab-payload`.
- `apps/site` - public Site in a Box site, formerly `site-siteinabox`.
- `apps/builder` - future client-facing intake, generator, authenticated
  preview, approval, payment handoff, and publish trigger app. No production
  service is deployed yet.
- `apps/runtime` - future public live tenant renderer; not implemented yet.
- `packages/ui` - shared UI primitives/components used by CMS and Builder.
- `packages/contracts` - shared data contracts.
- `packages/site-runtime` - future shared renderer for Builder preview, live
  runtime, and editor consistency.
- `packages/site-template`, `packages/site-themes`,
  `packages/tools/siab-orchestrator`, and `sites/*` - legacy/transition
  generated-site paths, retained for existing tenants and reference.

## Workflow Routing

- For CMS app work, read `apps/cms/AGENTS.md` and follow its rules.
- For public site work, work in `apps/site`.
- For Builder product work, work in `apps/builder` and read
  `docs/decisions/builder-platform.md` first. Programmatic site generation
  belongs to `apps/builder`; use "generator" only for internal generation
  logic, not as the app name.
- For generated-site template maintenance on legacy tenants only, work in
  `packages/site-template`.
- For orchestrator package maintenance only, read
  `packages/tools/siab-orchestrator/AGENTS.md`.
- Treat `/new-site` and `/add-cms <slug>` as legacy workflows. Do not use them
  for new Builder architecture work except as historical reference.

Do not open an orchestrator workflow `prompt.md` before that workflow's
preflight/confirmation gate says to do so.

## Builder Architecture Rules

- `apps/site` is the public marketing site.
- `apps/builder` owns the client-facing intake, generator, authenticated
  preview, approval, payment handoff, and publish trigger.
- `apps/cms` remains the Payload admin/editor and tenant/content authority.
- `apps/runtime` will own public live tenant rendering when added later.
- Do not generate per-client source code for new sites. New self-serve sites
  should become tenant data plus metadata consumed by Builder/CMS/runtime.
- AI must output validated structured data that matches contracts, not
  arbitrary React components, source files, or executable code.
- Shared UI must come from `packages/ui`. Do not import app components from
  one app into another app.
- Shared data shapes belong in `packages/contracts`.
- Preview URLs are `https://preview.siteinabox.nl/<slug>/` and are owned by
  Builder.
- DNS/domain pointing stays manual outside automation. A submitted domain is
  normalized into domain data and used to derive slug, preview path, live
  hostname, and deployment metadata.
- Payment work must stay payment-provider neutral until the provider is chosen.
  Refer to a future payment provider adapter; do not bake in Stripe or Mollie
  directly in architecture docs.

## MCP Status

The monorepo root declares project-local MCP servers in `.mcp.json`,
`.mcp.toml`, `.codex/config.toml`, and `.codex/mcp.toml`. Keep all four files
in sync.

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

## Deploy Invariants

- Platform-owned app images are:
  - `ghcr.io/optidigi/siteinabox-cms`
  - `ghcr.io/optidigi/siteinabox-site`
- Future Builder and runtime images must be added only when those apps are
  implemented and their deploy contracts are approved.
- Tenant/generated site images remain stable unless the operator explicitly
  approves a deploy contract change:
  - `ghcr.io/optidigi/siteinabox-site-ami-care`
  - `ghcr.io/optidigi/siteinabox-site-amblast`
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
- If generated-site app/template code changes, run the relevant build/check
  command for that package.
- For orchestrator script changes, run
  `npm --prefix packages/tools/siab-orchestrator/scripts test`.

Respect existing dirty work in imported app/package directories. Do not revert
unrelated changes.
