# SIAB Platform Docs

This directory is for monorepo-level docs that cut across apps, packages,
orchestrator workflows, and infra.

App-local docs stay with the app that owns them:

- `apps/cms/docs/` for Payload/CMS internals and backlog history.
- `apps/builder/` for future Builder app docs once implementation starts.
- `packages/site-template/docs/` for legacy generated-site template contracts.
- `packages/tools/siab-orchestrator/runbooks/` for operator runbooks tied to
  legacy `/new-site` or `/add-cms`.

Monorepo-level policies:

- `decisions/builder-platform.md` defines the future Builder/CMS/runtime
  architecture direction.
- `generated-site-snapshot-policy.md` defines how `packages/site-template`
  relates to legacy generated tenant snapshots under `sites/*`.
