# Block Source Catalog

Generated public sites render structured CMS data through the shared
`@siteinabox/site-renderer` React renderers. The previous adapted provider
renderer path has been disabled for self-serve generation because it did not
preserve exact Tailwind Plus source blocks.

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
renderer-ready page-block variants. It still contains some historical adapted
provider metadata, but only `SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS`
defines the active generic generation surface. A new provider variant can enter
active self-serve generation only after it has:

- structured CMS/editable fields;
- typed renderer support;
- deterministic renderer-owned class maps or package CSS;
- source URL/upstream ID/path metadata;
- license and approval metadata;
- visual review notes;
- focused tests.

The catalog may store provider URLs, upstream IDs, public source paths, runtime
requirements, and review notes. The next Tailwind Plus implementation must keep
an exact local TSX/HTML template or snapshot that can be tested against the
approved source; adapted renderer-owned approximations are not acceptable for
new self-serve provider blocks.

`SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS` is narrower than any historical
provenance catalog. It is currently empty. Self-serve generation must not use
Tailwind Plus, Preline UI, Tailblocks, or any other provider-labelled block
until exact-source provider blocks are implemented and approved.

Inactive provider families are removed from the active app/codebase architecture,
not backlog-only providers. They must not appear in generic self-serve
generation, schema enums, AI inputs, mock generation, normal pickers, chrome
choices, renderer fixtures, or active runtime registries. SIAB-owned generic
visual variants are also not generation inputs.

Ami-care remains temporary official-tenant compatibility and is only valid on
official Ami-care preview/canvas/live tenant-renderer paths. It is unavailable to
generation, generic tenant validation, normal pickers, and AI model inputs.

## Runtime Route

Approved source-backed renderer variants must preserve exact provider source
templates and fill only approved CMS content slots. AI and CMS data never supply
arbitrary class strings, raw provider HTML, component source, imports, or
executable code.

AI output is structured CMS data only. For visual selection it sets the
block-level approved `designVariant` ID for the chosen block type. Analytics
metadata is not a styling API.

Blocks must not expose arbitrary block-level visual tokens such as per-block
colors, fonts, radii, shape controls, class names, or provider token overrides.
Site-wide visual control belongs to the global theme toolbar and theme schema:
colors, font roles, shape, radius, border style, and mode. Renderers consume
those global tokens through approved class rules.

The public renderer uses `apps/renderer/src/styles/site.css` with Tailwind v4,
the `@tailwindcss/forms` plugin, and `@source` coverage for
`packages/site-renderer/src`. CMS preview/customizer uses the CMS generated-site
renderer stylesheet for matching renderer coverage.

Current active runtime families:

- None for generic self-serve generation. Amicare tenant-exclusive rendering is
  separate compatibility code and is not part of self-serve provider blocks.

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
2. Preserve the selected block as an exact TSX/HTML template with named CMS
   content slots.
3. Use Tailwind's intended compile path: literal utility classes in source,
   Tailwind v4 scanning via `@source`, and any required official runtime
   package for interactive provider elements.
4. Add catalog metadata, runtime notes, editable fields, and visual review
   notes.
5. Add contract, generation, renderer, CMS preview, and governance tests.
6. Add the provider to self-serve generation only if it is approved for the
   current product surface.

Do not let AI output raw provider HTML, classes, imports, source code, or
runtime input. AI chooses approved block IDs and supplies structured content
only.
