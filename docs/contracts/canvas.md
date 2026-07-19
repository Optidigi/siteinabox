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
- `PageForm` owns fields, saving, add/delete/duplicate/reorder, navigation,
  themes, and the inspector.
- The editor iframe owns rendering and event-delegated selection only. It does
  not mutate fields, render gutters, reorder blocks, or substitute provider DOM.

## Readiness

Preview/editor hosts keep the iframe transparent behind a CMS skeleton until
active provider modules, `window.load`, `document.fonts.ready`, React commit,
and two animation frames have completed. The frame then emits `renderer.ready`.
Customer preview uses a viewport-height, internally scrolling iframe so public
fixed-position chrome remains anchored to the visible preview viewport. The
page editor instead receives a height-only renderer signal and expands its
same-origin iframe, leaving the CMS document as the sole full-page scroll owner.
That signal cannot mutate fields, selection, block geometry, or ordering; the
removed DOM/geometry editing bridge remains retired.

## Protocol

The parent may send `page.replace`, `theme.patch`, `selection.set`, and mobile
focused-section mode. The editor may send `renderer.ready`, `renderer.height`,
`selection.changed`, `chrome.select`, and a fail-closed `error`. Legacy block
mutation, inline-field, geometry, gutter, and view-toggle messages were removed
from protocol v2.

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
load.
