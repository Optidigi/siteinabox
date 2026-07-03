# Canvas architecture

Reference for how the page editor's canvas + sidebar surfaces are wired. The high-level "what to follow" rules live in `AGENTS.md`; this file is the deep dive on internals — read when working in `src/components/editor/canvas/`, `src/components/editor/sidebar-drill-down.tsx`, or the mobile editor.

## Mode model

`PageForm` hosts a 2-way segmented control (`ModeToggle`) that toggles between two views, persisted to `users.editorMode` via the `setUserEditorMode` server action. Initial view comes from `resolveDefaultMode(userEditorMode, manifest)` — user pref wins over the manifest's `defaultMode`. `EditorMode = "canvas" | "sidebar"` (`src/lib/editor/editorMode.ts`); the legacy `form` / `preview` modes were removed.

- **Canvas view** — WYSIWYG: inline-edit every element directly on the canvas. The page's SEO fields and Danger Zone render as cards *below* the canvas.
- **Sidebar view** — Shopify-customizer style: the canvas is select-only, and a right-hand sidebar (`SidebarDrillDown`) is a drill-down state machine: block list ↔ selected-block form ↔ page settings (SEO + Danger Zone).

## Selection model

An `ElementPath` (`{ blockIndex, field, itemIndex?, subField?, subItemIndex?, subSubField? }`, `src/components/editor/canvas/elementPath.ts`) is the stable address of one editable element. `CanvasSelectionContext` carries `{ view, selected, select }`; `PageForm` owns the `selected` state and provides it. The inline primitives read this context: in `sidebar` view they render read-only and `select(elementPath)` on click; in `canvas` view they edit in place. The desktop sidebar is composed by `PageForm`, not the iframe frame route.

## App-shell layout

`PageForm` uses document-scroll: only the browser/window scrollbar exists. The PageMeta header and the ThemeBar are sticky (`sticky top-14 md:top-12` and `top: CHROME_STACK_HEIGHT` = `6.5rem` respectively, via `src/lib/editor/constants.ts`). In sidebar view the right-hand panel is a sticky `<aside>` (`top: CHROME_STACK_HEIGHT; height/maxHeight: calc(100dvh - CHROME_STACK_HEIGHT); overflow-hidden`) so it clears the sticky chrome stack (≈104 px); the inner drill-down has its own internal scrolling per state.

## Iframe editor frame

Desktop and mobile page editing render the visual pane through `PageEditorFrameHost`
and the authenticated `/editor-frame/pages/[id]` route. The parent `PageForm`
still owns RHF, save, ThemeBar, navigation membership, page settings, sidebar
drill-down, media pickers, and the unsaved-work guard. The iframe owns only the
rendered visual surface: block rendering, inline editing, DnD, gutters, and
site-chrome selection. All parent/frame communication uses the typed
`packages/contracts/src/iframe-editor.ts` postMessage protocol; raw HTML, raw
CSS, arbitrary class payloads, and executable source do not cross the boundary.

`CanvasSurface` is the transport-neutral render body shared by the iframe editor
frame (`FrameCanvasSurface` + `useFrameCanvasBlocks`, which mirrors edits locally
and emits protocol messages back to the parent). The parent remains the source of
truth and echoes confirmed page/theme/settings state back with `page.replace`
and `theme.patch`.

The customer preview frame is separate: `PreviewCustomizer` hosts
`/renderer-frame/...`, and preview-mode frames accept only `page.replace` and
`theme.patch`. Customer preview never receives block mutation, selection,
asset-pick, or chrome-edit messages.

## Editor error boundary

`EditorErrorBoundary` (`src/components/editor/EditorErrorBoundary.tsx`) wraps the editor surface so a Lexical/React render crash inside one block shows a Retry fallback instead of breaking the whole page. In `BlockFormFields`, each `<LexicalField>` is keyed by `${blockIndex}.${spec.field}` so switching between fields/blocks fully remounts the editor — a deliberate carry-forward of the original inspector-crash fix.

## Sidebar drill-down

`SidebarDrillDown` (`src/components/editor/sidebar-drill-down.tsx`) owns the 3-state machine `{ list } | { block; blockIndex } | { page-settings }`. State 1 is a flat sortable block list (dnd-kit) with a Settings cog that drills to page-settings. State 2 renders a 3-row flex column: header with a ghost-icon Back button (`<Button variant="ghost"><ChevronLeft/></Button>`) + truncated block label; scrollable body containing `BlockFormFields`; and a sticky footer at the bottom-right with a destructive `<Button variant="destructive">Delete block</Button>` that opens a `ConfirmDialog`. State 1b (page settings) shares the ghost-icon Back pattern. `BlockFormFields` (`src/components/editor/fields/block-form-fields.tsx`) is a flat per-block form that dispatches each field's `kind` (`richtext` / `text` / `image` / `icon` / `cta` / `array`) to the appropriate control. Array fields render as `ArrayItemCard` (`src/components/editor/fields/array-item-card.tsx`) — sortable expand-in-place cards with inline sub-field editing. Slide transitions between states are driven by a key-change-remount on a wrapper div using `tw-animate-css` (`animate-in slide-in-from-right-3`). External `selectedBlockIndex` changes (e.g. clicking a different block on the canvas) unconditionally re-drill the sidebar — no first-time-only guard.

