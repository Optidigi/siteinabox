# Canvas architecture

Reference for how the page editor's canvas + sidebar surfaces are wired. The high-level "what to follow" rules live in `AGENTS.md`; this file is the deep dive on internals — read when working in `src/components/editor/canvas/`, `src/components/editor/sidebar-drill-down.tsx`, or the mobile editor.

## Mode model

`PageForm` hosts a 2-way segmented control (`ModeToggle`) that toggles between two views, persisted to `users.editorMode` via the `setUserEditorMode` server action. Initial view comes from `resolveDefaultMode(userEditorMode, manifest)` — user pref wins over the manifest's `defaultMode`. `EditorMode = "canvas" | "sidebar"` (`src/lib/editor/editorMode.ts`); the legacy `form` / `preview` modes were removed.

- **Canvas view** — Desktop WYSIWYG: inline-edit every element directly on the
  canvas. On phone, `MobileFrameEditor` owns the section list and focused
  selected-section shell, while the iframe renders that selected section with
  inline editing disabled. The page's SEO fields and Danger Zone render as cards
  *below* the desktop canvas.
- **Sidebar view** — Shopify-customizer style: the canvas is select-only, and a right-hand sidebar (`SidebarDrillDown`) is a drill-down state machine: block list ↔ selected-block form ↔ page settings (SEO + Danger Zone).

## Selection model

An `ElementPath` (`{ blockIndex, field, itemIndex?, subField? }`, `src/components/editor/canvas/elementPath.ts`) is the stable address of one editable element. `CanvasSelectionContext` carries `{ view, selected, select }`; `PageForm` owns the `selected` state and provides it. The inline primitives read this context: in `sidebar` view they render read-only and `select(elementPath)` on click; in desktop `canvas` view they edit in place. On phone, inline editing is disabled and focused-section editing opens only from the `MobileFrameEditor` section list. The desktop sidebar is composed by `PageForm`, not the iframe frame route.

## App-shell layout

`PageForm` uses document-scroll: only the browser/window scrollbar exists. The PageMeta header and the ThemeBar are sticky on desktop (`sticky top-14 md:top-12` and `top: CHROME_STACK_HEIGHT` = `6.5rem` respectively, via `src/lib/editor/constants.ts`). On phones, the page editor does not mount ThemeBar; mobile editing stays focused on the section list/focused-section shell. In sidebar view the right-hand panel is a sticky `<aside>` (`top: CHROME_STACK_HEIGHT; height/maxHeight: calc(100dvh - CHROME_STACK_HEIGHT); overflow-hidden`) so it clears the sticky chrome stack (≈104 px); the inner drill-down has its own internal scrolling per state.

## Iframe editor frame

Desktop page editing renders the visual pane through `PageEditorFrameHost` and
the authenticated `/editor-frame/pages/[id]` route. Mobile page editing is
parent-owned by `MobileFrameEditor`: the parent renders the section list and
focused-section shell, while the iframe renders only the focused selected
section. The parent `PageForm` still owns RHF, save, ThemeBar, navigation
membership, page settings, sidebar drill-down, media pickers, and the
unsaved-work guard. On desktop, the iframe owns the rendered visual surface:
block rendering, inline editing, DnD, gutters, and site-chrome selection. On
phone, there is no inline editing; section open and reorder happen only from the
section list. All parent/frame communication uses the typed
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
asset-pick, or chrome-edit messages. The preview page owns scrolling: the
same-origin renderer iframe is measured after `renderer.ready` and auto-sized to
the rendered document height, so customer preview should not introduce a nested
site scrollbar. Customer preview chrome is owned by `PreviewCustomizer` in
`src/components/preview/`; see § Customer preview chrome below for layout,
breakpoints, and the component map. Preview always renders the comfortable
density preset; density is not customer-editable in preview. The preview page
keeps bottom padding (`pb-24 md:pb-32`) so the footer does not cover the final
rendered section when the customer scrolls to the end.

## Customer preview chrome

Preview chrome uses Tailwind **`md` (768px)** for desktop vs phone layout. The
page editor shell uses a separate **`1280px`** breakpoint (`EDITOR_DESKTOP_BREAKPOINT`);
do not conflate the two.

