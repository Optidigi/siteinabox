# Block Source Catalog

Generated public sites render structured CMS data through the shared
`@siteinabox/site-renderer` React renderers. Provider-backed page sections now
enter self-serve generation only through executable source-block definitions
under `packages/site-renderer/src/source-blocks`. Provider-backed chrome and
system fallbacks use adjacent executable registries under
`packages/site-renderer/src/source-chrome` and
`packages/site-renderer/src/source-templates`.

The active V1 provider runtime is intentionally narrow:

- active provider: Tailwind Plus Marketing;
- active page sections:
  - `tailwindplus.marketing.hero.simple-centered`;
  - `tailwindplus.marketing.feature.with-product-screenshot`;
  - `tailwindplus.marketing.feature.centered-2x2-grid`;
  - `tailwindplus.marketing.cta.dark-panel-with-app-screenshot`;
  - `tailwindplus.marketing.contact.centered`;
  - `tailwindplus.marketing.testimonial.simple-centered`;
  - `tailwindplus.marketing.stats.simple`;
  - `tailwindplus.marketing.logo-cloud.simple-with-heading`;
  - `tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier`;
  - `tailwindplus.marketing.team.with-small-images`;
  - `tailwindplus.marketing.newsletter.side-by-side-with-details`;
  - `tailwindplus.marketing.bento.three-column-bento-grid`;
  - `tailwindplus.marketing.content.sticky-product-screenshot`;
  - `tailwindplus.marketing.blog.three-column`;
  - `tailwindplus.marketing.hero.with-stats`;
- preferred generated `designVariant` values are the canonical provider IDs
  above;
- persisted legacy designVariant aliases remain accepted for existing content:
  - `tailwindPlusSimpleCentered`;
  - `tailwindPlusWithProductScreenshot`;
  - `tailwindPlusCentered2x2`;
  - `tailwindPlusDarkPanelWithAppScreenshot`;
  - `tailwindPlusCentered`;
  - `tailwindPlusSimple`;
  - `tailwindPlusSimpleWithHeading`;
  - `tailwindPlusSimpleTiers`;
  - `tailwindPlusGrid`;
  - `tailwindPlusNewsletterSideBySideWithDetails`;
  - `tailwindPlusThreeColumnBentoGrid`;
  - `tailwindPlusContentStickyProductScreenshot`;
  - `tailwindPlusThreeColumn`;
  - `tailwindPlusHeroWithStats`;
- active CMS page block slugs for self-serve provider generation: `hero`,
  `featureList`, `cta`, `contactSection`, `testimonials`, `stats`,
  `logoCloud`, `pricing`, `team`, `newsletter`, `contentSection`, and
  `bentoGrid`, and `blogCards`;
- active header chrome:
  `tailwindplus.marketing.header.with-stacked-flyout-menu`;
- active banner chrome:
  `tailwindplus.marketing.banner.with-button`;
- active system fallback:
  `tailwindplus.marketing.feedback.404-simple` for known-host missing pages.

Current verification status:

- Runtime/unit provider coverage passed for the active block/chrome/template
  registries: source hashes, upstream class coverage, fail-closed behavior,
  catalog lockstep, inactive slot validation, CSS isolation, generation scope,
  and intake mock generation all passed in the focused CMS unit suite.
- The provider visual parity gate is `pnpm provider:visual-parity`. It must pass
  without source fixture mutation for active exact variants. The
  active hero with-stats and sticky content variants now represent their
  source-visible content slots directly instead of stripping fixture content.
- The generic intake smoke fixture exercises the broad homepage set plus active
  Tailwind Plus header and banner chrome, but it does not exercise
  `tailwindplus.marketing.hero.with-stats` or the known-tenant 404 template.
  Treat it as broad smoke coverage, not complete provider inventory coverage.

Historical adapted Tailwind Plus variants, Preline, Tailblocks, SIAB-owned
generic visual variants, and locked provider examples remain inactive for
self-serve generation.

Mock/self-serve fixture generation defaults global header chrome to
`tailwindplus.marketing.header.with-stacked-flyout-menu` and emits the active
homepage-suitable Tailwind Plus page-section set, including pricing, team,
blog/cards, newsletter, and content section. The mock fixture also uses the
active Tailwind Plus bento grid and banner chrome. Footer chrome remains on the
SiaB `default` variant until a source-visible provider-backed footer
implementation is active.

## Canonical Generated Block Path

