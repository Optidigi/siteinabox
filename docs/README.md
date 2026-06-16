# SIAB Platform Docs

This directory is for monorepo-level docs that cut across apps, packages,
orchestrator workflows, and infra.

App-local docs stay with the app that owns them:

- `apps/cms/docs/` for Payload/CMS internals and backlog history.
- `packages/site-template/docs/` for generated-site template contracts.
- `packages/tools/siab-orchestrator/runbooks/` for operator runbooks tied to
  `/new-site` or `/add-cms`.

Monorepo-level policies:

- `generated-site-snapshot-policy.md` defines how `packages/site-template`
  relates to generated tenant snapshots under `sites/*`.
