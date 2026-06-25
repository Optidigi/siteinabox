# Feature Backlog

This backlog was reset after the platform cleanup that removed obsolete
generation flows and the provisional product app shell. Historical entries that
depended on command-run site generation are no longer current source of truth.

## Current State

- The CMS remains the tenant/content authority.
- The public marketing site remains `apps/site`.
- Shared data contracts live in `packages/contracts`.
- Shared UI primitives and app-neutral composites live in `packages/ui`.
- Existing tenant snapshots remain under `sites/*` and may use
  `packages/site-template` for renderer/reference contracts.

## Current Product Rules

- Future product architecture is under reconsideration.
- Do not add a new self-serve product surface until its architecture is
  approved.
- Do not generate per-client source code for new sites.
- AI-assisted generation, if reintroduced, must produce validated structured
  data that matches shared contracts.
- Payment-provider-specific work remains out of scope until a provider adapter
  decision is made.

## Open Follow-Up

- Write a new architecture decision before starting any replacement product
  surface.
- Revisit tenant provisioning, preview, approval, payment handoff, and publish
  responsibilities as part of that decision.
- Keep CMS feature work tracked in focused entries or runbooks that match the
  current codebase, not removed generation workflows.
