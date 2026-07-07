# Canvas ↔ live renderer parity

Tier-1 contract for how the CMS editor canvas must stay visually aligned with
`packages/site-renderer` and tenant renderers (Amicare). Read this before
changing `CanvasBlockRenderer`, `CanvasSurface`, or site-renderer block output.

## Problem statement

`CanvasSurface` uses `SitePageRenderer` for shell/chrome on Amicare and customer
preview. Editable surfaces still dispatch through `CanvasBlockRenderer`, but
active exact-source Tailwind Plus provider variants are now routed to
`RendererCanvasBlockRenderer`, which calls the shared `BlockRenderer` with CMS
edit-slot injectors. Generic fallback blocks and some tenant-specific
compatibility paths still have separate editable DOM trees, so they remain the
largest source of editor ↔ live visual drift.

## Current routing (authoritative)

| Surface | Shell | Blocks | Editing |
|---|---|---|---|
| Generic tenant editor (`.rt-canvas` path) | CMS `headerChrome` / `footerChrome` | `CanvasBlockRenderer` | Full inline |
| Amicare / forced shared shell editor | `SitePageRenderer` → `AmicarePageRenderer` | `CanvasBlockRenderer` via `renderBlocks`; existing Amicare block types delegate to renderer-owned `AmicareBlock` edit slots | Full inline for migrated slots |
| Customer preview (`view === "preview"`) | Renderer iframe (`/renderer-frame/preview/`) | Native `AmicareBlock` / `BlockRenderer` | None |
| Amicare customer preview in `CanvasSurface` | `SitePageRenderer` | Native blocks (`renderBlocks` omitted) | None |

Customer preview and read-only renderer iframe paths **must** keep using native
renderer blocks. Do not reintroduce `CanvasBlockRenderer` on those paths.

For active Tailwind Plus provider-backed page blocks, `CanvasBlockRenderer`
MUST keep using `RendererCanvasBlockRenderer` and the shared
`packages/site-renderer` provider renderer. Do not add a parallel
provider-specific CMS canvas renderer unless the block is intentionally removed
from provider-backed generation.

## Current provider verification

Current verified provider inventory is 15 active Tailwind Plus page-block
variants, 2 provider chrome variants, and 1 known-tenant 404 system template.
The active registry is executable source, not prose:
`packages/site-renderer/src/source-blocks/registry.tsx`,
`packages/site-renderer/src/source-chrome/registry.tsx`, and
`packages/site-renderer/src/source-templates/registry.tsx`.

Verification gates:

- `pnpm --dir apps/cms --ignore-workspace test tests/unit/provider-block-runtime.test.tsx tests/unit/provider-chrome-runtime.test.tsx tests/unit/provider-system-template-runtime.test.tsx tests/unit/generation-blocks-variant-resolution.test.tsx tests/unit/page-block-variant-scope.test.ts tests/unit/intakeGenerationRun.test.ts`
  covers provider runtime/chrome/template registration and fail-closed behavior.
- `pnpm provider:visual-parity` builds `apps/renderer` and compares active
  provider variants across desktop and mobile. Exact-source variants must not
  pass by stripping source-visible content from the approved source fixture.
- The Tailwind Plus header chrome is an active source-backed structured chrome
  variant, but upstream Tailwind Plus Elements popover behavior is not fully
  represented by the current SIAB renderer. The supported scope is
  static/closed-state chrome plus CSS-only mobile disclosure. Treat full stacked
  flyout interaction as a chrome backlog item until implemented with schema,
  hydration, accessibility, and open-state parity tests.

## Parity contract (Tier 1)

1. **Section anchors** — When a block has no explicit `anchor`, canvas fallbacks
   MUST match the renderer for that tenant:
   - Amicare: hero `top`, featureList `werkwijze`, richText `over`, CTA
     `contact` / `wat-telt` (contact vs quote).
   - Generic tenants: use neutral slugs (`features`, `cta`, etc.) or omit id.
2. **Generation eligibility** — Every generation-eligible block MUST have a
   typed renderer, a sidebar `BlockFormFields` mapping, and canvas editing for
   the same structured fields. Blocks without both sidebar and canvas editing
   are renderer/catalog work only and must stay out of generation.
3. **Outer section classes** — `cms-block cms-block--<slug>` plus variant /
   layout utilities MUST match the canonical renderer for Ami-care tenant renderer blocks.
   See `rt-dom-contract.md § Canvas block DOM contract` and
   `tests/unit/canvas-renderer-block-parity.test.ts`.
   `data-source-variant` is variant identity and may be stamped on both tenant
   and native DOM. `rendererClassName` / `cms-block--source-*` is native renderer
   styling and MUST only be applied to DOM that follows the native `cms-block__*`
   contract. Ami-care tenant renderer editable markup already carries its visual treatment
   through fallback canvas classes and must not mix in native source classes.
