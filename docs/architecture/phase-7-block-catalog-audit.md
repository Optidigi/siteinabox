# Phase 7 Block Catalog Completeness And Styling-Origin Audit

Date: 2026-06-26

Scope: final catalog completeness and styling-origin audit for the data-driven
generated-site block catalog. This report is descriptive only; it does not add
new product features or new block variants.

## Current Totals

- Generation contract block families: 12 total.
- Canonical self-serve/CMS block families: 7 total (`SITE_BLOCK_SLUGS`).
- Legacy parity block families: 5 total (`SITE_PARITY_BLOCK_SLUGS`).
- Cataloged generation variants: 21 total.
- Canonical self-serve/CMS catalog variants: 16 total.
- Legacy parity variants: 5 total.
- External source-backed canonical variants currently exported to generation:
  9 total.
- SIAB-owned local/generic canonical variants: 7 total.

`SITE_GENERATION_BLOCK_CATALOG` is the broad contract/renderer catalog.
`SITE_BLOCK_CATALOG` is the canonical self-serve/CMS catalog. The two must not be
treated as the same thing: the five parity blocks are renderer/runtime-schema
supported, but they are not CMS page-block definitions and are not passed to the
self-serve generation/import path.

## Family Counts

| Family | Cataloged families | Variants | Canonical self-serve? | Legacy parity? | Renderer support | CMS editable/importer support | Preview support |
| --- | ---: | ---: | --- | --- | --- | --- | --- |
| Headers/navs | 1 runtime chrome helper | 1 generic header renderer | No block slug | No | Supported via `SiteHeader` | Settings/nav data only, not page block | Supported through `SitePageRenderer` |
| Footers | 1 runtime chrome helper | 1 generic footer renderer | No block slug | No | Supported via `SiteFooter` | Settings/nav/footer data only, not page block | Supported through `SitePageRenderer` |
| Heroes/media heroes | 2 (`hero`, `mediaHero`) | 3 | `hero` only | `mediaHero` | Supported | `hero` only | Supported |
| Feature/service/info sections | 3 (`featureList`, `infoCardList`, `serviceCarousel`) | 4 | `featureList` only | `infoCardList`, `serviceCarousel` | Supported | `featureList` only | Supported |
| CTA sections | 1 (`cta`) | 2 | Yes | No | Supported | Supported | Supported |
| Testimonials | 1 (`testimonials`) | 2 | Yes | No | Supported | Supported | Supported |
| FAQ | 1 (`faq`) | 2 | Yes | No | Supported | Supported | Supported |
| Rich text | 1 (`richText`) | 2 | Yes | No | Supported | Supported | Supported |
| Contact/details/forms | 2 (`contactSection`, `contactDetails`) | 5 | `contactSection` only | `contactDetails` | Supported | `contactSection` only | Supported |
| Before-after/portfolio | 1 (`beforeAfterGallery`) | 1 | No | Yes | Supported | No | Supported |
| Runtime helpers/chrome/analytics | Renderer shell, theme, media, SEO, analytics attrs, header, footer | Not block variants | N/A | N/A | Supported | Settings/projection dependent | Supported |

Preview support means the CMS preview/customizer renders the shared
`SitePageRenderer` directly. It does not imply that every renderer-supported
block can be manually edited in Payload CMS.

## Variant Inventory

| Block family | Variants | Styling origin | Exactness/status | Self-serve generation/CMS status |
| --- | --- | --- | --- | --- |
| `hero` | `hero:minimal`; `hero:tailwindPlusSimpleCentered` | SIAB local/generic; Tailwind Plus free/public | SIAB exact-source; Tailwind Plus reviewed adapted-exact-style | CMS editable and generation/import supported |
| `mediaHero` | `mediaHero:amblastShapedOverlay` | SIAB legacy tenant snapshot | Adapted-exact-style, needs browser comparison | Renderer/runtime-schema supported; not CMS editable/importer-supported |
| `featureList` | `featureList:services`; `featureList:tailwindPlusCentered2x2` | SIAB local/generic; Tailwind Plus free/public | SIAB exact-source; Tailwind Plus reviewed adapted-exact-style | CMS editable and generation/import supported |
| `infoCardList` | `infoCardList:amblastImageBoxes` | SIAB legacy tenant snapshot | Adapted-exact-style, needs browser comparison | Renderer/runtime-schema supported; not CMS editable/importer-supported |
| `serviceCarousel` | `serviceCarousel:amblastSwiperServices` | SIAB legacy tenant snapshot | Adapted-exact-style, needs browser comparison | Renderer/runtime-schema supported; not CMS editable/importer-supported |
| `cta` | `cta:quote`; `cta:tailblocksCtaA` | SIAB local/generic; Tailblocks | SIAB exact-source; Tailblocks reviewed adapted-exact-style | CMS editable and generation/import supported |
| `richText` | `richText:prose`; `richText:tailblocksContentA` | SIAB local/generic; Tailblocks | SIAB exact-source; Tailblocks reviewed adapted-exact-style | CMS editable and generation/import supported |
| `contactSection` | `contactSection:form`; `contactSection:tailwindPlusNewsletterDetails`; `contactSection:hyperUiNewsletterCentered`; `contactSection:prelineCenteredNewsletter` | SIAB local/generic; Tailwind Plus free/public; HyperUI; Preline free | SIAB exact-source; external variants reviewed adapted-exact-style | CMS editable and generation/import supported |
| `faq` | `faq:accordion`; `faq:mambaFaq1` | SIAB local/generic; Mamba UI | SIAB exact-source; Mamba reviewed adapted-exact-style | CMS editable and generation/import supported |
| `testimonials` | `testimonials:cards`; `testimonials:mambaTestimonial1` | SIAB local/generic; Mamba UI | SIAB exact-source; Mamba reviewed adapted-exact-style | CMS editable and generation/import supported |
| `beforeAfterGallery` | `beforeAfterGallery:amblastPortfolio` | SIAB legacy tenant snapshot | Adapted-exact-style, needs browser comparison | Renderer/runtime-schema supported; not CMS editable/importer-supported |
| `contactDetails` | `contactDetails:amblastContactCards` | SIAB legacy tenant snapshot | Adapted-exact-style, needs browser comparison | Renderer/runtime-schema supported; not CMS editable/importer-supported |

