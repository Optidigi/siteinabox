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
- global ThemeTokenSpec V2 selections and typed token values where validation is
  complete
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
AI output must not include raw HTML, arbitrary class strings, arbitrary CSS,
file paths, source code, workflows, layout instructions, or executable code.

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
- Provider-backed block activation:
  `packages/site-renderer/src/source-blocks`.
- Provider-backed chrome activation:
  `packages/site-renderer/src/source-chrome`.
- Provider-backed system fallback activation:
  `packages/site-renderer/src/source-templates`.
- Payload CMS block schemas:
  `apps/cms/src/blocks/*.ts`, exported through
  `apps/cms/src/blocks/registry.ts`.
- Public and preview rendering:
  `packages/site-renderer/src/blocks/*.tsx`, exported through
  `packages/site-renderer/src/blocks/index.tsx`.
- Editable CMS canvas rendering:
  `apps/cms/src/components/editor/canvas/CanvasBlockRenderer.tsx` and
  `apps/cms/src/components/editor/canvas/blocks/*.tsx`.

`SITE_BLOCK_SLUGS` contains the structured generated-site page block contracts
that Payload, runtime validation, and shared renderers understand. Self-serve
AI generation uses a narrower active partition:
`SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS`, plus its generated JSON schema
projection. Structured contracts can exist for CMS/runtime coverage without
becoming self-serve generation candidates until a complete source-backed
provider variant is activated.
`SITE_DEFERRED_MARKETING_BLOCK_SLUGS` is empty; deferred blocks are not
available to generation.

Self-serve generation has a narrower active source partition than the full
provenance catalog. The current active provider-backed partition contains:

- Tailwind Plus Marketing hero `tailwindplus.marketing.hero.simple-centered`,
  with legacy alias `tailwindPlusSimpleCentered` on `hero` blocks;
- Tailwind Plus Marketing hero/header section
  `tailwindplus.marketing.hero.with-stats`, with legacy alias
  `tailwindPlusHeroWithStats` on `hero` blocks;
- Tailwind Plus Marketing feature section
  `tailwindplus.marketing.feature.with-product-screenshot`, with legacy alias
  `tailwindPlusWithProductScreenshot` on `featureList` blocks;
- Tailwind Plus Marketing feature section
  `tailwindplus.marketing.feature.centered-2x2-grid`, with legacy alias
  `tailwindPlusCentered2x2` on `featureList` blocks;
- Tailwind Plus Marketing CTA
  `tailwindplus.marketing.cta.dark-panel-with-app-screenshot`, with legacy
  alias `tailwindPlusDarkPanelWithAppScreenshot` on `cta` blocks;
- Tailwind Plus Marketing contact section
  `tailwindplus.marketing.contact.centered`, with legacy alias
  `tailwindPlusCentered` on `contactSection` blocks;
- Tailwind Plus Marketing testimonial
  `tailwindplus.marketing.testimonial.simple-centered`, with legacy alias
  `tailwindPlusSimpleCentered` on `testimonials` blocks;
- Tailwind Plus Marketing stats `tailwindplus.marketing.stats.simple`, with
  legacy alias `tailwindPlusSimple` on `stats` blocks;
- Tailwind Plus Marketing logo cloud
  `tailwindplus.marketing.logo-cloud.simple-with-heading`, with legacy alias
  `tailwindPlusSimpleWithHeading` on `logoCloud` blocks;
- Tailwind Plus Marketing pricing
  `tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier`, with
  legacy alias `tailwindPlusSimpleTiers` on `pricing` blocks;
- Tailwind Plus Marketing team
  `tailwindplus.marketing.team.with-small-images`, with legacy alias
  `tailwindPlusGrid` on `team` blocks;
- Tailwind Plus Marketing newsletter
  `tailwindplus.marketing.newsletter.side-by-side-with-details`, with legacy
  alias `tailwindPlusNewsletterSideBySideWithDetails` on `newsletter` blocks;
- Tailwind Plus Marketing bento grid
  `tailwindplus.marketing.bento.three-column-bento-grid`, with legacy alias
  `tailwindPlusThreeColumnBentoGrid` on `bentoGrid` blocks;
- Tailwind Plus Marketing content section
  `tailwindplus.marketing.content.sticky-product-screenshot`, with legacy
  alias `tailwindPlusContentStickyProductScreenshot` on `contentSection`
  blocks;
- Tailwind Plus Marketing blog/cards
  `tailwindplus.marketing.blog.three-column`, with legacy alias
  `tailwindPlusThreeColumn` on `blogCards` blocks.

