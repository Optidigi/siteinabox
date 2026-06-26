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
- Current implementation planning lives under `architecture/`, including
  `architecture/production-implementation-subagent-plan.md` for the next
  subagent-based production pass.
- Staging and CI verification for the current production-readiness pass lives in
  `architecture/phase-6-staging-ci-readiness.md`.
- Root `AGENTS.md` is the canonical monorepo operating policy, including MCP and
  agent-tooling state.
