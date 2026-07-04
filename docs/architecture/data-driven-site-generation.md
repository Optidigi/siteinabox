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

Self-serve generation has a narrower active source partition than the full
provenance catalog. That active partition is currently empty after removing the
adapted/fake Tailwind Plus runtime path. AI inputs, generated JSON schema enums,
mock generation, and generic runtime validation must not expose provider-backed
block variants until exact-source Tailwind Plus blocks are implemented and
approved. Inactive source families and SIAB-owned generic visual variants are
not generation inputs. Amicare variants are tenant-exclusive compatibility data
for the official Ami-care tenant path and are not available to generic
generation, normal pickers, or non-Amicare routes.

## Email And Analytics

Cloudflare Email Sending is the canonical email path. Runtime delivery uses
Cloudflare's REST Email Sending API for platform/admin mail, Better Auth CMS
and preview magic links, intake internal notifications, privacy exports,
preview handoff mail, and verified tenant-site form notifications.
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `EMAIL_FROM` configure the
primary runtime sender; `CLOUDFLARE_EMAIL_SMTP_TOKEN` remains an optional SMTP
fallback for environments that can reach Cloudflare's port 465 endpoint.

Tenant generated-site mail uses a per-tenant Cloudflare Email Sending sender,
normally `noreply@mail.<tenant-domain>`. Domain provisioning creates or reuses
the Cloudflare zone and Email Sending subdomain through the Cloudflare API
(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, optional
`CLOUDFLARE_API_BASE_URL`) and stores non-secret state on
`tenants.emailSending`. Run-linked generated-site activation is blocked until
that tenant email sender is `verified`; manual activation only bypasses
approval/payment, not domain or sender verification.

Outbound sends create metadata-only `mail-logs` records when a Payload instance
is supplied. Subjects, bodies, and secrets are not stored. Important or repeated
mail failures upsert super-admin-visible `operational-alerts`. `RESEND_API_KEY`
and alternate transactional mail providers are obsolete unless a future
architecture decision explicitly adds a new provider.

Generated and published sites are PostHog-first by default. Projection resolves
public analytics settings through the shared analytics config and the renderer
emits consent-gated metadata. Capture is active only when deployment env
provides the required PostHog token/config and analytics is not disabled.

## Official Tenant State

Old tenant app sources have been removed. Renderer/CMS snapshot data is
canonical; do not restore tenant-specific source folders, workflows, or images.
Amicare has a scoped official-tenant renderer path inside `packages/site-renderer`
for visual parity. Other retired tenant names must not be recreated without an
explicit future migration decision.

Do not use those snapshots as a pattern for new generated sites.
