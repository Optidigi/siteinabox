# Block Source Catalog

Provenance record and source-of-truth map for generated-site source-backed
renderer variants. Generated sites consume structured tenant/page/block data
only; this catalog does not allow generated tenant source files.

## Canonical Generated Block Path

The block pipeline is intentionally split by responsibility:

- `packages/contracts/src/site.ts` is the canonical list of generated page block
  slugs and TypeScript data shapes.
- `packages/contracts/src/generation.ts` is the AI/site-generation input
  contract.
- `packages/contracts/src/runtime.ts` is the runtime validation contract.
- `packages/contracts/src/block-catalog.ts` is the canonical catalog for
  approved variants, provenance, source families, and CMS editable-field
  mappings.
- `packages/contracts/block-sources/` is archived upstream UI source material.
- `apps/cms/src/blocks/registry.ts` maps the canonical block slugs to Payload
  CMS schemas.
- `packages/site-renderer/src/blocks/index.tsx` maps the same slugs to the
  public/preview React renderers.
- `apps/cms/src/components/editor/canvas/CanvasBlockRenderer.tsx` maps the same
  data to editable canvas renderers and editing affordances.

New AI-generation blocks are available only after the contract, catalog entry,
CMS schema, renderer, editable canvas behavior, and tests are all in place.

## Source Archive vs Renderer Catalog

There are two separate concepts:

- `packages/contracts/block-sources/` is the local source archive. It stores
  exact upstream/provider artifacts that SIAB can use as block build material.
- `SITE_SOURCE_BACKED_BLOCK_VARIANTS` is the renderer-ready page-block subset.
  A block enters this export only after contracts, editable fields, renderer
  markup/CSS, provenance, and tests are in place.
- `SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS` is the active self-serve
  generation subset. It is intentionally limited to Tailwind Plus, Preline UI,
  and Tailblocks. AI prompts, model inputs, generated JSON schema enums, mock
  generation, and generic runtime validation use this list, not the full
  provenance catalog.
- `SITE_CHROME_CATALOG` and `SITE_SOURCE_BACKED_CHROME_VARIANTS` are the
  renderer-ready header, footer, and announcement banner subset. Chrome stays in
  `SiteSettings.chrome` instead of becoming page blocks, so generated sites
  still choose approved nav/footer/banner styles through structured settings.
- `SITE_SELF_SERVE_CHROME_VARIANTS` is the active chrome generation subset. It
  currently exposes only the default structured chrome variants.

Refreshing the archive must not expose new variants to AI generation by itself.
Use:

```bash
pnpm blocks:archive-sources
```

Current local archive, retrieved on 2026-06-27:

| Provider | Archived source artifacts | Intended use |
| --- | ---: | --- |
| Tailwind Plus free/downloadable | 36 | Active self-serve source family. Operator-approved free/downloadable Tailwind snippets. Current renderer variants use renderer-owned Tailwind utility maps; future interactive snippets require Tailwind Plus Elements. |
| HyperUI | 130 | Archived/backlog source family for future AI/component-composition work. Not an active self-serve generation provider. |
| Preline free | 89 | Free Preline iframe/source payloads. Current renderer variants use renderer-owned Preline/Tailwind utility maps plus the supported Preline CSS/forms path. |
| Tailblocks | 126 | Active self-serve source family. Public MIT GitHub source files. Current renderer variants use renderer-owned Tailwind utility maps and no runtime package. |
| Mamba UI | 16 | Archived/backlog source family for future AI/component-composition work. Not an active self-serve generation provider. |

## Approval Gate

`SITE_SOURCE_BACKED_BLOCK_VARIANTS` may include only variants whose provenance is:

- `approvalStatus: "approved"`;
- `sourceAvailability: "free-public"`;
- `licenseCompatibility: "compatible"`;
- `sourceAccessType` in `public-page-payload`, `public-page-copy`, or
  `public-github-source`;
- `implementation` in `exact-source` or `adapted-exact-style`;
- `visualExactnessStatus` in `reviewed-exact-source` or
  `reviewed-adapted-exact-style`;
- backed by a renderer class, source URL, retrieval process, verification date,
  upstream block name/id or path, and visual source notes.

Paid, locked, unavailable, operator-archive-only, license-incompatible, deferred,
or visually unaudited variants must stay out of the exported source-backed list.