## Theme control bar

`ThemeBar` (`src/components/editor/theme/theme-bar.tsx`) is a floating glass pill with three segments (`Colours | Fonts | Shape`) controlled by a Radix `ToggleGroup type="single"` + `Popover` + `PopoverAnchor`. Each segment opens a panel anchored under it (no inline shape-morph). Sub-controls: `PalettePicker` shows 6 pairs of accent circles (light on top, dark below — every preset has both halves; clicking either applies the matching palette half AND flips `theme.mode`) plus a `+ Custom` popover with a Light/Dark mode tab that edits whichever half is active. `FontPicker` shows 4 cards — Default (uses tenant manifest fonts, falls back to system) + Sans / Serif / Display — each with 3 stacked "Aa" samples (title / heading / text). `RadiusControl` shows 3 corner-radius icons (Sharp / Soft / Round) — border-style is preserved in the schema but not surfaced in the UI. The bar edits **tenant-wide** design tokens — never the CMS's own shadcn tokens — seeded from `FONT_PRESETS` + `PALETTE_PRESETS` in `src/lib/theme/presets.ts`. The schema stores `palette` (light), `darkPalette`, `fonts.{title,heading,text}`, `radius`, `borderStyle`, and `mode: "light"|"dark"`. `toCssVars` emits a base `.rt-canvas { ... }` block plus, when `darkPalette` is set, a `.rt-canvas[data-rt-mode="dark"] { ... }` overlay block; `CanvasSurface` stamps `data-rt-mode` from `theme.mode` so the overlay wins. The role tokens consumed by block renderers + `InlineCtaButton` are `var(--font-{title,heading,text})` and `var(--radius-{sm,md,lg})` (sm = radius − 0.25rem clamped at 0; lg = radius + 0.5rem). Changes update `PageForm`'s live `theme` state and debounce-persist to `Tenant.theme` via `setTenantTheme`, validated by `themeSchema`. Live-site honoring of dark mode + the new role tokens is OBS-38 (multi-repo R5 — not in this repo yet).

## Block renderers

`CanvasBlockRenderer` is a thin adapter over `packages/site-renderer` block renderers. It dispatches by `blockType`, passes `surface: "canvas"`, merges canvas section props, and provides `slots.render` so renderer-owned leaf content becomes CMS inline primitives. The renderer package owns `<section class="cms-block cms-block--<slug> …">`, inner `cms-block__*` structure, source variant classes, and live/customer-preview DOM. Full class contract: `docs/runbooks/rt-dom-contract.md § Canvas block DOM contract`. Parity gates: `docs/runbooks/canvas-renderer-parity.md`. **When you add or change a rendered-site component, add/update its renderer slots and adapter handling in lockstep.**

## Inline-edit primitives

`src/components/editor/canvas/inline/`: `RtSlot`, `ClickToEditField`, `InlineImage`, `InlineIcon`, `InlineCtaButton`. These compose registry primitives — never reimplement them. Single-text **themed nodes** (e.g. the eyebrow) are fully inline-editable — `ThemedPill`'s `InlineTextPill` is a `contentEditable` span that writes back to the node's props, with no pencil/dialog. Multi-field themed nodes keep the pill + `ThemedNodeDialog`.

## Inline font picker

The floating Lexical toolbar (`src/components/editor/richText/toolbar/floating-toolbar.tsx`) has an `Aa` popover driven by `manifest.fontFamilies[]`. Picking a font stores the manifest id as `--rt-font:<id>` and mirrors it to an `rt-font-<id>` class; the editor also applies `font-family: var(<cssVar>)` for immediate preview. The persisted RtRoot field is `RtText.font`, not a raw CSS family, so saved rich text stays constrained to the tenant manifest.

## Block-array mutations

The parent `PageForm` remains the source of truth for block arrays via RHF
`setValue("blocks", next, { shouldDirty: true })`. Never mutate the blocks array
in place. Inside the iframe, `useFrameCanvasBlocks`
(`src/components/editor-frame/useFrameCanvasBlocks.ts`) mirrors edits optimistically
and emits typed `blocks.*` / `field.commit` messages; `PageEditorFrameHost`
applies those messages back onto RHF. `SidebarDrillDown` reorder/delete/duplicate
handlers update RHF directly on desktop.

