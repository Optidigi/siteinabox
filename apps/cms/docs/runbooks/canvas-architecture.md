# Canvas architecture

Reference for how the page editor's canvas + sidebar surfaces are wired. The high-level "what to follow" rules live in `CLAUDE.md`; this file is the deep dive on internals — read when working in `src/components/editor/canvas/`, `src/components/editor/sidebar-drill-down.tsx`, or the mobile editor.

## Mode model

`PageForm` hosts a 2-way segmented control (`ModeToggle`) that toggles between two views, persisted to `users.editorMode` via the `setUserEditorMode` server action. Initial view comes from `resolveDefaultMode(userEditorMode, manifest)` — user pref wins over the manifest's `defaultMode`. `EditorMode = "canvas" | "sidebar"` (`src/lib/editor/editorMode.ts`); the legacy `form` / `preview` modes were removed.

- **Canvas view** — WYSIWYG: inline-edit every element directly on the canvas. The page's SEO fields and Danger Zone render as cards *below* the canvas.
- **Sidebar view** — Shopify-customizer style: the canvas is select-only, and a right-hand sidebar (`SidebarDrillDown`) is a drill-down state machine: block list ↔ selected-block form ↔ page settings (SEO + Danger Zone).

## Selection model

An `ElementPath` (`{ blockIndex, field, itemIndex?, subField? }`, `src/components/editor/canvas/elementPath.ts`) is the stable address of one editable element. `CanvasSelectionContext` carries `{ view, selected, select }`; `PageForm` owns the `selected` state and provides it. The inline primitives read this context: in `sidebar` view they render read-only and `select(elementPath)` on click; in `canvas` view they edit in place. `CanvasMode` takes a `view` prop and renders only the canvas pane — the desktop sidebar is composed by `PageForm`, not `CanvasMode`.

## App-shell layout

`PageForm` uses document-scroll: only the browser/window scrollbar exists. The PageMeta header and the ThemeBar are sticky (`sticky top-14 md:top-12` and `top: CHROME_STACK_HEIGHT` = `6.5rem` respectively, via `src/lib/editor/constants.ts`). In sidebar view the right-hand panel is a sticky `<aside>` (`top: CHROME_STACK_HEIGHT; height/maxHeight: calc(100dvh - CHROME_STACK_HEIGHT); overflow-hidden`) so it clears the sticky chrome stack (≈104 px); the inner drill-down has its own internal scrolling per state.

## Editor error boundary

`EditorErrorBoundary` (`src/components/editor/EditorErrorBoundary.tsx`) wraps the editor surface so a Lexical/React render crash inside one block shows a Retry fallback instead of breaking the whole page. In `BlockFormFields`, each `<LexicalField>` is keyed by `${blockIndex}.${spec.field}` so switching between fields/blocks fully remounts the editor — a deliberate carry-forward of the original inspector-crash fix.

## Sidebar drill-down

`SidebarDrillDown` (`src/components/editor/sidebar-drill-down.tsx`) owns the 3-state machine `{ list } | { block; blockIndex } | { page-settings }`. State 1 is a flat sortable block list (dnd-kit) with a Settings cog that drills to page-settings. State 2 renders a 3-row flex column: header with a ghost-icon Back button (`<Button variant="ghost"><ChevronLeft/></Button>`) + truncated block label; scrollable body containing `BlockFormFields`; and a sticky footer at the bottom-right with a destructive `<Button variant="destructive">Delete block</Button>` that opens a `ConfirmDialog`. State 1b (page settings) shares the ghost-icon Back pattern. `BlockFormFields` (`src/components/editor/fields/block-form-fields.tsx`) is a flat per-block form that dispatches each field's `kind` (`richtext` / `text` / `image` / `icon` / `cta` / `array`) to the appropriate control. Array fields render as `ArrayItemCard` (`src/components/editor/fields/array-item-card.tsx`) — sortable expand-in-place cards with inline sub-field editing. Slide transitions between states are driven by a key-change-remount on a wrapper div using `tw-animate-css` (`animate-in slide-in-from-right-3`). External `selectedBlockIndex` changes (e.g. clicking a different block on the canvas) unconditionally re-drill the sidebar — no first-time-only guard.

## Theme control bar