- `packages/contracts/src/site.ts` owns generated page block slugs and data
  shapes.
- `packages/contracts/src/generation.ts` owns AI/site-generation input
  contracts.
- `packages/contracts/src/runtime.ts` owns runtime validation contracts.
- `packages/contracts/src/block-catalog.ts` owns approved design variants,
  provider provenance, source-family metadata, and CMS editable-field mappings.
- `packages/site-renderer/src/source-blocks` owns executable provider-block
  definitions, exact-source fixtures, source metadata/hashes, typed slot
  manifests, renderer lookup, and fail-closed provider validation.
- `packages/site-renderer/src/source-chrome` owns executable provider chrome
  definitions, local fixtures/hashes, chrome slot manifests, and fail-closed
  chrome lookup.
- `packages/site-renderer/src/source-templates` owns executable provider system
  templates such as the default known-tenant 404 fallback.
- `apps/cms/src/blocks/registry.ts` maps canonical block slugs to Payload CMS
  schemas.
- `packages/site-renderer/src/blocks/index.tsx` maps the same slugs to typed
  public/preview React renderers.
- `apps/cms/src/components/editor/canvas/CanvasBlockRenderer.tsx` maps the same
  data to editable canvas renderers and editing affordances.

New AI-generation provider blocks are available only after the executable
definition, local source fixture, source metadata/hash, slot manifest, CMS
schema/sidebar fields, shared renderer, canvas behavior, publish validation,
and tests are in place. A block that cannot be edited through both the sidebar
and the canvas is not generation-eligible.

## Provenance vs Runtime

`SITE_SOURCE_BACKED_BLOCK_VARIANTS` is a compact provenance catalog for
renderer-ready page-block variants. It still contains some historical provider
metadata, but activation truth for provider-backed page blocks comes from
executable definitions in `@siteinabox/site-renderer/source-blocks`. Chrome
activation is checked against `@siteinabox/site-renderer/source-chrome`.
Contracts can expose only the subset that is backed by those definitions.

A new provider variant can enter active self-serve generation only after it has:

- structured CMS/editable fields;
- an exact-source renderer with literal provider classes;
- local React and/or HTML source fixtures;
- source URL/upstream ID/path metadata and a source hash;
- a typed slot manifest with required/optional/inactive slot status;
- license and approval metadata;
- theme token policy;
- validation in generation import, page save, and publish;
- focused registry, validation, source-fixture/hash, root-marker, CSS-isolation,
  and fail-closed tests.

The catalog may store provider URLs, upstream IDs, public source paths, runtime
requirements, and review notes. Tailwind Plus active blocks keep exact local
TSX/HTML fixtures that can be tested against the approved source; adapted
renderer-owned approximations are not acceptable for self-serve provider blocks.

`SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS` is narrower than any historical
provenance catalog. It currently exposes only active executable provider
definitions. The projection keeps the catalog id and legacy alias, but its
preferred `designVariant` is the canonical provider id:

- `hero:tailwindPlusSimpleCentered` ->
  `tailwindplus.marketing.hero.simple-centered`;
- `featureList:tailwindPlusWithProductScreenshot` ->
  `tailwindplus.marketing.feature.with-product-screenshot`;
- `featureList:tailwindPlusCentered2x2` ->
  `tailwindplus.marketing.feature.centered-2x2-grid`;
- `cta:tailwindPlusDarkPanelWithAppScreenshot` ->
  `tailwindplus.marketing.cta.dark-panel-with-app-screenshot`;
- `contactSection:tailwindPlusCentered` ->
  `tailwindplus.marketing.contact.centered`;
- `testimonials:tailwindPlusSimpleCentered` ->
  `tailwindplus.marketing.testimonial.simple-centered`;
- `stats:tailwindPlusSimple` ->
  `tailwindplus.marketing.stats.simple`;
- `logoCloud:tailwindPlusSimpleWithHeading` ->
  `tailwindplus.marketing.logo-cloud.simple-with-heading`.
- `pricing:tailwindPlusSimpleTiers` ->
  `tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier`.
- `team:tailwindPlusGrid` ->
  `tailwindplus.marketing.team.with-small-images`.
- `newsletter:tailwindPlusNewsletterSideBySideWithDetails` ->
  `tailwindplus.marketing.newsletter.side-by-side-with-details`.
- `bentoGrid:tailwindPlusThreeColumnBentoGrid` ->
  `tailwindplus.marketing.bento.three-column-bento-grid`.