## Tenant CSS

Compiled by the tenant's Astro build and loaded from `DATA_DIR/tenants/<id>/cms-editor.css` via `src/lib/editor/loadTenantCss.ts`. That function hoists `@import`/`@charset` and rewrites `:root`/`:host` token selectors to `.rt-canvas` so the tenant's design tokens scope to the canvas surface only. The manifest's `cssEntry` field names the compiled file. If absent, canvas renders without tenant styles (falls back to admin tokens).

Legacy tenants (Amicare) do **not** consume `cms-editor.css`. The editor iframe loads bundled site-renderer styles (`generated-site-renderer.css` + scoped `site-renderer-canvas.css` in `(editor-frame)/layout.tsx`) and `loadCanvasTenantCss` skips the tenant artifact when `resolveLegacyTenant` matches. Generic/generated tenants still use `loadCanvasTenantCss` → `loadTenantCss` in the editor-frame route.

OBS-62 responsive contract: desktop canvas renders at actual pane width, not a fixed design width. `.rt-canvas` is the named `site-frame` container (`container-type: inline-size; container-name: site-frame; contain: layout`), and `CanvasSurface` wraps the tenant DOM in `.site-frame-root` so tenant CSS can apply container-query-driven global rules without styling the container itself. Generated tenant/site CSS must use named `site-frame` container queries for layout-width responsiveness; `siab-payload` does not runtime-convert `@media`/viewport units into container queries.

## Canvas ↔ sidebar selection sync

Clicking an inline element in the canvas calls `select(elementPath)`; `useScrollToSelection` (`src/components/editor/canvas/useScrollToSelection.ts`) watches `selected` and scrolls the chosen element into the canvas viewport, then stamps `data-rt-pulse="true"` to trigger the CSS arrival-pulse animation (`@keyframes rt-arrival-pulse` in `src/styles/siab.css`, with `prefers-reduced-motion` guard). `SidebarDrillDown` syncs to the external `selectedBlockIndex` via a `useEffect` — when something is selected from outside the drill-down (e.g. a canvas click) it drills the panel to the matching block. `CanvasSelectionContext.select` accepts a `React.SetStateAction<ElementPath | null>` so callers can derive the next selection from the previous.

## Selection remap on mutation

Block-array mutations that reorder, delete, or insert blocks must remap the active `ElementPath` so the selection doesn't drift. `remapSelectionAfterReorder`, `remapSelectionAfterDelete`, and `remapSelectionAfterInsert` (pure helpers in `src/components/editor/canvas/elementPath.ts`) handle this. `PageForm` applies the remap when handling iframe `blocks.*` protocol messages and when composing sidebar/canvas mutation handlers.

## Mobile (<1280px)

Mobile uses the same `PageEditorFrameHost` + `/editor-frame` route as desktop,
including `/editor-frame/pages/new` for unsaved drafts. The frame route boots
with `createEditorFrameNewPagePlaceholder()` until the parent sends `page.replace`.
`PageForm` still owns RHF, the floating `MobileSavePill`, and save/status feedback;
the iframe owns the rendered surface, inline editing, DnD, gutters, and chrome
selection. Mobile always drives the iframe in `canvas` view (inline editing) even
when the persisted desktop editor mode is `sidebar`; read-only viewers use
`sidebar` (select-only) in the frame.

When the iframe requests block settings (`edit.start` with `mode: "settings"`),
`PageForm` opens `MobileBlockInspectorSheet` — a parent-owned Vaul bottom sheet
hosting `BlockFormFields`, media pickers, and delete. Closing the sheet returns
to iframe canvas editing; block selection stays on the requested block via RHF/
`selection.set`. This replaces the legacy same-DOM `CanvasMobile` field inspector
without restoring in-process canvas rendering.

`PageEditorFrameHost` sets `data-siab-editor-frame-layout="mobile"` and sizes the
iframe to `calc(100dvh - 4.5rem)` so the editor clears the site header and the
floating save pill. There is no `NEXT_PUBLIC_IFRAME_PAGE_EDITOR` kill switch.

Legacy mobile layout primitives under `src/components/editor/canvas/mobile/` remain
for reference and unit contracts; only shared pieces such as `vaulBottomSnapCss`,
`useInspectorKeyboardLock`, and `MobileMediaSheet` are wired into the iframe mobile
inspector path.

Mobile editor controls follow the same pill language as the floating save pill.
The iframe mobile inspector uses a single `0.92` snap detent (not the legacy
`[0.42, 0.92]` field-level snap contract).

## Visual auditing