| Component | File | Role |
|-----------|------|------|
| `PreviewCustomizer` | `preview/PreviewCustomizer.tsx` | Parent shell, iframe host, theme save queue |
| `PreviewCommandBar` | same file | Desktop sticky footer (`hidden md:block` content path) |
| `ShineBorder` | `common/shine-border.tsx` | Animated border on command bar (CSP nonced styles) |
| `PreviewDesktopThemeToolbar` | `preview-desktop-theme-toolbar.tsx` | Inline colour/shape/font controls |
| `InlineToolbarGroup` | `common/inline-toolbar-group.tsx` | Segmented `bg-card` clusters for desktop pickers |
| `PreviewMobileChrome` | `preview-mobile-chrome.tsx` | Corner nav pills + bottom theme bar wrapper |
| `PreviewMobileThemeBar` | `preview-mobile-theme-bar.tsx` | Three-segment popover theme bar |
| Tone inversion | `preview-mobile-chrome-tone.ts` | Light site → dark CMS chrome (and vice versa) |
| Close event | `lib/preview/preview-theme-events.ts` | `PREVIEW_THEME_TOOLBAR_CLOSE_EVENT` closes mobile popovers on iframe interaction |
| Density pin | `lib/theme/normalizeTheme.ts` | `normalizePreviewThemeForSave` forces `comfortable` |

**Desktop (`md+`):** `PreviewCommandBar` is a centered floating card
(`md:bottom-6`, `md:rounded-lg`, `md:bg-background/90`, `md:backdrop-blur-xl`)
with `data-siab-cms-sticky-chrome`. Inside the card: `ShineBorder` overlay,
then **inline theme controls on the left** (`PreviewDesktopThemeToolbar`), a
vertical separator, and **review + launch/payment on the right**. Review is
icon-only from `md` through `lg`; the label appears at `lg+`
(`sr-only lg:not-sr-only`). Desktop theme controls use `InlineToolbarGroup`
segments with `layout="inline"` palette (includes light/dark `Switch`),
`layout="segment"` shape/font — **no popovers**.

**Mobile (`<md`):** `PreviewMobileChrome` — corner `MobileFloatingPill` for
review (top-left) and launch/payment (top-right); fixed bottom-centre
`PreviewMobileThemeBar` with colour/font/shape popovers opening upward.
Iframe focus or pointer interaction dispatches `PREVIEW_THEME_TOOLBAR_CLOSE_EVENT`
to collapse open theme popovers.

Theme changes in preview go through `normalizePreviewThemeForSave` on the client
and in `persistPreviewTheme*` on the server so density never persists outside
`comfortable`.

## Editor error boundary

`EditorErrorBoundary` (`src/components/editor/EditorErrorBoundary.tsx`) wraps the editor surface so a Lexical/React render crash inside one block shows a Retry fallback instead of breaking the whole page. In `BlockFormFields`, each `<LexicalField>` is keyed by `${blockIndex}.${spec.field}` so switching between fields/blocks fully remounts the editor — a deliberate carry-forward of the original inspector-crash fix.

## Sidebar drill-down

`SidebarDrillDown` (`src/components/editor/sidebar-drill-down.tsx`) owns the 3-state machine `{ list } | { block; blockIndex } | { page-settings }`. State 1 is a flat sortable block list (dnd-kit) with a Settings cog that drills to page-settings. State 2 renders a 3-row flex column: header with a ghost-icon Back button (`<Button variant="ghost"><ChevronLeft/></Button>`) + truncated block label; scrollable body containing `BlockFormFields`; and a sticky footer at the bottom-right with a destructive `<Button variant="destructive">Delete block</Button>` that opens a `ConfirmDialog`. State 1b (page settings) shares the ghost-icon Back pattern. `BlockFormFields` (`src/components/editor/fields/block-form-fields.tsx`) is a flat per-block form that dispatches each field's `kind` (`richtext` / `text` / `image` / `icon` / `cta` / `array`) to the appropriate control. Array fields render as `ArrayItemCard` (`src/components/editor/fields/array-item-card.tsx`) — sortable expand-in-place cards with inline sub-field editing. Slide transitions between states are driven by a key-change-remount on a wrapper div using `tw-animate-css` (`animate-in slide-in-from-right-3`). External `selectedBlockIndex` changes (e.g. clicking a different block on the canvas) unconditionally re-drill the sidebar — no first-time-only guard.

