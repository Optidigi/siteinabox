# Phase 2 Contract And Catalog Design

Date: 2026-06-26

Scope: Amicare/Amblast renderer parity contracts and catalog metadata only.
Renderer components, CMS block definitions, importer behavior, tenant data
migration, tenant source folders, tenant workflows, and tenant images remain out
of scope.

## Contract Additions

The shared contracts now model the missing parity primitives as structured data:

- `mediaHero` for Amblast image-backed heroes with overlays, priority media,
  alignment, min-height, and shape divider ids.
- `infoCardList` for icon/text facts such as hours, phone/email, and service
  facts.
- `serviceCarousel` for service cards in carousel or grid mode, including typed
  autoplay, pagination, loop, spacing, and responsive slide counts.
- `beforeAfterGallery` for portfolio comparison pairs with labels, orientation,
  and initial ratio.
- `contactDetails` for phone, email, address, hours, legal identifiers, and
  card/list/split layouts.
- `contactSection.provider` for form-provider behavior without secrets. Provider
  data can represent SIAB forms, Web3Forms, custom POST targets, mailto
  fallback, hidden fields, honeypot field, messages, consent, and analytics
  flags.

`SiteSettings` also has additional generic metadata for renderer chrome,
analytics consent, and JSON-LD:

- `chrome.header.behavior`, `activeMode`, `mobileMenu`, and `cta`.
- `chrome.footer.legalLinks`.
- `analyticsConsent` for consent-gated runtime behavior.
- `seoJsonLd` for Organization and LocalBusiness data.

## Catalog Additions

`SITE_GENERATION_BLOCK_CATALOG` records local-source provenance for the parity
primitives using the legacy tenant snapshots as visual/functionality references.
`SITE_BLOCK_CATALOG` remains limited to the currently renderable/shared-renderer
block set:

- Amblast shaped heroes: `sites/amblast/src/pages/index.astro`.
- Amblast image/info boxes: `sites/amblast/src/pages/index.astro`.
- Amblast service carousel: `sites/amblast/src/pages/index.astro`.
- Amblast portfolio comparisons: `sites/amblast/src/pages/portfolio.astro`.
- Amblast contact/legal cards: `sites/amblast/src/pages/contact.astro`.

These variants are approved as contract/catalog shapes but marked with deferred
renderer support and `needs-browser-comparison` visual exactness. They are not
included in `SITE_SOURCE_BACKED_BLOCK_VARIANTS`, which remains reserved for
implemented, browser-reviewed, externally source-backed marketing variants.
Form-provider behavior is represented in the `contactSection.provider` contract
but is not exposed as a supported renderer catalog variant until Phase 3 adds
the shared renderer behavior.

## Phase 3 Boundary

Phase 3 must implement shared renderer components in `packages/site-renderer`
for the new block contracts and generic runtime behavior. It must not add
tenant-specific branches. The CMS importer/editor still only has Payload block
definitions for the original seven blocks, so applying new block rows through
CMS requires a later CMS compatibility phase before Phase 5 data migration.

Secrets stay out of data: Web3Forms access keys and any provider credentials
must be supplied by runtime configuration or CMS secret storage, not committed
in snapshots.
