# Canvas ↔ live renderer parity

Tier-1 contract for how the CMS editor canvas must stay visually aligned with
`packages/site-renderer`. Read this before changing `CanvasBlockRenderer`,
`CanvasSurface`, or site-renderer block output.

## Problem statement

`packages/site-renderer` owns canonical block DOM for live sites, customer
preview, and editable CMS canvas. `CanvasBlockRenderer` is now an adapter: it
chooses the package block renderer, injects CMS edit slots (`RtSlot`,
`InlineImage`, `InlineCtaButton`, etc.), and merges canvas selection/chrome
section props. It must not fork block markup in CMS-local components.

## Current routing (authoritative)

| Surface | Shell | Blocks | Editing |
|---|---|---|---|
| Generic tenant editor (`.rt-canvas` path) | CMS `headerChrome` / `footerChrome` | `CanvasBlockRenderer` adapter → package block renderers | Full inline |
| Amicare / forced shared shell editor | `SitePageRenderer` generic shell + Ami-care profile chrome | `CanvasBlockRenderer` adapter via `renderBlocks` | Full inline |
| Customer preview (`view === "preview"`) | Renderer iframe (`/renderer-frame/preview/`) | `BlockRenderer` | None |
| Amicare customer preview in `CanvasSurface` | `SitePageRenderer` generic shell + Ami-care profile chrome | `BlockRenderer` (`renderBlocks` omitted) | None |

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
   `data-source-variant` is variant identity and is stamped on both live and
   editable DOM. `rendererClassName` / `cms-block--source-*` is native renderer
   styling and MUST be applied only to DOM that follows the renderer
   `cms-block__*` contract.
3. **Inner BEM classes** — Generation blocks (`pricing`, `stats`, …) MUST keep
   `cms-block__*` inner classes aligned with `packages/site-renderer/src/blocks/*`.
4. **Canvas-only attributes** — `data-active`, editor gutters, and gap overlays
   are CMS-only. Renderer output MUST NOT depend on them; tenant CSS MUST NOT
   target them.
5. **Theme tokens** — Both surfaces consume `var(--font-*)` and
   `var(--radius-*)` per `rt-dom-contract.md § Theme tokens`. Hard-coded colours
   in either tree are defects.

## Renderer-native editable blocks

`BlockRenderOptions.slots.render(slot)` is the edit-slot boundary. Package
renderers emit the same structural DOM in every surface; when `slots.render` is
absent they render static live/customer-preview HTML, and when it is present the
CMS adapter replaces leaf values with inline editor primitives. The renderer
still owns section/root/inner classes, `data-source-variant`, analytics
attributes, source variant classes, and visual wrapper structure.

Canvas-only behavior stays in CMS:

- `RtSlot`, `ClickToEditField`, `InlineImage`, `InlineIcon`, `InlineCtaButton`
- `ElementPath` selection and `CanvasSelectionContext` view gating
- iframe `field.commit` / `field.input` / `blocks.*` messages
  (`packages/contracts/src/iframe-editor.ts`)
- DnD gutters, gap overlays, block picker, and editor chrome

A visible field in a renderer block should have a matching slot path unless it
is intentionally read-only site chrome or form runtime UI.

## Change checklist

When touching either side of the boundary:

- [ ] Update the package renderer and its canvas slot mapping in the same change
- [ ] Run `pnpm test tests/unit/canvas-renderer-block-parity.test.ts`
- [ ] Run `pnpm test tests/unit/components/genericCanvasDefaults.test.ts` for Amicare anchors
- [ ] If DOM contract changes, update `rt-dom-contract.md` in the same PR

## Related docs

- `canvas-architecture.md § Block renderers` — current renderer-native adapter shape
- `rt-dom-contract.md § Canvas block DOM contract` — class-level contract
- `packages/contracts/src/block-catalog.ts` — `themeBehavior`, `rendererClassName`
