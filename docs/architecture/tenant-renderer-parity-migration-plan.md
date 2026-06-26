# Tenant Renderer Parity Migration Plan

Date: 2026-06-26

This document is the Phase 1 parity baseline for moving the existing Amicare
and Amblast tenant sites from legacy tenant source snapshots to the generic
renderer. It is a planning artifact only. Renderer contracts, catalog entries,
fixtures, CMS data, deployment files, and VPS environment files are not changed
by this phase.

## Architecture Guardrails

- The generic renderer must consume validated tenant, site, page, theme, media,
  SEO, analytics, and block data.
- New tenant-specific source folders, GitHub workflows, Docker images, or
  generated React/Astro components are out of scope and must not be introduced.
- Reusable code may be moved only into shared packages such as
  `packages/site-renderer`, `packages/contracts`, or `packages/ui` after the
  required block/catalog contracts are approved.
- Existing legacy sites under `sites/ami-care` and `sites/amblast` remain the
  visual/functionality source of truth and rollback reference until cutover.

## Phase Sequence

Each phase runs sequentially with one medium-effort subagent assigned to that
phase. Every phase has three required subphases:

1. Research: inspect current code, data, assets, and legacy behavior before
   changing anything.
2. Implement: make the smallest scoped change needed for the phase.
3. Review/test: verify the phase output, document remaining gaps, and hand it
   back for architect review before the next phase starts.

The main architect process owns phase acceptance, cross-phase consistency, and
final review. Subagents do not make independent architecture changes outside
their phase scope.

1. Phase 1 - Baseline and Plan: inventory legacy pages, chrome, assets,
   interactions, SEO, analytics, and current renderer fixtures. Produce this
   authoritative parity plan.
2. Phase 2 - Contract and Catalog Design: add approved structured block types
   or variants for the missing primitives, update runtime validation, and update
   the block source catalog with provenance and license status.
3. Phase 3 - Shared Renderer Implementation: implement missing primitives in
   `packages/site-renderer` and shared UI only, with generic props and no
   tenant-specific branches.
4. Phase 4 - Renderer App Wiring: wire `apps/renderer` to the approved shared
   chrome, catalog, block registry, and client behavior without tenant-specific
   branches.
5. Phase 5 - Tenant Snapshot/Data Migration: encode Amicare and Amblast as
   published snapshot data using approved contracts, including all required
   media references and chrome settings.
6. Phase 6 - Parity QA: compare legacy and renderer outputs at desktop, tablet,
   and mobile widths for layout, content, SEO, forms, interactions, and
   analytics/cookie behavior.
7. Phase 7 - Cutover Readiness Review: confirm whether parity QA is sufficient
   for a production route switch, document rollback commands, and keep legacy
   containers available until explicit operator approval.
8. Phase 8 - Block Catalog Completeness and Styling-Origin Audit: inventory the
   full generation catalog by block family, count usable variants, record styling
   origins, exactness status, contract/render/preview support, provenance, and
   remaining gaps before broad self-serve generation is enabled.

## Current Renderer Baseline

- `apps/renderer` resolves host and path to a CMS published snapshot endpoint,
  with local fixture mode for development.
- `packages/site-renderer` supports `hero`, `featureList`, `testimonials`,
  `faq`, `cta`, `richText`, and `contactSection`.
- `packages/contracts/src/fixtures/tenants.ts` already contains Amicare and
  Amblast `SiteGenerationSpec` and `PublishedSiteSnapshot` fixtures.
- Current fixtures are content-oriented and generic. They do not yet preserve
  all visual chrome, section variants, interaction behavior, or legacy media
  composition.

## Amicare Inventory

Source reference: `sites/ami-care`.