- `contentSection:tailwindPlusContentStickyProductScreenshot` ->
  `tailwindplus.marketing.content.sticky-product-screenshot`.
- `blogCards:tailwindPlusThreeColumn` ->
  `tailwindplus.marketing.blog.three-column`.
- `hero:tailwindPlusHeroWithStats` ->
  `tailwindplus.marketing.hero.with-stats`.

Inactive provider families are removed from the active app/codebase architecture,
not backlog-only providers. They must not appear in generic self-serve
generation, schema enums, AI inputs, mock generation, normal pickers, chrome
choices, renderer fixtures, or active runtime registries. SIAB-owned generic
visual variants are also not generation inputs.

Ami-care remains temporary official-tenant compatibility and is only valid on
official Ami-care preview/canvas/live tenant-renderer paths. It is unavailable to
generation, generic tenant validation, normal pickers, and AI model inputs.

## Runtime Route

Approved provider renderer variants preserve provider-owned DOM, layout,
responsive behavior, and literal Tailwind classes. SiaB fills only approved CMS
content slots. AI and CMS data never supply arbitrary class strings, raw
provider HTML, component source, imports, CSS, layout instructions, or
executable code.

AI output is structured CMS data only. For visual selection it sets the
block-level approved canonical provider `designVariant` for the chosen block
type and fills the slot fields exposed by the active manifest. Legacy aliases
continue to resolve for saved/imported pages but are not the preferred generated
shape. Analytics metadata is not a styling API.

Blocks must not expose arbitrary block-level visual tokens such as per-block
colors, fonts, radii, shape controls, class names, or provider token overrides.
Site-wide visual control belongs to ThemeTokenSpec V2: appearance mode,
approved color schemes, approved font schemes, approved density schemes, and
approved shape/radius schemes. Missing theme data resolves to the product
default preset set: `blue-professional` colors, `clear-modern` fonts,
`comfortable` density, `soft` shape, and light mode. Product presets theme the
same renderer through CSS variables only; source/default parity checks verify
renderer fidelity separately from user-facing tokenized output.

Provider utility classes stay static and detectable. The Tailwind Plus bridge
maps neutral and accent utility shades deliberately (`gray-50` through
`gray-950`, `indigo-50` through `indigo-950`) instead of collapsing shades into
one muted token. Provider roots use stable theme zones:
`data-theme-zone="ambient"` for normal themeable sections and
`data-theme-zone="fixed-dark"` for source dark panels that must remain
coherent. Density is limited to provider section vertical padding in V1. Shape is a
full Tailwind-like radius scale. The theme system does not expose arbitrary
spacing, breakpoint, grid/flex, CSS, classes, or per-block layout controls.

The public renderer uses `apps/renderer/src/styles/site.css` with Tailwind v4,
the `@tailwindcss/forms` plugin, and `@source` coverage for
`packages/site-renderer/src`. CMS preview/customizer uses the CMS generated-site
renderer stylesheet for matching renderer coverage.

Provider block roots are marked with `data-provider-block="tailwindplus"`,
`data-provider-variant="<canonical-provider-id>"`,
`data-source-backed-block="true"`, and the existing `data-source-variant`.
Projected block analytics also carries the selected `designVariant` as
`providerVariant`, emitted as `data-siab-provider-variant` and PostHog capture
attributes for provider-variant performance analysis.
Generic non-tenant `.cms-block` renderer CSS must be scoped to
`.cms-block:not([data-provider-block])` and descendant selectors must originate
from that filtered root. Provider isolation is an exclusion policy, not a
provider-specific CSS override layer.

Provider chrome roots use equivalent chrome markers:
`data-provider-chrome="tailwindplus"`, `data-provider-variant`,
`data-source-backed-chrome="true"`, and `data-source-variant`. Generic
`.site-chrome` CSS excludes `[data-provider-chrome]`.

Provider system-template roots use `data-provider-template="tailwindplus"`,
`data-provider-variant`, `data-system-template`,
`data-system-template-kind`, `data-source-backed-template="true"`, and
`data-source-variant`. The platform fallback keeps its own
`.renderer-not-found` markup and does not style provider template roots.

Current active runtime families and blocks:

- `tailwindplus.marketing.hero.simple-centered`, with legacy
  `tailwindPlusSimpleCentered` hero aliases still accepted. The active slots are `headline`
  required and `eyebrow`, `subheadline`, `cta`, and `secondary` optional.
  Upstream `image` and `pills` are recorded as inactive for this exact variant
  and are rejected if generated or saved with values.
