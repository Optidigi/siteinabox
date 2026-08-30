# Page editor rendering architecture

The page editor has one visual mode: the exact generated site beside a
parent-owned inspector sidebar. “Canvas” is historical terminology only; there
is no alternate CMS block renderer or canvas/source tree.

## Ownership

- `packages/site-renderer` renders public sites, customer preview, and the CMS
  editor frame from the same structured page, settings, and theme data.
- `apps/renderer` renders public pages to static HTML. Public output is never
  delayed behind a client loading shell.
- `/renderer-frame` and `/editor-frame` use the shared semantic block renderer;
  the five reviewed hero designs render through one `hero` family with local
  code-owned variants `hero-01` through `hero-05`. The approved services and
  CTA designs are also rendered through that path; the remaining seven Sitegen
  families emit an explicit pending state until their first designs are approved.
- `pageEditorCore.ts` and `usePageEditorCore.ts` own authoritative editor
  logic: form state, fields, add/delete/duplicate/reorder, navigation
  membership, theme dirty tracking, selection, draft recovery, and save
  orchestration. `PageForm` composes the shared core with desktop and mobile
  shells (inspector, theme bar, and layout chrome).
- Explicit save (**Opslaan**) posts to `/api/page-editor-save` with
  `publish: true`. There is no operator draft/publish split and no autosave.
  The only “draft” is browser IndexedDB recovery when leaving before a
  successful save. Page writes may include `expectedUpdatedAt` for optimistic
  concurrency; stale clients receive a conflict response instead of silently
  overwriting.
- A successful explicit save commits the page, related theme/navigation writes,
  and one validated active current-state snapshot through one database
  transaction. A validation or publication failure rolls the transaction back
  and the editor shows the failing stage and localized server message. For
  tenants that are already `active`, content republish does not re-require
  domain verification; first go-live still does. An authenticated page write
  from an older already-loaded editor client invokes the server-side
  publication fallback instead of leaving live output stale.
- The editor iframe owns rendering and event-delegated selection only. It does
  not mutate fields, render gutters, reorder blocks, or substitute block DOM.
  Canvas clicks select blocks/fields; editing happens only in the parent
  inspector (desktop rail or mobile Vaul). There is
  no click-to-type / contenteditable path in the iframe; that track is cancelled.

## Selection and inspector

- Editor-frame-only `editSlots` wrap live first-party output with
  `data-siab-field` markers so `selection.changed` can carry a full
  `ElementPath` (block + field + optional item/sub-field). Public and preview
  frames omit `editSlots`.
- Canvas hover uses pointer-tracked `data-siab-editor-hover` on the deepest
  field or block target (not nested CSS `:hover`). Selection chrome
  uses achromatic outer rings (`--siab-ed-ink` / `--siab-ed-ink-soft`) and a
  muted copper field ring (`--siab-ed-field`) via `outline` + `outline-offset`
  — never tenant `--accent` / `--color-accent` and never inset box-shadow
  (full-bleed children hide inset paint). Field selection does not also paint
  the parent block.
- Desktop sidebar and mobile Vaul inspector share `BlockFormFields`. Content
  fields show first; Advanced (design variant, anchor, metadata, unused
  optional arrays) stays collapsed until opened. Canvas deep-link sets
  `data-siab-inspector-field-selected` for a quiet selected wash (and matching
  hover). Settings-owned cookie consent is not page-editor chrome: public pages
  render the active numbered consent design only when approved optional
  analytics is available, while the editor hides its presentation data and
  keeps the policy editable under Settings. Announcement copy remains editable
  under Settings but is not rendered until a numbered announcement design
exists. Navbar/footer/announcement data remains settings-owned and uses the
shared renderer; consent uses the same renderer with public and customer-preview
runtime availability gates.

## Readiness and live preview

