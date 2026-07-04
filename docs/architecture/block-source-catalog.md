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
- active CMS page block slugs: `hero`, `featureList`, `cta`,
  `contactSection`, `testimonials`, `stats`, and `logoCloud`;
- active header chrome:
  `tailwindplus.marketing.header.with-stacked-flyout-menu`;
- active system fallback:
  `tailwindplus.marketing.feedback.404-simple` for known-host missing pages.

Historical adapted Tailwind Plus variants, Preline, Tailblocks, SIAB-owned
generic visual variants, and locked provider examples remain inactive for
self-serve generation.

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
Site-wide visual control belongs to the global theme toolbar and theme schema:
colors, font roles, radius/shape, and mode where supported. Renderers consume
those global tokens through CSS variables. The Tailwind Plus V1 path maps SiaB
theme choices onto Tailwind v4 CSS variables while keeping provider utility
classes static and detectable.

The public renderer uses `apps/renderer/src/styles/site.css` with Tailwind v4,
the `@tailwindcss/forms` plugin, and `@source` coverage for
`packages/site-renderer/src`. CMS preview/customizer uses the CMS generated-site
renderer stylesheet for matching renderer coverage.

Provider block roots are marked with `data-provider-block="tailwindplus"`,
`data-provider-variant="<canonical-provider-id>"`,
`data-source-backed-block="true"`, and the existing `data-source-variant`.
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
  optional `intro`, and exactly four feature items with required
  title/description. `eyebrow` and `image` are inactive for this exact variant.
- `tailwindplus.marketing.cta.dark-panel-with-app-screenshot`, with legacy
  `tailwindPlusDarkPanelWithAppScreenshot` aliases still accepted. `headline` is required;
  `description`, `primary`, `secondary`, and `backgroundImage` are optional.
  `eyebrow` is inactive.
- `tailwindplus.marketing.contact.centered`, with legacy
  `tailwindPlusCentered` aliases still accepted. `title`, `formName`,
  `submitLabel`, and one to six form fields are required; field labels, names,
  types, required flags, placeholders, and select/checkbox options remain CMS
  data.
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

Amicare tenant-exclusive rendering is separate compatibility code and is not
part of self-serve provider blocks.

Provider-like designVariant values fail closed. Missing or inactive provider
variants render a controlled editor/preview error instead of falling back to a
generic SiaB block. Publishing rejects pages containing unresolved provider
variants before snapshots are created.

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
generation/schema rejection, and publish validation. Browser screenshots,
pixel diffs, computed-style visual comparisons, Chromatic-style regressions,
and visual parity gates are explicitly out of scope for this pass.

## Chrome Decision

Header, footer, and announcement/banner are global site chrome. They remain in
`SiteSettings.chrome.header`, `SiteSettings.chrome.footer`, and
`SiteSettings.chrome.banner`; they are not page blocks and are not listed in
`SITE_BLOCK_SLUGS`.

Self-serve generation exposes the default structured chrome variants and the
active Tailwind Plus Marketing header chrome
`tailwindplus.marketing.header.with-stacked-flyout-menu` for
`SiteSettings.chrome.header.variant`. It is rendered through
`packages/site-renderer/src/source-chrome`, not as page content. Header slots
come from structured `SiteSettings` data: site/brand name, logo, `navHeader`,
and header CTA. Footer and banner remain SIAB-owned chrome variants.

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
5. Add contract, generation, renderer, CMS preview, and governance tests.
   These tests must remain structural/runtime/integrity tests, not visual
   parity gates.
6. Add the provider to self-serve generation only if it is approved for the
   current product surface.

Do not let AI output raw provider HTML, classes, imports, source code, or
runtime input. AI chooses approved block IDs and supplies structured content
only.

Future Preline and Tailblocks adapters must use the same activation model:
local fixtures, literal classes, typed slots, explicit interaction policy,
renderer support in public/preview/canvas, and fail-closed validation. They are
not active provider families in the current runtime.