- `tailwindplus.marketing.feature.with-product-screenshot`, with legacy
  `tailwindPlusWithProductScreenshot` aliases still accepted. The active slots are
  `title` and exactly three `features` with required title/description;
  `eyebrow`, `intro`, `feature.icon`, and `image` are editable optional slots.
  The image slot is optional because self-serve intake skips remote generated
  media ingestion; the renderer has the upstream screenshot fallback.
- `tailwindplus.marketing.feature.centered-2x2-grid`, with legacy
  `tailwindPlusCentered2x2` aliases still accepted. The active slots are `title`,
  optional `eyebrow`, optional `intro`, and exactly four feature items with
  required title/description. `image` is inactive for this exact variant.
- `tailwindplus.marketing.cta.dark-panel-with-app-screenshot`, with legacy
  `tailwindPlusDarkPanelWithAppScreenshot` aliases still accepted. `headline` is required;
  `description`, `primary`, `secondary`, and `backgroundImage` are optional.
  `eyebrow` is inactive.
- `tailwindplus.marketing.contact.centered`, with legacy
  `tailwindPlusCentered` aliases still accepted. `title`, `formName`,
  `submitLabel`, and exactly six source-role form fields are required:
  `first-name`, `last-name`, `company`, `email`, `phone-number`, and `message`.
  Field labels, required flags, placeholders, and select/checkbox options remain
  CMS data; layout and field order remain renderer-owned.
- `tailwindplus.marketing.testimonial.simple-centered`, with legacy
  `tailwindPlusSimpleCentered` testimonial aliases still accepted. It renders exactly one
  testimonial item with required quote, author, and role. Logo and avatar media
  are optional editable slots because self-serve intake does not require remote
  generated media ingestion.
- `tailwindplus.marketing.stats.simple`, with legacy
  `tailwindPlusSimple` aliases still accepted. The active slot is exactly three `items`,
  each with editable `value` and `label`. Section `title`, `intro`, and item
  `description` are inactive for this exact variant and are rejected if
  generated or saved with values.
- `tailwindplus.marketing.logo-cloud.simple-with-heading`, with legacy
  `tailwindPlusSimpleWithHeading` aliases still accepted. It renders exactly five logo
  items; `title`, logo names, and optional hrefs are structured CMS data, and
  logo image media is optional/editable for self-serve drafts that skip remote
  media ingestion. `intro` is inactive.
- `tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier`, with
  legacy `tailwindPlusSimpleTiers` aliases still accepted. It renders exactly
  two pricing plans, with the right-hand tier emphasized by the provider source
  layout. `eyebrow`, `title`, `intro`, plan titles, descriptions, prices,
  periods, CTAs, highlight flags, and feature labels are structured CMS data.
  Plan badges are inactive for this exact variant and are rejected if generated
  or saved with values.
- `tailwindplus.marketing.team.with-small-images`, with legacy
  `tailwindPlusGrid` aliases still accepted. It renders two to six team
  members with required names and roles plus optional member images. Bio and
  social links remain CMS fields but are not exposed by this exact source
  variant.
- `tailwindplus.marketing.blog.three-column`, with legacy
  `tailwindPlusThreeColumn` aliases still accepted. It renders exactly three
  article cards with required titles, excerpts, and hrefs plus optional dates,
  authors, author roles, categories, and author images. Author role is a
  dedicated post field and must not be derived from category or CTA label data.
- `tailwindplus.marketing.newsletter.side-by-side-with-details`, with legacy
  `tailwindPlusNewsletterSideBySideWithDetails` aliases still accepted. It is
  a `newsletter` page section, not a contact section. It renders exactly two
  benefit items and exposes title, description, email label, placeholder,
  submit label, provider binding, and benefit title/description/icon slots.
  Consent copy is inactive for this exact source variant and is rejected if
  generated or saved with a value.
- `tailwindplus.marketing.hero.with-stats`, with legacy
  `tailwindPlusHeroWithStats` aliases still accepted. It treats Tailwind Plus
  Header Sections `With stats` as a `hero` variant. It renders headline,
  optional body, optional media, exactly four text links, and exactly four
  stats. The four-link repeater is required because the upstream layout has
  four source-visible links. `cta`, `secondary`, `eyebrow`, and `pills` are
  inactive for this exact variant.