Preview/editor hosts keep the iframe transparent behind a CMS skeleton until
the first-party semantic modules, `window.load`, `document.fonts.ready`, React commit,
and two animation frames have completed. The frame then emits `renderer.ready`.
Customer preview keeps a constrained-height, internally scrolling iframe; the
generated-site frame itself has no fixed site chrome.
The desktop page editor instead scrolls in the parent CMS document: the iframe
uses `scrolling="no"` and grows to the measured `.site-frame-root` height via
`renderer.height` (ResizeObserver + rAF coalesce). Preview and editor may set
`--siab-preview-viewport-height` for frame-scoped viewport utilities, but
first-party hero sections are content-driven and no longer derive a minimum
height from `100svh` or the preview viewport. Preview and the editor frame
still measure the parent browser viewport (`window.parent.innerHeight` with
iframe fallback) for those shell utilities. That height signal cannot mutate
fields, selection, block geometry, or ordering; the removed
DOM/geometry editing bridge remains retired.

The canvas wire preserves canonical settings data for future shell designs. The
shared renderer paints active numbered navbar, footer, and consent designs;
announcement remains reserved until its numbered design exists.
`stripCanvasConsent` disables analytics capture in both CMS frames. The editor
also hides the public consent presentation so it cannot cover editing controls;
customer preview preserves the shared consent rail and connects it to an
in-memory runtime, so review actions never write storage or send analytics.
Customer preview may show that rail even when public analytics is disabled so
the customer can review the settings-owned component; public output remains
gated by the approved analytics configuration.
Maintenance and not-found output
remain dedicated system routes; they are not page blocks or active numbered
variants. Desktop editor parent-scroll
(`parentScroll=true` + `renderer.height`) remains for canvas sizing only.

Inspector edits push `render.snapshot` into the frame so the canvas acts as a
live preview: text, section order, and theme update without
save or refresh. Host payloads are normalized with `ensureCanvasWirePage` /
`ensureCanvasWireSettings` (required `language` / `updatedAt`, strip `blockName`,
analytics extras, and legacy visual metadata). Complete blocks are parsed with
`BlockSchema`; incomplete rows use the existing shared renderer fixture for
their block type while retaining order and stable id. `CanvasPageSchema` permits
an explicit zero-block editor canvas, while save/publish `PageSchema` retains its
non-empty requirement. If the full envelope still fails, the editor frame applies
each of page / settings / theme that independently parses and reports the
rejection in development. Theme, settings, selection, and mobile mode
flush immediately; rapid page-body text updates are debounced (~80ms). While
first-party modules prepare for a changed block shape, the last painted frame stays
visible under a light overlay instead of blanking.

Canvas clicks select and paint both frame and inspector highlights without
scrolling either document. Sidebar block navigation sets
`revealSelection: true` on `render.snapshot` so the frame `scrollIntoView`s the
target (`block: "center"`). Focusing an inspector field updates the same
selection and canvas highlight without reveal or scroll. Canvas-echoed
selection snapshots also omit that flag, and a local frame click synchronously
clears any pending reveal permission.

At ≤768px the editor keeps the mobile section-list / focused-section shell.
Preview remains select-only; editing stays in the inspector panel.

## Protocol

The parent sends one versioned `render.snapshot` carrying page, settings, theme,
selection, and mobile focused-section mode. The editor may send `renderer.ready`,
`selection.changed`, and a fail-closed `error`. The editor frame emits
`renderer.height` so the parent can size a non-scrolling
iframe to the measured `.site-frame-root` height. Legacy block mutation,
inline-field, geometry,
gutter, and view-toggle messages were removed from protocol v3. Customer
Customer preview consent is an in-memory rehearsal only; a fresh preview
reload or frame recreation creates the undecided initial state. There is no
preferences-management command in the iframe protocol yet.

## Parity and safety

- First-party blocks own their DOM/classes and explicit variants.
- Missing/unknown variants throw; there is no default renderer or fallback.
- Theme changes patch root attributes/variables and do not replace the page.
- Links/forms are inert in the editor. Internal preview links route through the
  parent so all generated pages remain testable.
- The editor-frame layout imports only generated-site renderer CSS.
- Ami Care and newly generated tenants use the same first-party renderer in the
  editor frame and public runtime; tenant identity never selects a renderer.

## Verification

Run `pnpm --dir apps/cms typecheck`, CMS and site-renderer tests, first-party
renderer checks, and fixed-viewport light/dark Playwright parity. Inspect the
composed fixture network graph: only variants active on the current page may
load. Targeted editor unit coverage includes `elementPathBridge`,
`createEditorSelectSlots`, `blockElementPartition`, and
`editor-renderer-parity-source`.