`ThemeBar` (`src/components/editor/theme/theme-bar.tsx`) is a floating glass pill with three segments (`Colours | Fonts | Shape`) controlled by a Radix `ToggleGroup type="single"` + `Popover` + `PopoverAnchor`. Each segment opens a panel anchored under it (no inline shape-morph). Sub-controls: `PalettePicker` shows 6 pairs of accent circles (light on top, dark below — every preset has both halves; clicking either applies the matching palette half AND flips `theme.mode`) plus a `+ Custom` popover with a Light/Dark mode tab that edits whichever half is active. `FontPicker` shows 4 cards — Default (uses tenant manifest fonts, falls back to system) + Sans / Serif / Display — each with 3 stacked "Aa" samples (title / heading / text). `RadiusControl` shows 3 corner-radius icons (Sharp / Soft / Round) — border-style is preserved in the schema but not surfaced in the UI. The bar edits **tenant-wide** design tokens — never the CMS's own shadcn tokens — seeded from `FONT_PRESETS` + `PALETTE_PRESETS` in `src/lib/theme/presets.ts`. The schema stores `palette` (light), `darkPalette`, `fonts.{title,heading,text}`, `radius`, `borderStyle`, and `mode: "light"|"dark"`. `toCssVars` emits a base `.rt-canvas { ... }` block plus, when `darkPalette` is set, a `.rt-canvas[data-rt-mode="dark"] { ... }` overlay block; `CanvasMode` stamps `data-rt-mode` from `theme.mode` so the overlay wins. The role tokens consumed by block renderers + `InlineCtaButton` are `var(--font-{title,heading,text})` and `var(--radius-{sm,md,lg})` (sm = radius − 0.25rem clamped at 0; lg = radius + 0.5rem). Changes update `PageForm`'s live `theme` state and debounce-persist to `Tenant.theme` via `setTenantTheme`, validated by `themeSchema`. Live-site honoring of dark mode + the new role tokens is OBS-38 (multi-repo R5 — not in this repo yet).

## Block renderers

Block renderers live in `src/components/editor/canvas/blocks/` — one file per block type (`Hero.tsx`, `FeatureList.tsx`, `CTA.tsx`, `RichText.tsx`, `ContactSection.tsx`, `FAQ.tsx`, `Testimonials.tsx`). Each renderer emits a `<section class="cms-block cms-block--<slug> …">` whose inner DOM mirrors the corresponding `sites/ami-care/src/components/cms/*.tsx` and `packages/site-template/src/components/cms/*.tsx` component so tenant CSS styles the canvas identically to the live site. Full class contract: `docs/runbooks/rt-dom-contract.md § Canvas block DOM contract`. **When you add or change a block's rendered-site component, update its canvas renderer in lockstep.**

## Inline-edit primitives

`src/components/editor/canvas/inline/`: `RtSlot`, `ClickToEditField`, `InlineImage`, `InlineIcon`, `InlineCtaButton`. These compose registry primitives — never reimplement them. Single-text **themed nodes** (e.g. the eyebrow) are fully inline-editable — `ThemedPill`'s `InlineTextPill` is a `contentEditable` span that writes back to the node's props, with no pencil/dialog. Multi-field themed nodes keep the pill + `ThemedNodeDialog`.

## Inline font picker

The floating Lexical toolbar (`src/components/editor/richText/toolbar/floating-toolbar.tsx`) has an `Aa` popover driven by `manifest.fontFamilies[]`. Picking a font stores the manifest id as `--rt-font:<id>` and mirrors it to an `rt-font-<id>` class; the editor also applies `font-family: var(<cssVar>)` for immediate preview. The persisted RtRoot field is `RtText.font`, not a raw CSS family, so saved rich text stays constrained to the tenant manifest.

## Block-array mutations

Mutations go through `useCanvasBlocks` (`src/components/editor/canvas/useCanvasBlocks.ts`) → `setValue("blocks", next, { shouldDirty: true })`. Never mutate the blocks array in place.

## Tenant CSS

Compiled by the tenant's Astro build and loaded from `DATA_DIR/tenants/<id>/cms-editor.css` via `src/lib/editor/loadTenantCss.ts`. That function hoists `@import`/`@charset` and rewrites `:root`/`:host` token selectors to `.rt-canvas` so the tenant's design tokens scope to the canvas surface only. The manifest's `cssEntry` field names the compiled file. If absent, canvas renders without tenant styles (falls back to admin tokens).

