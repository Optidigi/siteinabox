# Page editor rendering architecture

The page editor has one visual mode: the exact generated site beside a
parent-owned inspector sidebar. “Canvas” is historical terminology only; there
is no alternate CMS block renderer or canvas/source tree.

## Ownership

- `packages/site-renderer` renders public sites, customer preview, and the CMS
  editor frame from the same structured page, settings, and theme data.
- `apps/renderer` renders public pages to static HTML. Public output is never
  delayed behind a client loading shell.
- `/renderer-frame` and `/editor-frame` use the generated active-variant loader,
  so a page downloads only its selected provider views.
- `pageEditorCore.ts` and `usePageEditorCore.ts` own authoritative editor
  logic: form state, fields, add/delete/duplicate/reorder, navigation
  membership, theme and site-chrome dirty tracking, selection, draft recovery,
  and save orchestration. `PageForm` composes the shared core with desktop and
  mobile shells (inspector, theme bar, and layout chrome).
- Explicit save (**Opslaan**) posts to `/api/page-editor-save` with
  `publish: true`. There is no operator draft/publish split and no autosave.
  The only “draft” is browser IndexedDB recovery when leaving before a
  successful save. Page writes may include `expectedUpdatedAt` for optimistic
  concurrency; stale clients receive a conflict response instead of silently
  overwriting.
- A successful explicit save commits the page, related theme/navigation/chrome
  writes, and one validated active current-state snapshot through one database
  transaction. A validation or publication failure rolls the transaction back
  and the editor shows the failing stage and localized server message. For
  tenants that are already `active`, content republish does not re-require
  domain verification; first go-live still does. An authenticated page write
  from an older already-loaded editor client invokes the server-side
  publication fallback instead of leaving live output stale.
- The editor iframe owns rendering and event-delegated selection only. It does
  not mutate fields, render gutters, reorder blocks, or substitute provider DOM.
  Canvas clicks select blocks/fields (and header/footer/banner chrome); editing
  happens only in the parent inspector (desktop rail or mobile Vaul). There is
  no click-to-type / contenteditable path in the iframe; that track is cancelled.

## Selection and inspector

- Editor-frame-only `editSlots` wrap live provider output with
  `data-siab-field` markers so `selection.changed` can carry a full
  `ElementPath` (block + field + optional item/sub-field). Public and preview
  frames omit `editSlots`.
- Canvas hover uses pointer-tracked `data-siab-editor-hover` on the deepest
  field, block, or chrome target (not nested CSS `:hover`). Selection chrome
  uses achromatic outer rings (`--siab-ed-ink` / `--siab-ed-ink-soft`) and a
  muted copper field ring (`--siab-ed-field`) via `outline` + `outline-offset`
  — never tenant `--accent` / `--color-accent` and never inset box-shadow
  (full-bleed children hide inset paint). Field selection does not also paint
  the parent block.
- Desktop sidebar and mobile Vaul inspector share `BlockFormFields`. Content
  fields show first; Advanced (design variant, anchor, metadata, unused
  optional arrays) stays collapsed until opened. Canvas deep-link sets
  `data-siab-inspector-field-selected` for a quiet left-rail highlight.
- Site chrome zones are `header` | `footer` | `banner`. Cookie/consent chrome
  uses `data-site-chrome="banner"` (and `data-siab-cookie-consent` when the
  consent variant is active); clicking it opens the banner inspector.

## Readiness and live preview

Preview/editor hosts keep the iframe transparent behind a CMS skeleton until
active provider modules, `window.load`, `document.fonts.ready`, React commit,
and two animation frames have completed. The frame then emits `renderer.ready`.
Customer preview keeps a constrained-height, internally scrolling iframe so
public fixed-position chrome stays anchored to the visible frame viewport.
The desktop page editor instead scrolls in the parent CMS document: the iframe
uses `scrolling="no"` and grows to the measured `.site-frame-root` height via
`renderer.height` (ResizeObserver + rAF coalesce). Both preview and editor set
`--siab-preview-viewport-height` for composed first-hero height
(`site-renderer` composition CSS) so it matches live `100dvh` sizing without
an iframe growth loop: preview and the editor frame measure the parent browser
viewport (`window.parent.innerHeight` with iframe fallback). That height signal
cannot mutate fields, selection, block geometry, or ordering; the removed
DOM/geometry editing bridge remains retired.

Viewport-fixed cookie consent (`banner-03` + analytics consent on) is painted
in the parent editor document via `EditorConsentBannerOverlay` on desktop
parent-scroll only, so it stays pinned to the visible CMS viewport while the
page scrolls. The desktop iframe suppresses the in-frame banner for that
variant (`parentScroll=true`). The mobile editor shell keeps iframe-internal
scroll and paints consent inside the frame. Customer preview still renders
consent inside the iframe and adds extra bottom offset for the in-frame
`PreviewCommandBar`; the editor does not apply that lift because its save
chrome lives outside the iframe.

Inspector edits push `render.snapshot` into the frame. Theme, settings/chrome,
selection, and mobile mode flush immediately; rapid page-body text updates are
debounced (~80ms). While provider modules prepare for a new `variantKey`, the
last painted frame stays visible under a light overlay instead of blanking.

At ≤768px the editor keeps the mobile section-list / focused-section shell.
Preview remains select-only; editing stays in the inspector panel.

## Protocol

The parent sends one versioned `render.snapshot` carrying page, settings, theme,
selection, and mobile focused-section mode. The editor may send `renderer.ready`,
`selection.changed`, `chrome.select` (including
`fieldPath: ["chrome","banner"]`), and a fail-closed `error`. The editor frame emits `renderer.height` so the parent can size a non-scrolling
iframe to the measured `.site-frame-root` height. Legacy block mutation,
inline-field, geometry,
gutter, and view-toggle messages were removed from protocol v3.

## Parity and safety

- Provider blocks keep literal upstream DOM/classes and explicit variants.
- Missing/unknown variants throw; there is no default renderer or fallback.
- Theme changes patch root attributes/variables and do not replace the page.
- Links/forms are inert in the editor. Internal preview links route through the
  parent so all generated pages remain testable.
- The editor-frame layout imports only generated-site renderer CSS.
- Ami Care and newly generated tenants use the same provider renderer in the
  editor frame and public runtime; tenant identity never selects a renderer.

## Verification

Run `pnpm --dir apps/cms typecheck`, CMS and site-renderer tests, provider
source/hash audits, and fixed-viewport light/dark Playwright parity. Inspect the
composed fixture network graph: only variants active on the current page may
load. Targeted editor unit coverage includes `elementPathBridge`,
`createEditorSelectSlots`, `blockElementPartition`, and
`editor-renderer-parity-source`.