- `tailwindplus.marketing.content.sticky-product-screenshot`, with legacy
  `tailwindPlusContentStickyProductScreenshot` aliases still accepted. It
  renders a Tailwind Plus Content Sections `With sticky product screenshot`
  layout through the `contentSection` block contract. Active slots are eyebrow,
  title, intro, body, optional screenshot media, exactly three feature rows,
  the source-visible bridge paragraph, secondary title, and secondary body. CTA
  is inactive because the provider source variant has no action.
- `tailwindplus.marketing.bento.three-column-bento-grid`, with legacy
  `tailwindPlusThreeColumnBentoGrid` aliases still accepted. It renders the
  Tailwind Plus Bento Grids `Three column bento grid` source through exactly
  four ordered `bentoGrid` items. Geometry is fixed by renderer order; generated
  data cannot set spans, placement, layout classes, or breakpoint behavior.
  Item icons and CTAs are inactive for this exact source variant.

Current active provider chrome:

- `tailwindplus.marketing.header.with-stacked-flyout-menu` renders global
  header chrome from structured site settings and `navHeader`. The upstream
  source uses Tailwind Plus Elements popover behavior; SIAB's current renderer
  is an honest structured static/closed-state chrome adaptation with CSS-only
  mobile disclosure. Full stacked-flyout interaction parity is not claimed.
- `tailwindplus.marketing.banner.with-button` renders global banner chrome from
  `SiteSettings.chrome.banner`. It is not a page block and is not exposed in
  `SITE_BLOCK_SLUGS`. `dismissible` is a boolean setting; when true the banner
  renders a local CSS-only dismiss control, and when false no dismiss affordance
  is rendered.

Amicare tenant-exclusive rendering is separate compatibility code and is not
part of self-serve provider blocks.

Provider-like designVariant values fail closed. Missing or inactive provider
variants render a controlled editor/preview error instead of falling back to a
generic SiaB block. Publishing rejects pages containing unresolved provider
variants before snapshots are created.

Optional provider slots may be empty in drafts. Canvas/editor surfaces can show
clear add-style affordances for empty optional CTAs, images, or text, but live
and customer-preview output must omit unset optional elements entirely. Required
provider slots and fixed provider repeaters remain publish-blocking when unset
or outside their manifest `minItems`/`maxItems`; public output must not invent
placeholder cards, buttons, or layout cells to compensate.

## Approval Gate

New active self-serve provider variants may include only variants whose
provenance is:

- `approvalStatus: "approved"`;
- `sourceAvailability: "free-public"`;
- `licenseCompatibility: "compatible"`;
- `sourceAccessType` in `public-page-payload`, `public-page-copy`, or
  `public-github-source`;
- `implementation: "exact-source"`;
- `visualExactnessStatus: "reviewed-exact-source"`;
- backed by a renderer class, source URL, retrieval process, verification date,
  upstream source identity, visual source notes, and runtime requirements.

Paid, locked, unavailable, license-incompatible, deferred, visually unaudited,
or raw-HTML-only variants must stay out of the exported source-backed list.
Durable automated checks for this provider path are structural and integrity
based: source fixture hashes, static upstream class coverage, provider root
markers, registry completeness, CSS isolation, fail-closed renderer behavior,
generation/schema rejection, and publish validation. Active Tailwind Plus
provider variants also have a browser screenshot parity gate:
`pnpm provider:visual-parity` builds the public renderer CSS, renders each
active source-backed block/chrome/system-template variant against its approved
source fixture at desktop and mobile widths, and fails if the pixel delta
exceeds the provider threshold or if any active provider registry entry lacks a
visual case. This gate is provider-scoped; it is not a broad page-level visual
regression suite. Exact-source variants must compare directly against the
approved source fixture without fixture-stripping masks.

## Current Tailwind Plus Inventory Notes

The July 5, 2026 inventory used the public Tailwind Plus Marketing UI Blocks
pages and treated only examples with visible `PreviewCode`/downloadable source
payloads as eligible. Application UI, Ecommerce, page examples, locked
`Get the code` examples, Preline, and Tailblocks are excluded from this
provider-backed self-serve path.

Active source-visible Marketing/Product Marketing variants after this pass:

- Hero Sections: `Simple centered` ->
  `tailwindplus.marketing.hero.simple-centered`.
- Header Sections: `With stats` ->
  `tailwindplus.marketing.hero.with-stats` as a hero variant.
