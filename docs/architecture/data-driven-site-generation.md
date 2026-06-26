# Data-Driven Site Generation

Site in a Box generation creates CMS data, not source code.

This document is a Phase 0 guardrail. It records the repo direction before the
generator, renderer, payment, intake, and AI implementation phases exist.

## Target Direction

New generated sites must be represented as validated structured data:

- tenant identity and ownership
- domain and routing metadata
- site settings and navigation
- page records and block data
- theme tokens and style presets
- SEO metadata and analytics metadata
- publish state and published site snapshots

The CMS remains the authoring and control plane. The future public runtime is a
generic renderer, not a tenant-specific source tree.

## Boundaries

Generation must not create:

- folders under `sites/*`
- tenant-specific Astro, React, or other source files
- tenant-specific GitHub workflows
- tenant-specific Docker images
- arbitrary executable code

AI-assisted generation, when implemented, must output a validated
`SiteGenerationSpec` or equivalent contract data. That data is applied to CMS
draft tenant/site/page/theme/SEO records and later published as a snapshot.

## Repo Roles

- `apps/landing` remains the public `siteinabox.nl` marketing site and entry
  point to intake.
- `apps/intake` owns the public intake surface mounted at
  `www.siteinabox.nl/intake`.
- `apps/cms` remains the Payload CMS control plane for tenants, content,
  preview/customizer surfaces, approval, publish state, and ongoing management.
- `apps/renderer` is reserved for the future generic public runtime. It should
  resolve tenants by host, load published snapshots, and serve live sites
  without tenant-specific logic.
- `packages/contracts` owns shared data contracts and validation shapes.
- `packages/site-renderer` is reserved for shared rendering logic used by CMS
  preview/customizer surfaces and `apps/renderer`.
- `packages/ui` owns shared UI primitives and app-neutral components.
- `packages/site-template` and `sites/*` remain legacy/current snapshot paths
  for existing tenant maintenance and reference only.

## Legacy Snapshots

`sites/ami-care` and `sites/amblast` are existing tenant snapshots. Their image
workflows and deployment contracts remain stable until the operator approves a
migration or archival plan.

Do not use those snapshots as a pattern for new generated sites.

## Prep-Only Status

This phase does not implement:

- intake forms
- AI generation
- generator services
- CMS draft application logic
- CMS preview/customizer rewrites
- payment or approval flows
- published snapshot storage
- `apps/renderer` runtime behavior
- `packages/site-renderer` rendering behavior

Future phases should add behavior only after the relevant contracts and deploy
boundaries are approved.