## Theme control bar

`ThemeBar` (`src/components/editor/theme/theme-bar.tsx`) is a floating desktop control for the approved `ThemeTokenSpec` V2 color, font, shape, density, and appearance presets. It edits tenant-wide preset IDs only—never CMS tokens, raw palettes, arbitrary classes, or custom CSS. `toCssVars`, `ThemeStyle`, and `themeToCssVars` apply the same scoped variables in canvas, preview, and public rendering. Provider surfaces use exact upstream reference tokens under `data-provider-token-mode="reference"`; tenant overrides stay outside that scope and do not rewrite literal provider classes. Changes persist through the normal page or preview-theme save path.

Generated blocks must not add their own arbitrary visual token fields, class
names, provider CSS overrides, or per-block color/font/radius/spacing controls.
Fonts, colors, shape, mode, and non-default section-padding density are
global theme-schema responsibilities; block renderers consume those values
through approved token classes or renderer-owned provider bridge rules.

## Block renderers

Block renderers are split by surface. `packages/site-renderer/src/blocks/*`
owns public/preview typed renderers for generated blocks. The editable CMS
canvas uses `src/components/editor/canvas/CanvasBlockRenderer.tsx` to dispatch
to renderer-native editable wrappers where available, Ami-care tenant-renderer
edit slots for the official tenant, and canvas-owned editable block components
where editor affordances are still required. Active generation blocks include
hero, featureList, richText, cta, contactSection, faq, testimonials, pricing,
stats, logoCloud, gallery, team, and blogCards. Each editable renderer emits a
`<section class="cms-block cms-block--<slug> ...">` and mirrors the matching
`packages/site-renderer` DOM/classes closely enough for theme tokens and
source-backed variant classes to behave the same in canvas and live output.
Full class contract: `docs/runbooks/rt-dom-contract.md § Canvas block DOM
contract`. Parity gates: `docs/runbooks/canvas-renderer-parity.md`. **When you
add or change a block's rendered-site component, update its canvas/editable
path in lockstep.**

Generation-eligible blocks must support both sidebar editing and canvas editing
for the same structured fields. If a block lacks a `BlockFormFields` mapping,
canvas inline/select behavior, or renderer parity coverage, keep it out of
generation until those surfaces are complete.

Self-serve generation uses only approved explicit `shadcnui-blocks.*`
`designVariant` values derived from the canonical generated manifest. Missing
or unknown variants render the canvas fail-closed error surface. Generation
must not rely on analytics metadata for visual selection. Tenant-exclusive
Amicare compatibility variants are unavailable to self-serve generation.

## Inline-edit primitives

`src/components/editor/canvas/inline/`: `RtSlot`, `ClickToEditField`, `InlineImage`, `InlineIcon`, `InlineCtaButton`. These compose registry primitives — never reimplement them. Single-text **themed nodes** (e.g. the eyebrow) are fully inline-editable — `ThemedPill`'s `InlineTextPill` is a `contentEditable` span that writes back to the node's props, with no pencil/dialog. Multi-field themed nodes keep the pill + `ThemedNodeDialog`.

Empty optional CTA/image slots should stay saveable in drafts. The canvas may
render a visually distinct add affordance, but customer preview and public
renderer output must omit the unset element. Required provider slots are a
validation/publish concern, not a live placeholder concern.

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

Tenant renderers (currently Ami-care) do **not** consume `cms-editor.css`. The editor iframe loads bundled site-renderer styles (`generated-site-renderer.css` + scoped `site-renderer-canvas.css` in `(editor-frame)/layout.tsx`) and `loadCanvasTenantCss` skips the tenant artifact when `resolveTenantRenderer` matches. Generic/generated tenants still use `loadCanvasTenantCss` → `loadTenantCss` in the editor-frame route. Ami-care is temporary official-tenant compatibility only and must not become a generation provider or generic fallback.

