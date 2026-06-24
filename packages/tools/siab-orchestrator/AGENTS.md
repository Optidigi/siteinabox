# AGENTS.md

Operating rules for the SIAB orchestrator package.

This package is one legacy/transition tool shell, not the future Builder product
architecture. Keep the site generation and CMS conversion flows separate unless
the user explicitly asks to change the orchestration contract.

## Package Shape

- `/new-site` starts at `commands/new-site.md` and routes to
  `workflows/sitegen/`.
- `/add-cms <slug>` starts at `commands/add-cms.md` and routes to
  `workflows/cms/`.
- Sitegen-only agents live under `workflows/sitegen/agents/`.
- CMS-conversion-only agents live under `workflows/cms/agents/`.
- `.codex/` and `.claude/` expose runner-specific command/agent shims. Keep
  those shims in sync with the canonical `commands/` and `workflows/` files.

## Monorepo Contract

These contracts describe existing generated-site tenants and transition
workflows. New self-serve Builder sites must not be created by copying
`packages/site-template` into `sites/<slug>`.

- Generated site source lives in the monorepo under `sites/<slug>`.
- Tenant site images are monorepo-owned and named
  `ghcr.io/optidigi/siteinabox-site-<slug>:latest`.
- The platform CMS image is `ghcr.io/optidigi/siteinabox-cms:latest`.
- The public Site in a Box app image is
  `ghcr.io/optidigi/siteinabox-site:latest`.
- Production stack files live under
  `/srv/saas/infra/stacks/siteinabox/`.
- Tenant Payload data remains under
  `/srv/data/saas/siab-payload/tenants/<tenantId>`.

## Workflow Safety

- Do not open a workflow `prompt.md` before the matching preflight and user
  confirmation gate.
- `/new-site` must not modify CMS conversion files.
- `/add-cms <slug>` must not rewrite template/theme packages as part of a
  tenant conversion.
- Preserve the separate subagent contracts. The shared package is only a
  packaging convention.
