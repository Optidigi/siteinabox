# Infra Backlog

This backlog was reset after the monorepo cleanup that removed the command-run
site generation tooling, theme package, generated workflow docs, agent command
artifacts, and the provisional product app shell.

## Current State

- Active platform apps are `apps/cms`, `apps/landing`, `apps/intake`, and
  `apps/renderer`.
- Shared packages are `packages/contracts`, `packages/ui`, and
  `packages/site-renderer`.
- Platform-owned images remain:
  - `ghcr.io/optidigi/siteinabox-cms`
  - `ghcr.io/optidigi/siteinabox-site`
  - `ghcr.io/optidigi/siteinabox-renderer`
- VPS stack files remain under `/srv/saas/infra/stacks/siteinabox/`.
- Payload tenant data paths remain
  `/srv/data/saas/siab-payload/tenants/<tenantId>`.

## Current Rules

- Do not restore command-run site generation workflows.
- Do not create new per-client source folders, workflows, or images for
  generated sites.
- Future generation must create validated CMS tenant/site/page/theme/SEO data,
  not generated source code.
- DNS/domain pointing remains manual outside approved automation.
- New app images or deploy contracts require an explicit architecture/deploy
  decision before implementation.

## Open Follow-Up

- Keep the production deploy contract for the generic `apps/renderer` image in
  `apps/renderer/README.md` and `docs/runbooks/deploy.md` current as the
  renderer moves from reserved/foundation work to an approved deploy target.
  It must stay platform-owned and must not introduce per-tenant images,
  workflows, or source folders.
- Define any future tenant provisioning/deploy automation as product code or
  approved infra automation, not as prompt/runbook command flows.
- Keep local MCP declarations in `.mcp.json`, `.mcp.toml`,
  `.codex/config.toml`, and `.codex/mcp.toml` synchronized.
- Treat retired legacy tenants as out of scope for the current SIAB tenant
  roster. Do not recreate tenant-specific operations until a future migration
  is explicitly approved.

## Implemented Foundation

### Phase 9 — Generic renderer activation

**Status:** Foundation added 2026-06-25.

`apps/renderer` now runs as an Astro SSR app using the Node adapter, resolves
the incoming Host header, and loads the active immutable snapshot through the
CMS renderer snapshot endpoint. Local fixture mode is retained only when
`SIAB_RENDERER_FIXTURE_MODE=1` is explicitly set outside production; a missing
CMS URL no longer falls back to bundled data in production. No tenant-specific
deploy artifacts were added.

Follow-up on 2026-06-26 documented the production renderer contract and manual
domain verification workflow. Production requires matching
`SIAB_RENDERER_API_TOKEN` values in CMS and renderer, `SIAB_CMS_URL` in the
renderer, and proxy preservation of the public `Host` / `X-Forwarded-Host`.
Aliases serve the same active snapshot; canonical redirects remain out of
scope. Domain verification remains a super-admin manual checklist on existing
tenant fields, with no DNS automation.

### 2026-06-29 — Legacy source cleanup

**Status:** Applied.

Removed obsolete tenant/template source directories from the monorepo:
`sites/`, `packages/site-template/`, and `packages/tools/`. The current source
contract is CMS tenant data plus the platform-owned renderer in
`packages/site-renderer` / `apps/renderer`; deleted tenant-specific source
trees must not be restored.

Production cleanup removed stale renderer staging tenants for
`amicare.optidigi.nl`.
