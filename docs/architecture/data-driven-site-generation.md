# Data-Driven Site Generation

Site in a Box generation creates CMS data, not source code.

This document records the current repo contract for generated sites, CMS
content, preview, publishing, and live rendering.

## Current Contract

New generated sites must be represented as validated structured data:

- tenant identity and ownership
- domain and routing metadata
- site settings and navigation
- page records and block data
- theme tokens and style presets
- SEO metadata and analytics metadata
- publish state and published site snapshots

The CMS is the authoring and control plane. The public runtime is the generic
`apps/renderer` app, not a tenant-specific source tree. Live output is served
from active published snapshots.

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
AI output must not include raw HTML, arbitrary class strings, file paths, source
code, workflows, or executable code.

## Repo Roles

- `apps/landing` remains the public `siteinabox.nl` marketing site and entry
  point to intake.
- `apps/intake` owns the public intake surface mounted at
  `www.siteinabox.nl/intake`.
- `apps/cms` remains the Payload CMS control plane for tenants, content,
  preview/customizer surfaces, approval, publish state, and ongoing management.
- `apps/renderer` is the generic public runtime. It resolves tenants by host,
  loads active published snapshots through the CMS renderer snapshot API, and
  serves live sites without tenant-specific logic.
- `packages/contracts` owns shared data contracts and validation shapes.
- `packages/site-renderer` owns shared rendering logic used by CMS
  preview/customizer surfaces and `apps/renderer`.
- `packages/ui` owns shared UI primitives and app-neutral components.

## Block Source Of Truth

Generated-site blocks have one canonical contract path:

- Block slugs and TypeScript data shapes:
  `packages/contracts/src/site.ts`.
- Generation input contracts:
  `packages/contracts/src/generation.ts`.
- Runtime/schema validation:
  `packages/contracts/src/runtime.ts`.
- Approved UI block provenance, variants, source-family metadata, and editable
  field mappings:
  `packages/contracts/src/block-catalog.ts`.
- Archived upstream UI block material:
  `packages/contracts/block-sources/`, refreshed by
  `scripts/archive-block-sources.mjs`.
- Payload CMS block schemas:
  `apps/cms/src/blocks/*.ts`, exported through
  `apps/cms/src/blocks/registry.ts`.
- Public and preview rendering:
  `packages/site-renderer/src/blocks/*.tsx`, exported through
  `packages/site-renderer/src/blocks/index.tsx`.
- Editable CMS canvas rendering:
  `apps/cms/src/components/editor/canvas/CanvasBlockRenderer.tsx` and
  `apps/cms/src/components/editor/canvas/blocks/*.tsx`.

`SITE_BLOCK_SLUGS` currently contains every generated-site page block that AI
may use. `SITE_DEFERRED_MARKETING_BLOCK_SLUGS` is empty; deferred blocks are
not available to generation.

## Email And Analytics

Cloudflare Email Service over Nodemailer is the canonical email delivery path
for all SIAB mail. That includes platform/admin mail, tenant-site mail, Payload
email through the Nodemailer adapter, and Better Auth magic-link mail in both
CMS and preview auth flows. `RESEND_API_KEY` and alternate transactional mail
providers are obsolete unless a future architecture decision explicitly adds a
new provider.

Generated and published sites are PostHog-first by default. Projection resolves
public analytics settings through the shared analytics config and the renderer
emits consent-gated metadata. Capture is active only when deployment env
provides the required PostHog token/config and analytics is not disabled.

## Legacy Tenant State

Old tenant app sources have been removed. Renderer/CMS snapshot data is
canonical; do not restore tenant-specific source folders, workflows, or images.
Amicare has a scoped legacy-tenant renderer path inside `packages/site-renderer`
for visual parity. Other retired tenant names must not be recreated without an
explicit future migration decision.

Do not use those snapshots as a pattern for new generated sites.