- Feature Sections: `With product screenshot` ->
  `tailwindplus.marketing.feature.with-product-screenshot`.
- Feature Sections: `Centered 2x2 grid` ->
  `tailwindplus.marketing.feature.centered-2x2-grid`.
- CTA Sections: `Dark panel with app screenshot` ->
  `tailwindplus.marketing.cta.dark-panel-with-app-screenshot`.
- Pricing Sections: `Two tiers with emphasized right tier` ->
  `tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier`.
- Contact Sections: `Centered` ->
  `tailwindplus.marketing.contact.centered`.
- Testimonials: `Simple centered` ->
  `tailwindplus.marketing.testimonial.simple-centered`.
- Stats: `Simple` -> `tailwindplus.marketing.stats.simple`.
- Logo Clouds: `Simple with heading` ->
  `tailwindplus.marketing.logo-cloud.simple-with-heading`.
- Team Sections: `With small images` ->
  `tailwindplus.marketing.team.with-small-images`.
- Newsletter Sections: `Side-by-side with details` ->
  `tailwindplus.marketing.newsletter.side-by-side-with-details`.
- Bento Grids: `Three column bento grid` ->
  `tailwindplus.marketing.bento.three-column-bento-grid`.
- Content Sections: `With sticky product screenshot` ->
  `tailwindplus.marketing.content.sticky-product-screenshot`.
- Blog Sections: `Three-column` ->
  `tailwindplus.marketing.blog.three-column`.
- Marketing Headers: `With stacked flyout menu` ->
  `tailwindplus.marketing.header.with-stacked-flyout-menu`.
- Banners: `With button` ->
  `tailwindplus.marketing.banner.with-button` as banner chrome.
- Feedback/404 Pages: `Simple` ->
  `tailwindplus.marketing.feedback.404-simple`.

Next Tailwind Plus-only expansion classification:

A. Ready to add now:

- Additional variants for already-supported roles: more source-visible Tailwind
  Plus Marketing hero, feature, CTA, stats, testimonials, contact, logo-cloud,
  pricing, team, blog, newsletter, bento, content section, header, and banner
  variants that reuse the existing typed slots without new CMS fields. Each still needs
  the full exact-source fixture/hash, renderer, typed slot manifest, token
  policy, root marker, CSS isolation, generation exposure, fail-closed
  validation, and structural test gates before activation.

B. Add after small contract/editor work:

- Newsletter variants with consent text, extra fields, or list segmentation:
  useful, but require explicit form/consent editor semantics beyond the current
  side-by-side source variant.
- Additional banner variants with multiple actions, audience targeting, or
  persistence behavior: useful, but require a small `SiteSettings.chrome.banner`
  contract/editor extension before activation.

C. Deferred until separate model or source availability:

- Additional Bento Grid variants whose source geometry cannot be represented as
  fixed renderer order with strict item counts remain deferred. Generation still
  cannot supply layout spans, placement, classes, or breakpoint behavior.
- Flyout Menus `Stacked with footer actions`: deferred as header substructure;
  it should not be exposed independently from a supported header renderer.
- FAQ Sections: deferred while public Tailwind Plus FAQ examples remain
  locked/non-downloadable.
- Footer Sections: deferred while public Tailwind Plus Footer examples remain
  locked/non-downloadable and until footer chrome ownership is modeled.

Footer and FAQ current state, verified July 5, 2026:

- FAQ Sections are available on Tailwind Plus at
  `https://tailwindcss.com/plus/ui-blocks/marketing/sections/faq-sections`,
  but every public page-payload variant is currently locked/non-downloadable:
  `Offset with supporting text` (`8017f4faee579f7ca518cdde140d4689`),
  `Centered accordion` (`8699d80b13ef524eb573e54b4d4b89d1`),
  `Side-by-side` (`a79cba194f17e6b28fe610c07bcdb8a0`),
  `Three columns` (`f273cb93c5b5acf64f2c1711417aadfa`),
  `Three columns with centered introduction`
  (`a113dbf75844a04b403f4c7a55d431c5`), `Two columns`
  (`1c3fc65e9a4924a065d231ea14f07e16`), and
  `Two columns with centered introduction`
  (`f23694a5070bbd968770234e5d1e178e`). Dark variants are also present but
  likewise non-downloadable. None are active until a source-visible fixture is
  available or the operator supplies licensed source under the provider fixture
  policy.
