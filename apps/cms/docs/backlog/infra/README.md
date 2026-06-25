# Infra Backlog

This backlog was reset after the monorepo cleanup that removed the command-run
site generation tooling, theme package, generated workflow docs, agent command
artifacts, and the provisional product app shell.

## Current State

- Active platform apps are `apps/cms` and `apps/site`.
- Shared packages are `packages/contracts`, `packages/ui`, and
  `packages/site-template`.
- Current tenant site snapshots live under `sites/*`.
- Platform-owned images remain:
  - `ghcr.io/optidigi/siteinabox-cms`
  - `ghcr.io/optidigi/siteinabox-site`
- Tenant snapshot images remain:
  - `ghcr.io/optidigi/siteinabox-site-ami-care`
  - `ghcr.io/optidigi/siteinabox-site-amblast`
- VPS stack files remain under `/srv/saas/infra/stacks/siteinabox/`.
- Payload tenant data paths remain
  `/srv/data/saas/siab-payload/tenants/<tenantId>`.

## Current Rules

- Do not restore command-run site generation workflows.
- Do not create new per-client source folders while the platform architecture
  is under reconsideration.
- DNS/domain pointing remains manual outside approved automation.
- New app images or deploy contracts require an explicit architecture/deploy
  decision before implementation.

## Open Follow-Up

- Re-document the next platform architecture once it is approved.
- Define any future tenant provisioning/deploy automation as product code or
  approved infra automation, not as prompt/runbook command flows.
- Keep local MCP declarations in `.mcp.json`, `.mcp.toml`,
  `.codex/config.toml`, and `.codex/mcp.toml` synchronized.
