# Canvas ↔ live renderer parity

Tier-1 contract for how the CMS editor canvas must stay visually aligned with
`packages/site-renderer` and legacy tenant renderers (Amicare). Read this before
changing `CanvasBlockRenderer`, `CanvasSurface`, or site-renderer block output.

## Problem statement

`CanvasSurface` uses `SitePageRenderer` for shell/chrome on Amicare and customer
preview, but **editable** surfaces still render blocks through
`CanvasBlockRenderer` and `src/components/editor/canvas/blocks/*`. The live
renderer uses `BlockRenderer` / `AmicareBlock`. Two parallel DOM trees are the
largest source of editor ↔ live visual drift.

## Current routing (authoritative)

| Surface | Shell | Blocks | Editing |
|---|---|---|---|
| Generic tenant editor (`.rt-canvas` path) | CMS `headerChrome` / `footerChrome` | `CanvasBlockRenderer` | Full inline |
| Amicare / forced shared shell editor | `SitePageRenderer` → `AmicarePageRenderer` | `CanvasBlockRenderer` via `renderBlocks` | Full inline |
| Customer preview (`view === "preview"`) | Renderer iframe (`/renderer-frame/preview/`) | Native `AmicareBlock` / `BlockRenderer` | None |
| Amicare customer preview in `CanvasSurface` | `SitePageRenderer` | Native blocks (`renderBlocks` omitted) | None |

Customer preview and read-only renderer iframe paths **must** keep using native
renderer blocks. Do not reintroduce `CanvasBlockRenderer` on those paths.

## Parity contract (Tier 1)

1. **Section anchors** — When a block has no explicit `anchor`, canvas fallbacks
   MUST match the renderer for that tenant:
   - Amicare: hero `top`, featureList `werkwijze`, richText `over`, CTA
     `contact` / `wat-telt` (contact vs quote).
   - Generic tenants: use neutral slugs (`features`, `cta`, etc.) or omit id.
2. **Outer section classes** — `cms-block cms-block--<slug>` plus variant /
   layout utilities MUST match the canonical renderer for legacy Amicare blocks.
   See `rt-dom-contract.md § Canvas block DOM contract` and
   `tests/unit/canvas-renderer-block-parity.test.ts`.
   `data-source-variant` is variant identity and may be stamped on both legacy
   and native DOM. `rendererClassName` / `cms-block--source-*` is native renderer
   styling and MUST only be applied to DOM that follows the native `cms-block__*`
   contract. Legacy Amicare editable markup already carries its visual treatment
   through legacy classes and must not mix in native source classes.
3. **Inner BEM classes** — Generation blocks (`pricing`, `stats`, …) MUST keep
   `cms-block__*` inner classes aligned with `packages/site-renderer/src/blocks/*`.
4. **Canvas-only attributes** — `data-active`, editor gutters, and gap overlays
   are CMS-only. Renderer output MUST NOT depend on them; tenant CSS MUST NOT
   target them.
5. **Theme tokens** — Both surfaces consume `var(--font-*)` and
   `var(--radius-*)` per `rt-dom-contract.md § Theme tokens`. Hard-coded colours
   in either tree are defects.

## Renderer-native editable blocks (target architecture)

**Not safe for a broad swap in the current codebase.** Inline editing is woven
into canvas block components via:

- `RtSlot`, `ClickToEditField`, `InlineImage`, `InlineIcon`, `InlineCtaButton`
- `ElementPath` selection and `CanvasSelectionContext` view gating
- Iframe `field.commit` / `field.input` / `blocks.*` messages
  (`packages/contracts/src/iframe-editor.ts`)
- Canvas-only UX (FAQ `<details open>`, pill add/remove, DnD gutters)

### Required migration shape (next architecture)

1. **Extend `BlockRenderOptions`** in `packages/site-renderer` with optional
   edit-slot injectors, e.g. `renderRichText`, `renderCta`, `renderImage`, each
   receiving `{ value, onChange, elementPath, readOnly }`.
2. **Default path** — injectors absent → current read-only `RichTextRenderer` /
   static markup (live site + customer preview unchanged).
3. **Canvas path** — `CanvasSurface` passes CMS injectors that delegate to
   existing inline primitives; `renderBlocks` wraps native output instead of
   duplicating markup.
4. **Legacy Amicare** — converge `AmicarePage` block functions and generic
   `BlockRenderer` behind one implementation; canvas injectors apply to both.
5. **Delete** duplicated `src/components/editor/canvas/blocks/*` only after
   block-by-block parity tests pass for Amicare + one generic tenant fixture.

### Blockers (do not bypass)

| Blocker | Why it blocks swap now |
|---|---|
| No edit-slot API on renderer blocks | Renderer components render static HTML only |
| Dual legacy + generic render trees | Amicare DOM lives in `AmicarePage.tsx`, not shared `blocks/Hero.tsx` |
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
