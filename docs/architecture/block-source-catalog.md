# Block Source Catalog

Phase 2 provenance record for generated-site source-backed renderer variants.
Generated sites consume structured tenant/page/block data only; this catalog does
not allow generated tenant source files.

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

The public Tailwind Plus category pages expose the selected components in the
server-rendered `data-page` payload with public preview/snippet data and
`downloadable: true`. Locked paid siblings on the same pages expose "Get the
code" links instead and remain unavailable.

Retrieval process:

1. Fetch the relevant category page:
   - `https://tailwindcss.com/plus/ui-blocks/marketing/sections/heroes`
   - `https://tailwindcss.com/plus/ui-blocks/marketing/sections/feature-sections`
   - `https://tailwindcss.com/plus/ui-blocks/marketing/sections/newsletter-sections`
2. Parse the `#app[data-page]` JSON.
3. Find the component by `upstreamId`.
4. Accept it only when the component is public/free/downloadable and exposes
   public snippet/preview payload data.

No local operator-provided archive is required for the three current variants as
of this verification. If Tailwind Plus removes public payload access later, these
variants must move to `operator-archive-required` or be removed from the
source-backed export until an approved local archive process exists.

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

Current approved variant:

- `contactSection:prelineCenteredNewsletter`:
  `https://preline.co/blocks/forms/newsletter-signup-forms/#centered-newsletter-signup`.

The block page is publicly reachable, shows free/pro distinction in the page UI,
and exposes the current centered newsletter block markup in an embedded source
area. Preline remains a mixed catalog source: only free-badged public blocks are
eligible, and the dual MIT/Fair Use terms must remain explicit in provenance.
Pro blocks remain unavailable.

## Visual Review Notes

Local review compared the renderer classes in `packages/site-renderer/src/styles.css`
and block components against the approved source structure at desktop and mobile
widths to the extent practical without a maintained screenshot-diff harness.

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
   `cms-block--source-*` class and fixture coverage in
   `packages/site-renderer`.
5. Compare desktop and mobile output against the exact source/style. Set
   `visualExactnessStatus` only after review.
6. Add/update tests that prove the variant is accepted only for its canonical
   block slug and that raw HTML, arbitrary classes, source code, and file paths
   remain rejected.