- Footer Sections are available on Tailwind Plus at
  `https://tailwindcss.com/plus/ui-blocks/marketing/sections/footers`, but
  every public page-payload variant is currently locked/non-downloadable:
  `4-column with company mission` (`de25869ecf8c2903fbede9b3a7602adb`),
  `4-column with call-to-action` (`2e47a11aec9a4e1aab7fc0e20d6b5951`),
  `4-column simple` (`c5a3339d6971da22d5ffe67aa4fd168b`),
  `4-column with newsletter` (`38c15f2c35def7c2c555175450d1448e`),
  `4-column with newsletter below` (`b2c41f4521a0b989aa8e3c0d6ee400c9`),
  `Simple centered` (`8fd8a490ec2fae888154eb83685bbe23`), and
  `Simple with social links` (`2804f3d86cef85d9e040bee6d08633d6`). Dark
  variants are also present but likewise non-downloadable. Footer remains
  SIAB-owned `default` chrome until a source-visible fixture is available or
  licensed source is supplied and mapped through `packages/site-renderer/src/source-chrome`.

Preline and Tailblocks are future/non-provider work for this pass and were not
implemented. Tailwind Plus provider visual parity is covered by
`pnpm provider:visual-parity`; Preline and Tailblocks have no active visual
parity cases because they remain inactive.

## Chrome Decision

Header, footer, and announcement/banner are global site chrome. They remain in
`SiteSettings.chrome.header`, `SiteSettings.chrome.footer`, and
`SiteSettings.chrome.banner`; they are not page blocks and are not listed in
`SITE_BLOCK_SLUGS`.

Self-serve generation exposes the default structured chrome variants and the
active Tailwind Plus Marketing header chrome
`tailwindplus.marketing.header.with-stacked-flyout-menu` for
`SiteSettings.chrome.header.variant` and the active Tailwind Plus Marketing
banner chrome `tailwindplus.marketing.banner.with-button` for
`SiteSettings.chrome.banner.variant`. They are rendered through
`packages/site-renderer/src/source-chrome`, not as page content. Header slots
come from structured `SiteSettings` data: site/brand name, logo, `navHeader`,
and header CTA. Banner slots come from `SiteSettings.chrome.banner`: title,
message, link, visibility, and dismissibility. Mock generation now uses this
header and banner by default. Footer remains a SIAB-owned chrome variant.

Inactive provider chrome variants are not active chrome choices, provenance
entries, renderer fixture requirements, or AI-generation suggestions. Provider
chrome variants fail closed when unresolved instead of falling back to generic
chrome.

## System Templates

The public renderer distinguishes unknown hosts/missing snapshots from known
tenant missing pages:

- no published snapshot for the request host: the platform/default static 404
  remains in use;
- published snapshot exists but the requested page is missing:
  `apps/renderer/src/pages/[...path].astro` renders the provider-backed
  Tailwind Plus Simple 404 template
  `tailwindplus.marketing.feedback.404-simple` with the tenant snapshot's
  settings and theme.

There is no CMS-owned system-template editor or generated system-template data
model today. The active 404 template therefore uses renderer-owned structured
defaults derived from site settings, not AI-generated page content. It is not a
page block and is not duplicated into every generated site. If the provider
template renderer is missing, the known-tenant 404 path fails closed instead of
silently falling back to platform markup.

## Adding Or Reintroducing Providers

For any new Tailwind Plus block:

1. Confirm source access, license compatibility, and allowed product use.
2. Preserve the selected block as an exact TSX/HTML template with named CMS
   content slots.
3. Use Tailwind's intended compile path: literal utility classes in source,
   Tailwind v4 scanning via `@source`, and any required official runtime
   package for interactive provider elements.
4. Add catalog metadata, runtime notes, editable fields, and visual review
   notes.
5. Add contract, generation, renderer, CMS preview, governance, and provider
   visual parity coverage. The provider visual gate must compare the active
   renderer to the approved source fixture and must not expose inactive source
   affordances just to make the screenshot match.
6. Add the provider to self-serve generation only if it is approved for the
   current product surface.

Do not let AI output raw provider HTML, classes, imports, source code, or
runtime input. AI chooses approved block IDs and supplies structured content
only.

Future Preline and Tailblocks adapters must use the same activation model:
local fixtures, literal classes, typed slots, explicit interaction policy,
renderer support in public/preview/canvas, and fail-closed validation. They are
not active provider families in the current runtime.