| Surface | Legacy baseline | Current renderer-compatible state | Delta |
| --- | --- | --- | --- |
| Pages | Home only, loaded from `CMS_DATA_DIR/pages/index.json`; 404, preview, health, media, robots helpers exist. | Fixture has one home page with hero, feature list, rich text, and CTA. | Need real published CMS snapshot baseline rather than placeholder fixture copy if current tenant data differs. |
| Header | Sticky React nav with logo/brand, section anchors, active section indicator, mobile menu animation. | Generic `SitePageRenderer` accepts optional header/footer but `apps/renderer` does not pass tenant chrome. | Need shared renderer chrome or app-level generic chrome that consumes `SiteSettings.navHeader`, logo, and active anchor behavior. |
| Footer | Data-driven columns, brand/logo, contact, business info, navigation, copyright. | `SiteSettings.chrome.footer` exists in contracts; generic renderer currently omits footer. | Need generic footer renderer using the existing contract shape. |
| Blocks | Hero, FeatureList, RichText, CTA, FAQ, Testimonials, ContactSection components exist under `sites/ami-care/src/components/cms`. | Same canonical block types exist in `packages/site-renderer`. | Need browser parity check against legacy Amicare styles, especially image treatment, spacing, typography, and analytics attrs. |
| Assets | `src/assets/bedroom.jpg`, `src/assets/toys.jpg`, favicon, OG, manifest icons. | Fixture references bedroom and toys. | Need confirm final media filenames/paths in CMS published snapshot and include logo/favicon if present. |
| Forms | ContactSection posts to `/api/forms`, tracks analytics attributes. | Generic block supports fields and `formAction` option. | Need approved production form action for renderer and smoke for validation/submission behavior. |
| SEO/JSON-LD | SEO component, Organization JSON-LD, LocalBusiness JSON-LD, sitemap link, manifest. | Renderer emits title, description, canonical, OG/Twitter metadata only. | Need generic JSON-LD for organization/local business, favicon/manifest links, robots/sitemap behavior. |
| Analytics/Cookies | PostHog-compatible runtime with consent banner and section/action/form tracking. | `packages/site-renderer` has analytics attributes; `apps/renderer` does not load consent/runtime. | Need shared consent/runtime integration gated by snapshot analytics settings. |
| Security/preview | Legacy middleware has CSP, no-store dynamic routes, preview frame allowances. | Renderer route has minimal page shell. | Need renderer-level security headers reviewed separately before production cutover. |

## Amblast Inventory

Source reference: `sites/amblast`.

| Surface | Legacy baseline | Current renderer-compatible state | Delta |
| --- | --- | --- | --- |
| Pages | Home, Over ons, Diensten, Portfolio, Contact, 404, robots. | Fixture has the five main pages. | Page count is covered, but several sections are flattened or summarized. |
| Header | Elementor/HFE-style header with large logo, horizontal menu, current-page classes, mobile toggle, contact button with envelope icon. | Fixture settings include nav and logo; renderer currently omits header. | Need generic chrome renderer with page-aware active nav and optional action button. |
| Footer | Four-column footer: logo/tagline, menu, contact, legal info, copyright row, privacy link. | Fixture footer has only contact/info/navigation columns and generic footer shape. | Need footer composition support for brand column, legal text, menu, privacy link, and copyright row parity. |
| Home | Shaped hero with background image/overlay, reveal animations, CTA, contact info icon boxes, service carousel, content sections, CTA/contact form. | Fixture has hero, feature list, rich text, CTA, contactSection. | Missing shape dividers, overlay positioning, info icon row, carousel behavior, and exact service-card assets. |
| Over ons | Hero, narrative sections, values/service cards, CTA/contact form. | Fixture has hero, rich text, featureList, contactSection. | Need exact section ordering, imagery, icon cards, and spacing. |
| Diensten | Hero, detailed services/cards, CTA/contact form. | Fixture has hero, featureList, CTA, contactSection. | Need service card primitive with image icons and optional carousel/grid variants. |
| Portfolio | Hero, intro, two before/after image comparison sliders, CTA/contact form. | Fixture stores comparison image paths in rich text. | Need structured before/after comparison block with drag handle, labels, and media refs. |
| Contact | Hero, contact details column, form column. | Fixture has hero, richText, contactSection. | Need contact details primitive or richer contact section layout, and reconcile address conflict. |
| Assets | Logo, favicon/icons, OG, six hero images with AVIF/WebP/JPG variants, service-card icons, info icons, portfolio images, Font Awesome webfonts. | Fixture references logo, OG, three hero images. | Need full media manifest for all used hero variants, service icons, info icons, and portfolio pairs. |
| Interactions | Reveal-on-scroll, Swiper service carousel, before/after pointer drag, mobile menu toggle, Web3Forms submit/fallback. | Renderer has no client runtime for these Amblast-specific interactions. | Need shared, generic interaction modules bound to structured block props. |
| SEO/JSON-LD | SEO, Organization JSON-LD, LocalBusiness JSON-LD, favicons, manifest, preload for hero images. | Renderer emits only base SEO/OG/Twitter metadata. | Need JSON-LD, favicon/manifest, preload/media priority, and per-page canonical parity. |
| Analytics/Cookies | No explicit cookie banner found in Amblast source; no PostHog runtime found. | Renderer analytics should be data-gated. | Do not add analytics/cookie UI unless tenant data requires it. |

