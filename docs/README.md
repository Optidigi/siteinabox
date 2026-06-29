# SIAB Platform Docs

This directory is for monorepo-level docs that cut across apps, packages, and
infra.

App-local docs stay with the app that owns them:

- `apps/cms/docs/` for Payload/CMS internals and backlog history.
- `packages/site-renderer/` for shared CMS/public rendering behavior.

Monorepo-level policies:

- Future platform architecture decisions should be added under `decisions/`
  once approved.
- Current platform architecture lives under `architecture/`, especially
  `architecture/data-driven-site-generation.md` and
  `architecture/block-source-catalog.md`.
- Historical phase and subagent plans under `architecture/` are retained as
  implementation history. They must not override current root `AGENTS.md`,
  this README, or the current architecture docs.
- Staging and CI verification notes live in
  `architecture/phase-6-staging-ci-readiness.md` and
  `architecture/phase-10-e2e-readiness-report.md`.
- Root `AGENTS.md` is the canonical monorepo operating policy, including MCP and
  agent-tooling state.