## Current Runtime Route

The current approved source-backed renderer variants render structured
`@siteinabox/site-renderer` React components. Provider styling is selected by
approved variant IDs and mapped to renderer-owned Tailwind/Preline utility
classes in `packages/site-renderer/src/blocks/native-classes.ts`. AI and CMS
data never supply arbitrary class strings or provider HTML.

The public renderer uses `apps/renderer/src/styles/site.css` with Tailwind v4
through `@tailwindcss/vite`, app-local Preline theme/variant imports, the
`@tailwindcss/forms` plugin, and `@source` coverage for
`packages/site-renderer/src`. CMS preview/customizer uses
`apps/cms/src/styles/site-renderer-preview.css` for the same renderer utility
coverage while keeping `apps/cms/src/styles/globals.css` as the protected
shadcn/SIAB import shell.

Archived provider source under `packages/contracts/block-sources/` is provenance
and review material only. It is not a production Tailwind scan target because
archived provider pages can contain demo/pro asset URLs and unapproved sibling
components. Runtime CSS scans renderer-owned implementation files only.

Current external page-block and chrome variants are cataloged with native
runtime kinds:

- Tailwind Plus and Tailblocks use `copy-paste-tailwind` or Tailwind Plus
  static runtime metadata in active self-serve paths.
- Preline variants use `preline-ui` with `preline`,
  `@tailwindcss/forms`, app-local `node_modules/preline/css/themes/theme.css`,
  and app-local `node_modules/preline/variants.css`.
- HyperUI and Mamba UI may still appear in archived provenance and the full
  source-backed catalog for historical review, but generic renderer variant
  resolution, native class maps, mock generation, AI inputs, and generated JSON
  schema enums exclude them.

`@siteinabox/site-renderer/styles.css` remains the base/fallback renderer CSS
and the parity CSS home for Amicare tenant-exclusive variants. Amicare CSS and
rendering are scoped to the legacy tenant path with
`data-legacy-tenant="amicare"` and must not be used for generic generated
sites.

## Chrome Catalog Decision

Header, footer, and announcement/banner are global site chrome. They remain in
`SiteSettings.chrome.header`, `SiteSettings.chrome.footer`, and
`SiteSettings.chrome.banner`; they are not page blocks and are not listed in
`SITE_BLOCK_SLUGS`. The editable data is limited to approved structured fields:
logo, behavior, active mode, mobile menu, navigation arrays, footer composition,
message/title/link, dismissibility, and visibility.

The archived source-backed chrome style is `hyperUiSimple` for:

- `header:hyperUiSimple`, sourced from
  `packages/contracts/block-sources/hyperui/marketing/headers/headers-1/example.html`;
- `footer:hyperUiSimple`, sourced from
  `packages/contracts/block-sources/hyperui/marketing/footers/footers-1/example.html`;
- `banner:hyperUiSimple`, sourced from
  `packages/contracts/block-sources/hyperui/marketing/announcements/announcements-1/example.html`.

These variants remain provenance/backlog material and are excluded from the
active self-serve chrome list. Generated settings must not include raw HTML,
component names, source code, file paths, or class strings for chrome.

## Provider-Native Integration Rules

The clean implementation path is provider-specific:

- Tailwind Plus free/downloadable: use the downloaded HTML/Tailwind snippet in
  renderer-owned components. If the snippet includes `@tailwindplus/elements`,
  `el-*` elements, `command`, `commandfor`, disclosures, menus, dialogs, tabs, or
  similar interactive behavior, the renderer/CMS preview app must install or
  load `@tailwindplus/elements` before that variant is marked native-ready.
- HyperUI: backlog only for future AI/component-composition work. No HyperUI
  package or runtime is expected. If a component is reintroduced later, record
  plugin assumptions and add contract, schema, typed renderer, picker, and test
  coverage before it can enter active generation.
- Tailblocks: copy/paste Tailwind source from the public MIT repository. No
  Tailblocks package or runtime is expected.
- Mamba UI: backlog only for future AI/component-composition work. No Mamba
  runtime is expected. Because public docs/source have moved over time, use the
  archived source path as the local reference for any future review.