4. **Inner BEM classes** — Generation blocks (`pricing`, `stats`, …) MUST keep
   `cms-block__*` inner classes aligned with `packages/site-renderer/src/blocks/*`.
5. **Canvas-only attributes** — `data-active`, editor gutters, and gap overlays
   are CMS-only. Renderer output MUST NOT depend on them; tenant CSS MUST NOT
   target them.
6. **Theme tokens** — Both surfaces consume global ThemeTokenSpec V2 values per
   `rt-dom-contract.md § Theme tokens`. Missing themes resolve to the product
   defaults: `blue-professional`, `clear-modern`, `soft`, and `comfortable`.
   Hard-coded colours, fonts, radius values, per-block
   visual tokens, arbitrary spacing values, class payloads, arbitrary CSS, or
   provider token overrides in either tree are defects. The global theme toolbar
   owns approved color schemes, light/dark/system mode, font schemes, density,
   and shape/radius. Density is limited to provider section vertical padding in V1. Provider
   classes and DOM remain renderer-owned.
7. **Variant selection** — Generic self-serve generation currently exposes only
   approved exact-source Tailwind Plus Marketing provider-backed block
   `designVariant` IDs from the executable source-block registry. Analytics metadata is not a design-selection API.
   Inactive provider families, SIAB-owned generic visual variants, and
   Ami-care tenant-compatibility variants must not be available to generation.

## Renderer-native editable blocks (target architecture)

**Not safe for a broad swap in the current codebase.** Inline editing is woven
into canvas block components via:

- `RtSlot`, `ClickToEditField`, `InlineImage`, `InlineIcon`, `InlineCtaButton`
- `ElementPath` selection and `CanvasSelectionContext` view gating
- Iframe `field.commit` / `field.input` / `blocks.*` messages
  (`packages/contracts/src/iframe-editor.ts`)
- Canvas-only UX (FAQ `<details open>`, pill add/remove, DnD gutters)

### Required migration shape (next architecture)

1. **Continue extending `BlockRenderOptions`** in `packages/site-renderer` with
   optional edit-slot injectors. `renderRichText`, `renderCta`, `renderImage`,
   `renderIcon`, and `renderText` are active for provider-backed editable
   rendering; add any new slot kinds there instead of building separate provider
   canvas DOM.
2. **Default path** — injectors absent → current read-only `RichTextRenderer` /
   static markup (live site + customer preview unchanged).
3. **Canvas path** — `CanvasSurface` passes CMS injectors that delegate to
   existing inline primitives; `renderBlocks` wraps native output instead of
   duplicating markup.
4. **Ami-care tenant renderer** — converge `AmicarePage` block functions and generic
   `BlockRenderer` behind one implementation; canvas injectors apply to both.
   Phase 1 is active for existing Amicare block types through
   `AmicareCanvasBlockRenderer` + exported renderer `AmicareBlock`.
   Generated `hero`, `featureList`, `richText`, and `cta` blocks use the same
   slot pattern through `RendererCanvasBlockRenderer` + shared `BlockRenderer`.
5. **Delete** duplicated `src/components/editor/canvas/blocks/*` only after
   block-by-block parity tests pass for Amicare + one generic tenant fixture.

### Blockers (do not bypass)

| Blocker | Why it blocks swap now |
|---|---|
| Incomplete edit-slot coverage on some non-provider/fallback paths | Provider blocks use renderer edit slots, but generic fallback and tenant-specific paths still need canvas-specific components |
| Dual tenant-specific + generic render trees | Amicare DOM lives in `AmicarePage.tsx`, not shared `blocks/Hero.tsx` |
| Field-level sidebar selection | Read-only sidebar still needs per-field `ElementPath`; native blocks have no selectable fields |
| Array / dialog editing UX | Pills, FAQ items, themed nodes need canvas-specific controls |
| postMessage boundary | Iframe frame cannot import CMS inline primitives without bundling editor into renderer frame |

## Change checklist

When touching either side of the boundary:

- [ ] Update canvas block **and** renderer (or Amicare block) in the same change
- [ ] Run `pnpm test tests/unit/canvas-renderer-block-parity.test.ts`
- [ ] Run `pnpm test tests/unit/components/genericCanvasDefaults.test.ts` for Amicare anchors
- [ ] If DOM contract changes, update `rt-dom-contract.md` in the same PR

## Related docs

- `canvas-architecture.md § Block renderers` — where canvas renderers live today
- `rt-dom-contract.md § Canvas block DOM contract` — class-level contract
- `packages/contracts/src/block-catalog.ts` — `themeBehavior`, `rendererClassName`