AI inputs, generated JSON schema enums, mock generation, CMS validation, and
publish validation use those active executable provider definitions and must not
expose inactive provider variants or inactive slots.
New self-serve generation prefers canonical provider IDs in `designVariant`;
legacy aliases remain accepted for existing saved/imported page data.

Provider block source owns DOM, layout, responsive behavior, and static
Tailwind classes. SiaB owns structured slots, CMS editing, links/media/forms,
routing, theme tokens, preview/canvas/public orchestration, and publish
validation. Generation may choose only approved provider IDs and fill exposed
slot fields; it must not output raw HTML, TSX/JSX, CSS, imports, `className`,
arbitrary Tailwind classes, executable code, or layout instructions.
Provider roots carry `data-provider-block`, `data-provider-variant`, and
`data-source-backed-block`; generic `.cms-block` CSS excludes those roots so
legacy SiaB block styling cannot alter provider layout.
Projected analytics stores the selected `designVariant` as `providerVariant`
and emits it to PostHog section/action context for provider-variant performance
analysis.

ThemeTokenSpec V2 is the generated-site theme contract. It supports:

- `appearance.mode`: `light`, `dark`, or `system`;
- approved color scheme IDs;
- approved font scheme IDs;
- approved density scheme IDs;
- approved shape/radius scheme IDs.

Missing theme data resolves to the default preset set: `tailwind-default`
colors, `clear-modern` fonts, `tailwind-default` density,
`tailwind-default` shape, and light mode. Default parity should reproduce
upstream Tailwind Plus behavior as closely as the source-backed renderer
allows. Themed parity may differ visually only through approved CSS variable
outputs. Generation and CMS must not use theme data to
change provider DOM, classes, item counts, responsive rules, or layout.

Header, footer, and banner remain global chrome under `SiteSettings.chrome` plus
`navHeader`/`navFooter`; they are not page blocks. Self-serve generation exposes
the default structured chrome variants plus the active Tailwind Plus Marketing
header chrome `tailwindplus.marketing.header.with-stacked-flyout-menu` through
`SiteSettings.chrome.header.variant` and the active Tailwind Plus Marketing
banner chrome `tailwindplus.marketing.banner.with-button` through
`SiteSettings.chrome.banner.variant`. Header and banner content remains
structured site settings data: brand/site name, logo, header navigation, CTA,
banner message/link, and dismissibility.

The active Tailwind Plus header is static/closed-state chrome with CSS-only
mobile disclosure; full Tailwind Plus stacked-flyout interactivity is not
claimed. Banner `dismissible` is boolean behavior: a local CSS-only dismiss
control is rendered only when the setting is true.

404 output is system fallback behavior, not generated page content. Unknown
hosts and missing snapshots use the platform/default 404. When a published
snapshot exists but the requested page is missing, the public renderer uses the
provider-backed Tailwind Plus Simple 404 system template
`tailwindplus.marketing.feedback.404-simple` with the tenant snapshot's
settings and theme. There is no CMS-owned system-template editor or generated
system-template data shape today, so the 404 template uses renderer defaults
derived from site settings and is not added as a normal generated page section.

Self-serve intake applies generated specs with remote media placeholder
ingestion disabled. Provider media slots remain editable CMS fields, but active
blocks that use upstream/source fallback imagery mark those media slots
optional so publish validation does not depend on fetching arbitrary generated
remote assets. Required provider slots are limited to the structured content
and item counts needed to preserve the exact source layout.

Current P0 exact-source content rules:

- `tailwindplus.marketing.blog.three-column` uses a dedicated `authorRole`
  field; category/CTA labels must not be reused as author subtitles.
- `tailwindplus.marketing.hero.with-stats` requires exactly four structured
  text links and exactly four stats. `cta`, `secondary`, and `pills` are
  inactive for this variant.
- `tailwindplus.marketing.content.sticky-product-screenshot` exposes the
  source-visible bridge paragraph between the feature list and secondary
  heading.
- Visible content-bearing eyebrows in active exact variants are editable where
  represented by the source-backed renderer; otherwise they must be explicitly
  inactive and rejected rather than silently generated.

Inactive source families and SIAB-owned generic visual variants are not
generation inputs. Amicare variants are tenant-exclusive compatibility data for
the official Ami-care tenant path and are not available to generic generation,
normal pickers, or non-Amicare routes.

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
The public renderer does not need its own PostHog env; it consumes the
CMS-projected snapshot analytics config.

## Official Tenant State

Old tenant app sources have been removed. Renderer/CMS snapshot data is
canonical; do not restore tenant-specific source folders, workflows, or images.
Amicare has a scoped official-tenant renderer path inside `packages/site-renderer`
for official compatibility. Other retired tenant names must not be recreated
without an explicit future migration decision.

Do not use those snapshots as a pattern for new generated sites.