- Preline: use the supported Preline installation route. Current static Preline
  blocks require `preline`, `@tailwindcss/forms`, app-local imports for
  `node_modules/preline/css/themes/theme.css` and
  `node_modules/preline/variants.css`, and renderer-source scanning. Interactive
  Preline components also require `preline/dist` and
  `window.HSStaticMethods.autoInit()` after client render.

For Astro apps, copy-paste Tailwind provider blocks require Tailwind v4 through
`@tailwindcss/vite`, an app CSS entry with `@import "tailwindcss"`, and `@source`
coverage for renderer component files that contain provider utility classes.
The structured renderer does not render arbitrary archived provider HTML.

## Source Access Findings

Checked on 2026-06-26.

Phase 5 spot checks on 2026-06-26:

- `https://tailwindcss.com/plus/ui-blocks/marketing/sections/heroes` returned
  200 and the public page payload still exposed
  `b9bcab4538776a17fff93d18f82a8272`, "Simple centered", and
  `downloadable`.
- `https://raw.githubusercontent.com/mertJF/tailblocks/master/LICENSE` and
  `https://raw.githubusercontent.com/mertJF/tailblocks/master/src/blocks/content/light/a.js`
  were publicly reachable and confirmed MIT/source access.
- `https://raw.githubusercontent.com/Microwawe/mamba-ui/master/src/app/components/faq/faq1/faq1.component.html`
  was publicly reachable. The repository license is published as
  `LICENSE.md`; the GitHub license API reports MIT.
- `https://hyperui.dev/components/marketing/ctas/` returned 200 and exposed
  component/copy markers for `component-2`.
- `https://preline.co/blocks/forms/newsletter-signup-forms/` returned 200 and
  exposed the mixed Free/Pro page markers. Only free/public blocks remain
  eligible.

### Tailwind Plus

Current approved variants:

- `hero:tailwindPlusSimpleCentered`:
  `b9bcab4538776a17fff93d18f82a8272`, "Simple centered".
- `featureList:tailwindPlusCentered2x2`:
  `64ac58e032276db96bf343a8d4f332a8`, "Centered 2x2 grid".
- `contactSection:tailwindPlusNewsletterDetails`:
  `82fc139db99143307df48bb9fe6152c5`, "Side-by-side with details".
- `pricing:tailwindPlusSimpleTiers`:
  `4a9182e85945751476472f12356adb68`, "Simple pricing tiers".
- `stats:tailwindPlusSimple`:
  `b5eb58f5c8fd565cc54bf488d647f02b`, "Stats section".
- `logoCloud:tailwindPlusSimple`:
  `6b864c393af88d7b8a2ac53eaebf6403`, "Logo cloud".
- `team:tailwindPlusGrid`:
  `1ea7e52a3e89a3cf7b4a0a4fd2dcdf84`, "Team grid".
- `blogCards:tailwindPlusThreeColumn`:
  `b8172652fa29dc3eac306c2a8a922323`, "Three-column blog section".

The public Tailwind Plus category pages expose the selected components in the
server-rendered `data-page` payload with public preview/snippet data and
`downloadable: true`. Locked paid siblings on the same pages expose "Get the
code" links instead and remain unavailable.

Retrieval process:

1. Fetch the relevant category page:
   - `https://tailwindcss.com/plus/ui-blocks/marketing/sections/heroes`
   - `https://tailwindcss.com/plus/ui-blocks/marketing/sections/feature-sections`
   - `https://tailwindcss.com/plus/ui-blocks/marketing/sections/newsletter-sections`
   - `https://tailwindcss.com/plus/ui-blocks/marketing/sections/pricing`
   - `https://tailwindcss.com/plus/ui-blocks/marketing/sections/stats-sections`
   - `https://tailwindcss.com/plus/ui-blocks/marketing/sections/logo-clouds`
   - `https://tailwindcss.com/plus/ui-blocks/marketing/sections/team-sections`
   - `https://tailwindcss.com/plus/ui-blocks/marketing/sections/blog-sections`
2. Parse the `#app[data-page]` JSON.
3. Find the component by `upstreamId`.
4. Accept it only when the component is public/free/downloadable and exposes
   public snippet/preview payload data.

No local operator-provided archive is required for the current Tailwind Plus
variants as of this verification. If Tailwind Plus removes public payload access
later, affected variants must move to `operator-archive-required` or be removed
from the source-backed export until an approved local archive process exists.