## Required Custom Block/Catalog Primitives

These must be approved as structured contracts before renderer work starts.

| Primitive | Tenants | Purpose | Data requirements | Reusable source/reference |
| --- | --- | --- | --- | --- |
| `siteChrome` or generic header/footer renderers | Amicare, Amblast | Render tenant header/footer from `SiteSettings` rather than page blocks. | Logo/favicons, nav links, active path/anchor mode, optional header CTA, footer columns/items, copyright, legal/privacy links. | `sites/ami-care/src/components/Nav.tsx`, `sites/ami-care/src/components/Footer.astro`, `sites/amblast/src/components/layout/Header.astro`, `sites/amblast/src/components/layout/Footer.astro`. |
| `mediaHero` variant | Amblast | Shaped/overlay hero with background image, optional dividers, CTA, and page title modes. | Background media, overlay color/opacity, divider style ids, min height, content column alignment, CTA. | Amblast page hero markup and `sites/amblast/src/styles/amb-base.css`. |
| `infoCardList` | Amblast | Icon/text boxes for hours, phone/email, location, service facts, and contact cards. | Items with image/icon media, title, rich text, link/action, alignment, animation style. | Amblast image-box/info-box markup and icon assets. |
| `serviceCarousel` / service card variant | Amblast | Swiper-like service carousel on home and card/grid services on Diensten. | Items with image media, title, rich text bullet paragraphs, CTA, layout mode, autoplay/pagination settings. | Amblast carousel DOM and `sites/amblast/src/scripts/site.client.ts`. |
| `beforeAfterGallery` | Amblast | Portfolio before/after comparisons with draggable handle and labels. | Pairs of before/after media refs, labels, initial ratio, orientation, optional captions. | Amblast portfolio markup and `initImageComparison`. |
| `contactDetails` or contact-section layout variants | Amblast | Structured contact/legal data alongside forms. | Address, email, phone, KVK, BTW, IBAN, BIC, hours, display address source. | Amblast contact page and footer legal config. |
| `formProvider` adapter fields | Amicare, Amblast | Preserve form submission behavior without tenant source. | Provider id, endpoint/action, hidden fields, honeypot, fallback mailto, field names, consent/analytics flags. | Amicare ContactSection, Amblast Web3Forms forms. |
| `analyticsConsent` runtime | Amicare | Shared cookie consent and analytics capture when enabled by tenant data. | Provider config, consent storage key/version, event flags, section/action/form attributes. | `sites/ami-care/src/lib/analytics/runtime.ts` and `CookieConsent.astro`. |
| `seoJsonLd` | Amicare, Amblast | Organization/LocalBusiness structured data. | NAP, hours, service area, social links, canonical URL, logo. | Tenant `JsonLdOrganization.astro` and `JsonLdLocalBusiness.astro` components. |

## Required Assets

Amicare required assets:

- `sites/ami-care/src/assets/bedroom.jpg`
- `sites/ami-care/src/assets/toys.jpg`
- `sites/ami-care/public/favicon.svg`
- `sites/ami-care/public/favicon.ico`
- `sites/ami-care/public/apple-touch-icon.png`
- `sites/ami-care/public/manifest.json`
- `sites/ami-care/public/og-default.png`

Amblast required assets:

- Logo/favicons: `public/logo.png`, `public/uploads/logo/cropped-AMBlast_logo.png`,
  `cropped-AMBlast_logo-300x75.png`, `AMBlast_favicon.png`, `favicon.ico`,
  `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`,
  `manifest.json`, `og-default.png`.
- Hero media: all files under `public/uploads/hero/`, including AVIF, WebP,
  JPG, and `-768` variants used for preload/responsive parity.
- Service cards: all files under `public/uploads/service-cards/`.
- Info icons: all files under `public/uploads/icons/`.
- Portfolio pairs: `1-olie-scaled.jpg`, `2-olie-scaled.jpg`,
  `IMG_20210402_144215-scaled.jpg`, `IMG_20210402_151225-scaled.jpg`, and
  all referenced `IMG_20210723_083536-*` variants if the final gallery uses
  them.
