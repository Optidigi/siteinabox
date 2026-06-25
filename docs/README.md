# SIAB Platform Docs

This directory is for monorepo-level docs that cut across apps, packages, and
infra.

App-local docs stay with the app that owns them:

- `apps/cms/docs/` for Payload/CMS internals and backlog history.
- `packages/site-template/docs/` for tenant snapshot renderer/reference contracts
  used by current tenant snapshots.

Monorepo-level policies:

- Future platform architecture decisions should be added under `decisions/`
  once approved.
- Root `AGENTS.md` is the canonical monorepo operating policy, including MCP and
  agent-tooling state.