The archived "Simple centered" Tailwind Plus hero includes header/mobile-menu
Elements markup in the source snippet. SIAB currently maps only the centered
hero section into renderer-owned native utility classes and renders header
chrome as a separate structured settings concern. Any future literal Tailwind
Plus header or mobile-menu variant must include Tailwind Plus Elements support
before being marked renderer-ready.

### Tailblocks

Current approved variants:

- `richText:tailblocksContentA`:
  `src/blocks/content/light/a.js`.
- `cta:tailblocksCtaA`:
  `src/blocks/cta/light/a.js`.

The upstream source files are publicly reachable from the Tailblocks GitHub
repository, and the repository license file is MIT. Retrieval uses raw GitHub
URLs under `https://raw.githubusercontent.com/mertJF/tailblocks/master/`.

### Mamba UI

Current approved variants:

- `faq:mambaFaq1`:
  `src/app/components/faq/faq1/faq1.component.html`.
- `testimonials:mambaTestimonial1`:
  `src/app/components/testimonial/testimonial1/testimonial1.component.html`.

The upstream component source files are publicly reachable from the Mamba UI
GitHub repository, and the repository license is MIT. The catalog keeps these
variants approved for the first catalog because their source access is public and
license-compatible.

### HyperUI

Current approved variant:

- `contactSection:hyperUiNewsletterCentered`:
  `https://hyperui.dev/components/marketing/ctas/#component-2`.

The public component page exposes copy/preview HTML for this component. HyperUI
is published as a free open source MIT-licensed component library, and this
variant is approved as public-page-copy source.

### Preline

Current approved variants:

- `contactSection:prelineCenteredNewsletter`:
  `https://preline.co/blocks/forms/newsletter-signup-forms/#centered-newsletter-signup`.
- `gallery:prelineSquareGrid`:
  `https://preline.co/blocks/marketing/gallery-grids/#square-image-grid-with-four-columns`.

The block pages are publicly reachable, show free/pro distinction in the page
UI, and expose the current free block markup in embedded source areas. Preline
remains a mixed catalog source: only free-badged public blocks are eligible, and
the dual MIT/Fair Use terms must remain explicit in provenance. Pro blocks
remain unavailable. The current approved Preline variants are static Preline
sections, so they use Preline CSS/forms plus renderer-owned utility maps and do
not initialize Preline JS. Any future interactive Preline block must add the
documented JS init path before approval.

## Visual Review Notes

Local review compared the renderer classes in
`packages/site-renderer/src/blocks/native-classes.ts`,
`packages/site-renderer/src/styles.css`, and block components against the
approved source structure at desktop and mobile widths to the extent practical
without a maintained screenshot-diff harness.

All current external entries are `adapted-exact-style`, not literal upstream
source copies. SIAB keeps structured contract props, normalized renderer DOM,
theme tokens, analytics attributes, and form behavior while matching the
approved source block's layout, spacing, typography, and action/form treatment.

Remaining ambiguity: exact pixel parity against live upstream previews is not
automated yet. Future catalog expansion should add a screenshot fixture or source
archive comparison before accepting new external variants.

## Manual Variant Review Checklist

Before adding or changing a catalog variant:

1. Confirm the source is one of the approved families: shadcn-owned primitives,
   Tailwind Plus free/public, Tailblocks, Mamba UI, HyperUI, Preline free, or a
   reviewed SIAB-owned custom block.
2. Record the exact URL, upstream id/name/path, retrieval process, source access
   type, license status, and verification date in `block-catalog.ts`.
3. Mark paid, locked, unavailable, operator-archive-only, license-incompatible,
   deferred, renderer-unsupported, or visually unaudited variants as ineligible
   for `SITE_SOURCE_BACKED_BLOCK_VARIANTS`.
4. Implement or verify renderer support with a stable
   `cms-block--source-*` class, native utility mapping where the provider route
   is Tailwind/Preline-native, and fixture coverage in `packages/site-renderer`.
5. Compare desktop and mobile output against the exact source/style. Set
   `visualExactnessStatus` only after review.
6. Add/update tests that prove the variant is accepted only for its canonical
   block slug and that raw HTML, arbitrary classes, source code, and file paths
   remain rejected.