- Font Awesome webfonts are legacy implementation detail. Prefer lucide/shared
  icon equivalents unless exact Font Awesome icons are required for Amblast
  visual parity and licensing is accepted.

## Required Interactions

- Amicare sticky/mobile nav with active section tracking.
- Amicare analytics consent banner, preferences button, consent grant/revoke,
  section views, action clicks, and form started/submitted events when analytics
  config is present.
- Amicare and Amblast contact form submission with validation, correct hidden
  metadata, honeypot behavior, and fallback behavior when provider config is
  missing.
- Amblast mobile menu open/close and close-on-link-click.
- Amblast reveal-on-scroll behavior for sections that start hidden in the
  legacy source.
- Amblast service carousel autoplay, pagination, responsive slide count, and
  graceful no-JS fallback.
- Amblast before/after comparison drag, keyboard-accessible handle fallback,
  initial 50 percent ratio, "Voor" and "Na" labels, and responsive image sizing.

## Data Issues To Resolve

- Amblast address conflict: `src/content/site.ts` lists `Heinsbergerweg 172,
  6045 CK Roermond`; the contact page prints `Stationspark 189, 6042 AX
  Roermond`. Phase 4 must choose the business source of truth and document the
  decision in tenant data.
- Amblast current fixtures include only a subset of referenced assets. Phase 4
  must include every asset required by the approved blocks.
- Amicare fixture content may be placeholder-like compared with the live
  `CMS_DATA_DIR` content. Phase 4 must export the active CMS tenant snapshot and
  compare it against the legacy renderer.
- Renderer SEO currently omits JSON-LD and selected chrome metadata. Phase 2/3
  must decide whether those are app shell features or shared renderer features.

## Acceptance Criteria

- No new tenant source folders, tenant-specific renderer branches, tenant
  workflows, tenant Docker images, or generated component source are created.
- Both tenants render from validated `PublishedSiteSnapshot` data.
- All pages in the parity matrix return 200 on staging hosts; unknown paths
  return 404 with no fixture fallback in production mode.
- Header, footer, page content, CTA links, forms, SEO metadata, JSON-LD, and
  media assets match the legacy baseline within agreed visual tolerance.
- Amblast portfolio before/after controls and service carousel work without
  console errors and degrade to readable static content without JavaScript.
- Amicare analytics and cookie consent appear only when tenant analytics data is
  configured; Amblast does not gain analytics/cookie behavior unless configured.
- Forms submit to approved provider endpoints or show the approved fallback;
  secrets remain outside the repo.
- Lighthouse/accessibility smoke does not regress relative to legacy baselines
  for the staging proof URLs.
- A final block catalog audit lists headers/navs, heroes, feature/service
  sections, CTAs, testimonials, FAQ, rich text, contact sections,
  portfolio/comparison sections, footers, forms, runtime helpers, and
  tenant-parity blocks with per-family counts, styling origins, exactness
  status, CMS support, renderer support, preview support, and license notes.

## Tests And Smoke Gates

- Contract validation: run the relevant package checks after contract changes,
  including published snapshot schema validation for both tenants.
- Renderer unit/component checks: block render snapshots for every new primitive
  and variant, including empty/invalid optional fields.
- Visual regression: Playwright screenshots for legacy vs renderer at 390, 768,
  1024, and 1440 pixel widths for every page in the parity matrix.
- Interaction smoke: mobile nav, carousel pagination/autoplay pause behavior,
  before/after dragging, form required fields, form submit/fallback, and cookie
  consent for Amicare.
- SEO smoke: title, description, canonical, OG/Twitter image, favicon/manifest,
  Organization JSON-LD, LocalBusiness JSON-LD, robots, sitemap, and noindex
  behavior.
- Asset smoke: every media ref in the active snapshot returns 200 and has the
  expected content type and dimensions where known.
- Production-readiness smoke: renderer in production mode requires CMS URL and
  token, never serves fixture data, and uses the observed host for snapshot
  lookup.

## Review Verdict

This plan is data-driven and compatible with the approved SIAB architecture. It
does not propose generated tenant source or tenant-specific deploy artifacts.
The main parity gaps are Amblast visual/interactive primitives, shared
header/footer chrome, JSON-LD/metadata parity, complete media manifests, and
Amicare analytics/cookie runtime integration.