OBS-62 responsive contract: desktop canvas renders at actual pane width, not a fixed design width. `.rt-canvas` is the named `site-frame` container (`container-type: inline-size; container-name: site-frame; contain: layout`), and `CanvasMode` wraps the tenant DOM in `.site-frame-root` so tenant CSS can apply container-query-driven global rules without styling the container itself. Generated tenant/site CSS must use named `site-frame` container queries for layout-width responsiveness; `siab-payload` does not runtime-convert `@media`/viewport units into container queries.

## Canvas ↔ sidebar selection sync

Clicking an inline element in the canvas calls `select(elementPath)`; `useScrollToSelection` (`src/components/editor/canvas/useScrollToSelection.ts`) watches `selected` and scrolls the chosen element into the canvas viewport, then stamps `data-rt-pulse="true"` to trigger the CSS arrival-pulse animation (`@keyframes rt-arrival-pulse` in `src/styles/siab.css`, with `prefers-reduced-motion` guard). `SidebarDrillDown` syncs to the external `selectedBlockIndex` via a `useEffect` — when something is selected from outside the drill-down (e.g. a canvas click) it drills the panel to the matching block. `CanvasSelectionContext.select` accepts a `React.SetStateAction<ElementPath | null>` so callers can derive the next selection from the previous.

## Selection remap on mutation

Block-array mutations that reorder, delete, or insert blocks must remap the active `ElementPath` so the selection doesn't drift. `remapSelectionAfterReorder`, `remapSelectionAfterDelete`, and `remapSelectionAfterInsert` (pure helpers in `src/components/editor/canvas/elementPath.ts`) handle this. `useCanvasBlocks` itself only exposes the raw mutators — the remap is applied at the **caller site** by wrapping the call with `setSelected((prev) => remapSelectionAfter*(prev, …))`. Both `PageForm.tsx` and `canvas-mode.tsx` define local mutation handlers (`reorderBlocks` / `deleteBlock` / `duplicateBlock` / `insertBlockAt`) that compose the raw mutator + the remap helper; the mobile path receives those wrapped handlers as props from `PageForm`. Use the wrapped handlers (never the raw `useCanvasBlocks` mutators directly) anywhere block indices may shift.

## Mobile (<1280px)

`CanvasMode` delegates to `CanvasMobile` (`src/components/editor/canvas/mobile/CanvasMobile.tsx`) → `MobileSectionList` → `MobileSectionEdit` + `MobileInspectorBar` (bottom-sheet, Vaul). The canvas+sidebar layout is replaced with a section-card drill-down. Mobile receives the wrapped block-mutation handlers via props from `PageForm` (the same handlers desktop uses), so selection stays coherent across mutations — see FE-32 in `docs/backlog/features/README.md` for the resolution history.

The bottom inspector sheet has snap points `[0.42, 0.92]`. Selecting an element opens the sheet at `0.42`; focusing an editable field inside the inspector promotes it to `0.92` so the field clears the mobile keyboard. Focus leaving the inspector field or keyboard dismissal restores the stored pre-focus detent unless the user manually changed detents. Inspector code must only promote on actual editable targets and must ignore invalid/empty Vaul snap callbacks instead of coercing them into state.

Production CSP is nonce-only for `style-src`, so do not rely on Vaul's un-nonced runtime stylesheet injection for the mobile sheet. The mobile inspector carries the required bottom-snap Vaul mechanics in a nonce-bearing `<style data-mobile-inspector-vaul-css>` tag; drawer visuals/chrome should remain token-class based.

Mobile editor controls follow the same pill language as the floating save/back/trash affordances. Section prev/next/name buttons and the inspector Done/check button should stay round/pill-shaped through local UI composites. The bottom sheet uses Vaul `handleOnly`, so only the visible grip drags the sheet; buttons, media pickers, icon pickers, array rows, and the Done/check control remain normal tappable controls. The Done/check button must both clear mobile selection and participate in Vaul close semantics. Mobile save feedback is owned by `MobileSavePill`: it may briefly show the saved state, then returns to the normal save icon without rendering a separate saved-status badge or continuous pulse animation.

## Visual auditing

`pnpm audit:canvas` (`scripts/audit-canvas.mjs`) logs into the local dev server, screenshots both views to `tmp/phase-3-review/`, and logs console errors + failed network requests to `console.txt`. Requires `pnpm dev` running. After a collection or migration change, **restart the dev server** before auditing — Payload loads its schema once at boot, so a stale dev server rejects writes against newly-added columns/enum values.