## Styling-Origin Breakdown

- Tailwind Plus free/operator-approved: 3 implemented variants. Tailwind Plus
  remains mixed availability; only the three cataloged public/free variants are
  currently usable. Locked or paid siblings are not usable.
- Tailblocks: 2 implemented variants from public MIT GitHub source.
- Mamba UI: 2 implemented variants from public MIT GitHub source.
- HyperUI: 1 implemented variant from public MIT component page/copy source.
- Preline-free: 1 implemented variant. Preline remains mixed Free/Pro; only the
  cataloged free public variant is usable.
- SIAB legacy tenant snapshots: 5 renderer-supported parity variants for
  Amblast migration coverage. These are canonical parity references, not broad
  self-serve generation variants.
- SIAB local/generic variants: 7 canonical variants used as SIAB-owned renderer
  defaults.
- TailGrids is explicitly unavailable for SIAB generated-site catalogs because
  its license disallows website builder/UI generator use.

`SITE_SOURCE_BACKED_BLOCK_VARIANTS` exports only external, free-public,
license-compatible, renderer-supported, reviewed variants with stable
`sectionVariant` and `cms-block--source-*` classes. It intentionally excludes
SIAB-owned local/generic variants and legacy parity variants.

## Support Matrix

- Renderer support: all 12 generation block families are registered in
  `packages/site-renderer/src/blocks/index.tsx`; header/footer chrome is in
  `packages/site-renderer/src/chrome.tsx`; analytics attrs are in
  `packages/site-renderer/src/analytics.ts`.
- Runtime validation support: all 12 block families have schemas in
  `packages/contracts/src/runtime.ts`; unsupported raw HTML/classes/source fields
  are rejected for generated blocks.
- CMS page-block support: Payload `Pages` and `apps/cms/src/blocks/registry.ts`
  expose only the canonical 7 block families: `hero`, `featureList`,
  `testimonials`, `faq`, `cta`, `richText`, and `contactSection`.
- Generation/import support: `validateSiteGenerationSpecForCms()` gates page
  blocks to `SITE_BLOCK_SLUGS`, so parity blocks are not accepted by the normal
  CMS apply path.
- AI model input support: generation model input receives only
  `SITE_SOURCE_BACKED_BLOCK_VARIANTS`, currently the 9 external source-backed
  canonical variants.
- Preview/customizer support: `PreviewCustomizer` uses shared
  `SitePageRenderer` directly and therefore can render any page data that reaches
  the renderer path, including published parity snapshots.

## Gaps Before Broad Generation

- Catalog breadth is not yet broad enough for unrestricted marketing-site
  generation. Deferred V1 marketing needs remain: pricing, stats, logo cloud,
  gallery, team, blog cards, process steps, and comparison.
- Headers/navs and footers are runtime chrome helpers, not cataloged editable
  block families with multiple source-backed variants.
- Legacy parity blocks need browser comparison before claiming visual parity
  against Amblast/Amicare. Their provenance remains `needs-browser-comparison`
  and they must stay out of `SITE_SOURCE_BACKED_BLOCK_VARIANTS`.
- Parity blocks are not CMS editable/importer-supported. They are supported for
  shared renderer/runtime-schema and staging snapshot parity, not normal
  self-serve generation.
- Contact form provider behavior is structured and rendered, but production form
  submission still needs the approved secret-safe provider/server integration
  before final generated-site production use.
- Tailwind Plus source availability is mixed and may change. Only variants
  already represented in the catalog count as implemented; future Tailwind Plus
  additions need fresh free/public verification or an approved local archive.
- There is no automated screenshot-diff/source-archive harness for external
  visual exactness. Current external variants are recorded as
  `adapted-exact-style`, not literal upstream code copies.

## Audit Sources

Primary code/docs inspected for this audit:

- `packages/contracts/src/block-catalog.ts`
- `packages/contracts/src/site.ts`
- `packages/contracts/src/runtime.ts`
- `packages/site-renderer/src/blocks/*`
- `packages/site-renderer/src/chrome.tsx`
- `packages/site-renderer/src/SitePageRenderer.tsx`
- `packages/site-renderer/src/analytics.ts`
- `apps/cms/src/collections/Pages.ts`
- `apps/cms/src/blocks/registry.ts`
- `apps/cms/src/components/preview/PreviewCustomizer.tsx`
- `apps/cms/src/lib/site-generation/applySiteGenerationSpec.ts`
- `apps/cms/src/lib/ai-generation/siteGenerationInput.ts`
- `docs/architecture/block-source-catalog.md`
- `docs/architecture/phase-2-contract-catalog-design.md`
- `apps/cms/tests/unit/blockCatalog.test.ts`
- `apps/cms/tests/unit/siteGenerationCatalogGovernance.test.ts`
