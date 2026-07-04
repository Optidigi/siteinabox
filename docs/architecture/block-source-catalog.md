# Block Source Catalog

Generated public sites render structured CMS data through the shared
`@siteinabox/site-renderer` React renderers. They do not render raw provider
HTML and the repository no longer keeps a raw provider block-source archive.

## Canonical Generated Block Path

- `packages/contracts/src/site.ts` owns generated page block slugs and data
  shapes.
- `packages/contracts/src/generation.ts` owns AI/site-generation input
  contracts.
- `packages/contracts/src/runtime.ts` owns runtime validation contracts.
- `packages/contracts/src/block-catalog.ts` owns approved design variants,
  provider provenance, source-family metadata, and CMS editable-field mappings.
- `apps/cms/src/blocks/registry.ts` maps canonical block slugs to Payload CMS
  schemas.
- `packages/site-renderer/src/blocks/index.tsx` maps the same slugs to typed
  public/preview React renderers.
- `apps/cms/src/components/editor/canvas/CanvasBlockRenderer.tsx` maps the same
  data to editable canvas renderers and editing affordances.

New AI-generation blocks are available only after the contract, catalog entry,
CMS schema, renderer, sidebar fields, editable canvas behavior, and tests are
in place. A block that cannot be edited through both the sidebar and the canvas
is not generation-eligible.

## Provenance vs Runtime

`SITE_SOURCE_BACKED_BLOCK_VARIANTS` is a compact provenance catalog for
renderer-ready page-block variants. A variant can enter this list only after it
has:

- structured CMS/editable fields;
- typed renderer support;
- deterministic renderer-owned class maps or package CSS;
- source URL/upstream ID/path metadata;
- license and approval metadata;
- visual review notes;
- focused tests.

The catalog may store provider URLs, upstream IDs, public source paths, runtime
requirements, and review notes. It must not store or point at repo-local raw
provider HTML. Raw provider source can be consulted externally during review,
but once a block is converted the repo keeps the typed renderer and compact
metadata only.

`SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS` is narrower than any historical
provenance catalog. Current self-serve generation uses only Tailwind Plus,
Preline UI, and Tailblocks variants. AI prompts, model inputs, generated JSON
schema enums, mock generation, normal pickers, and generic runtime validation
must use this approved list.

Inactive provider families are removed from the active app/codebase architecture,
not backlog-only providers. They must not appear in generic self-serve
generation, schema enums, AI inputs, mock generation, normal pickers, chrome
choices, renderer fixtures, or active provenance catalogs. SIAB-owned generic
visual variants are also not generation inputs; generation selects only approved
provider-backed design variants from Tailwind Plus, Preline UI, or Tailblocks.

Ami-care remains temporary official-tenant compatibility and is only valid on
official Ami-care preview/canvas/live tenant-renderer paths. It is unavailable to
generation, generic tenant validation, normal pickers, and AI model inputs.

## Runtime Route

Approved source-backed renderer variants render structured
`@siteinabox/site-renderer` React components. Provider styling is selected by
approved variant IDs and mapped to renderer-owned Tailwind/Preline utility
classes in `packages/site-renderer/src/blocks/native-classes.ts`. AI and CMS
data never supply arbitrary class strings or provider HTML.

AI output is structured CMS data only. For visual selection it sets the
block-level approved `designVariant` ID for the chosen block type. Analytics
metadata is not a styling API.

Blocks must not expose arbitrary block-level visual tokens such as per-block
colors, fonts, radii, shape controls, class names, or provider token overrides.
Site-wide visual control belongs to the global theme toolbar and theme schema:
colors, font roles, shape, radius, border style, and mode. Renderers consume
those global tokens through approved class rules.

The public renderer uses `apps/renderer/src/styles/site.css` with Tailwind v4,
app-local Preline theme/variant imports, the `@tailwindcss/forms` plugin, and
`@source` coverage for `packages/site-renderer/src`. CMS preview/customizer uses
`apps/cms/src/styles/site-renderer-canvas.css` for matching renderer coverage.

Current active runtime families:

- Tailwind Plus: approved free/downloadable references rendered through typed
  React components and static renderer-owned Tailwind class maps.
- Preline UI: approved free references rendered through typed React components,
  Preline CSS/theme imports, and static class maps. Interactive Preline
  components would also require `preline/dist` initialization before approval.
- Tailblocks: MIT public source references rendered through typed React
  components and renderer-owned Tailwind class maps.

## Approval Gate

`SITE_SOURCE_BACKED_BLOCK_VARIANTS` may include only variants whose provenance
is:

- `approvalStatus: "approved"`;
- `sourceAvailability: "free-public"`;
- `licenseCompatibility: "compatible"`;
- `sourceAccessType` in `public-page-payload`, `public-page-copy`, or
  `public-github-source`;
- `implementation` in `exact-source` or `adapted-exact-style`;
- `visualExactnessStatus` in `reviewed-exact-source` or
  `reviewed-adapted-exact-style`;
- backed by a renderer class, source URL, retrieval process, verification date,
  upstream source identity, visual source notes, and runtime requirements.

Paid, locked, unavailable, license-incompatible, deferred, visually unaudited,
or raw-HTML-only variants must stay out of the exported source-backed list.

## Chrome Decision

Header, footer, and announcement/banner are global site chrome. They remain in
`SiteSettings.chrome.header`, `SiteSettings.chrome.footer`, and
`SiteSettings.chrome.banner`; they are not page blocks and are not listed in
`SITE_BLOCK_SLUGS`.

Self-serve generation exposes only the default structured chrome variants.
Inactive provider chrome variants are not active chrome choices, provenance
entries, renderer fixture requirements, or AI-generation suggestions.

## Adding Or Reintroducing Providers

For any new provider or backlog provider:

1. Confirm source access, license compatibility, and allowed product use.
2. Convert the selected block into a typed renderer with structured CMS data.
3. Use static renderer-owned class maps or an approved runtime package.
4. Add catalog metadata, runtime notes, editable fields, and visual review
   notes.
5. Add contract, generation, renderer, CMS preview, and governance tests.
6. Add the provider to self-serve generation only if it is approved for the
   current product surface.

Do not commit copied raw provider HTML as a block archive or runtime input.