OBS-62 responsive contract: desktop canvas renders at actual pane width, not a fixed design width. `.rt-canvas` is the named `site-frame` container (`container-type: inline-size; container-name: site-frame; contain: layout`), and `CanvasSurface` wraps the tenant DOM in `.site-frame-root` so tenant CSS can apply container-query-driven global rules without styling the container itself. Generated tenant/site CSS must use named `site-frame` container queries for layout-width responsiveness; `apps/cms` does not runtime-convert `@media`/viewport units into container queries.

## Canvas ↔ sidebar selection sync

On desktop, clicking an inline element in the canvas calls `select(elementPath)`; `useScrollToSelection` (`src/components/editor/canvas/useScrollToSelection.ts`) watches `selected` and scrolls the chosen element into the canvas viewport, then stamps `data-rt-pulse="true"` to trigger the CSS arrival-pulse animation (`@keyframes rt-arrival-pulse` in `src/styles/siab.css`, with `prefers-reduced-motion` guard). `SidebarDrillDown` syncs to the external `selectedBlockIndex` via a `useEffect` — when something is selected from outside the drill-down (e.g. a canvas click) it drills the panel to the matching block. `CanvasSelectionContext.select` accepts a `React.SetStateAction<ElementPath | null>` so callers can derive the next selection from the previous. On phone, focused-section open is driven only by the `MobileFrameEditor` section list, not by tapping inline iframe content.

## Selection remap on mutation

Block-array mutations that reorder, delete, or insert blocks must remap the active `ElementPath` so the selection doesn't drift. `remapSelectionAfterReorder`, `remapSelectionAfterDelete`, and `remapSelectionAfterInsert` (pure helpers in `src/components/editor/canvas/elementPath.ts`) handle this. `PageForm` applies the remap when handling iframe `blocks.*` protocol messages and when composing sidebar/canvas mutation handlers. On phone, reorder is available only from the `MobileFrameEditor` section list.

## Mobile (<1280px)

Mobile uses the same `PageEditorFrameHost` + `/editor-frame` route as desktop,
including `/editor-frame/pages/new` for unsaved drafts. The frame route boots
with `createEditorFrameNewPagePlaceholder()` until the parent sends
`page.replace`. `PageForm` still owns RHF, save/status feedback, the floating
`MobileSavePill`, mobile screen state, page/SEO settings, media/icon sheets, and
the unsaved-work guard.

`MobileFrameEditor` is the canonical phone shell. It renders a parent-owned
section list first; sections can be opened only from that list. Reorder, add,
page settings, SEO, and page delete live on the list/settings screens. Opening a
section switches the iframe into `focusedSection` mobile mode: the iframe renders
only that selected section, hides site chrome/gutters/add controls, and treats
the section as select-only. Inline editing is intentionally unavailable on
phones.

The focused-section screen keeps only the mobile editor chrome that matters: a
top-left close pill, top-right save pill, animated trash pill beside save while
near the top of the page, and a compact section switcher with previous/next
buttons. The route-level page title row and mobile sidebar trigger are hidden on
phone editor routes to preserve vertical space.

Field editing is parent-owned through `MobileInspectorBar`, which is always
mounted in focused-section mode. The inspector is collapsed to its handle by
default, opens to the compact detent when a field is selected, and expands to the
editing detent when the user focuses an editable control or drags it upward. The
two-detent editing model is `0.42` compact and `0.92` editing; the `0.08`
collapsed snap exists only for the handle. Media and icon picking are hosted in
the parent document through `MobileMediaSheet` and `MobileIconSheet`.

`PageEditorFrameHost` sets `data-siab-editor-frame-layout="mobile"` and keeps a
`calc(100dvh - 4.5rem)` minimum so the editor clears the site header and the
floating save pill. Canvas view auto-sizes the iframe to the rendered document
height, including focused-section mode, so the parent editor page owns scrolling
and there is no iframe/body nested scrollbar. Sidebar/read-only view keeps the
bounded viewport-height iframe needed by the sticky inspector layout. There is no
`NEXT_PUBLIC_IFRAME_PAGE_EDITOR` kill switch.

## Visual auditing
