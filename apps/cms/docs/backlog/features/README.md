# Features Backlog

Product feature work — UI improvements, new functionality, and full-stack additions. Items are tagged by `**Layer:**` to indicate implementation scope.

**Layer values:**
- `frontend` — UI/UX only, no schema or API changes
- `full-stack` — meaningful work on both frontend and backend within this repo
- `multi-repo` — spans this repo AND `siab-site-template` or orchestrator

**IDs:** Frontend items use `FE-N` (current high water mark: FE-109). Full-stack/multi-repo items use `OBS-N` continuing the shared sequence (current high water mark across all backlogs: OBS-122 — next OBS = OBS-123).

Cross-reference: security findings at `../security/README.md`, infra items at `../infra/README.md`.

**Open-item status source:** Use each item's `**Status:**` line as the source of
truth. Some category sections below retain recently closed items for lineage;
items marked `Closed` are not open backlog work.

---

## Closed — recent full-stack completions

### FE-109 — Logout redirect leaves stale admin header on login

**Status:** Closed 2026-06-11 · **Layer:** frontend
**Discovered in:** Operator CMS sign-out review, 2026-06-11

#### Description
Signing out from the CMS could land on `/login` with the authenticated admin
header still visible. `/login` is outside the `(admin)` route group and does
not render `SiteHeader`; the stale header came from the logout client flow
calling `router.replace("/login")` and immediately `router.refresh()` after
clearing auth state, which could refresh the still-mounted protected admin tree
while the cross-layout navigation was in flight.

#### Resolution
`UserMenu` now performs one decisive document navigation with
`window.location.replace("/login")` after Payload and Better Auth sign-out
complete, avoiding the App Router refresh race and forcing the admin shell to
unmount.

#### Validation
Added source-level regression coverage for the logout navigation shape.
Focused unit coverage and `pnpm typecheck` passed.

### OBS-113 — Audit follow-up: extract PageForm site-chrome draft helpers

**Status:** Closed 2026-06-05 · **Layer:** frontend
**Discovered in:** Session 2026-06-05 (multi-agent codebase tightness audit)

#### Description
`PageForm` owned both the interactive site-chrome editor UI and the pure mapping
logic that turns `SiteSettings` chrome data into editable drafts, comparable
snapshots, PATCH payloads, and merged preview settings. Keeping these pure
helpers inside the large component made the file harder to reason about and
harder to test directly.

#### Resolution
Site-chrome draft mapping now lives in `src/lib/siteChromeDraft.ts`.
`PageForm` imports the helpers and keeps the interactive editor composition
unchanged. The extracted helpers are covered directly by
`tests/unit/site-chrome-draft.test.ts`.

#### Validation
Focused site-chrome draft, PageForm wiring, client media, route/navigation, and
typecheck coverage passed.

### OBS-112 — Audit follow-up: tenant-host role route browser smoke

**Status:** Closed 2026-06-05 · **Layer:** full-stack / access QA
**Discovered in:** Session 2026-06-05 (multi-agent codebase tightness audit)

#### Description
OBS-103 had pure route-gate tests, selected-site boundary tests, and
source-level navigation canaries, but the Playwright browser gate only covered
unauthenticated access. There was no small browser-level smoke proving that the
seeded tenant roles still match representative direct routes and sidebar
affordances.

#### Resolution
Added `tests/e2e/role-route-matrix.spec.ts`. It logs in on the tenant host as
seeded owner, editor, and viewer users, then verifies representative allowed
owner routes, editor forbidden redirects/hidden owner links, and viewer
read-only page access plus forbidden page creation. The spec supports
`E2E_TENANT_BASE_URL` and otherwise uses `<seed-slug>.localhost` when the normal
E2E base is local.

#### Validation
Typecheck and the focused route/navigation/source unit suite passed. The new
Playwright spec was added as coverage for dev/CI E2E runs; it requires a running
dev server and tenant-host resolution.

### OBS-111 — Audit follow-up: decouple rich-text manifest context from PageForm

**Status:** Closed 2026-06-05 · **Layer:** frontend
**Discovered in:** Session 2026-06-05 (multi-agent codebase tightness audit)

#### Description
`FieldRenderer` and rich-text paste handling imported `useRtManifest` from
`PageForm`, coupling small editor utilities to the large page editor module.
That made the editor dependency graph noisier and increased the chance that
future rich-text changes would pull in PageForm-only code.

#### Resolution
The manifest provider/hook now live in
`src/components/editor/RtManifestContext.tsx`. App-owned editor utilities import
from that context directly, and `PageForm` uses `RtManifestProvider` while
retaining a compatibility re-export for registry-owned consumers that still
import the hook from the historical path.

#### Validation
Source-level wiring coverage pins the app-owned imports. Focused PageForm
wiring, rich-text canvas selection, media/editor tests, and `pnpm typecheck`
passed.

### OBS-110 — Audit follow-up: shared client media tenant loading

**Status:** Closed 2026-06-05 · **Layer:** frontend
**Discovered in:** Session 2026-06-05 (multi-agent codebase tightness audit)

#### Description
The desktop media picker, inline canvas image picker, and mobile media sheet
each duplicated the same client-side tenant resolution and media-list loading
logic. All three fetched `/api/users/me`, special-cased selected-site
super-admin routes, and queried `/api/media` with the resolved tenant id. The
behavior matched, but the duplication made future media picker fixes easy to
apply to only one surface.

#### Resolution
Client media tenant resolution and tenant-scoped media loading now live in
`src/components/media/clientMedia.ts`. `MediaPicker`, `InlineImage`, and
`MobileMediaSheetContext` use the shared helper/hook while preserving the
existing picker behavior and upload callbacks.

#### Validation
Focused client-media, media-uploader, canvas chrome fidelity, rich-text canvas
selection tests passed. `pnpm typecheck` passed in the implementation session.

### OBS-109 — Audit follow-up: shared block summary rich-text walker

**Status:** Closed 2026-06-05 · **Layer:** full-stack
**Discovered in:** Session 2026-06-05 (multi-agent codebase tightness audit)

#### Description
Several block schema files duplicated the same recursive rich-text walker just
to derive block summary labels from the first text node. The duplication was
low risk but made block schema files noisier and future summary changes easier
to drift.

#### Resolution
`src/blocks/_summary.ts` now exports `firstRichText` next to the existing
`truncate` helper. Hero, CTA, FAQ, ContactSection, FeatureList, and RichText
block summaries use the shared helper. Per-block summary selection logic is
unchanged.

#### Validation
Focused block summary, registry, page block projection, mapper block, and
`pnpm typecheck` checks passed.

### OBS-108 — Audit follow-up: selected-site route policy consolidation

**Status:** Closed 2026-06-05 · **Layer:** full-stack
**Discovered in:** Session 2026-06-05 (multi-agent codebase tightness audit)

#### Description
Selected-site routes repeated the same policy composition in many pages:
`requireRole`, `getTenantBySlug`, `notFound`, and, for owner-capable routes,
`assertSelectedTenantRouteAccess`. The behavior was mostly correct but
distributed, making future route/navigation drift more likely.

#### Resolution
Selected-site route policy composition now lives in `src/lib/routePolicy.ts`.
Super-admin-only selected-site routes use `requireSuperAdminSelectedSite`, and
owner-capable selected-site settings/navigation/users routes use
`requireOwnerSelectedSite`. `generateMetadata` remains a simple unauthenticated
tenant/page lookup where needed, because metadata generation cannot depend on
route auth.

#### Validation
Route parity source coverage now pins the shared policy helpers and verifies
selected-site pages import/use the correct helper. Focused route parity tests
and `pnpm typecheck` passed.

### OBS-107 — Audit follow-up: shared projection media serialization

**Status:** Closed 2026-06-05 · **Layer:** full-stack
**Discovered in:** Session 2026-06-05 (multi-agent codebase tightness audit)

#### Description
Page projection and settings projection each carried their own media
relationship serializer. The duplicated logic emitted the same public shape for
raw upload IDs and populated Media objects, but keeping it in two files made
future projection changes more likely to drift.

#### Resolution
Projection media serialization now lives in `src/lib/projection/media.ts`.
`pageToJson` still only treats recursively encountered objects as media when
they have the populated media shape, while `settingsToJson` still serializes
known media fields directly. This is a consolidation-only change; the emitted
JSON contract is unchanged.

#### Validation
Focused projection media, page projection, page block projection, settings
projection, and page-to-disk projection tests passed. `pnpm typecheck` passed.

### OBS-106 — Audit follow-up: shared relationship ID normalization

**Status:** Closed 2026-06-05 · **Layer:** full-stack
**Discovered in:** Session 2026-06-05 (multi-agent codebase tightness audit)

#### Description
The audit found repeated tenant/relationship ID normalization across auth
gates, route checks, access helpers, preview-token creation, and projection
hooks. Some paths compared raw IDs while others string-normalized, increasing
drift risk when Payload relationship values arrive as raw numbers, raw strings,
or populated `{ id }` objects.

#### Resolution
A shared `relationshipId` helper now normalizes raw and populated relationship
IDs, with `sameRelationshipId` and `relationshipIdSet` helpers for comparison
and membership checks. The helper is used by the host/tenant gate, selected
tenant route boundary, write access role helper, tenant existence validation,
page projection media fallback logic, page edit tenant ownership checks, and
preview-token tenant/page validation.

#### Validation
Focused unit coverage pins raw number, raw string, populated object, null, set,
auth-gate, selected-route, write-access, preview-token, and page-projection
behavior. `pnpm typecheck` passed.

### OBS-104 — Audit follow-up: projection, preview token, and tenant page-route safety

**Status:** Closed 2026-06-05 · **Layer:** full-stack
**Discovered in:** Session 2026-06-05 (multi-agent codebase tightness audit)

#### Description
The architecture audit found three narrow safety gaps:

- Published page slug renames could leave the old `pages/<slug>.json` and
  manifest entry on disk because `projectPageToDisk` only removed old files on
  unpublish, not published-to-published slug changes.
- Tenant-host `/pages/[id]` normalized cross-tenant pages to 404 but did not
  catch a missing `getPageById` result before the RSC route could surface a
  server error. The selected-site super-admin route already had the correct
  `.catch(() => null)` shape.
- `/api/preview-tokens` checked tenant membership before signing but did not
  verify that a persisted `pageId` belonged to the requested tenant.

#### Resolution
`projectPageToDisk` now removes the previous published projection when a
published page changes slug or tenant, then writes the new projection and
manifest entry. Tenant page edit routes now mirror the selected-site 404
normalization for missing page IDs. Preview-token creation now verifies
persisted pages belong to the requested tenant before signing, while preserving
the existing `draft-*` preview sentinel path after tenant authorization.

#### Validation
Focused unit coverage was added for published page slug projection cleanup and
preview token tenant/page ownership. Tenant route handling now mirrors existing
selected-site behavior.

## Closed — recent frontend completions

### FE-101 — Mobile editor navigation/media picker polish and duplicate add affordance cleanup

**Status:** Closed 2026-06-04 · **Layer:** multi-repo (`@siab/mobile-inspector` + CMS canvas inline controls)
**Discovered in:** Session 2026-06-04 (operator mobile editor polish pass)

#### Description
Mobile section navigation and image editing needed several small interaction
adjustments:

- Section prev/next controls sat in the sticky section header instead of the
  same top floating control row as close/save.
- Tapping an editable image on mobile selected the image first, then required a
  second tap on the inspector's Choose/Replace button to open media selection.
- The mobile media sheet used the shared sheet's small default close affordance
  instead of the thumb-sized round button language used by the bottom-sheet
  Done/check control.
- The desktop-style background-image hover toolbar could still surface in the
  mobile editor even though mobile should use direct image/background taps.
- Empty CTA add controls could show two plus signs because the control already
  renders a plus icon while some app-owned labels included a literal `+`.

#### Resolution
The registry-owned mobile section editor now renders prev/next as
`MobileFloatingPill` controls beside the top-left close pill. The section-name
dropdown remains in the sticky header.

The registry-owned mobile component editor now opens the media picker
immediately when an image field is selected. The registry-owned mobile media
sheet disables the default sheet close and uses a `SheetClose` + shadcn
`Button` cross control with the same token classes, size, and round shape as
the mobile bottom-sheet Done/check button.

The app-owned `InlineImage` suppresses hover overlay chrome only in mobile view,
so mobile image/background edits use direct selection while desktop overlay
toolbar behavior remains unchanged. App-owned CTA/Hero empty CTA labels no
longer include a literal plus prefix; the existing `InlineCtaButton` plus icon
is the sole add affordance.

#### Validation
Validation passed on 2026-06-04: focused mobile inspector / CTA background /
generic canvas default contract tests, `pnpm typecheck`, `pnpm lint:no-css`,
and SIAB registry build from `optidigi/design-systems`.

#### Follow-up — 2026-06-04
Live testing showed the first mobile image-selection polish still opened the
bottom inspector behind the media picker because the picker was mounted from
inside `MobileComponentEditor`. The registry-owned mobile inspector now treats
selected image fields as a direct media-selection flow: it resolves the selected
element spec, mounts `MobileMediaSheet` directly, writes the picked media to the
same React Hook Form field path, and clears the mobile selection when the media
sheet closes. Image picking no longer opens the Vaul bottom inspector.

The mobile section header was also tightened into one top row. Prev/next moved
back to shadcn `Button` controls beside the centered section-name dropdown, and
the section-name trigger now uses an outlined/token-backed surface so it reads
as a selectable dropdown. This removes the extra header row and gives the mobile
canvas more vertical space.

### FE-100 — Post-save CSP nonce continuity and CTA field contract mismatch

**Status:** Closed 2026-06-04 · **Layer:** multi-repo (`siab-payload` + `site-amicare-zorg`)
**Discovered in:** Session 2026-06-04 (operator retest after manifest-derived block editor fields)

#### Description
Two related-looking editor regressions had separate causes:

- After saving, the canvas could lose tenant styling and the floating CMS chrome
  could shift position. The common failure mode was strict `style-src` CSP:
  runtime style tags for tenant CSS/theme and editor chrome positioning were
  receiving a fresh RSC/request nonce after `router.refresh()`, while the
  browser document still enforced the original document nonce.
- Newly exposed CTA fields could save and project but not render on Amicare.
  The Amicare CTA component and CMS canvas CTA renderer had a contact-variant
  early return that ignored `description`, `secondary`, and `backgroundImage`.
  The Amicare manifest also lacked explicit `blocks[].fields`, so the CMS was
  using Payload schema fallback fields rather than a site-declared editor
  contract.

#### Resolution
`CspNonceProvider` now pins the first non-empty CSP nonce for the lifetime of
the client document. Client-side RSC refreshes can no longer replace runtime
style tags with a nonce that the current document CSP does not allow.

The CMS canvas CTA renderer and Amicare site CTA renderer now keep the
contact/quote variant classes but render all optional CTA fields when present.
Empty CTA values remain valid and simply do not render on the live site.
Amicare's `siteManifest.json` now declares the CTA editor fields explicitly, so
future tenant-manifest syncs carry the site-owned block contract instead of
relying on CMS schema fallback.

#### Validation
Validation passed on 2026-06-04: focused nonce and CTA canvas contract tests,
`pnpm typecheck`, `pnpm lint:no-css`, `pnpm registry:check`, `pnpm exec astro
check`, and `pnpm build` for `site-amicare-zorg`.

### FE-99 — Mobile editor follow-up regressions: background media triggers, save cue, pill geometry, and canvas theme continuity

**Status:** Closed 2026-06-04 · **Layer:** multi-repo (`@siab/mobile-inspector`, `@siab/save-ui`, `@siab/mobile-floating-pill` + CMS canvas)
**Discovered in:** Session 2026-06-03 (operator follow-up after FE-98 live retest)

#### Description
Several small mobile/canvas regressions remained after the bottom-sheet CSP fix:

- CTA section background media could open the media picker by clicking the
  rendered background itself; the intended trigger is only the designated
  toolbar/inspector media affordance.
- Mobile saved feedback needed to be carried by the save pill itself, not by a
  separate saved-status UI, and the saved state should clear back to the normal
  save affordance after a short hold.
- Mobile section prev/next/name controls and the inspector Done/check control
  did not match the rounded mobile pill language.
- The inspector Done/check control could feel inert because it only cleared app
  selection state inside a draggable Vaul surface.
- Mobile canvas could intermittently appear neutral/monochrome after save if a
  same-route refresh temporarily dropped the previously loaded tenant CSS.

#### Resolution
`InlineImage` now supports a narrow `openOnImageClick` contract. Normal inline
images still open the picker from the rendered image; the CTA quote background
sets `openOnImageClick={false}`, so clicking the section/background no longer
launches media selection while the overlay media chrome and inspector image
button remain the designated edit paths.

Registry-owned mobile inspector/save primitives were updated through
`optidigi/design-systems` and pulled back into this repo via the SIAB registry.
Mobile section prev/next/name controls and the inspector Done/check button now
use round/pill geometry. The Done/check button participates in Vaul close
semantics (`Vaul.Close`) while still clearing the mobile editor selection.

`MobileSavePill` now holds `saved` for two seconds locally, then restores the
normal idle save icon even if the parent page-level saved flag remains true.
The success cue uses existing `success` / `background` tokens on
`MobileFloatingPill`; no shadcn theme or registry token configuration changed.

`PageForm` keeps the last non-null compiled tenant CSS bundle during same-route
refreshes, preventing the canvas from briefly falling back to neutral admin
tokens after save. This does not alter tenant CSS imports, manifests,
`siteManifest.cssEntry`, `loadTenantCss`, or the site/canvas CSS transform.

#### Validation
Focused source/unit coverage pins the CTA background-image trigger contract,
mobile inspector close/snap contract, mobile pill geometry, mobile saved-state
timeout, and tenant CSS continuity guard. Validation passed: focused Vitest
contract tests, `pnpm typecheck`, `pnpm lint:no-css`, and `pnpm registry:check`.

#### Follow-up — 2026-06-04
Live retesting found the first FE-99 fix was incomplete:

- CTA quote backgrounds no longer opened the picker on direct click, but still
  advertised a hover/cursor image affordance and the overlay image button had
  been accidentally routed through the disabled surface-click path.
- The mobile Done/check button could still miss close on touch gestures because
  both `Vaul.Close` and the app `clearSelection()` path were click-dependent.
- The saved-state ring read detached from the save pill, and the saved icon
  needed the simpler checkmark/success-token treatment.
- The neutral/monochrome canvas report after save still matched a tenant-style
  continuity failure mode during same-route refresh/remount.

The follow-up split `InlineImage` surface clicks from toolbar clicks. CTA
background surfaces with `openOnImageClick={false}` no longer receive
`rt-click-edit`, `cursor-pointer`, or a click handler, while the overlay image
button still opens the media picker and the delete button still clears the
image. Registry-owned mobile inspector/save primitives were updated through
`optidigi/design-systems`, rebuilt, redeployed, and pulled back through the
SIAB registry: Done/check now has an explicit touch-end close path in addition
to `Vaul.Close`, the saved icon is a `Check`, and the success cue uses inset
`success` token ring/pulse classes instead of an offset ring. `PageForm` now
keeps a per-tenant in-memory cache of the last compiled tenant CSS and saved
theme snapshot so a same-route refresh/remount can synchronously reuse tenant
styling instead of falling back to neutral `.rt-canvas` tokens.

Validation passed on 2026-06-04: focused Vitest contract tests, `pnpm
typecheck`, `pnpm lint:no-css`, and `pnpm registry:check` after deploying the
updated public SIAB registry.

#### Follow-up — 2026-06-04
Further mobile testing showed the prior Done/check fix was too narrow: controls
inside the bottom sheet could still fail to respond to touch because the Vaul
drawer body was still the drag surface. Registry-owned mobile inspector
primitives were updated through `optidigi/design-systems` so the drawer uses
Vaul `handleOnly`; only the visible grip drags the sheet, while buttons, media
pickers, icon pickers, array rows, and the Done/check control remain normal
tappable controls. The obsolete touch-end close workaround was removed.

The mobile save success cue also no longer uses the continuous `animate-pulse`
animation. `MobileFloatingPill` now renders the success state as a static
success-token surface (`bg-success text-success-foreground`) with the existing
two-second saved hold handled by `MobileSavePill`.

Same-session follow-up corrected the Vaul/CSP details behind that fix. Because
production CSP blocks Vaul's un-nonced runtime stylesheet, the registry-owned
mobile inspector's nonce CSS now includes explicit visible handle geometry.
The restrictive `touch-action: none` rule was moved off the whole drawer body
and onto the handle/hit-area, so the sheet content remains normal tappable
form/control UI while only the visible handle drives drawer drag gestures.

#### Follow-up — 2026-06-04
Further save/canvas testing found two app-owned causes behind the remaining
reports. First, the page save request only normalized `seo.ogImage` to a bare
upload id. Depth-loaded edit pages can also contain populated Media objects in
block upload fields, so a later unrelated save could resubmit populated media
objects and trigger Payload validation errors. Page saves now normalize the
known block upload relationships (`hero.image`, `cta.backgroundImage`, and
`testimonials.items[].avatar`) while preserving block ids, array row ids, rich
text, and unknown block fields.

Second, a sparse tenant theme containing only `mode` could be persisted by the
theme bar. A bare `{ mode: "dark" }` produces no tenant palette/font/radius CSS
for the canvas, leaving the canvas to render against the neutral dark fallback
tokens after save/remount. `PageForm` now normalizes theme snapshots at its
state/cache/save boundary: empty nested token groups are pruned, concrete theme
tokens are preserved, and mode-only snapshots are cleared instead of persisted
as tenant overrides.

Validation passed on 2026-06-04: focused Vitest coverage for upload
normalization, sparse-theme normalization, and the PageForm explicit-save
contract; `pnpm typecheck`; `pnpm lint:no-css`; and `pnpm registry:check`.

### FE-98 — Mobile editor snap, pill shape, and canvas theme parity regressions

**Status:** Closed 2026-06-03 · **Layer:** multi-repo (`@siab/mobile-inspector` + CMS editor state)
**Discovered in:** Session 2026-06-03 (operator phone review after CSP/dialog batches)

#### Description
Mobile editor behavior drifted from the intended first-touch contract and visual
shape/parity expectations:

- The inspector still opened compact on initial canvas selection, but after a
  field focus promoted the sheet to the editing detent, blur/keyboard dismissal
  left it full-height instead of restoring the compact detent.
- Mobile floating pills rendered with medium-radius corners even though the
  mobile affordance is expected to be circular.
- The focused mobile section canvas rendered block content directly inside
  `.rt-canvas` without the `.site-frame-root` wrapper used by desktop/site
  preview, so tenant CSS relying on that shell could fail to apply consistently.

#### Resolution
Restored the pre-focus snap lifecycle in the CMS mobile editor state and
registry-owned inspector: selection opens at `0.42`, field focus promotes to
`0.92`, and focus leaving the inspector or keyboard close restores the stored
pre-focus detent unless a manual snap change has cleared it.

Updated the registry-owned mobile floating pill primitive to use circular
radius utilities for the pill and badge. Updated the registry-owned mobile
section editor to wrap rendered site content in `.site-frame-root` inside
`.rt-canvas`, matching the desktop/site CSS contract. No shadcn theme tokens or
registry token configuration were changed.

#### Validation
Focused reducer coverage now pins `0.42 -> 0.92 -> 0.42` and manual snap
override behavior. Registry source was rebuilt locally and pulled into the CMS
through the shadcn registry install path. Public registry deployment was
verified from `registries.optidigi.nl` after `optidigi/design-systems`
`4ec9f93`; focused mobile runtime probing confirmed initial selection at
`0.42`, field focus at `0.92`, blur restore to `0.42`, circular pill radius,
and `.rt-canvas > .site-frame-root` in the mobile section editor. Validation:
focused unit test, typecheck, `lint:no-css`, and registry drift check passed.

#### Follow-up — 2026-06-03
Operator live testing found a remaining mobile browser edge: selection could
visibly start at the editing detent (`0.92`) and then drop to compact (`0.42`)
after touch. `SET_SELECTED` was already correct and still opens at `0.42`; the
remaining issue was the registry-owned editor's broad focus capture, which
could promote the sheet during mount-time focus churn, plus a Vaul snap callback
fallback that coerced invalid/empty callback values into `0.42`.

The registry-owned mobile inspector was updated through `optidigi/design-systems`
so focus promotion only runs for real editable targets after the first settled
frame, with recent editable pointer interaction still allowed. The Vaul snap
callback now accepts only declared detents (`0.42` / `0.92`) and ignores invalid
values instead of coercing them into state.

Second same-day follow-up fixed the production-CSP half of the same symptom.
The mobile inspector uses a full-height Vaul host and depends on Vaul snap CSS
to translate that host into the compact/editing detents. Vaul injects its own
stylesheet at runtime without the request nonce, which is blocked by the
nonce-only production `style-src`. The registry-owned mobile inspector now
ships the required bottom-snap mechanics through a nonce-bearing `<style>` tag
owned by the component, while keeping drawer chrome/colors on existing
shadcn/token classes. This preserves the strict CSP instead of restoring
`style-src 'unsafe-inline'`.

### FE-97 — Dialog footer spacing and focus ring clipping

**Status:** Closed 2026-06-03 · **Layer:** multi-repo (`@siab/dialog` + CMS registry pull)
**Discovered in:** Session 2026-06-03 (operator screenshots of discard/restore dialogs)

#### Description
Shared dialogs could render action buttons cramped against the description, with
focused outline/ring treatment appearing clipped or accidental. The issue was
not isolated to the reported discard/restore dialogs: `DialogContent` wrapped
all children in one scroll container, so the primitive's outer grid gap did not
actually space headers, bodies, and footers, and the overflow wrapper could clip
focused button rings.

#### Resolution
Updated the registry-owned `@siab/dialog` primitive through
`optidigi/design-systems`. Dialog children now remain direct content-grid
children so native gap spacing applies, max-height scrolling is handled by the
dialog shell, and `DialogFooter` aligns row actions consistently on desktop.
No theme tokens, colors, or shadcn token configuration were changed.

#### Validation
The SIAB registry was rebuilt and redeployed, then `@siab/dialog` was pulled
back into the CMS through the shadcn registry path. Typecheck, zero-authored-CSS
lint, focused custom-dialog Playwright flow, and local browser geometry/screenshot
checks passed.

### FE-96 — Sidebar rich-text toolbar still used removed color flag

**Status:** Closed 2026-06-03 · **Layer:** multi-repo (`@siab/sidebar-inspector`, `@siab/mobile-inspector`, `@siab/rich-text-toolbar` + CMS editor contract)
**Discovered in:** Session 2026-06-03 (operator reported sidebar rich-text toolbar no longer worked after FE-95)

#### Description
After removing the manual text color control from the rich-text toolbar, the
sidebar rich-text editor still passed the old `allowColor` prop into
`LexicalField`. `LexicalField` also kept using that removed color flag as the
default switch for the remaining font-family toolbar chip, leaving the sidebar
toolbar path coupled to a feature that no longer exists.

#### Resolution
Removed `allowColor` from the editor contract and registry-owned toolbar
callers. Dedicated RichText block editors now opt into the font-family chip with
`allowFontFamily` directly. The sidebar, mobile editor, persistent toolbar, and
floating toolbar all use the same color-free contract.

#### Validation
Registry source rebuilt locally and the updated registry items were pulled into
the CMS. Typecheck, no-authored-CSS lint, registry drift, and focused rich-text
tests were run with the fix.

### FE-95 — Remove manual text color from rich-text toolbar

**Status:** Closed 2026-06-03 · **Layer:** multi-repo (`@siab/rich-text-toolbar` + CMS registry pull)
**Discovered in:** Session 2026-06-03 (operator editor testing after FE-94)

#### Description
The rich-text toolbar's manual text color control remained unreliable as an
editing workflow and conflicted with the preferred model: text color should
follow the tenant/site theme pipeline rather than be managed from the CMS
rich-text toolbar.

#### Resolution
The registry-owned rich-text toolbar no longer imports or renders the color
chip, even when callers pass `allowColor`. Existing structured rich-text color
serialization remains historical compatibility, but the authoring surface no
longer exposes manual text color selection.

The same registry pull also replaces the non-color toolbar chips' harsh
`ring-foreground` active outline with the standard shadcn pressed-fill state.

#### Validation
Registry source rebuilt locally and pulled into the CMS through the shadcn
registry install path. Typecheck and CI gates were run with the implementation.

### FE-94 — Rich-text toolbar color changes appear not to persist

**Status:** Closed 2026-06-03 · **Layer:** multi-repo (`@siab/rich-text-toolbar` + CMS rich-text serializer)
**Discovered in:** Session 2026-06-03 (operator editor test after RT toolbar bundle)

#### Description
When editing a RichText block and choosing a text color from the toolbar
palette, the selected color did not appear to persist on the text. The persisted
wire marker was `RtText.color` / `--rt-color:<id>`, but the editor did not also
restore an actual CSS `color` declaration for form-mode rendering. That made
saved colored text look unchanged when reopened outside the tenant canvas CSS
scope, even though the token marker could survive the JSON round trip.

#### Resolution
The registry-owned `ColorChip` now patches both the persisted `--rt-color`
marker and an editor-visible `color: var(--rt-tenant-color-<id>,
var(--color-<id>))` style. The CMS RtRoot-to-Lexical loader restores the same
display color when saved `RtText.color` content is reopened, while
`lexicalToRt` continues to persist only the `--rt-color` token marker as
`RtText.color`.

#### Validation
Focused rich-text unit tests pin RtRoot/Lexical round-trip persistence for
`RtText.color` and verify the reopened Lexical style includes both
`--rt-color:accent` and the editor display color fallback.

### FE-10 — Multilanguage dashboard (EN + NL at minimum)

**Status:** Closed 2026-05-25 · **Layer:** frontend
**Discovered in:** GitHub #28

#### Resolution
Admin CMS localization is now wired through `next-intl` with EN/NL locale files, browser/cookie fallback, and a cross-device `Users.language` preference. The account menu exposes the language switcher; changing language updates the user record, refreshes the admin shell, and persists the locale cookie.

The first translated surface covered the shared admin chrome, account menu, dashboard cards/charts/activity table, site overview labels, settings form, and profile/password form. This scope is the CMS/dashboard UI only; generated website content and future non-CMS languages remain separate follow-up work.

Follow-up 2026-05-25: completed the Dutch admin pass across list pages, user/site/page/media/navigation forms, onboarding, auth/reset-password forms, editor save/status chrome, mobile editor sheets, media usage/delete flows, activity timestamps/status labels, and registry-owned editor primitives. User-facing `tenant(s)` wording is now expressed as `site(s)` / `website(s)`; a locale coverage test guards EN/NL key parity and prevents visible tenant wording from returning.

### FE-50 — RichText toolbar: add font-family selector bound to tenant theme

**Status:** Closed 2026-05-22 · **Layer:** multi-repo
**Discovered in:** Session 2026-05-19 (FE walkthrough — operator request)
**Files:** `@siab/rich-text-toolbar`, `src/lib/richText/*`, `src/components/editor/richText/LexicalField.tsx`, `src/components/editor/canvas/inline/RtStaticView.tsx`, `siab-site-template`, `site-amicare-zorg`, `siab-payload-orchestrator`

#### Resolution
RichText now has a manifest-bound font-family chip in the persistent and floating toolbars. The chip reads `siteManifest.fontFamilies[]`, previews the tenant CSS variable, writes `--rt-font:<id>` into Lexical selection style, and mirrors that value to the stable DOM class `rt-font-<id>`.

The persisted wire format is `RtText.font`, validated against the tenant manifest. Existing tenants get default role font options (`title`, `heading`, `text`) via the CMS fallback manifest when `fontFamilies` is omitted; explicit `fontFamilies: []` still hides the chip.

The DOM/rendering contract is wired through the CMS canvas renderer, generated site template, current Amicare site renderer, and site-converter agent docs so saved font picks survive round-trip and render on live sites.

#### Validation
Focused rich-text coverage pins manifest parsing, validation, HTML mapping, RtRoot ↔ Lexical round-tripping, and static rendering for `RtText.font`. CMS typecheck, no-authored-CSS lint, design registry build, site-template Astro check/build/tests, and Amicare Astro check/build passed. `pnpm registry:check` is run after the public registry deployment so the committed CMS pull matches `registries.optidigi.nl`.

### FE-43 — Decide semantics for `appliesTo: "paragraph"` on text-node vs paragraph-level style

**Status:** Closed 2026-05-22 · **Layer:** frontend
**Discovered in:** Task 2 code review during FE-42 implementation
**Files:** `src/lib/richText/RtNode.ts`, `src/lib/richText/rtNodeSchema.ts`, `src/lib/richText/validateAgainstManifest.ts`, `src/lib/richText/mapper.ts`, `src/lib/richText/lexical/*`, `src/components/editor/canvas/inline/RtStaticView.tsx`, `@siab/rich-text-toolbar`

#### Resolution
Chosen semantic: `appliesTo: "paragraph"` is a paragraph-element style, not a text-node style. `RtParagraph` now has an optional `style` field, the validator accepts paragraph styles only on paragraph blocks, and text-node `style` now accepts only `appliesTo: "inline"`.

Lexical round-tripping uses a new `StyledParagraphNode` (`type: "styled-paragraph"`) mirroring the existing `StyledHeadingNode` pattern. The read-only/canvas renderer emits `rt-type-{id}` on the `<p>` element, and the HTML mapper reads paragraph-scoped `rt-type-*` classes from `<p>` tags.

The `@siab/rich-text-toolbar` registry source now applies paragraph styles by replacing the current paragraph block with `StyledParagraphNode` instead of patching `--rt-style` onto selected text. Active style detection also reads styled paragraph nodes.

#### Validation
Focused rich-text coverage pins validator semantics, zod parsing, mapper behavior, static rendering, and RtRoot ↔ Lexical round-tripping for styled paragraphs.

### FE-23 — "Sync manifest from siteRepo" admin action

**Status:** Closed 2026-05-22 · **Layer:** full-stack
**Files:** `src/components/forms/TenantEditForm.tsx`, `src/lib/actions/fetchTenantManifestFromRepo.ts`, `src/lib/github/siteRepoManifest.ts`

#### Resolution
The custom Tenant edit form now has a super-admin-only "Sync from source" action for `siteManifest`. The button reads the tenant's configured `siteRepo`, fetches `siteManifest.json` from GitHub, falls back to `siteManifest.example.json`, validates the JSON against `manifestSchema`, and loads it into the existing manifest textarea.

The sync is review-first: it marks the form dirty and does not PATCH the tenant until the operator presses Save. Private repos can be read when `GITHUB_TOKEN` or `GH_TOKEN` is present in the server environment; public repos work without a token.

2026-06-16 monorepo follow-up: the source parser now supports both legacy
repo-root sources (`owner/repo`) and monorepo site package sources such as
`Optidigi/siteinabox:sites/<slug>` or
`https://github.com/Optidigi/siteinabox/tree/main/sites/<slug>`. The sync
still fetches `siteManifest.json` first and falls back to
`siteManifest.example.json`, but now under the configured package path.

#### Validation
Focused unit coverage pins GitHub repo parsing, manifest fetch/validation, fallback behavior, auth-token header use, and the Tenant edit form's review-before-save wiring.

### FE-79 — Media library upload does not auto-appear until refresh

**Status:** Closed 2026-05-22 · **Layer:** frontend
**Discovered in:** Session 2026-05-22 (operator visual review)
**Files:** `src/app/(frontend)/(admin)/media/page.tsx`, `src/app/(frontend)/(admin)/sites/[slug]/media/page.tsx`, `src/components/media/MediaUploader.tsx`

#### Resolution
`MediaUploader` now supports an explicit `refreshOnUploaded` prop. The standalone media library pages opt into that prop, so a successful upload triggers `router.refresh()` after the success status and the server-rendered media grid updates without a manual browser refresh.

Picker and editor sheet flows remain callback-driven through `onUploaded`, so uploads inside pickers can reload/select in place without forcing a full route refresh.

Follow-up 2026-05-27: the shared `MediaPicker` now keeps the selected media
object in local form/editor state instead of immediately collapsing it to a bare
ID. Save handlers still normalize uploads to IDs before sending API payloads,
but page-editor previews that depend on `url` / `filename` now update as soon as
an image is picked. This specifically fixes the chrome/logo picker path where
removal was instant but adding an image was only visible after save + reload.

Follow-up 2026-05-28: `MediaGrid` now prunes stale selected IDs whenever the
server-rendered item list changes, and clears delete/usage dialogs if their
target disappeared. Single-item delete also removes that ID from local selection
before the route refresh returns, so the sticky selected-items bar cannot keep
counting a deleted image.

#### Validation
Focused unit coverage pins the `refreshOnUploaded` path, both management-page opt-ins, and callback-only picker flows.

### FE-63 — Navigation page-picker silently caps at 50 pages

**Status:** Closed 2026-05-22 · **Layer:** frontend
**Discovered in:** Session 2026-05-20, OBS-7 implementation
**Files:** `src/lib/queries/pages.ts`, `tests/unit/audit-p2-13-pagination-no-truncation.test.ts`

#### Resolution
`listPages(tenantId)` now delegates to `findAllPaginated` with the same tenant scope, sort, depth, and `overrideAccess` posture as the paginated listing query. The navigation page continues to call `listPages`, but it now receives the full tenant page set instead of only the first `DEFAULT_PAGE_SIZE` rows.

Added focused unit coverage proving `listPages` walks all pages for one tenant, preserves query arguments across each underlying Payload `find`, and does not include another tenant's docs.

#### Validation
shadcn registry queried ✓ · `pnpm test tests/unit/audit-p2-13-pagination-no-truncation.test.ts` ✓ (24 tests) · `pnpm typecheck` ✓ · `pnpm lint` ✓ (warning baseline only) · `pnpm lint:no-css` ✓

### OBS-37 — Round-3 e2e regression tests need rewrite for SidebarDrillDown UX

**Status:** Closed 2026-05-22 · **Layer:** infra (test infrastructure)
**Discovered in:** Session 2026-05-15, Rich Text v2 Phase 3 Round 3 final verification
**File:** `tests/e2e/round3-regressions.spec.ts`

#### Resolution
Rewrote the Round 3 local regression spec around the current editor UX:
- Added shared helpers that log in, open the local AMI editor page, and switch modes via the current `Editor view` segmented control.
- Added a `beforeEach` reset to canvas mode so canvas-only checks no longer depend on the prior test's persisted `editorMode`.
- Replaced the deleted `SectionsTree` / `ElementInspector` locators with current `SidebarDrillDown` locators: click block rows (`role=button` + `tabindex=0`), assert the block drill-down by the `Back to block list` button, back out, then drill into another block.

#### Validation
`pnpm typecheck` ✓. Focused Playwright execution was not run in this environment because Docker is not installed, so the local Postgres/dev-server seed path (`docker compose -f docker-compose.local.yml up -d` + `pnpm dev`) cannot be started here.

### FE-68 — Mobile editor: strip FE-67's manual keyboard handling (it fought iOS, didn't fix it)

**Status:** Closed 2026-05-22 — superseded by FE-69; diagnostic strip-back deployed + device-tested, canvas scroll-lock resolved but keyboard displacement remained · **Layer:** frontend
**Discovered in:** Session 2026-05-21, deep vaul-source root-cause review after FE-67 was confirmed still-broken on device
**Files:** `@siab/mobile-inspector` — `mobile-inspector-bar.tsx`, `mobile-component-editor.tsx`

#### Root cause (corrects FE-67)
FE-67's stated root cause — vaul's `onVisualViewportChange` mis-positioning the sheet at snap index 0 via the `&& activeSnapPointIndex` falsy guard — is real but **unreachable in our config**. FE-67 also set `repositionInputs={false}`, and vaul's handler early-returns at `if (!drawerRef.current || !repositionInputs) return` (`vaul/dist/index.mjs:1115`). FE-67 "fixed" a code path its own change had disabled — which is why the symptom never moved.

The actual mechanism: vaul's `preventScrollMobileSafari()` is what suppresses iOS Safari's native "scroll the page to centre a focused input" behaviour — vaul's own source comment (`index.mjs:162-167`) notes this *"may cause even fixed position elements to scroll off the screen."* That suppression is gated behind `modal`: `usePreventScroll` is disabled when `!modal` (`index.mjs:939-940`). The mobile inspector runs `modal={false}` (load-bearing — it keeps the canvas tappable behind the sheet), so iOS's native page-scroll-on-focus is **unsuppressed** and displaces the `position: fixed` sheet. FE-67 then layered a manual `visualViewport` listener + `scrollIntoView` on top — a second scroll *appended* to iOS's, producing the intermittent displacement + canvas scroll-lock. Structural: vaul couples `modal={false}` (needed for the interactive canvas) with disabling the iOS scroll-suppression — no prop combination unlocks both.

#### Fix shape
Strip FE-67's custom keyboard code so iOS handles the keyboard with no interference:
- `mobile-inspector-bar.tsx` — deleted the `visualViewport` listener + `--mobile-kb-inset` CSS var.
- `mobile-component-editor.tsx` — `onFocusCapture` reduced to `() => expandTo(0.92)`; removed the `--mobile-kb-inset` bottom padding and the `scrollIntoView` re-centre.
- **Kept:** `repositionInputs={false}` (vaul's buggy snap-0 handler stays off), `modal={false}`, `expandTo(0.92)`-on-focus (promotes the sheet clear of the keyboard — a snap change, not keyboard-fighting code), and FE-66's `.rt-content` 16px auto-zoom fix.

#### Confidence — deliberate bisection, not a certain fix (~55%)
Strip-back removes the CMS's contribution to the scroll-fighting; it cannot remove iOS's *native* `position: fixed` displacement. On-device outcome is diagnostic either way:
- **Acceptable** → close FE-68; it is a net code deletion.
- **Still janks** → proves the residual is iOS-native. Move 2: attack the positioning model (`fixed top-0 h-[100dvh]` is vaul's; `position: fixed` is the worst case on iOS + keyboard) or port vaul's `translateY(-2000px)` focus trick into a CMS-owned handler.

#### On-device test guidance
The verdict hinges on the **richtext field low in a tall array-item body** — longest editor body, field furthest from the top. With the `--mobile-kb-inset` padding gone, that is the case most likely to leave a field behind the keyboard (independent regression review, R1). Test that scenario specifically; a short single-text-field editor will read falsely optimistic.

#### Validation
typecheck ✓ · lint:no-css ✓ (0 violations) · 733/733 unit tests ✓ · two independent reviews (code-correctness → SHIP; regression audit → SHIP-WITH-CAVEATS) — no blockers. `registry:check` is expected-red until design-systems deploys.

#### Follow-up (FE-69)
FE-68's strip-back was **incomplete**: it retained `onFocusCapture={() => expandTo(0.92)}` on the editor scroll-region, treating it as "a snap change, not keyboard-fighting code." On device it remained broken — that focus-time snap *is* the trigger: the Vaul snap animation races the iOS keyboard-raise + native focus-scroll on the `position: fixed` sheet. FE-69 removes the `onFocusCapture` entirely and opens the sheet directly at 0.92 via `SET_SELECTED` (so it is already at the editing detent before any input can be focused), and swaps the height cap from `dvh` to `svh`. See FE-69.

---

### FE-69 — Mobile editor: focus-time snap is the displacement trigger — open at 0.92, drop the focus handler

**Status:** Closed 2026-05-22 — superseded by FE-70; device-confirmed keyboard-displacement fix, then replaced for compact-open UX · **Layer:** frontend
**Discovered in:** Session 2026-05-21, three-researcher + three-reviewer investigation after FE-68 was confirmed still-broken on device
**Files:** `@siab/mobile-inspector` — `mobile-inspector-bar.tsx`, `mobile-component-editor.tsx`; host — `src/components/editor/canvas/mobile/MobileEditorContext.tsx`

#### Root cause (corrects FE-68)
FE-67 introduced `onFocusCapture` on the editor scroll-region to promote the sheet to 0.92 for **all** field kinds (text / cta / richtext / array). FE-68 stripped FE-67's other custom keyboard code but **kept that handler**, mis-classifying it as "a snap change, not keyboard-fighting code." It is the trigger. When an input is focused, the `onFocusCapture` fires a Vaul snap animation that runs *concurrently* with the iOS keyboard-raise and iOS's native scroll-focused-input-into-view — three position mutations racing on the same `position: fixed` sheet, which displaces it. Before FE-67, focusing a text/cta field did nothing to the sheet at all; FE-67 added the handler, FE-68 carried it forward, so the symptom never moved. Secondary: the `h-[100dvh]` / `dvh`-based `maxHeight` cap is keyboard-blind — `dvh` does not shrink when the keyboard is up. Also corrected: FE-68's `modal={false}`-coupling root cause was wrong — `modal={false}` is the baseline (the canvas must stay tappable behind the sheet) and is not itself a defect.

#### Fix shape
Three changes — the sheet is at the editing detent *before* any input can be focused, so no focus-time mutation is needed:
- `mobile-component-editor.tsx` — removed `onFocusCapture={() => expandTo(0.92)}` from the editor scroll-region `<div>`, and dropped the now-unused `expandTo` from `MobileComponentEditor`'s `useMobileEditor()` destructure. Comment block rewritten to explain why focus must not move the sheet.
- `mobile-inspector-bar.tsx` — `h-[100dvh]` → `h-[100svh]` on `Vaul.Content`; `calc(${snapFraction} * 100dvh - 1rem)` → `... 100svh ...` on the editor-region `maxHeight`.
- `MobileEditorContext.tsx` (host) — `SET_SELECTED` reducer case now returns `activeSnapPoint: 0.92` (was `0.42`). `initialMobileEditorState` and `CLEAR_SELECTION` keep `0.42` (idle/dismissed detent).
- **Kept unchanged:** `modal={false}`, `repositionInputs={false}`, `SNAP_POINTS = [0.42, 0.92]`, the handle drag, FE-66's `.rt-content` 16px auto-zoom fix. The CMS still adds **no** custom keyboard JS.

#### Contingency
If residual displacement persists on device, the next move is to port Vaul's `translateY(-2000px)` focus trick into a **CMS-owned** focus handler — explicitly *not* re-enabling `repositionInputs` (its snap-0 handler is buggy) or `modal` (kills the interactive canvas).

#### On-device test guidance
Test the **richtext field low in a tall array-item body** specifically — longest editor body, field furthest from the top. That is the case most likely to expose any remaining displacement; a short single-text-field editor will read falsely optimistic.

#### Validation
typecheck ✓ · lint:no-css ✓ (0 violations) · full unit suite ✓ (`MobileEditorContext.test.ts` updated for the new `SET_SELECTED` snap). `registry:check` is expected-red until design-systems deploys.

#### Follow-up (FE-70)
The displacement fix is **confirmed working on device.** FE-69 opened the sheet at 0.92 on selection; per operator UX feedback FE-70 restores compact-on-open (0.42) with an *instant* (non-animated) pop to 0.92 on field focus — instant because an *animated* focus-pop is FE-67's displacement bug.

---

### FE-70 — Mobile editor: restore compact-on-open with an instant (non-animated) focus-pop

**Status:** Closed 2026-05-22 — superseded by FE-71; device-tested and rejected on iOS, Firefox/Chrome fine · **Layer:** frontend
**Discovered in:** Session 2026-05-21, operator UX feedback after FE-69 confirmed the displacement fixed
**Files:** `@siab/mobile-inspector` — `mobile-inspector-bar.tsx`, `mobile-component-editor.tsx`; host — `src/components/editor/canvas/mobile/MobileEditorContext.tsx`

#### Context
FE-69 fixed the keyboard-displacement (confirmed on device) by opening the sheet directly at the 0.92 editing detent — eliminating the focus-time snap animation that raced the keyboard. The cost: the sheet opens near-full on every selection. The operator wants it to open at the compact 0.42 detent (canvas sliver visible) and move to 0.92 only when a field is focused.

#### Why a naive re-add would re-break it
"Open at 0.42, expand to 0.92 on focus" is exactly FE-67's pattern. The displacement was the *animated* snap (0.42→0.92) running concurrently with the iOS keyboard-raise — racing position mutations on the `position: fixed` sheet. An animated focus-pop cannot be re-added.

#### Fix shape — instant (non-animated) pop
The pop is made instant: it settles in a single frame and never animates "into" the keyboard, so the keyboard rises against a settled sheet — the proven-good FE-69 geometry.
- `MobileEditorContext.tsx` — `SET_SELECTED` returns `activeSnapPoint: 0.42` again (compact on open). New transient `snapInstant?: boolean` state; `EXPAND_TO` takes an `instant` flag that sets it; new `CLEAR_SNAP_INSTANT` action.
- `mobile-component-editor.tsx` — re-added `onFocusCapture` on the editor scroll-region: focusing a field calls `expandTo(0.92, true)` (instant) unless already at 0.92.
- `mobile-inspector-bar.tsx` — when `snapInstant` is set, `Vaul.Content` gets `!transition-none` (stylesheet `!important` overrides vaul's inline snap transition → the snap applies with no animation). A 350ms timeout then clears `snapInstant` so drag-release and picker expands animate normally.
- **Kept unchanged:** `modal={false}`, `repositionInputs={false}`, `SNAP_POINTS = [0.42, 0.92]`, the handle drag, FE-66's 16px fix, FE-69's `svh` height cap. No custom keyboard JS.

#### Contingency
If the instant pop still displaces on device, fall back to FE-69's confirmed-working behaviour (open at 0.92 — `SET_SELECTED` → 0.92, drop `onFocusCapture`).

#### On-device test guidance
Tap an element → sheet opens compact (0.42). Tap a text / CTA / richtext field → sheet instant-pops to 0.92, keyboard rises, sheet stays put. Test the richtext field low in a tall array-item body specifically.

#### Validation
typecheck ✓ · lint:no-css ✓ · full unit suite ✓ (`MobileEditorContext.test.ts`: `SET_SELECTED` snap reverted to 0.42; `snapInstant` / `EXPAND_TO instant` / `CLEAR_SNAP_INSTANT` covered). `registry:check` expected-red until design-systems deploys.

#### Follow-up (FE-73)
FE-70's instant-pop (the `snapInstant` / `!transition-none` mechanism) was removed once FE-71 — suppressing iOS's native focus-scroll — was confirmed as the real fix on device. With the scroll suppressed the animated snap has nothing to race, so the focus-pop is back to vaul's normal animation. See FE-73.

---

### FE-71 — Mobile editor: suppress iOS Safari's native focus-scroll (Option A)

**Status:** Closed 2026-05-22 — on-device verified · **Layer:** frontend
**Discovered in:** Session 2026-05-21, three-researcher "Option A" investigation after FE-70 was confirmed still-broken on iOS
**Files:** host — `src/components/editor/canvas/mobile/useInspectorKeyboardLock.ts` (new); `@siab/mobile-inspector` — `mobile-inspector-bar.tsx`

#### Root cause (the iOS-specific part FE-70 could not fix)
On input focus, iOS Safari **synchronously and natively** scrolls the layout viewport to bring the focused input into the visual viewport; that scroll drags the `position: fixed` inspector sheet off-screen. It cannot be out-run — FE-67/68/70 all tried to move the sheet faster (animated, then "instant") and all lost the race, because iOS handles focus before any React update lands. Vaul ships the real fix — `preventScrollMobileSafari` — but gates it behind `modal={true}`; the inspector runs `modal={false}` (canvas tappable while selecting), so vaul's fix never engaged. Firefox/Chrome do not do this aggressive focus-scroll — which is why FE-70 works there and only iOS breaks.

Researched alternatives: the `interactive-widget` viewport meta, the `VirtualKeyboard` API, and `env(keyboard-inset-*)` are all confirmed **unsupported on iOS Safari** (WebKit, through Safari 26) — no platform API solves this. Suppression is the only path.

#### Fix
New host-side hook `useInspectorKeyboardLock(open)` ports vaul's `preventScrollMobileSafari` technique, **iOS-gated** and scoped to inspector inputs:
- On `touchend` / `focusin` of an input inside `[data-mobile-inspector-bar]`, briefly transform the focused element `translateY(-2000px)` so iOS's "centre the focused input" math computes a ~zero scroll, then restore it on the next frame.
- `touchend` additionally `preventDefault()`s the native focus-from-tap and focuses the element manually (`{ preventScroll: true }`) so the suppression is in place *before* iOS's synchronous focus-scroll.
- Then reveal the field within the sheet's own scroll region via a `scrollIntoView` that scrolls nested scrollables only (never the window), plus a window-scroll → `scrollTo(0,0)` guard.
- Contenteditable (Lexical) taps resolve to the editing host, not a nested node.
- `mobile-inspector-bar.tsx` calls `useInspectorKeyboardLock(!isIdle)`.

This is **additive** — everything from FE-70 (compact-open 0.42, instant focus-pop to 0.92, `svh` cap, `modal={false}`, `repositionInputs={false}`) is unchanged. The hook is a no-op off iOS, so Firefox/Chrome/Android are untouched.

Why this differs from FE-67's failed handler: FE-67 added a `scrollIntoView` that *raced/fought* iOS. This *suppresses* iOS — the exact, battle-tested technique vaul itself ships for modal drawers; we only re-scope when it runs.

#### Confidence — ~75%
The mechanism is well-understood and this attacks it at the source. Knocked down because: cannot device-test (iOS-Safari-only, not emulator-reproducible); iOS 26 changed focus internals enough that react-aria dropped the `translateY` trick on `main` — mitigated here by also passing `focus({ preventScroll: true })` (the operator's repro is iOS 18, where the trick is current and vaul still ships it); the Lexical `contenteditable` path is the genuine test unknown.

#### Contingency
If iOS still displaces after this, fall back to FE-69's confirmed-working behaviour (open at 0.92, no focus-pop) — a one-line revert.

#### On-device test guidance
Tap an element → sheet opens compact (0.42). Tap a text field, then a CTA field → sheet pops to 0.92, keyboard rises, **sheet must stay put** (no displacement off-screen). Then the hard case: a richtext field low in a tall array-item body — keyboard rises, sheet stays put, field reachable.

#### Validation
typecheck ✓ · lint:no-css ✓ · full unit suite ✓. `registry:check` expected-red until design-systems deploys.

---

### FE-72 — Mobile editor: draggable sheet body + restore detent on keyboard close

**Status:** Closed 2026-05-22 — on-device verified · **Layer:** frontend
**Discovered in:** Session 2026-05-21, operator UX tweaks after FE-71 fixed the iOS keyboard displacement
**Files:** `@siab/mobile-inspector` — `mobile-inspector-bar.tsx`, `mobile-component-editor.tsx`; host — `src/components/editor/canvas/mobile/MobileEditorContext.tsx`

#### Tweak 1 — the whole sheet body is draggable
The sheet ran vaul's `handleOnly` (drag only via the grip). Removed it — vaul's default lets the body be dragged, and vaul's built-in `shouldDrag` arbitrates per gesture: a non-scrollable (or scroll-top) spot drags the sheet, scrollable content mid-scroll scrolls. The `Vaul.Handle` stays as a visible grip affordance.

#### Tweak 2 — sheet returns to its pre-focus detent when the keyboard closes
Focusing a field pops the sheet to 0.92; it used to stay there after the keyboard closed. Now:
- `MobileEditorContext` — new `preFocusSnap` state; new `FOCUS_POP` action (pops to 0.92, instant, records the detent it came from); new `RESTORE_PRE_FOCUS_SNAP` action (returns to `preFocusSnap`, animated, clears it). `EXPAND_TO` clears `preFocusSnap` — a manual drag / picker-expand drops the restore intent, so the user's drag wins.
- `mobile-component-editor.tsx` — `onFocusCapture` calls `focusPop()` (was `expandTo(0.92, true)`).
- `mobile-inspector-bar.tsx` — a `visualViewport` resize listener detects the keyboard closing (viewport height-shrink crosses back under a 120px threshold) and calls `restorePreFocusSnap()`. The restore is an animated snap — nothing to race, the keyboard is already gone.

#### Notes
Both tweaks are additive — they do not touch FE-71's iOS keyboard-suppression. Edge to watch on device: a drag *gesture* starting on a text field moves the sheet (a plain tap still focuses it); if dragging in the rich-text field ever fights text selection, the targeted fix is a `data-vaul-no-drag` marker on it.

#### Follow-up (FE-74)
Tweak 1's whole-body drag is narrowed: the editor scroll region is now `data-vaul-no-drag` so overflowing content can scroll (otherwise vaul stole the first scroll as a sheet-drag). The sheet drags via the grip handle + the editor header row, not the scroll body — the standard bottom-sheet pattern. See FE-74.

#### Validation
typecheck ✓ · lint:no-css ✓ · full unit suite ✓ (`MobileEditorContext.test.ts`: `FOCUS_POP` / `RESTORE_PRE_FOCUS_SNAP` / `EXPAND_TO`-clears-`preFocusSnap` covered). `registry:check` expected-red until design-systems deploys.

---

### FE-73 — Mobile editor: remove the instant-pop, restore the normal snap animation

**Status:** Closed 2026-05-22 — on-device verified · **Layer:** frontend
**Discovered in:** Session 2026-05-21, cleanup after FE-71 was confirmed as the correct fix on device
**Files:** `@siab/mobile-inspector` — `mobile-inspector-bar.tsx`, `mobile-component-editor.tsx`; host — `src/components/editor/canvas/mobile/MobileEditorContext.tsx`

#### Context
FE-70 made the focus-pop (0.42 → 0.92) *instant* (a `!transition-none` override) to keep the snap animation from racing the iOS keyboard. FE-71 then fixed the displacement at its source by suppressing iOS's native focus-scroll. With FE-71 confirmed working on device, the instant-pop is redundant — the animated snap has nothing left to race — so it is removed, restoring vaul's normal snap animation.

#### Change
Removed the `snapInstant` machinery: the `snapInstant` state field, the `CLEAR_SNAP_INSTANT` action + `clearSnapInstant`, the `instant` param on `EXPAND_TO` / `expandTo`, the `!transition-none` conditional class on `Vaul.Content`, and the clear-timeout effect. `FOCUS_POP` now pops to 0.92 with vaul's normal transition. Everything else — FE-71's iOS keyboard-suppression, FE-72's draggable body + restore-on-keyboard-close — is unchanged.

#### Validation
typecheck ✓ · lint:no-css ✓ · full unit suite ✓ (`MobileEditorContext.test.ts`: `snapInstant` / `CLEAR_SNAP_INSTANT` / `EXPAND_TO instant` tests removed). `registry:check` expected-red until design-systems deploys.

---

### FE-74 — Mobile inspector polish: prompt keyboard-close restore, scrollable content, neutral focus ring, dead-code sweep

**Status:** Closed 2026-05-22 — on-device verified · **Layer:** frontend
**Discovered in:** Session 2026-05-21, operator cleanup pass + observations after FE-71/72/73
**Files:** `@siab/mobile-inspector` — `mobile-inspector-bar.tsx`, `mobile-component-editor.tsx`, `mobile-section-edit.tsx`, `mobile-page-settings.tsx`, `mobile-seo-settings.tsx`; `@siab/theme` — `registry.json` cssVars (`--ring`); host — `tests/e2e/ux/mobile-editor.spec.ts`

#### (a) Prompt restore when the keyboard closes
The keyboard-close restore was keyed solely on a `visualViewport` resize listener; iOS fires that event late on keyboard *hide*, so the sheet slid down ~1s after the keyboard. Now driven by a `focusout` listener on the inspector (fires synchronously when the field blurs), with the `visualViewport` resize kept as an idempotent fallback for swipe-dismiss. A `relatedTarget` guard avoids restoring on field-to-field focus moves.

#### (c) Overflowing content is scrollable
At 0.92, vaul's `shouldDrag` claimed the first upward scroll as a sheet-drag (it climbs to `Vaul.Content`'s `role="dialog"`), so tall editor content "snapped back" and could not be scrolled. The editor scroll region now carries `data-vaul-no-drag` (vaul's documented escape — that region always scrolls), `touch-pan-y` (native panning over vaul's `touch-action:none`), and unconditional `overflow-y-auto` (scrollable at both detents). The sheet still drags via the grip handle + the editor header row. This deliberately narrows FE-72's whole-body drag to the standard bottom-sheet pattern — content scrolls, chrome drags.

#### (e) Neutral focus ring
`--ring` was `oklch(0.902 0.194 99)` — a bright, saturated yellow, app-wide, light and dark. Retuned to the conventional neutral (light `oklch(0.708 0 0)`, dark `oklch(0.439 0 0)` — matching the theme's existing `--sidebar-ring`). Edited in `@siab/theme`'s `registry.json` cssVars; `globals.css` regenerates on re-pull.

#### Dead-code sweep (audit findings)
- `mobile-section-edit.tsx` — rewrote a stale doc comment describing a pre-FE-69 "persistent idle strip."
- `mobile-inspector-bar.tsx` — removed the unused static `data-mobile-inspector-mode="editing"` attribute (nothing read it).
- `mobile-page-settings.tsx` / `mobile-seo-settings.tsx` — dropped two empty `*Props` interfaces (only held a stale changelog comment; components take no props).
- `tests/e2e/ux/mobile-editor.spec.ts` — fixed AC12's selector (`data-mobile-save-badge` → `data-mobile-save-pill`, which never matched); removed AC11b, which drove a `mobile-row-duplicate` page row that was never built (if page-duplication ships later, re-add the test).
- Audit confirmed no orphaned files / dead exports — the FE-66→73 cleanup was complete.

#### Validation
typecheck ✓ · lint:no-css ✓ · full unit suite ✓. `registry:check` expected-red until design-systems deploys.

---

### FE-75 — No input autofocus on touch devices

**Status:** Closed 2026-05-22 — on-device verified · **Layer:** frontend
**Discovered in:** Session 2026-05-21, operator observations (b) icon picker keyboard covers the grid, (d) page-delete modal keyboard blocks positioning
**Files:** `@siab/utils` — `utils.ts`; `@siab/dialog` / `@siab/popover` / `@siab/sheet` — `dialog.tsx`, `popover.tsx`, `sheet.tsx`; host — `Hero.tsx`, `Testimonials.tsx`

#### Problem
On phones, opening a modal / sheet / popover auto-focused its first text input, which popped the on-screen keyboard — covering the icon grid in the icon picker, and stopping the page-delete dialog from positioning into view. An audit found 14 autofocus sites: 9 via Radix `Dialog` / `Popover` / `Sheet` auto-focusing their first focusable child on open, and 5 explicit `autoFocus` props on canvas inline editors.

#### Fix
- New `isCoarsePointer()` helper in `@siab/utils` — `matchMedia("(pointer: coarse)")`, SSR-safe.
- The registry `DialogContent` / `PopoverContent` / `SheetContent` primitives intercept `onOpenAutoFocus`: on a coarse-pointer device they `preventDefault()` the input autofocus and focus the *container* instead (focus still enters the surface — a11y preserved). Desktop is unchanged. One change per primitive covers all 9 modal / sheet / popover sites (typed-confirm-dialog, mobile-icon-sheet, icon-picker, link-popover, the user forms, themed-node-dialog, InlineCtaButton, NavEntryDialog).
- The 5 explicit `autoFocus` props on the canvas inline editors (`Hero` pill label; `Testimonials` title / quote / author / role) are now `autoFocus={!isCoarsePointer()}`.

#### Notes
The handler is composed — any caller-supplied `onOpenAutoFocus` still runs after the touch guard, so the `*-chip` popovers that already `preventDefault` are unaffected. The base `dialog`/`popover`/`sheet` are `@siab/*` registry items, so this is a registry-source change, not a per-call-site one.

#### Validation
typecheck ✓ · lint:no-css ✓ · full unit suite ✓. `registry:check` expected-red until design-systems deploys.

---

### FE-76 — Mobile inspector snap duration matches keyboard-close restore — REVERTED

**Status:** Closed 2026-05-22 — reverted after on-device verification · **Layer:** frontend
**Discovered in:** Session 2026-05-21, follow-up after FE-74 reduced keyboard-close restore from ~1s late to a visible animation tail
**Files:** `@siab/mobile-inspector` — `mobile-inspector-bar.tsx`

#### Root cause
FE-74 made the restore start promptly by listening for `focusout`, but the sheet still used Vaul's default snap transition: `transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)`. On iOS the keyboard hide animation is materially shorter, so after the keyboard is already gone the sheet can still be visibly sliding down for the remainder of Vaul's 500ms snap.

#### Fix
Use a blanket transition override on `Vaul.Content`: `duration-[250ms]! ease-out!`. This keeps Vaul's transform transition and controlled snap logic intact while shortening every mobile inspector snap to roughly track keyboard hide. It intentionally applies to focus-pop, drag-release, keyboard-close restore, and dismiss snaps rather than reintroducing transient "only during keyboard close" state.

#### Device result
Rejected. On iPhone the animation was visibly faster, but the delay remained. That proves the residual is not primarily Vaul's 500ms animation tail; it is a late restore trigger relative to the native keyboard dismissal. The override made the sheet feel less natural without removing the observed delay, so it was removed and Vaul's default snap speed restored.

#### Research verdict
No reliable web-level hijack was found for the keyboard-dismiss path. The browser does not expose a `keyboardwillhide`/animation-start event or keyboard animation curve to web content. The available options are all incomplete:
- `visualViewport.resize`/geometry is the right primitive in theory, but WebKit bug 265578 documents iOS Safari updating visual viewport height only at the end of the keyboard open/close animation in the bottom-address-bar state.
- `focusout`/`blur` is the earliest DOM signal available for normal field blur, but keyboard chrome interactions can still be delivered late relative to the native hide animation.
- `navigator.virtualKeyboard`, `geometrychange`, and `keyboard-inset-*` would be the correct explicit API, but the VirtualKeyboard API is unsupported in Safari/iOS Safari.
- Intercepting the keyboard's Done/hide button is not possible from page JavaScript; that UI is outside the DOM event stream.

Possible non-reliable mitigations if the UX still needs work: add an explicit in-sheet Done/Collapse button that calls `restorePreFocusSnap()` before blurring the field, or test standalone/PWA / hidden-toolbar modes where WebKit reports viewport changes earlier. Neither covers the native keyboard Done/swipe-dismiss path reliably.

#### Notes
This is polish, not a correctness fix. iOS Safari does not expose the exact keyboard duration/curve to web code, and the native timing varies by device/settings, so the target is "near-imperceptible tail", not mathematically zero drift.

#### Validation
Original attempt: typecheck ✓ · lint:no-css ✓ · registry:check ✓ · focused unit test ✓ (`MobileEditorContext.test.ts`). Revert validation: typecheck ✓ · lint:no-css ✓ · registry:check ✓ · focused unit test ✓ (`MobileEditorContext.test.ts`).

---

### FE-77 — Mobile inspector: app-owned Done exit and no keyboard-close auto-restore

**Status:** Closed 2026-05-22 — on-device verified · **Layer:** frontend
**Discovered in:** Session 2026-05-22, follow-up UX decision after FE-76 proved Safari keyboard-Done timing cannot be reliably hijacked
**Files:** `@siab/mobile-inspector` — `mobile-inspector-bar.tsx`, `mobile-component-editor.tsx`; host — `src/components/editor/canvas/mobile/MobileEditorContext.tsx`, `tests/unit/MobileEditorContext.test.ts`

#### Context
FE-76 proved the remaining delay is not Vaul's snap duration. On iPhone Safari, pressing the native keyboard Done button can delay page-visible restore timing until after Safari's bottom URL row finishes moving. Web code has no reliable `keyboardwillhide` signal for that native chrome path.

#### Change
- `mobile-component-editor.tsx` — replaced the icon-only close button with an app-owned Done action. Follow-up 2026-05-22: restyled it as an icon-only check pill (`size-9`, rounded, token-toned) to match the mobile pill language instead of showing text. On touch, the button closes on pointer-down so the app-owned exit wins before Safari's native blur timing; it still has `onClick` for mouse/keyboard activation.
- `mobile-inspector-bar.tsx` — removed the `focusout` and `visualViewport.resize` keyboard-close auto-restore handlers. Native keyboard Done now hides the keyboard but leaves the sheet at the full editing detent.
- `MobileEditorContext.tsx` — removed `preFocusSnap` and `RESTORE_PRE_FOCUS_SNAP`; `FOCUS_POP` only moves the sheet to `0.92`.
- Drag/overscroll — the editor scroll body no longer carries blanket `data-vaul-no-drag`, so Vaul can drag the sheet downward from scroll-top while normal upward/mid-content gestures keep scrolling. `overscroll-contain` stays on the scroll body and is added to the sheet wrappers to reduce scroll-chain escape into Safari pull-to-refresh. The Done button itself remains `data-vaul-no-drag`.

#### Intended UX
Tap a field → sheet opens full for editing. Press the native keyboard Done button → keyboard hides and the sheet stays full. Tap the app check pill → editor/sheet closes entirely. Drag down from the sheet to collapse/close manually.

#### Validation
design-systems registry build ✓ · public registry deploy ✓ (`73c16d2`, icon-pill follow-up `0902059`) · typecheck ✓ · lint:no-css ✓ · registry:check ✓ · focused unit test ✓ (`MobileEditorContext.test.ts`) · payload image build ✓ · production deploy ✓ (`261107f`) · health ✓.

---

### FE-78 — Page editor draft recovery for native mobile refresh

**Status:** Closed 2026-05-22 — on-device verified · **Layer:** frontend
**Discovered in:** Session 2026-05-22, iPhone Safari pull-to-refresh can bypass the custom unsaved-changes modal
**Files:** `src/components/forms/PageForm.tsx`, `src/lib/editor/pageDraftStore.ts`, `src/components/forms/PageDraftRecoveryDialog.tsx`, `@siab/mobile-floating-pill`

#### Context
Research confirmed there is no reliable way for web code to intercept iOS Safari's native pull-to-refresh/browser refresh path and show the app's custom discard dialog. `beforeunload` is native/generic and unreliable on mobile; `overscroll-behavior` is only a mitigation on iOS Safari. The reliable product fix is to preserve dirty editor work across a native refresh rather than trying to block the refresh.

#### Change
- Page editor drafts are persisted locally while dirty, including RHF page values and tenant theme state.
- Storage prefers IndexedDB and falls back to localStorage for constrained/private contexts.
- On reload, a newer valid local draft opens a restore/discard dialog before editing continues.
- Successful save and explicit discard clear the local draft.
- The mobile destructive floating pill now keeps the standard pill surface and removes the red border/ring; only the trash icon is red.

#### Validation
Draft recovery: typecheck ✓ · lint:no-css ✓ · registry:check ✓ · focused unit test ✓ (`pageDraftStore.test.ts`). Registry source: design-systems `b43d14d`, image build ✓, VPS `docker compose pull && up -d` ✓, public registry JSON verified ✓, `@siab/mobile-floating-pill` re-pulled into `siab-payload`. Payload CI ✓ · image build ✓ · production deploy ✓ (`0247795`) · health ✓.

---

## Frontend Items

### FE-106 — Dashboard and analytics charts need clearer color systems

**Status:** Closed 2026-06-05 · **Layer:** frontend / analytics UX
**Discovered in:** Session 2026-06-05 (operator backlog request)

#### Description
Dashboard and analytics charts should use distinct, complete color schemes so
different value representations are easy to distinguish. Current charts reuse a
small set of chart tokens, which can make bars, pies, areas, and multi-series
values feel less differentiated than the data deserves.

#### Suggested fix shape
Audit every dashboard and analytics chart. Define a consistent chart color
assignment strategy per metric family and chart type using existing theme/chart
tokens where possible. Ensure adjacent series and pie slices remain legible in
light and dark modes, and verify charts with realistic data.

#### Resolution — 2026-06-05
Analytics now uses a richer app-owned chart composition on top of the existing
`@/components/ui/chart` primitive: traffic remains an area chart, top pages use
bar comparison, source/device splits use donut charts, form funnel uses radial
progress, journey/scroll progression uses a line chart, section performance uses
stacked bars, and component performance uses radar. Related datasets are grouped
by outcome summary, acquisition, conversion path, content/interaction behavior,
and geography for super-admin, owner, editor, and viewer analytics routes.

The existing `--chart-1` through `--chart-5` token contract remains intact and
registry-owned global token files were not edited. App-owned dashboard and
analytics chart configs now assign metric families to the existing semantic
token surface (`brand`, `success`, `warning`, `destructive`) plus chart tokens,
so adjacent series are easier to distinguish without touching
`src/components/ui/*`.

Validation: `pnpm typecheck`, `pnpm registry:check`, and `pnpm lint:no-css`
passed locally under Node 24 with the expected Node 26 engine warning.

### FE-107 — Analytics chart selection and color palette need interactive review

**Status:** Closed 2026-06-08 · **Layer:** frontend / analytics UX
**Discovered in:** Session 2026-06-06 (operator visual-review follow-up after FE-106 deploy)

#### Description
FE-106 shipped a richer analytics chart composition and deployed it for visual
review, but the chart selection and palette direction are not final. The current
implementation intentionally mixes semantic tokens (`brand`, `success`,
`warning`, `destructive`) with existing chart tokens so the operator can review
whether the UI should keep stronger categorical colors or return closer to the
intended monochrome/grayscale chart language.

The current chart set also should not be treated as a final claim that every
available chart type is used optimally. Some shadcn/Recharts chart families are
available but may not be valuable for the current datasets, and the useful
choice needs interactive review against real analytics data.

#### Suggested fix shape
1. Review the deployed analytics page with realistic tenant and super-admin
   data.
2. Decide the final palette direction: semantic/categorical colors, mostly
   monochrome/grayscale, or a small hybrid with strict metric-family rules.
3. Confirm chart choices per dataset: keep, replace, remove, or add charts only
   where the visual form makes the metric easier to understand.
4. If global chart tokens need new semantics or values, route that through
   `optidigi/design-systems` and pull the registry update back into this repo;
   do not hand-edit registry-owned primitives.
5. Update FE-106's shipped chart composition if review shows that any chart is
   decorative, misleading, too colorful, or not the clearest representation.

#### Update — 2026-06-07

Operator chose the monochrome/grayscale direction for current analytics chart
rendering. App-owned analytics chart configs now use only existing
`--chart-1` through `--chart-5` tokens for series, pies, bars, lines, radar,
radial bars, and traffic area gradients. Semantic `brand`, `success`, `warning`,
and `destructive` tokens remain available for non-chart UI states, but are no
longer used by the analytics chart components. No registry-owned primitives or
global chart token values were changed.

Same-session phase 1 follow-up paired previously table-only super-admin CMS
analytics sections with charts: event volume now has a bar chart, CMS route
metrics and device metrics now have stacked bar charts, and CMS action metrics
now has a horizontal bar chart. The dashboard now keeps its CMS usage chart/table
pair together, uses chart tokens only, and switches cramped phone bar surfaces to
compact fixed-bucket mobile bars. The edits trend is now a bar chart with the
same phone-safe mobile bar treatment. Chart configurability and splitting
analytics into separate metric views remain the next phases.

Same-session phase 2 follow-up split analytics into URL-driven metric views:
overview, acquisition, conversion, behavior, geography, plus a super-admin-only
CMS view. The analytics routes now conditionally call only the query helpers
needed for the active view while still loading the overview availability check.
The traffic trend chart now has app-owned controls for chart type (area, line,
bar) and visible series (pageviews, visitors). Chart containers no longer pass
negative initial dimensions, which removes the Recharts placeholder warning
noise observed after the phase 1 deploy.

Closure note 2026-06-08: operator review accepted the current analytics chart
direction. Follow-up work moved to performance/Web Vitals product semantics
under OBS-114 and installation-health tracking under OBS-115.

### FE-108 — Analytics review UX follow-up: switching, tabs, and aggregate behavior

**Status:** Closed 2026-06-08 · **Layer:** frontend / analytics UX
**Discovered in:** Session 2026-06-08 (operator analytics review)

#### Description
The super-admin analytics site selector changed route state without any visible
pending feedback, making site switches feel ambiguous. The analytics view tabs
could show an unnecessary vertical scrollbar on constrained widths. The
super-admin all-sites behavior view also reused single-site presentation too
directly: site-quality checks only make sense for one tenant, and aggregate Web
Vitals needed a per-site comparison shape. The site performance table used too
many columns for the card width and could force horizontal scrolling.

#### Resolution
The super-admin site selector now lives inside the analytics period frame, so
switching between individual sites and "all sites" disables the selector and
shows the same skeleton loading state as period/view transitions while the route
transition is in flight. The analytics tab list hides vertical overflow and
keeps horizontal overflow visually clipped. Super-admin all-sites behavior now
has a tenant-level Web Vitals comparison query/card and omits the single-tenant
site-quality card. The site performance table was replaced with compact
per-site metric rows so the card does not require horizontal scrolling.

#### Validation
`pnpm test tests/unit/analytics-queries.test.ts`, `pnpm typecheck`, and
`pnpm lint:no-css` passed locally under Node 24 with the expected Node 26 engine
warning.

### FE-105 — Page editor block names should be semantic for normal users

**Status:** Active · **Layer:** frontend / editor UX
**Discovered in:** Session 2026-06-05 (operator backlog request)

#### Description
Technical block names such as `hero` and `cta` do not necessarily mean anything
to a normal site owner. The page editor should display block labels that are
semantic and task-oriented from the user's perspective while still preserving
stable internal block type identifiers.

#### Suggested fix shape
Audit block labels in the canvas, sidebar, add-block picker, mobile editor, and
manifest-driven menus. Prefer labels like "Intro banner", "Contact section",
"Services", or site/theme-specific copy where appropriate. Keep internal
`blockType` values unchanged and ensure translations/manifest labels can carry
friendly names.

### FE-104 — Mobile login/auth page needs stronger visual polish and logo

**Status:** Active · **Layer:** frontend / auth UX
**Discovered in:** Session 2026-06-05 (operator backlog request)

#### Description
The login/auth pages need a better phone experience. The mobile view should
feel intentionally designed, use the SIAB logo/brand clearly, and avoid a
generic form-only presentation. This is separate from the earlier desktop/login
polish lineage because the current request is specifically about phone layout
and first impression.

#### Suggested fix shape
Review `/login`, `/forgot-password`, and `/reset-password/[token]` on small
viewports. Align the auth forms with the current SIAB design language, add the
appropriate logo mark/wordmark, preserve accessibility and password-manager
behavior, and verify the pages on phone-sized screenshots.

### FE-103 — Prefer page/section/link pickers over raw href and technical URL typing

**Status:** Active · **Layer:** frontend / editor UX
**Discovered in:** Session 2026-06-04 (operator mobile/editor follow-up)

#### Description
Several CMS editing surfaces still ask users to type technical link values
directly, especially CTA/button `href` fields and footer/custom link rows. This
is error-prone and inconsistent with the navigation manager, where users can
dynamically select a page or section instead of hand-writing an href.

The desired direction is to replace raw URL/href typing as much as possible
with structured selectors:

- Internal page selector for links to tenant pages.
- Section/anchor selector for links to sections on the current page/site.
- Clear external/custom URL option only when a real external/manual target is
  needed.
- Reuse the navigation page's page/section picker behavior and data model where
  practical, instead of inventing a separate one-off picker per field.

#### Suggested fix shape
Research the current link-entry surfaces first: `InlineCtaButton`,
`block-form-fields`, `mobile-component-editor`, rich-text link popover,
footer/chrome link rows in `PageForm`, and navigation manager types/actions.

Plan whether CTA/link values should keep storing the existing `{ label, href }`
shape with a picker that writes the resolved href, or whether they should move
toward the navigation model's structured `page` / `section` / `custom` entries.
The decision must preserve dynamic CMS behavior for future tenant sites and
avoid breaking existing saved content, projections, and generated-site renderers.

#### Acceptance notes
- Users should not need to know or type internal slugs, hashes, or relative URLs
  for normal page/section links.
- Existing custom/external URLs remain possible, validated, and clearly
  separated from internal targets.
- The same link-picker pattern should work in desktop sidebar, mobile bottom
  inspector, inline CTA editing, and any future block manifest field that maps
  to a link/CTA value.
- Any schema/model migration must be planned before implementation; do not
  silently change persisted link shape without projection and compatibility
  coverage.

### FE-102 — Mobile editor bottom sheet interaction needs deeper UX refactor

**Status:** Active · **Layer:** frontend / registry UX
**Discovered in:** Session 2026-06-04 (operator mobile editor retest)

#### Description
The mobile editor bottom sheet works, but the interaction quality is still not
good enough. It can feel laggy/glitchy, snap transitions can appear delayed, and
the draggable handle/active drag area is too small and easy to miss on a phone.

This should not be treated as another narrow patch until the interaction model
is reviewed. Recent fixes around Vaul `handleOnly`, CSP-safe Vaul CSS, keyboard
focus promotion, and direct media picking have reduced obvious bugs, but the
remaining issue is broader UX quality and may call for a refactor of the mobile
inspector/sheet composition.

#### Suggested fix shape
Research and spar before implementation. Review the current `@siab/mobile-
inspector` Vaul setup, snap points, transition timing, drag handle geometry,
touch target sizing, keyboard/focus behavior, direct media picker bypass, and
how much editor UI should live inside a draggable bottom sheet at all.

Possible directions to evaluate:

- Larger, more discoverable handle/hit target while keeping controls tappable.
- A clearer split between compact inspector, full editor, and direct modal/sheet
  flows such as media selection.
- Whether Vaul remains the right primitive for this surface or whether a simpler
  custom state machine/composite would be more reliable.
- Whether snap points, open/close timing, and keyboard promotion should be
  redesigned rather than tuned.

#### Acceptance notes
- Do not regress the intended first-selection behavior: normal editable fields
  open compact first, then promote when the user focuses an input.
- Buttons and controls inside the inspector must remain reliably tappable.
- Dragging should be obvious and forgiving on real mobile devices.
- The solution must stay token/component based, preserve CSP nonce requirements,
  and route registry-owned primitive/composite changes through
  `optidigi/design-systems`.

### FE-80 — Unify saved/save-failed badge UI through one registry component

**Status:** Closed 2026-05-28 · **Layer:** frontend / registry
**Discovered in:** Session 2026-05-26 (operator page-editor polish review)

#### Description
Saved and save-failed badges should use the same style, content, and behavior
everywhere. The page editor's newer save-state treatment is the desired behavior
and copy shape, but the visual colors should preserve the older good colors.

There should not be two near-duplicate save/status components drifting apart.
Prefer rewriting or extending the default `@siab/*` shadcn/registry component so
all consumers use the same source of truth.

#### Suggested fix shape
Audit page editor, mobile save pill, navigation/settings forms, and any other
save-status surfaces. Move the chosen saved/error/dirty badge variants into the
registry-owned component or a single registry-owned composition, then re-pull it
into `siab-payload`. Remove duplicate local implementations once all call sites
use the shared component. Verify saved, dirty, saving, and failed states in both
desktop and mobile editor flows.

#### Progress — 2026-05-27
Batch 1 audit confirmed the main app call sites already consume the registry
save primitives (`SaveButton`, `SaveStatusBar`, `MobileSavePill`) across the
page editor, navigation manager, settings form, tenant edit form, and user edit
form. The form-submission status drawer now also uses `SaveButton` after being
converted to explicit-save behavior under FE-85.

Backlog correction 2026-05-27: the broad "remaining scope is registry-owned"
note was too strong. The app already consumes the registry-pulled save
primitives (`SaveButton`, `SaveStatusBar`, `MobileSavePill`). The next FE-80
slice should first verify state/copy/color consistency across call sites and
close any app-local wiring gaps. Only primitive API or visual-token changes
should be routed through `@siab/*` registry source before being re-pulled here.

FE-80 execution 2026-05-27: `save-ui` is owned in the `@siab/*` design-system
registry and re-pulled into `siab-payload` as
`src/components/save-ui/save-status-bar.tsx` and
`src/components/save-ui/mobile-save-pill.tsx`. It keeps the newer bottom-center
position and compact badge shape, restores the stronger success/destructive
contrast observed to work better in CMS dark mode, and preserves the existing
`SaveStatusBar` lifecycle semantics. Page editor, navigation, settings, tenant
edit, and user edit import the registry primitives directly. Settings, tenant
edit, user edit, and profile name editing now count validation errors with the
same leaf-error helper as the page editor, passing those counts into
`SaveButton`, `SaveStatusBar`, and `MobileSavePill` where relevant. Duplicate
save-result notifications were removed from registry-backed save surfaces,
including the navigation manager and form-submission status sheet, so explicit
save flows use the merged save badge only.

Follow-up 2026-05-28: the registry now owns a shared `@siab/status-badge`
primitive. `SaveStatusBar` renders `StatusBadge`, and saved/non-validation
failed states are again rendered by `SaveStatusBar` itself instead of any popup
system. The app root now exposes a `StatusFeedbackProvider` for non-form status
feedback such as media upload/delete, copy, account, and table actions. That
provider renders the same status-badge geometry (`h-8` / `px-3` /
`rounded-md`) and supports loading -> success/error replacement by id.

Follow-up same session: the previous popup library was removed from Payload
status feedback entirely. The root notification host was removed, app call sites now use the shared
status badge provider, media upload/delete show `Uploading...` / `Deleting...`
before replacing that same badge with success or failure, and the direct
notification dependency was dropped from the app.

Final closure 2026-05-28: the media page already used the shared
`StatusFeedbackProvider`/`StatusBadge` path. The remaining mismatch was the
global feedback host's fixed-position anchor: it was mounted above the admin
sidebar provider and therefore did not apply the same sidebar center offset as
`SaveStatusBar`. The feedback host now derives the active admin sidebar width
from the DOM and uses the same bottom-center geometry as `SaveStatusBar`, while
continuing to render the registry-owned `StatusBadge`. The current residual
save/status behavior concern is no longer component duplication; it is tracked
separately as FE-89.

---

### FE-88 — RichText canvas selection targets the section instead of the rich-text element

**Status:** Closed 2026-05-28 · **Layer:** frontend
**Discovered in:** Session 2026-05-28 (operator canvas QA)

#### Description
RichText blocks cannot be selected directly from the canvas in either canvas
mode or sidebar mode. In sidebar mode, selecting the rich-text field from the
sidebar works, but the hover/selected affordance on the canvas targets the
surrounding section/block instead of the rich-text element itself.

#### Suggested fix shape
Audit `RichTextCanvas` and `RtSlot` selection wiring. The rich-text body should
carry the same stable `ElementPath` hit target, hover outline, and selected
pulse behavior as other inline/editable elements. Fix both canvas and sidebar
views, and verify mobile mode separately.

#### Progress — 2026-05-28
`RtSlot` no longer unwraps addressed block rich-text fields into bare static
markup, so RichText body content keeps its `ElementPath`, click handler, hover
outline, and selected affordance. Canvas-mode clicks stop at the rich-text slot
before reaching the surrounding section wrapper, and the block hover outline is
suppressed while an inline/edit target is hovered or selected.

Follow-up closure 2026-05-28: field-level selection no longer mirrors into the
whole block's active section outline. `CanvasMode` only paints the block active
outline for true block-level selections (`field === ""`), so selecting the
RichText body shows the rich-text slot affordance instead of a misleading
whole-section outline.

### FE-89 — Save status should clear when a change is reverted to its baseline

**Status:** Closed 2026-06-02 · **Layer:** frontend / product behavior
**Discovered in:** Session 2026-05-28 (operator canvas QA)

#### Description
Some editor surfaces show the saved/status badge after the user changes a value
and then changes it back to its original value. At that point no effective
change remains, but the UI still behaves as if something changed and was saved.
This reads like an autosave happened even though the final state matches the
baseline.

#### Suggested fix shape
Audit the dirty/baseline comparison used by `SaveStatusBar`, site chrome state,
theme state, navigation membership, and any local form surfaces that feed the
shared status badge. Reverted values should clear dirty state without emitting a
saved transition unless a real persistence operation occurred. Add coverage for
change → revert cycles across normal page fields, footer chrome fields, and
other known affected surfaces.

#### Research update — 2026-05-28
The likely root cause is the current `lastSavedAt` fallback in save-state
derivation. Page editor, navigation, and form-submission flows can render
`status="saved"` whenever `lastSavedAt` is set and dirty state is currently
false, even if the latest user interaction was change -> revert with no
persistence operation. Treat saved as an explicit save-transition event, not a
generic clean-state signal.

#### Current verification — 2026-05-28
Still current. `PageForm`, `NavigationManager`, `SettingsForm`,
`TenantEditForm`, `UserEditForm`, and `FormSubmissionSheet` still derive
`saved` from a non-null `lastSavedAt` after dirty state clears. That matches the
reported misleading change -> revert badge behavior.

#### Resolution — 2026-06-02
Save-status derivation now uses an explicit `showSaved` flash instead of a
stale `lastSavedAt` clean-state fallback. Page editor, settings, tenant edit,
user edit, profile name edit, form submission status, and navigation manager all
clear the saved flash on the next user edit; change -> revert now returns to
idle unless a real save occurred.

#### Validation
`pnpm test tests/unit/save-status-ui.test.ts
tests/unit/components/siteChromePreview.test.ts
tests/unit/richtext-canvas-selection.test.ts` passed. `pnpm typecheck`,
`pnpm registry:check`, and `pnpm lint:no-css` passed with the local Node 24 vs
repo Node 26 engine warning only.

---

### FE-90 — Empty newly-added canvas blocks need editable empty-state affordances

**Status:** Closed 2026-06-02 · **Layer:** frontend
**Discovered in:** Session 2026-05-28 (operator canvas QA)

#### Description
When adding new blocks in canvas mode, an empty block can render with no visible
editable target, leaving the user no way to add content directly in the block.
Hero is a partial exception because button and pill controls remain visible, but
other blocks can appear effectively uneditable until content already exists.

#### Suggested fix shape
Audit every canvas block renderer for empty/default content states. Each block
should render stable click/edit targets or an inline empty-state affordance for
its primary fields, consistent with existing `RtSlot`, `ClickToEditField`,
image, CTA, and array editing patterns. Verify canvas mode, sidebar mode, and
mobile behavior so newly inserted blocks can always be populated without relying
on hidden controls.

#### Research update — 2026-05-28
New blank blocks are inserted with only `blockType` plus optional anchor/seed.
Empty rich-text slots can render `null` before editing, and array-based blocks
such as FeatureList and FAQ can render no item-level affordance when their
arrays are empty. Fix targets are `RtSlot` empty rendering and per-block empty
array adders/seed defaults.

#### Current verification — 2026-05-28
Still current. `RtSlot` / `RtStaticView` still return `null` for empty rich-text
values, and `FeatureListCanvas` / `FAQCanvas` render only mapped array rows.
When `features` or `items` are empty, no inline add/edit target is rendered in
the canvas block body.

#### Resolution — 2026-06-02
Addressed canvas `RtSlot` instances now keep a stable placeholder hit target
when their rich-text value is empty, while `RtStaticView` keeps its live-site
empty-DOM behavior. FeatureList and FAQ canvas renderers now show one editable
blank row when their arrays are empty, and their nested update handlers create
the first array item on edit.

#### Validation
Focused source coverage pins the empty-slot placeholder and FeatureList/FAQ
empty-array fallback behavior. `pnpm typecheck`, `pnpm registry:check`, and
`pnpm lint:no-css` passed with the local Node 24 vs repo Node 26 engine warning
only.

---

### FE-91 — Canvas right-click should open SIAB chrome context menus, never the browser menu

**Status:** Closed 2026-06-02 · **Layer:** frontend
**Discovered in:** Session 2026-05-28 (operator canvas/chrome QA)

#### Description
Right-clicking anywhere inside the CMS canvas should never open the browser
context menu or any default context menu. Canvas right-click should be owned by
the SIAB CMS interaction layer and use the same contextual menu/dropdown UI
style already used for Header/Footer chrome actions. At minimum, the menu must
offer a clear action to open the inspector/sidebar for the selected section or
chrome area.

Header and Footer need the same interaction model:
- Right-clicking anywhere in Header or Footer opens that chrome area's SIAB
  context menu.
- The existing Footer dropdown should no longer open on normal left-click; it
  should open from right-click or from an explicit settings button.
- Header and Footer should show a small settings/options icon at the top-right,
  matching the spirit of the canvas chrome controls used for section drag/options.
  Clicking that icon opens the same context menu as right-click.
- Footer columns should not all become nested persistent canvas selections.
  Only the column/content surface that actually supports inline editing should
  be selectable separately, so text can be edited naturally in-canvas like other
  section text. Other footer interactions should route through the whole-Footer
  inspector/context menu.

#### Suggested fix shape
Implement a canvas-level `contextmenu` guard that prevents the native browser
menu for tenant/canvas content and dispatches a SIAB context-menu open request
with enough target metadata to resolve section, inline element, Header, or
Footer context. Reuse the existing Header/Footer contextual menu styling and
actions rather than introducing a second menu look. Add explicit top-right
settings buttons for Header/Footer chrome that trigger the same menu path.

For Footer, split the model cleanly: right-click/settings opens the Footer
chrome menu; normal left-click selection only targets inline-editable footer
content where typing/editing is expected. Verify canvas mode and sidebar mode,
and cover at least these regressions: native context menu is blocked, Header
and Footer menus open from right-click and icon click, Footer left-click no
longer opens the dropdown, and editable footer text remains selectable/editable
in-canvas.

**Related:** OBS-88 (footer composition contract), FE-82/FE-83 (closed chrome
selection/navigation handoff behavior).

#### Current verification — 2026-05-28
Still current. The canvas currently guards normal clicks on tenant links, but
there is no canvas-level `contextmenu` owner/dispatcher for SIAB menus. Header
and Footer chrome actions are still opened from normal click/select paths
rather than the requested right-click/settings-button model.

#### Resolution — 2026-06-02
Desktop canvas now owns `contextmenu` events. Right-clicking a page section
prevents the browser menu, selects the section, and opens a CMS-styled context
menu with Open inspector, Duplicate, and Delete actions. Header/Footer chrome
right-clicks and their explicit top-right options buttons open the existing
SIAB chrome quick menu. Ordinary footer column clicks no longer open the chrome
menu; inline-editable footer text remains handled by `RtSlot`.

#### Validation
Focused source coverage pins the chrome right-click/options-button path, the
block context menu, and the footer-left-click behavior. `pnpm typecheck`,
`pnpm registry:check`, and `pnpm lint:no-css` passed with the local Node 24 vs
repo Node 26 engine warning only.

---

### FE-92 — Canvas/editor UX follow-up: chrome affordances, menu dismissal, Werkwijze cards

**Status:** Closed 2026-06-02 · **Layer:** frontend
**Discovered in:** Session 2026-06-02 (operator QA after FE-89/FE-90/FE-91 deploy)

#### Description
The first Canvas/editor UX bundle left three polish regressions:

- Header/Footer chrome in the canvas looked and behaved differently from normal
  canvas sections, rather than using the same selected/hover affordance
  convention.
- After opening a CMS context menu with right-click, a second outside
  right-click could open the browser context menu while leaving the SIAB menu
  mounted. Outside left-click and right-click should both dismiss CMS menus.
- The Werkwijze FeatureList canvas empty-state allowed editing an existing card,
  but did not provide an in-canvas way to add the second/third cards. The
  canvas should allow adding cards up to the intended three-card layout.

#### Resolution — 2026-06-02
Header/Footer chrome wrappers now opt into the same `.cms-block` canvas
selection/hover affordance as page sections, and their top-right options
control uses the same compact chrome-gutter styling convention. The block
context menu, chrome action menu, and richer Header/Footer quick menu now
prevent and consume outside `contextmenu` events, closing the CMS menu instead
of leaking to the browser menu. FeatureList now renders an editor-only add-card
tile in the canvas grid while fewer than three feature cards exist.

#### Validation
`pnpm test tests/unit/components/siteChromePreview.test.ts
tests/unit/richtext-canvas-selection.test.ts tests/unit/locales.test.ts`
passed. Full `pnpm test` passed at 100 files / 869 tests. `pnpm typecheck`,
`pnpm payload:contract`, `pnpm registry:check`, `pnpm lint:no-css`, and
`git diff --check` passed with the local Node 24 vs repo Node 26 engine warning
only.

---

### FE-93 — Canvas chrome follow-up: shared gutter and sidebar right-click no-op

**Status:** Closed 2026-06-02 · **Layer:** frontend
**Discovered in:** Session 2026-06-02 (operator QA after FE-92 deploy)

#### Description
Header/Footer chrome still looked slightly different from normal canvas sections:
the options control was positioned and sized by a separate inline implementation,
and because it lived inside the tenant preview wrapper, tenant/site styling could
visually leak into the CMS chrome. In sidebar/read-only mode, right-clicking the
canvas could still open CMS context menu affordances; sidebar mode should consume
right-click as a no-op, matching the existing sidebar interaction model.

#### Resolution — 2026-06-02
Sections and Header/Footer chrome now reuse the same portaled
`CanvasChromeGutterOverlay` component. The shared overlay owns the fixed gutter
position, compact border/background styling, options trigger, and block duplicate
/ delete menu path, keeping CMS controls outside tenant-rendered DOM. Sidebar
mode now prevents and stops canvas `contextmenu` events, clears any block menu,
and hides the Header/Footer options gutter.

#### Validation
Focused chrome coverage passed:
`pnpm test tests/unit/components/canvas-chrome-fidelity.test.ts
tests/unit/components/siteChromePreview.test.ts
tests/unit/richtext-canvas-selection.test.ts`. Full `pnpm test` passed at 100
files / 870 tests. `pnpm typecheck`, `pnpm payload:contract`,
`pnpm registry:check`, `pnpm lint:no-css`, and `git diff --check` passed with
the local Node 24 vs repo Node 26 engine warning only.

---

### OBS-89 — Amicare "Wat telt" background image missing and not editable in CMS canvas

**Status:** Closed 2026-06-02 · **Layer:** multi-repo (`siab-payload` + `site-amicare-zorg`)
**Discovered in:** Session 2026-05-28 (operator canvas QA)

#### Description
The background image for Amicare's "Wat telt" section does not load in the CMS
canvas/preview and is not editable from the current CMS surface. The CMS CTA
quote renderer hardcodes `/media/bedroom.jpg`, but that asset is not present in
the Payload app and the CTA block schema does not expose a background/image
field. The live/site renderer and CMS canvas renderer need a shared contract for
whether this is a block field, theme asset, or site-owned static asset.

#### Suggested fix shape
Reproduce locally with browser console open and capture the failed
`/media/bedroom.jpg` request. Decide the product contract for section
backgrounds, then implement it consistently in the CTA schema, manifest/block
element contract, Payload canvas renderer, projection, and Amicare site
renderer. Add focused coverage for the projection/canvas data shape and a
visual/manual check that the canvas no longer logs the missing asset.

#### Resolution — 2026-06-02
CTA blocks now expose an optional `backgroundImage` media upload field. The CMS
canvas quote CTA renders that field through the existing inline image picker
instead of hardcoding `/media/bedroom.jpg`, and the CTA block element contract
exposes the image to sidebar/mobile editing. Projection flattens populated CTA
background media through the existing page JSON path, and media usage tracking
now records CTA background image references.

The Amicare live and preview renderers now consume the projected
`backgroundImage` field and omit the decorative background `<img>` when no
image is configured, so the missing hardcoded bedroom asset is no longer
requested.

#### Validation
Focused Payload coverage passed:
`pnpm test tests/unit/components/ctaBackgroundImage.test.ts
tests/unit/pageToJson-blocks.test.ts
tests/unit/fe-59-block-element-specs.test.ts tests/unit/mediaUsage.test.ts
tests/unit/locales.test.ts`. Full `pnpm test` passed at 101 files / 874 tests.
`pnpm typecheck`, `pnpm payload migrate`, `pnpm payload:contract`,
`pnpm registry:check`, and `pnpm lint:no-css` passed with the local Node 24 vs
repo Node 26 engine warning only.

Amicare validation passed: `pnpm astro check`, `pnpm build`, and
`pnpm check:responsive`. `pnpm astro check` still reports pre-existing warnings
for `BlockErrorBoundary.tsx` and JSON-LD inline script hints.

#### Follow-up — 2026-06-02
The initial canvas affordance used a visible text button inside the tenant DOM,
so site styles could leak into the background-image chrome and the existing
image state did not clearly advertise replacement/removal. The CTA background
image control now uses compact portaled canvas chrome with shadcn `Button` /
`Tooltip` primitives and lucide image/remove icons. The chrome is visible for
both empty and populated states, opens replacement in canvas mode, selects the
field in sidebar mode, and exposes a destructive remove icon when an image is
set.

Second correction from operator QA moved the image chrome to the left side of
the CTA section so it no longer collides with the section drag/options chrome,
added default sidebar image add/remove controls, and removed the hidden
quote-style CTA primary button from the sidebar element contract. The CTA
primary group is now optional in the Payload schema so quote CTAs without a
button can save cleanly.

Third correction from operator QA made the empty canvas chrome measure from a
neutral full-section anchor instead of inheriting tenant image classes, so the
add image icon is visible in canvas mode. Sidebar/inspector image controls now
use compact edit and trash icon buttons with tooltips instead of a visible
remove-image text button below the image.

Fourth correction from operator QA aligned the CTA background image chrome with
the general section toolbar hover contract: nested image chrome now reads the
same block hover/focus visibility state as the section drag/options toolbar.
The image chrome anchor measurement also re-observes the actual DOM node after
switching between populated and empty states, avoiding the stale top-left
viewport placement that could appear immediately after removing an image.

---

### FE-81 — Site chrome labels must be exactly Header and Footer

**Status:** Closed 2026-05-28 · **Layer:** frontend
**Discovered in:** Session 2026-05-26 (operator editor review)

#### Description
Any UI mention of site chrome must use the plain labels **Header** and
**Footer**. Avoid alternate wording or translations such as "voetmenu" or other
non-literal labels. This applies to canvas action menus, sidebar rows, mobile
rows, navigation handoff UI, settings references, and locale files.

#### Suggested fix shape
Audit EN/NL locale keys and hardcoded labels for header/footer/site chrome. Keep
the chrome component labels literal where that prevents missing-key fallbacks,
and update tests so future copy changes cannot reintroduce non-literal labels.

#### Progress — 2026-05-27
Batch 2 replaced the remaining Dutch "Bovenmenu"/"Voetmenu" labels with literal
Header/Footer copy for navigation tabs and page-level include controls. Static
regressions now assert the chrome label helper uses literal Header/Footer, the
page editor does not request translated `header`/`footer` editor keys, and the
Dutch locale visible zone labels cannot drift back to bovenmenu/voetmenu.

Closure verification 2026-05-28: chrome labels are literal through
`chromeLabel()` and mobile/header/footer controls use literal Header/Footer
copy. Remaining `siteChrome` locale keys are unused stale copy, not visible UI
behavior.

---

### FE-82 — Sidebar mode header/footer click should open the sidebar drill-down

**Status:** Closed 2026-05-28 · **Layer:** frontend
**Discovered in:** Session 2026-05-26 (operator editor review)

#### Description
In sidebar mode, clicking the visible Header or Footer chrome in the canvas
should select/open that chrome item in the sidebar drill-down. It should not open
the floating/dropdown action menu. Canvas mode can keep a contextual action
menu, but sidebar mode's mental model is direct selection into the inspector.

#### Suggested fix shape
Extend the canvas/site-chrome selection model so Header/Footer are selectable
targets in sidebar mode, with corresponding sidebar rows and drill-down states.
Keep them non-draggable and outside block insertion/reordering. Verify keyboard
and click behavior, and ensure the action menu remains available only where it
is still intentional.

#### Progress — 2026-05-27
Batch 2 added app-local chrome selection state in `PageForm`: sidebar-mode
Header/Footer canvas clicks now select chrome instead of opening the floating
menu, sidebar chrome rows highlight the selected zone, and the right inspector
switches into a Header/Footer drill-down with a Navigation manage action. Block
selection clears chrome selection so the existing block drill-down remains the
normal editing path. Registry-owned sidebar primitives were only composed
through their slots; no `src/components/ui/` files were edited.

Closure verification 2026-05-28: the current `PageForm` still routes sidebar
Header/Footer selection through `selectedChrome`, renders selectable chrome
rows, and swaps the right inspector into `SiteChromeDrillDown`.

---

### FE-83 — Header/footer navigation handoff menu should route correctly and preserve selected zone

**Status:** Closed 2026-05-28 · **Layer:** frontend
**Discovered in:** Session 2026-05-26 (operator editor review)

#### Description
The Header/Footer dropdown currently has broken navigation/settings actions in
some contexts: from the canvas dropdown the options can do nothing, while the
sidebar version works. The menu should only hand off to navigation management;
remove the settings-page option/behavior from this chrome dropdown.

When the user opens navigation from Footer, the navigation page should default
to the footer navigation selected. When opened from Header, it should default to
header selected.

#### Suggested fix shape
Make the chrome action menu emit a navigation URL that carries the source zone
(`header` / `footer`) through a query param or route state. Update the navigation
page to read that hint and default its active tab/segment accordingly. Remove
the site-settings menu item from Header/Footer chrome actions. Add a focused
Playwright/local audit covering header → navigation and footer → navigation from
both canvas and sidebar surfaces.

#### Progress — 2026-05-27
Batch 2 removed the site-settings handoff from `SiteChromePreview` and routes
all chrome Navigation actions through `/navigation?zone=header|footer`.
`NavigationPage` reads `searchParams.zone`, normalises invalid/missing values
to header, and passes `initialZone` into `NavigationManager`, which now seeds
its segmented control from that prop. Static tests cover the URL handoff, the
absence of `settingsHref`/settings action usage, and the navigation page's zone
normalisation.

Follow-up fix 2026-05-27: canvas dropdown navigation used a portal-rendered
`<Link>`. When the page editor was dirty, the document-capture navigation guard
intercepted that anchor before the portal menu could close, making the action
look inert. Chrome menu actions now render as guarded buttons when hosted by
`PageForm`, call `guard.guardedNavigate(() => router.push(href))`, and close the
portal before opening the discard-changes flow or navigating.

Closure verification 2026-05-28: chrome menus only expose Navigation, the
handoff URL carries `zone=header|footer`, and the navigation page seeds the
matching Header/Footer tab from that query value.

---

### FE-84 — Mobile page settings should expose Header/Footer navigation controls

**Status:** Closed 2026-05-28 · **Layer:** frontend
**Discovered in:** Session 2026-05-26 (operator mobile editor review)

#### Description
On mobile, Header and Footer controls should live under Page Settings in a
dedicated Navigation subsection, placed between Slug and Status. This subsection
should include the Header/Footer inclusion toggles that exist on desktop and
were previously intentionally omitted from mobile.

The placement should make the relationship obvious: for example each
Header/Footer row can pair the include toggle with a nearby Manage action that
opens the relevant navigation management flow for that zone. Exact interaction
copy and layout should be planned with the related chrome navigation items
before implementation.

#### Suggested fix shape
Batch with FE-82 and FE-83. Add a mobile Page Settings Navigation subsection
that mirrors desktop page-level header/footer inclusion controls while keeping
mobile density reasonable. The Manage action should route to navigation with
the selected zone preserved (`header` or `footer`) and must not expose the
removed site-settings handoff behavior. Cover both existing-page and new-page
states, dirty-state handling, and save behavior.

#### Progress — 2026-05-27
Batch 2 composes the registry `MobilePageSettingsLayout` slot app-side so mobile
Page Settings renders Title, Slug, a Navigation subsection, then Status. The
mobile subsection exposes the same explicit-save Header/Footer include toggles
as desktop, disables them for unsaved pages, and adds Header/Footer manage
links that preserve the selected navigation zone. Static tests lock the slot
order and toggle ids.

Closure verification 2026-05-28: mobile Page Settings still renders the
Navigation subsection between Slug and Status, with Header/Footer include
toggles and zone-preserving manage links.

---

### FE-85 — No autosave anywhere; changes persist only through explicit Save

**Status:** Closed 2026-05-28 · **Layer:** frontend / product behavior
**Discovered in:** Session 2026-05-26 (operator save-model clarification)

#### Description
There should be no autosaving anywhere in the CMS. All editable surfaces should
track dirty state locally and persist changes only when the user explicitly
presses the relevant Save button. This applies to page editing, navigation,
site settings, theme changes, profile/entity edit forms, mobile editor flows,
dialogs, drawers, inline canvas editing, and any future editor surfaces.

Local draft recovery is allowed only as client-side recovery for unsaved work.
It must not PATCH Payload, update generated site data, or otherwise become a
server-side save until the user presses Save.

#### Suggested fix shape
Audit every mutation path and classify it as explicit-save, create/delete
command, or accidental autosave. Remove or refactor accidental autosaves so
field changes only mark a form/editor dirty. Standardize copy and visual state
around dirty/saving/saved/failed, and make sure navigation away, refresh
recovery, mobile sheets, and theme/sidebar interactions all preserve unsaved
state without silently persisting it. Add tests around representative surfaces
so `onChange`/toggle/blur cannot call server actions directly unless the action
is itself an explicit command.

#### Progress — 2026-05-27
Batch 1 removed the clearest accidental autosaves:
- Page editor Header/Footer nav membership toggles no longer call
  `togglePageInNav` on change. They now mark the page editor dirty, participate
  in the save badge/count and navigation guard, persist in client-only draft
  recovery, and write SiteSettings nav membership only when the page Save button
  is pressed.
- The form-submission status sheet no longer PATCHes `/api/forms/:id` from the
  status select's `onValueChange`. It now keeps a local status draft and writes
  only through an explicit Save button.

Focused regression coverage was added in
`tests/unit/page-editor-explicit-save.test.ts`. Preference-style commands
(`setUserEditorMode`, `setUserLanguage`, theme mode outside the tenant theme
bar, API key rotation, upload/delete actions) were classified as explicit user
commands for this batch rather than content autosaves.

Closure verification 2026-05-28: no current accidental content autosave path
was found in the repo. The remaining save/status concern is not server-side
autosave; it is a misleading saved badge after change -> revert and is tracked
separately as FE-89. Keep "explicit Save only" as a product invariant for future
editor work rather than an active implementation item.

---

### FE-86 — Canvas insert affordances must not create visible spacing between sections

**Status:** Closed 2026-05-28 · **Layer:** frontend
**Discovered in:** Session 2026-05-26 (operator canvas fidelity review)

#### Description
In canvas mode, visible spacing appears between rendered site sections. That
spacing should not exist: adjacent site sections should connect exactly as they
do on the live site, with no editor-introduced vertical gap or padding between
them.

The likely cause is the between-section "add section" / insertion affordance.
That behavior must remain intact and discoverable, but it should be implemented
as an overlay/hover/focus affordance that does not participate in document flow
or alter the measured layout of the rendered page.

#### Suggested fix shape
Inspect `@siab/canvas-chrome` / Payload canvas composition for gap wrappers,
insert slots, margins, padding, or grid/flex gaps around block boundaries.
Refactor the add-section affordance so it is absolutely positioned, portal-like,
or otherwise layout-neutral. Verify that screenshots and DOM measurements show
zero editor-created spacing between blocks while keyboard/mouse/touch insertion
still works, including first/last insertion points and empty-page behavior.

#### Progress — 2026-05-27
Batch 3 moved the desktop canvas host to an app-owned composition at
`src/components/editor/canvas/CanvasMode.tsx` so registry primitives did not
need hand edits. The old in-flow gap button's `h-6` spacer is replaced with a
zero-height in-canvas anchor plus a fixed-position portal overlay. Insert
affordances open an app-owned canvas block picker, preserving blank/preset
insertion without adding document-flow height between site sections.

Closure verification 2026-05-28: the add-section affordance remains
layout-neutral: only zero-height anchors stay in document flow, while insertion
controls are fixed-position editor chrome.

---

### FE-87 — Canvas editor chrome controls must use CMS styling, not tenant styling

**Status:** Closed 2026-05-28 · **Layer:** frontend / registry
**Discovered in:** Session 2026-05-26 (operator canvas fidelity review)

#### Description
In canvas mode, editor-owned controls rendered inside or over the tenant canvas
are inheriting the site/tenant theme. Specifically, the add-section control
(`+` icon/circle between sections) and the drag handles on canvas sections
(currently top-right of sections) should follow the CMS/admin style system, not
the tenant site's colors, fonts, or component styling.

Tenant styling should continue to own the rendered site content itself. CMS
editing chrome should remain visually and semantically separate so controls are
consistent across tenants, readable in every tenant palette, and recognizable as
editor controls rather than live-site elements.

#### Suggested fix shape
Audit `@siab/canvas-chrome`, `CanvasGapButton`, block gutter/drag-handle
composition, and any Payload wrappers rendered inside `.rt-canvas`. Move these
controls onto CMS tokens/classes, portal them outside tenant-scoped style where
appropriate, or explicitly isolate their token scope so tenant CSS cannot
recolor them. Verify light/dark CMS themes and at least one tenant with a
strong custom palette. Preserve add-section and drag/reorder behavior.

#### Progress — 2026-05-27
Batch 3 portals desktop canvas editor chrome (`data-siab-canvas-chrome`) to
`document.body` from the app-owned canvas host. The add-section affordance and
block gutter now render outside tenant-scoped `.rt-canvas` CSS, while the actual
tenant content and block renderers stay inside `.rt-canvas`. The host still
composes registry-owned `CanvasBlockRenderer`, `CanvasMobile`, dialog/button,
and dropdown primitives; `src/components/ui/*` was not hand-edited. Follow-up in
the same batch replaced the canvas add-section modal's square tile hover with a
canvas-specific rounded card picker, avoiding the cornered hover artifact while
keeping preset insertion/deletion behavior.

Closure verification 2026-05-28: desktop add-section and block-gutter controls
still render as `data-siab-canvas-chrome` portals outside `.rt-canvas`, so
tenant CSS no longer owns those editor controls.

---

## Full-stack Items

### OBS-117 — Replace Resend with Better Auth Infra + Cloudflare mail split

**Status:** Active · blocked on Better Auth Infra production setup and Cloudflare Workers Paid / Email Sending entitlement · **Layer:** full-stack / infra-adjacent
**Discovered in:** Session 2026-06-12 (OBS-101 email transport follow-up)

#### Description
OBS-101 shipped Better Auth email magic links, but the current mail transport
is still Resend-specific. App-level transactional sends use
`src/lib/email/resend.ts`, while Payload password reset / invite flows use
`@payloadcms/email-resend` through `payload.config.ts`.

Product direction update 2026-06-16: SIAB no longer wants a single
Cloudflare-owned path for every user email. Better Auth Infrastructure should
own every user/auth lifecycle email it can handle consistently: magic-link
login, reset-password, email verification / future MFA codes, and invite /
set-password style onboarding where the flow can be represented by Better
Auth's supported templates and handlers. Cloudflare Email Sending remains the
fallback/general SIAB mail path for privacy data export and any miscellaneous
`siab-payload` email that cannot be represented safely by Better Auth
Infrastructure's template-based sender.

Research on 2026-06-16 verified that Better Auth Infra can send transactional
template emails through `@better-auth/infra`, backed by the Better Auth
Infrastructure API and provider support documented as AWS SES, SendGrid, and
Resend. The current public package API is template-based (`template`, `to`,
`variables`, optional `subject`) and does not expose SMTP credentials,
arbitrary raw HTML/text, per-message sender control, or attachments. Therefore
privacy data export should stay outside Better Auth Infra unless Better Auth
later documents custom templates / attachment support that satisfies the
export requirement.

Cloudflare research on 2026-06-12 found that the correct product is
Cloudflare Email Service / Email Sending, not plain Email Routing. Email
Routing is available on Workers Free and Workers Paid, but sending to
arbitrary recipients is not available on Workers Free. Production transactional
mail that is not covered by Better Auth Infra therefore requires enabling the
Workers Paid / Email Sending entitlement on the Cloudflare account first.
Cloudflare exposes Workers binding, REST API, and SMTP for sending once
entitled; REST API is the preferred SIAB integration shape for the VPS-hosted
Next/Payload app.

#### Required Better Auth setup

Before implementation/testing:

- Enable/configure Better Auth Infrastructure for SIAB production.
- Add `@better-auth/infra` and wire `BETTER_AUTH_API_KEY` /
  `BETTER_AUTH_API_URL` where needed.
- Confirm the sender domain / displayed sender can be configured as
  `noreply@siteinabox.nl` for Better Auth Infra mail.
- Confirm the exact template coverage for SIAB auth/user lifecycle mail:
  magic link, reset password, invite/set-password, future email verification,
  and future MFA/OTP messages.
- Do not route privacy data export through Better Auth Infra unless custom
  templates and export-safe content/attachment handling are explicitly
  verified.

#### Required Cloudflare setup
Before implementation/testing for privacy/miscellaneous app mail:

- Upgrade/enable Cloudflare Workers Paid / Email Sending on the SIAB account.
- Ensure the sender domain uses Cloudflare DNS.
- Onboard the sender domain under Cloudflare Email Service > Email Sending.
- Let Cloudflare create/verify the required SPF, DKIM, DMARC, and bounce
  records.
- Create a Cloudflare API token with Email Sending: Edit permission scoped to
  the SIAB account.

Expected environment shape:

```bash
AUTH_EMAIL_PROVIDER=better-auth-infra
APP_EMAIL_PROVIDER=cloudflare
EMAIL_FROM=noreply@siteinabox.nl
BETTER_AUTH_API_KEY=
BETTER_AUTH_API_URL=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_EMAIL_API_TOKEN=
```

#### Suggested implementation shape
1. Add a Better Auth Infra sender for supported auth/user lifecycle mail and
   route Better Auth magic links through it first.
2. Decide whether Payload reset-password / invite-set-password flows should be
   migrated to Better Auth-owned flows or bridged by passing Payload-generated
   URLs into Better Auth Infra templates. Prefer Better Auth ownership where it
   preserves SIAB's Payload-owned role/tenant authorization invariants.
3. Replace `src/lib/email/resend.ts` with an app-mail module for privacy data
   export and other miscellaneous non-auth mail. Keep the existing
   `sendEmail({ to, subject, html })` call shape and add plain-text fallback
   support.
4. Implement Cloudflare REST sending via
   `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/email/sending/send`
   with `Authorization: Bearer <token>`.
5. Preserve a local/dev-safe failure mode: missing provider credentials should
   fail loudly when a send is attempted, not during app boot unless the chosen
   production provider requires them.
6. Keep SIAB mail split by capability:
   - Better Auth Infra: auth/user lifecycle emails it can represent safely.
   - Cloudflare: privacy data export and miscellaneous app mail outside Better
     Auth's supported template/handler surface.
   Do not add marketing/bulk email without a separate unsubscribe/list-
   management and privacy review.
7. Update `.env.example`, production compose env pass-through, and
   `docs/runbooks/social-auth.md` to remove Resend as the expected production
   path and document Better Auth Infra plus Cloudflare setup/validation.
8. Add focused tests for provider selection, Better Auth Infra request mapping,
   Cloudflare request shape, Cloudflare error handling, and any Payload bridge
   or adapter wiring retained during migration.

#### Acceptance notes
After Better Auth Infra and Cloudflare credentials are available, acceptance
requires a real end-to-end send test for:

- Better Auth magic link login for an existing Payload user through Better
  Auth Infra.
- Reset-password and invite/set-password mail through the selected Better
  Auth Infra-owned or bridged path.
- User data export email through Cloudflare.

Production should be verified through Better Auth Infra delivery visibility,
Cloudflare Email Service logs for app mail, and live mailboxes. Do not claim
strict EU/NL data residency from standard Better Auth Infra or Cloudflare Email
Service docs; treat it as a GDPR/DPA/subprocessor review item unless the
provider supplies a product-specific EU-only processing guarantee.

### OBS-115 — PostHog-native tracking completeness and dashboard warning cleanup

**Status:** Closed 2026-06-08 · **Layer:** multi-repo (`siab-payload` + `siab-site-template` + deployed tenant sites)
**Discovered in:** Session 2026-06-08 (analytics/PostHog production review)

#### Description
PostHog analytics is now the canonical SIAB analytics backend, with enriched
autocapture and native `$web_vitals` feeding CMS analytics. Production review
still showed PostHog dashboard alerts suggesting one or more recommended
signals are missing or incomplete. The tracking contract must be checked
against current PostHog recommendations rather than relying on the previous
local assumptions.

Known areas to verify:

- Native `$pageview` and `$pageleave` behavior. The current backlog history
  notes that these were intended for native PostHog web analytics surfaces, but
  the latest implementation notes also say `capture_pageview` and
  `capture_pageleave` remain false. Confirm whether SIAB is manually emitting
  equivalent native events after consent, or whether PostHog-native capture
  should be enabled/configured differently.
- Native `$web_vitals` completeness. Confirm PostHog receives all metrics
  supported by the installed SDK/version and expected by PostHog dashboards,
  including current Core Web Vitals and diagnostic metrics where available.
- Autocapture completeness. Keep enriched `$autocapture` as the canonical
  browser interaction stream where PostHog recommends it, but ensure
  SIAB-specific semantic events remain only where autocapture cannot replace
  them: section exposure/engagement, forms, scroll depth, journey, and trusted
  server-side conversions.
- Consent behavior. Preserve the current no-pre-consent-transmission rule for
  public sites unless a later privacy/legal review explicitly changes it.
- Duplicate measurement. Ensure no click, page, leave, or Web Vital signal is
  counted twice in PostHog or CMS analytics.

#### Suggested fix shape
1. Review current official PostHog docs for web analytics, autocapture,
   pageleave, and Web Vitals using the currently installed `posthog-js` version.
2. Audit `siab-site-template` and at least one deployed tenant runtime against
   those docs, including consent timing, idle loading, `before_send`, and event
   filtering.
3. Produce a small event matrix that lists every native/custom event, source,
   consent requirement, CMS query consumer, and duplicate-prevention rule.
4. Update the runtime/configuration to satisfy PostHog's recommended native
   behavior while preserving SIAB metadata enrichment and privacy constraints.
5. Verify in PostHog UI that web analytics alerts are cleared or explicitly
   understood, and that CMS analytics still query the intended canonical event
   names.

#### Acceptance notes
Acceptance requires a production or staging verification pass in PostHog UI.
Document which PostHog warnings were present, what each warning represented,
and whether it was fixed, intentionally ignored, or blocked by consent/privacy
requirements. Add focused tests for duplicate-prevention logic and server-side
query event-name choices where practical.

#### Implementation progress — 2026-06-08

Current PostHog docs were reviewed for JavaScript SDK page lifecycle
configuration, autocapture, and Web Vitals. SIAB now treats `$pageview` and
`$pageleave` as the only page lifecycle events, but still consent-gates them by
initializing `posthog-js` only after the visitor accepts analytics cookies. The
generated-site runtime and the deployed Amicare runtime no longer manually
capture `$pageview`, `$pageleave`, `site_page_viewed`, or `site_page_left`,
avoiding duplicate page lifecycle signals while preserving the existing
no-pre-consent-transmission rule.

The CMS now has an app-owned analytics event contract matrix in
`src/lib/analytics/contract.ts`. It records each native/custom event source,
consent requirement, canonical dashboard use, duplicate-prevention rule, and
query consumer. Focused unit coverage pins the important native lifecycle
decision: `$pageview` / `$pageleave` are the only canonical page lifecycle
events, and the old SIAB custom `site_page_viewed` / `site_page_left` events
are not part of the active contract. CMS traffic, top-page, acquisition,
device, and geography queries now use consent-gated `$pageview` events enriched
with SIAB tenant/page metadata.

OBS-115 is in review after the 2026-06-08 production verification pass. Final
acceptance still requires reviewer confirmation that the PostHog UI
installation-health warnings are cleared or intentionally deferred.

Production deployment note: `siab-payload` revision
`b6dfe4230765091d7f9bc1201e0c7967b5226425`, `siab-site-template` revision
`59b3af8028a7bad4e7bbcce9ed6d5a441fcdfcad`, and live
`site-amicare-zorg` revision `4fc508faffe6a2d79c127cde325c6553836930c5`
were published on 2026-06-08. The VPS pulled/recreated Payload and Amicare,
synced Amicare tenant 7 CMS artifacts, and public health checks passed for
`https://admin.siteinabox.nl/api/health` and `https://ami-care.nl/healthz`.

Follow-up health-check mapping: PostHog's installation health warnings map to
specific native signals/settings, not only SIAB custom events. Scroll depth is
considered healthy only when `$pageleave` / subsequent `$pageview` events carry
native `$prev_pageview_*` properties such as
`$prev_pageview_max_content_percentage`; `site_scroll_depth_reached` is useful
for SIAB threshold/journey views but does not satisfy that native check. Web
Vitals requires both client-side `$web_vitals` capture and project-side
PostHog settings (`autocapture_web_vitals_opt_in`,
`autocapture_web_vitals_allowed_metrics`, and `capture_performance_opt_in`).
Authorized URLs are project `app_urls` and should be synced by provisioning,
not clicked in PostHog per generated site. Reverse proxy is intentionally
pinned as an infra/DNS strategy decision so SIAB can choose a central/wildcard
ingest hostname rather than managing per-site proxies.

Implementation follow-up adds `disable_scroll_properties: false` explicitly to
the generated-site and Amicare runtimes, keeps Web Vitals client capture on
`CLS`/`FCP`/`INP`/`LCP`, switches CMS scroll-depth buckets to native
`$pageleave` scroll properties, and adds `pnpm posthog:sync-settings` to merge
generated-site domains into `app_urls` while enabling PostHog Web
Vitals/performance project settings.

Live PostHog MCP verification on 2026-06-08 found the remaining health-warning
causes were project settings, not missing runtime code: `app_urls` was empty,
`autocapture_opt_out` was true, and `autocapture_web_vitals_opt_in` was false.
Those settings were updated for project `SiteinaBox` (`193842`) to authorize
`https://ami-care.nl`, enable autocapture, enable Web Vitals for
`CLS`/`FCP`/`INP`/`LCP`, and keep performance capture enabled. SDK health
reported healthy with no outdated SDKs. Current source in `siab-site-template`
and `site-amicare-zorg` contains no `site_page_viewed` or `site_page_left`
emission path; any remaining rows with those event names are historical or from
browser cache windows.

Remaining acceptance check: trigger a fresh consented Amicare session after the
project-setting update, leave the page after scrolling, and verify a new
`$pageleave` carries PostHog's native `$prev_pageview_max_content_percentage`
property. Reverse proxy remains intentionally deferred to a central/wildcard
ingest strategy rather than per-site runtime code.

Same-session live browser smoke confirmed the live Amicare asset loads
PostHog JS after consent and reaches PostHog EU ingest, but the delayed
consent-and-idle initialization missed PostHog JS's normal DOM-loaded initial
pageview path. The generated-site and Amicare runtimes therefore emit
PostHog-native `$pageview` / `$pageleave` event names explicitly through the
same consent-gated transport, with `$pageleave` carrying native
`$prev_pageview_*` scroll properties.

Closure verification on 2026-06-08 deployed:

- `siab-payload` `9ff1020`
- `siab-site-template` `b4f38c3`
- `site-amicare-zorg` `e2dd3ef`

Production Amicare health passed after VPS image refresh. Live browser smoke
and PostHog MCP SQL verification confirmed new consented Amicare traffic
ingested `$pageview`, `$pageleave`, and `$web_vitals`. `$pageleave` included
`$prev_pageview_max_content_percentage`, `$prev_pageview_max_scroll_percentage`,
`scroll_depth`, and duration fields. `$web_vitals` ingested
`$web_vitals_FCP_value`, `$web_vitals_LCP_value`, `$web_vitals_CLS_value`, and
`$web_vitals_INP_value`.

Reverse proxy/enrichment follow-up on 2026-06-08: PostHog managed reverse proxy
was enabled at `https://r.siteinabox.nl`. Payload now separates
`POSTHOG_HOST` (server/API/UI host) from `POSTHOG_PUBLIC_HOST` (browser ingest
host), projecting `posthogHost: https://r.siteinabox.nl` and
`posthogUiHost: https://eu.posthog.com` for generated sites. Generated-site and
Amicare runtimes now pass `ui_host` to `posthog-js`, use the proxy for direct
keepalive fallback captures, and enrich fallback events with browser, OS,
device, viewport, screen, locale/timezone, connection, referrer, and campaign
properties so PostHog web analytics dashboards have fewer `unknown` buckets.
Amicare CSP allows the proxy plus PostHog EU asset/config hosts.

Same-session PostHog MCP check after enabling the managed proxy found
organization proxy record `r.siteinabox.nl` present and `valid`, with Payload
and the live Amicare runtime projecting `posthogHost: https://r.siteinabox.nl`
and `posthogUiHost: https://eu.posthog.com`. PostHog's deeper
`proxy-diagnose` endpoint rejected the current Personal API key with 403, so
any remaining Installation Health reverse-proxy warning should be treated as a
PostHog health-observation/UI lag or a diagnosis-permission gap until a fresh
consented proxied browser session is observed in the UI. The proxy DNS record
itself is not missing.

CMS-native analytics follow-up on 2026-06-08: the authenticated admin shell now
initializes `posthog-js` directly when capture config is present, without a
cookie banner, because this is first-party product analytics for logged-in CMS
users. Native SDK events own CMS `$pageview`, `$pageleave`, Web Vitals,
autocapture, rage-click, and dead-click tracking; SIAB does not manually emit
duplicate native lifecycle events. The SDK enriches native CMS events with
`analytics_surface: cms`, `admin_host`, `cms_mode`, role, tenant, and domain
context so PostHog Web Analytics can include admin domains while dashboards can
still separate CMS/product usage from public site traffic. Existing
`cms_route_viewed` / `cms_action_clicked` custom events remain only for
CMS-specific workflow analysis.

Closure note 2026-06-08: operator confirmed PostHog Installation Health updated
after the live deployment and the reverse-proxy warning cleared. PostHog MCP
verification found fresh native `$pageview`, `$pageleave`, `$web_vitals`, and
session rows for `admin.siteinabox.nl`, plus native Amicare public-site
traffic. The managed proxy record for `r.siteinabox.nl` is `valid`, live DNS
points at PostHog's EU proxy target, and browser ingest/config endpoints
respond through the proxy. With PostHog health now green and no active duplicate
`site_page_viewed` / `site_page_left` emission path, OBS-115 is closed.

### OBS-114 — Define Web Vitals meaning and add Lighthouse-style site score

**Status:** Closed 2026-06-08 · **Layer:** full-stack
**Discovered in:** Session 2026-06-08 (analytics product follow-up)

#### Description
The CMS now surfaces native PostHog Web Vitals and a basic web performance
score, but the product still needs a clear model for what each current Web
Vital means, how values are rated, and how that should roll up into an
operator-friendly site score. The target experience is a Lighthouse-like view
inside SIAB analytics/dashboard: useful for site owners and SIAB operators,
without implying that field analytics and lab Lighthouse audits are identical.

The desired score should cover:

- Field performance from PostHog/native Web Vitals.
- A clear explanation of each metric currently available in PostHog and SIAB
  CMS analytics.
- SEO/site-quality checks that can be computed from Payload projection and/or
  generated site output, such as title/meta description presence, canonical
  URL, indexability, Open Graph basics, headings, image alt coverage, structured
  data presence, sitemap/robots availability, and mobile viewport basics.
- A combined presentation similar to Lighthouse categories, while keeping the
  formula transparent enough for SIAB operators to debug.

#### Suggested fix shape
1. Inventory the current PostHog Web Vitals event properties and document what
   each metric represents, including units, good/needs-improvement/poor
   thresholds, and caveats for field data volume.
2. Decide the SIAB field-performance score formula from available Web Vitals.
   Keep it separate from synthetic/lab Lighthouse scores unless a lab runner is
   explicitly added later.
3. Define an SEO/site-quality score that can be computed server-side from CMS
   data and generated-site artifacts without crawling arbitrary third-party
   content.
4. Add an analytics/dashboard card or view that shows category scores,
   underlying metric statuses, sample counts, and concrete remediation hints.
5. Keep tenant-facing copy precise: call field data "Web Vitals" or
   "field performance", and call lab-style SEO checks "site quality" unless a
   true Lighthouse run is implemented.

#### Acceptance notes
Acceptance requires product copy explaining the score semantics, tests for the
score formula and SEO/site-quality checks, and tenant/super-admin analytics UI
that degrades cleanly when Web Vitals sample counts are low or PostHog query
credentials are absent.

#### Implementation progress — 2026-06-08

Added a first explicit SIAB score model. `src/lib/analytics/scoring.ts` defines
the current PostHog Web Vitals used by SIAB (`FCP`, `LCP`, `INP`, `CLS`), their
meaning, thresholds, ratings, and 0-100 field-performance scoring. Dashboard
highlights now report a combined tenant site score when a tenant is in scope:
60% field Web Vitals and 40% CMS-derived site-quality checks. When Web Vitals
or site-quality data is unavailable, the formula degrades to the available
side; when both are unavailable it returns no score.

The analytics behavior view now includes a site-quality card sourced from CMS
settings and published pages. The current check set covers canonical site URL,
site name/description/language, favicon/logo, published home page, SEO titles,
meta descriptions, at least one Open Graph image, navigation, and contact
signal. This is intentionally labelled as site quality / field performance, not
a lab Lighthouse score.

Same-session product follow-up renamed the visible analytics tab from Behavior
to Performance while keeping `view=behavior` as the stable URL value for
existing links. The performance view now starts with a Lighthouse-style SIAB
score card that shows overall score, field-performance score, optional
site-quality score, real-user Web Vital samples, low-sample caveats, and plain
metric names for LCP, INP, CLS, and FCP. Non-super-admin users get a simplified
performance overview plus site-quality checks instead of the super-admin
component, journey, friction, scroll, and autocapture diagnostic tables.

Visual follow-up applies semantic state tokens to performance scoring: good
uses success, needs-work uses warning, poor metric ratings use destructive, and
missing data remains neutral. A later visual refinement keeps the card surfaces
neutral and limits semantic color to score text, status badges, and small
accent indicators on score cards, Web Vital metric tiles, Web Vitals table
ratings, and site-quality checks. The three performance score tiles now share
the same component treatment, and site-quality checks that need attention use
warning rather than destructive styling with the status badge aligned to the top
of the check row. Score tiles consistently show `/100`, and the site-quality
check list groups fixable warning items first before passed checks.

Focused unit coverage now pins Web Vital ratings/scoring, CMS site-quality
checks, the combined score formula, and the OBS-115 event contract.

Closure note 2026-06-08: operator accepted the current Performance/Web Vitals
presentation against live Amicare analytics data after PostHog health caught up.
The visible score model is intentionally SIAB field-performance plus CMS site
quality, not a lab Lighthouse audit. Additional generated-artifact checks such
as sitemap/robots, structured data, or rendered image-alt coverage can be
opened as a new product-hardening item if selected later.

Production deployment note: the first score/card implementation is live in
`siab-payload` revision `b6dfe4230765091d7f9bc1201e0c7967b5226425` as of
2026-06-08. Production health is green; OBS-114 remains active only for final
product review and any additional generated-artifact checks selected after that
review.

### OBS-99 — Integrate PostHog analytics for CMS usage and SIAB site intelligence

**Status:** Closed 2026-06-05 · **Layer:** full-stack
**Discovered in:** Session 2026-06-02 (operator backlog request)

#### Description
The CMS currently has only internal activity-style dashboard data. PostHog is
now the chosen analytics/intelligence platform for SIAB, covering both:

- **CMS/product analytics** — how tenant users and SIAB operators use the CMS:
  login/onboarding, editor workflows, block usage, saves, media uploads,
  errors, generation flows, and operational funnels.
- **Generated website intelligence** — tenant website visits, unique visitors,
  pageviews, section exposure, CTA clicks, form funnels, conversion attribution,
  component/section performance, and future experiments.

The product goal is broader than a basic web analytics page. SIAB needs a
shared event model that can prove client-site improvement, compare generated
site builds, and actively improve future site builds based on which section
types, section orders, component variants, and conversion paths perform best.

This must not become generic uncontrolled tracking. Events need tenant-aware
scoping, clear environment controls, and privacy-safe payloads. Avoid sending
raw rich-text content, form message bodies, secrets, API keys, personal data
beyond deliberate identity metadata, or tenant-private generated-site content.
Anonymous website visitor tracking must be consent-aware. PostHog's default web
SDK persists identity through browser storage/cookies; generated sites must make
that behavior explicit through the site analytics/consent contract rather than
silently enabling full persistence for every tenant.

#### Suggested fix shape
1. Add environment-gated PostHog configuration (`POSTHOG_KEY`,
   `POSTHOG_HOST`, `POSTHOG_PROJECT_ID`, server API key for dashboard queries,
   opt-out/disable flag) with production/staging separation.
2. Add a server-side event helper for CMS/product events with tenant/user/role
   context and explicit allowlisted event properties.
3. Define the stable event taxonomy before broad instrumentation:
   authentication funnel, dashboard visits, page/editor open, block add/remove,
   save success/failure, media upload, form submission received, `/new-site` /
   `/add-cms` operational milestones, site pageview, section viewed,
   section engaged, CTA clicked, form started/submitted, phone/email click, and
   conversion completed.
4. Standardize generated-site event context: `tenant_id`, `site_id`, `page_id`,
   `page_slug`, `theme_id`, `site_build_id`, `manifest_version`, plus section
   metadata such as `section_id`, `section_type`, `section_variant`,
   `section_position`, `block_preset_id`, and a content signature/hash instead
   of raw content.
5. Add consent-aware generated-site instrumentation. Before consent, either do
   no client tracking or use memory-only/aggregate tracking; after consent,
   allow PostHog persistence for anonymous unique visitor/session tracking.
6. Connect accepted form submissions to the same anonymous visitor/session only
   through a safe PostHog distinct/session id handoff. Do not identify website
   visitors with raw email/phone/name unless a later privacy review explicitly
   approves it.
7. Add role/tenant scoping rules for analytics surfaces. Super-admin/SIAB
   internal views may aggregate across tenants; tenant users must only see their
   own site data.
8. Build SIAB-internal dashboards for section/component scoring, site-build
   comparison, conversion funnels, and future experiment readouts. Keep raw
   event streams, session replay, cross-tenant benchmarks, and exact scoring
   formulas internal by default.

#### Section/component scoring model
The SIAB internal layer should compute and compare metrics such as:

- `section_view_rate = section_views / pageviews`
- `section_click_rate = cta_clicks_inside_section / section_views`
- `section_conversion_rate = conversions_after_section_view / section_views`
- `assisted_conversion_rate = conversions_after_view_within_window / section_views`
- `dropoff_after_section = visitors_who_leave_after_section / section_views`

Treat these as correlations unless an explicit PostHog experiment/feature-flag
variant assignment exists. Use experiments to prove causal impact when changing
section variants, ordering, or CTA patterns.

#### Acceptance notes
Implementation should include tests for event payload redaction/allowlisting,
environment disable behavior, tenant/user context handling, generated-site
metadata emission, consent/persistence modes, and tenant-scoped query filtering.

#### Planning direction — 2026-06-04
Treat OBS-99 as the parent planning and implementation item for the SIAB
PostHog analytics program. SIAB will use one PostHog project, not one project
per tenant/site. Tenant, site, page, section, component, build, and manifest
metadata must therefore be first-class event properties on every relevant event,
and every CMS query surface must enforce tenant/site filtering server-side.

OBS-26 (client-facing website analytics dashboard) and OBS-22 (dashboard
metrics/highlights) are part of this same plan and should be designed together
before implementation starts. The CMS dashboard should consume the same
PostHog-backed analytics layer for high-level highlights while keeping local
Payload activity data where it remains useful. OBS-26 remains the curated
tenant-facing analytics route/surface; it must expose useful website analytics
without exposing SIAB's full internal intelligence layer.

OBS-27 remains separate for now. Build trusted fixed analytics views and
dashboard highlights first; configurable chart controls can be picked up as a
follow-up once the PostHog event/query model is proven.

Before coding, spar and document the implementation plan interactively,
including the event taxonomy, consent model, generated-site runtime contract,
site-template/orchestrator propagation path, tenant-facing metric set, and
SIAB-internal intelligence boundaries.

#### Consent direction — 2026-06-04
Analytics is a normal platform capability and should be configured/enabled for
SIAB sites by default when the required PostHog environment/configuration is
present. Public website visitor tracking must only become active after visitor
consent.

Pre-consent behavior should be conservative for EU/NL compliance: the generated
site runtime may load and keep memory-only, anonymous in-page observations if
needed for local behavior, but it must not transmit events to PostHog, write
cookies/localStorage/sessionStorage, identify the visitor, or create a
cross-page/session profile before consent. `posthog-js` memory persistence alone
is not enough to treat transmitted pre-consent analytics as anonymous; network
events can still involve personal data or terminal/device access. After consent,
normal PostHog capture/persistence may start for the consented analytics
purpose. A later legal/privacy review can loosen this only if the exact
implementation is proven to satisfy the applicable Dutch/EU analytics-cookie
exception and GDPR anonymisation threshold.

#### Public-site V1 event taxonomy — 2026-06-04
Approved V1 generated-site events:

- `$pageview`
- `$pageleave`
- `site_page_viewed`
- `site_page_left`
- `site_section_viewed`
- `site_section_engaged`
- `site_component_interacted`
- `site_nav_clicked`
- `site_scroll_depth_reached`
- `site_journey_step`
- `site_cta_clicked`
- `site_contact_clicked`
- `site_form_started`
- `site_form_submitted`
- `site_form_accepted`
- `site_conversion_completed`

V1 now includes the deeper behavioral layer approved after the initial
implementation slice. `site_page_viewed` is the curated base traffic event;
`$pageview` and `$pageleave` keep PostHog's native web analytics surfaces
useful; `site_page_left`, `site_scroll_depth_reached`, and
`site_journey_step` support journey and content-depth analysis;
`site_section_viewed`, `site_section_engaged`, and
`site_component_interacted` support section/component performance; and
`site_nav_clicked` separates header/footer/nav behavior from generic CTA
clicks. CTA/contact/form events support funnels and lead intelligence.
`site_form_submitted` captures browser-side submission intent, while
`site_form_accepted` is the trusted server-side accepted lead signal after
validation/rate-limit/spam handling. `site_conversion_completed` is the
normalized business conversion rollup event.

#### Conversion model — 2026-06-04
Default conversion semantics:

- `site_form_accepted` always counts as a conversion.
- `site_form_submitted` does not count as a conversion; it is a funnel and
  diagnostics signal.
- `site_contact_clicked` counts as contact intent by default.
- Phone, email, WhatsApp, and similar contact clicks become conversions only
  when the tenant/site analytics contract marks those target types as conversion
  goals.
- `site_conversion_completed` is emitted for every accepted form and for any
  configured contact-intent conversion goal.

This keeps tenant-facing conversion rates tied to trusted lead capture while
still allowing contact-heavy sites to opt specific contact actions into the
conversion model.

#### Public-site V1 event metadata — 2026-06-04
Approved V1 public-site event metadata.

Every public-site event carries:

- `schema_version`
- `environment`
- `tenant_id`
- `tenant_slug`
- `site_id`
- `site_domain`
- `page_id`
- `page_slug`
- `page_path`
- `theme_id`
- `site_build_id`
- `manifest_version`
- `session_id`
- `device_type`
- `referrer_domain`
- `referrer_type`
- `$geoip_country_code`
- `$geoip_country_name`
- `$geoip_city_name`

Section/component events additionally carry:

- `section_id`
- `section_type`
- `section_position`
- `section_anchor`
- `section_variant`
- `block_preset_id`
- `content_signature`

Behavioral events additionally carry:

- `journey_step_index`
- `journey_step`
- `journey_from`
- `scroll_depth`
- `page_duration_ms`
- `component_type`
- `component_role`
- `interaction_type`

CTA/contact events additionally carry:

- `action_id`
- `action_role`
- `action_label`
- `target_type`
- `target_domain`
- `target_path`

Rules: do not send raw `mailto:` or `tel:` hrefs. Internal links may store safe
path/hash. External links may store domain and, where useful, sanitized path;
strip query strings by default. `action_label` may contain CMS-authored button
or link text, but never user-submitted data. `content_signature` is a stable
hash of sanitized block content/shape, never raw rich text or private content.
Every event uses `schema_version: 1` so later taxonomy/schema changes can be
queried without breaking V1 dashboards.

#### Metadata source model — 2026-06-04
Approved direction: analytics metadata is projection-owned. Generated sites
should not invent tenant/page/section metadata at runtime. Payload projection
should emit the stable analytics metadata into generated `site.json` and page
JSON, and the generated-site runtime should mostly read and forward that data.

Source model:

- `tenant_id`, `tenant_slug`, `site_id`, and `site_domain` come from Payload
  tenant/site settings projection.
- `page_id`, `page_slug`, and `page_path` come from each projected page.
- `theme_id` and `manifest_version` come from the tenant manifest/theme
  pipeline.
- `site_build_id` is injected by the site template/orchestrator build or deploy
  path, preferably commit SHA or image revision.
- `section_type`, `section_position`, and `section_anchor` come from page block
  projection.
- `section_id` uses the explicit anchor where present; otherwise projection
  emits a stable fallback such as page slug + section position + block type.
- `section_variant` and `block_preset_id` are optional in V1 and may be null
  until block variants/presets are formalized.
- `content_signature` is generated during projection from sanitized block
  shape/content and must not expose raw rich text or private content.

The runtime may derive only request/browser-local facts such as current URL,
referrer, device hints, visibility timing, and sanitized clicked-target details.
If implementation intent or product purpose is unclear for any metadata field
or analytics behavior, pause and prompt the operator before coding.

#### Analytics settings contract — 2026-06-04
Approved V1 settings direction: analytics is platform-enabled by default when
PostHog configuration exists, but public tracking is consent-gated per the
site analytics contract. The V1 analytics contract is operator-managed, not a
broad tenant-editable settings surface.

Projected V1 shape:

- `enabled`
- `provider: "posthog"`
- `consentMode: "required"`
- `posthogHost`
- `posthogProjectToken`
- `conversionGoals.acceptedForms: true`
- `conversionGoals.contactClicks`
- `dashboardVisible`

Defaults: `enabled: true`, `provider: "posthog"`,
`consentMode: "required"`, `conversionGoals.acceptedForms: true`,
`conversionGoals.contactClicks: []`, and `dashboardVisible: true`.
Accepted forms are always conversions. Contact clicks remain contact-intent
signals by default and become conversions only when the operator-managed site
contract includes their target type, such as `phone`, `email`, or `whatsapp`,
in `conversionGoals.contactClicks`.

#### Generated-site runtime behavior — 2026-06-04
Approved V1 runtime direction: `siab-site-template` ships a small first-party
analytics runtime loaded from `BaseLayout.astro`. It is generic and not
theme-specific.

Runtime responsibilities:

- Read projected analytics config plus page/block analytics metadata.
- Wait for visitor analytics consent before initializing PostHog capture.
- Emit `site_page_viewed` once per page load after consent.
- Observe sections and emit `site_section_viewed` and
  `site_section_engaged` once per section per page load.
- Track CTA/contact clicks through delegated click listeners.
- Track form start/submit through delegated form listeners.
- Include projected metadata on every event.
- Never transmit pre-consent analytics events.

Approved thresholds:

- `site_section_viewed`: section is at least 50% visible for 500 ms.
- `site_section_engaged`: section is visible for 3 seconds total, or a
  click/focus/input occurs inside it.
- `site_form_started`: first focus/input in a form.
- `site_form_submitted`: browser submit event before the network response.
- `site_form_accepted`: server-side CMS/Payload event only.
- `site_conversion_completed`: server emits for accepted forms; browser emits
  only for configured contact-click conversion goals after consent.

Consent handoff: runtime exposes `window.SIABAnalytics?.grantConsent()` and
`window.SIABAnalytics?.revokeConsent()` for a future cookie banner/CMP. Until a
consent component grants consent, public-site PostHog tracking remains inactive.

#### Low-overhead behavior and Web Vitals follow-up — 2026-06-07
Same parent analytics program follow-up added the requested deeper metrics. The
generated-site runtime tracks one consented `site_component_viewed` event per
visible link/button per page load and records visible-before-click,
hover-before-click, and time-to-click properties on enriched PostHog
`$autocapture` click events. Web Vitals now use PostHog JS native
`$web_vitals` capture for LCP, INP, CLS, and FCP in the installed SDK version.

Payload analytics now recognizes the new event names, includes them in event
volume, and adds behavior-view queries/tables/charts for component exposure,
interaction rate, click timing, and Web Vitals. The added PostHog queries are
conditional on the behavior tab so the other analytics views keep their prior
load profile.

#### Scoped PostHog autocapture rollout — 2026-06-07
Same-session follow-up enabled PostHog JS autocapture as the canonical
browser-click stream for CTA/contact/nav/component interactions. The generated
site runtime loads `posthog-js` only after consent and idle, bootstraps it with
the same consented SIAB distinct/session ids, enriches autocaptured events with
SIAB tenant/page/section/action metadata in `before_send`, and drops SDK events
except `$autocapture`, `$rageclick`, `$dead_click`, and `$web_vitals`.

Duplicate measurements are avoided by leaving SIAB custom events in place only
for semantics autocapture cannot replace: page/session events, section
visibility/engagement, component exposure, journey, forms, scroll depth, and
server/business conversions. Browser click KPIs query enriched `$autocapture`
only, and Web Vitals query native `$web_vitals` only; the prior custom
click/Web Vital event names are not part of the canonical CMS query path.
`capture_pageview` and `capture_pageleave` remain false;
`capture_performance.web_vitals` is enabled so PostHog and CMS analytics share
the same native Web Vitals stream. Session recording, heatmaps, console log
capture, copied text capture, surveys, and broad attribute capture remain
disabled.

Same-day cleanup follow-up removed the old custom click/Web Vital event names
from the public-site event contract and event-volume query, deleted the mobile
analytics redirect/hidden wrapper, forced dashboard/analytics routes to render
dynamically, and made server-side PostHog query fetches `no-store`. Dashboard
highlights now surface the 7-day native Web Vitals performance score.

#### Server-side analytics query layer — 2026-06-04
Approved V1 CMS/PostHog integration direction: `siab-payload` uses a dedicated
server-only analytics module rather than ad hoc PostHog calls in pages or
components.

Proposed module shape:

- `src/lib/analytics/config.ts`
- `src/lib/analytics/events.ts`
- `src/lib/analytics/posthogClient.ts`
- `src/lib/analytics/queries.ts`
- `src/lib/analytics/access.ts`
- `src/lib/analytics/redaction.ts`

Responsibilities:

- Read PostHog environment/configuration and return enabled/disabled state.
- Capture server-side CMS/product and accepted-form events.
- Query PostHog from the server only; never expose query credentials to the
  browser.
- Keep typed event names and property schemas.
- Enforce tenant/site access before every analytics query.
- Redact or reject disallowed event properties before capture.
- Return curated, UI-safe analytics data rather than raw PostHog responses.

Initial query helper surface:

- `getSiteAnalyticsOverview({ tenantId, days })`
- `getSiteTrafficSeries({ tenantId, days })`
- `getTopPages({ tenantId, days })`
- `getTopCtas({ tenantId, days })`
- `getSectionPerformance({ tenantId, days })`
- `getComponentPerformance({ tenantId, days })`
- `getJourneySteps({ tenantId, days })`
- `getScrollDepth({ tenantId, days })`
- `getGeoCountries({ tenantId, days })`
- `getGeoCities({ tenantId, days })`
- `getDashboardHighlights({ tenantId, days })`

Access rules: tenant-mode users may query only their own tenant; super-admins
may query any tenant and later SIAB-wide internal views. If PostHog config is
missing or disabled, the analytics page renders an unavailable/empty state and
the dashboard keeps existing local Payload stats/activity without runtime
errors.

#### Tenant-facing analytics surface — 2026-06-04
Approved V1 `/analytics` direction: useful and restrained tenant-facing website
analytics that answer whether the site is working, without exposing SIAB's full
internal intelligence layer.

Tenant-facing V1 shows:

- Overview cards: visitors, pageviews, conversions, conversion rate, CTA clicks,
  and accepted form submissions.
- Traffic trend: pageviews and visitors over time, with 7/30/90 day ranges if
  cheap to support in V1.
- Top pages: page, views, visitors, conversions, and conversion rate.
- CTA/contact performance: label/role/type, clicks, and conversion-goal marker
  where applicable.
- Forms funnel: started, submitted, accepted, and acceptance rate.
- Basic section performance: section name/type/page, views, engagements, CTA
  clicks inside the section, and conversion assists only if reliable.
- Component/nav performance: component type/role, section type, interactions,
  and unique visitors.
- Journey depth: ordered journey steps, page-leave duration, and scroll-depth
  buckets.
- Geography: aggregated countries and cities from PostHog GeoIP enrichment,
  without storing or exposing raw IPs.
- Traffic sources and device split.

Keep internal-only in V1: raw event streams, individual visitor/person profiles,
session replay, cross-tenant benchmarks, exact section/component scoring
formulas, experiments/feature flags, and unvalidated inferred recommendations.

Dashboard highlights consume the same analytics query layer but show only a
small summary such as visitors 30d, conversions 30d, conversion rate, and top
page or top CTA. Existing local Payload activity remains available where it is
still the right source of truth.

#### Cross-repo propagation plan — 2026-06-04
Approved multi-repo responsibility split:

`siab-payload` owns analytics contract docs, site/page/block analytics metadata
projection, CMS/server event capture, `site_form_accepted` capture, the
server-only PostHog query layer, `/analytics`, and dashboard highlights.

`siab-site-template` ships the first-party generated-site analytics runtime,
reads projected `site.analytics`, `page.analytics`, and `block.analytics`,
emits the approved public-site V1 events after consent, exposes
`window.SIABAnalytics.grantConsent()` / `revokeConsent()`, and tests emitted
metadata plus no pre-consent transmission.

`siab-site-orchestrator` ensures new generated sites inherit the analytics
runtime from the template, ensures generated site metadata/manifest output
includes analytics support, and adds reviewer gates that verify analytics
runtime/metadata exists or is intentionally disabled.

`siab-payload-orchestrator` seeds the operator-managed analytics config into
Payload, ensures `/add-cms` generated tenants get the analytics contract, and
adds runbook checks for PostHog environment/configuration plus generated-site
analytics metadata.

Existing tenant sites, including Amicare, need a normal template/runtime
backport or site-specific integration. They are not complete until events appear
in the shared SIAB PostHog project with correct tenant/site metadata.

Approved implementation order:

1. `siab-payload` contract docs, projection metadata, and server query helper
   skeleton.
2. `siab-site-template` generated-site runtime.
3. Orchestrator generation/reviewer/seeder updates.
4. Existing tenant backport.
5. CMS `/analytics` page and dashboard highlights.
6. Production smoke for consent, event capture, accepted form conversion, and
   tenant-filtered queries.

#### Closure gate — 2026-06-04
OBS-99 closes only after end-to-end analytics is proven for at least one
production tenant, not merely when code exists.

Approved closure criteria:

- Shared SIAB PostHog project configuration is deployed.
- Public site runtime is consent-gated: no PostHog events, cookies,
  localStorage, or sessionStorage before consent; events flow after consent.
- All public-site V1 events appear in PostHog with correct V1 metadata:
  `site_page_viewed`, `site_section_viewed`, `site_section_engaged`,
  `site_cta_clicked`, `site_contact_clicked`, `site_form_started`,
  `site_form_submitted`, `site_form_accepted`, and
  `site_conversion_completed`.
- Accepted forms emit server-side `site_form_accepted` and the conversion rollup
  event.
- `/sites/[slug]/analytics` renders tenant-filtered curated analytics data.
- Tenant users cannot query another tenant's analytics.
- Super-admins can view tenant analytics.
- Dashboard shows the approved analytics highlights and keeps local activity
  fallback where appropriate.
- The new generated-site flow inherits analytics runtime/configuration.
- At least one existing tenant rollout, initially Amicare, is verified.
- Tests cover redaction/allowlisting, missing-config fallback, tenant query
  access, metadata projection, no pre-consent transmission, and accepted-form
  event capture.

#### Runbook — 2026-06-04
The planning decisions above are consolidated in
`docs/runbooks/posthog-analytics-contract.md`. The runbook is a decision record
and implementation guide, not a rigid script; agents should still research,
review, and adapt implementation details while preserving the approved product
and privacy contracts.

#### Implementation progress — 2026-06-04
Initial OBS-99 implementation slice is in place across the planned repos:

- `siab-payload` now projects analytics config and page/block metadata, defines
  typed analytics events/config/redaction/query helpers, captures accepted form
  conversions server-side, renders tenant-scoped `/analytics` and
  `/sites/[slug]/analytics`, includes overview, traffic, top page/action,
  form-funnel, traffic-source, device-split, and section-performance slices,
  and adds dashboard analytics highlights when PostHog query credentials are
  configured.
- `siab-site-template` now ships a first-party consent-gated runtime that emits
  the approved public-site V1 events only after
  `window.SIABAnalytics.grantConsent()`, adds safe referrer-domain/source-type
  and device-type metadata after consent, and avoids PostHog transmission or
  browser storage before consent.
- `siab-site-orchestrator` and `siab-payload-orchestrator` prompts/reviewer
  contracts now preserve the analytics manifest/runtime requirements for future
  generated sites.

Validated locally with focused analytics/projection/redaction/locale tests,
`pnpm typecheck`, `pnpm lint:no-css`, and `pnpm registry:check` in
`siab-payload`; plus `astro check`, template tests, and production build in
`siab-site-template`. OBS-99 remains **Active** until the closure gate above is
proven against a deployed PostHog project and at least one production tenant.

Deployment note: the production Payload compose stack must pass
`POSTHOG_HOST`, `POSTHOG_PROJECT_TOKEN`, `POSTHOG_PROJECT_ID`,
`POSTHOG_PERSONAL_API_KEY`, `POSTHOG_ENVIRONMENT`, and
`POSTHOG_ANALYTICS_DISABLED` through to the app container. Having these values
only in the stack `.env` is not sufficient; missing compose pass-through leaves
CMS capture/query and public projection config disabled.

Follow-up implementation progress same session: the top-level `/analytics`
route now renders a super-admin-only SIAB-wide analytics/intelligence view when
visited from the platform overview context, while tenant-mode `/analytics` and
selected-site `/sites/[slug]/analytics` remain tenant/client-scoped curated
views. The super-admin view aggregates PostHog data across tenants by default,
supports 7/30/90 day ranges plus an optional tenant filter, and shows overall
metrics, traffic trend, tenant-performance bar chart/table, source and device
charts, event-volume table, and the existing detailed page/action/form/source/
device/section slices. The sidebar now places the super-admin analytics link in
the Overview group beneath Dashboard; tenant and selected-site analytics stay
in Content.

Follow-up implementation progress same session: SIAB CMS product analytics now
captures authenticated admin route views and click/action usage through a
same-origin `/api/cms-analytics` endpoint mounted from the admin app shell. The
client tracker records normalized CMS route templates, route entry type
(`direct`, `internal`, `external`), device class, element role, and short
sanitized action labels without form values or raw external URLs. The
server-side capture path still derives user, role, tenant, and SIAB mode from
the authenticated request.

The super-admin dashboard now includes route-view, action-click, and
desktop/mobile editor-open highlights. The super-admin `/analytics` view now
adds CMS product-usage tables for most-reached CMS routes, most-used actions,
and CMS device split, backed by dedicated HogQL query helpers. Tenant/client
analytics remain scoped to public website performance; SIAB CMS product
intelligence is super-admin-only.

Validated in `siab-payload` with focused analytics redaction/query/locale tests,
`pnpm typecheck`, `pnpm lint:no-css`, and `pnpm registry:check`.

Follow-up implementation progress same session: the generated-site runtime now
emits standard PostHog `$pageview` and `$pageleave` events after consent, plus
curated `site_page_left`, `site_component_interacted`, `site_nav_clicked`,
`site_scroll_depth_reached`, and `site_journey_step` events. SIAB CMS usage
analytics now records save/upload/status success and failure signals plus
unsaved-navigation friction, all through the authenticated CMS analytics
endpoint and redaction allowlist. The SIAB analytics query/UI layer now exposes
component performance, journey-step, and scroll-depth tables for both
tenant-scoped and super-admin views.

Follow-up implementation progress same session: the tenant and super-admin
analytics surfaces now include geography intelligence from PostHog GeoIP
properties: country distribution, top countries, and top cities. This is
aggregated and tenant-filtered through the same server-only PostHog query layer;
raw IP addresses are neither captured nor exposed by SIAB.

Follow-up implementation progress same session: CMS analytics pages are now
desktop-only at the existing admin `md` breakpoint. Sidebar analytics links are
hidden below `md`, analytics drill-down dashboard cards disable mobile
navigation, phone user-agent requests are redirected before PostHog query work,
and resized/narrow clients are redirected by a viewport guard.

Follow-up implementation progress same session: analytics period changes now
show an explicit analytics-shaped skeleton while the new server-rendered
PostHog query payload resolves. The shared period frame preserves existing
query params and the super-admin tenant filter while switching between 7, 30,
and 90 days, and direct analytics route loads have segment-specific skeletons.
Production logs showed no recent PostHog query failures for the reported
90-day switch; the issue matched an unclear pending state rather than a silent
query crash.

Follow-up implementation progress same session: default CMS analytics windows
now start at 7 days instead of 30 days. This covers slugless `/analytics`,
selected-site `/sites/[slug]/analytics`, dashboard analytics highlights, CMS
usage highlights, and the dashboard edits chart. The month-based submissions
stat remains explicitly 30 days.

Follow-up implementation progress same session: dashboard and admin polish
fixed two route/layout regressions and reduced super-admin dashboard metric
noise. Tenant owners now have a top-level `/navigation` route that redirects to
their resolved site navigation manager, and the selected-site navigation route
guards tenant-host owners against cross-slug access. The user edit form shell is
explicitly full-width so its header save action aligns with the other edit
pages. Super-admin CMS usage highlights now render as a compact activity-volume
bar chart plus editor device-split pie chart instead of a wall of event cards.

Closure verification 2026-06-05: OBS-99 is marked done after the PostHog
integration, CMS analytics surfaces, generated-site tracking runtime, consent
gating, super-admin analytics, tenant/client analytics, geography intelligence,
mobile route gating, loading states, 7-day default windows, and dashboard
analytics polish were implemented and deployed. Validation across the final
slices included focused analytics/query/locale tests, `pnpm typecheck`,
`pnpm lint:no-css`, `pnpm registry:check`, `pnpm build`, GitHub CI,
GHCR image smoke-starts, production deploys, and green production health checks.

### OBS-101 — Add Google/Apple/SSO login options

**Status:** Closed 2026-06-11 · **Layer:** full-stack / auth
**Discovered in:** Session 2026-06-05 (operator backlog request)

#### Description
Users should be able to authenticate with common identity providers such as
Google/Gmail, Apple, and potentially broader SSO options. This needs a proper
auth architecture decision rather than a cosmetic button: provider linking,
tenant/role assignment, account matching, invited-user onboarding, session
security, callback URLs, environment configuration, and production runbooks all
need explicit handling.

#### Suggested fix shape
Research Payload v3-compatible auth provider patterns and decide whether to use
OAuth/OIDC directly or through an auth broker. Define provider configuration,
allowed domains if needed, account-linking rules, invite compatibility,
role/tenant assignment, failure states, and tests before implementation.

#### Architecture decision — 2026-06-09
Use **Better Auth** as the preferred broker/library for OBS-101, pending a
small technical spike that proves the Payload integration boundary.

Rationale: SIAB needs Google/Apple/Microsoft-style login, future MFA/2FA,
passwordless/passkeys, and possible SSO without owning the full maintenance
surface for OAuth/OIDC provider drift, token/session edge cases, recovery flows,
and MFA/passkey protocol details. Better Auth fits the product direction better
than hand-rolled OAuth because it is open source, runs in the SIAB codebase,
uses SIAB-owned persistence, supports custom UI, and exposes plugin-based
features for social sign-on, 2FA, passkeys, and SSO. This keeps the CMS login
experience in the existing shadcn/SIAB UI layer instead of forcing a hosted
vendor UI or ecosystem lock-in.

This is not a decision to replace Payload's authorization model. Payload
`Users`, role/tenant invariants, route gates, and Local API `user: caller`
behavior remain the source of CMS authorization truth. The implementation must
prove how Better Auth accounts/sessions map to Payload users, how existing
invited users link providers safely, how tenant/role assignment is prevented
from provider-controlled input, and how logout/session rotation interacts with
Payload's current `useSessions: true` password-change behavior.

Implementation constraints:
1. Start with provider login/linking for existing invited users; do not allow
   open self-signup into tenant roles.
2. Treat email matching as a controlled linking signal, not sufficient
   authorization by itself, especially for unverified or provider-changed email
   states.
3. Keep role and tenant assignment Payload-owned and operator/invite-owned.
4. Add Better Auth tables/migrations explicitly and document environment
   variables, callback URLs, and production provider setup.
5. Cross-reference OBS-77 before exposing MFA UI; Better Auth's 2FA plugin is
   the likely implementation path, but social/passwordless sign-ins may need
   explicit challenge hooks depending on the desired MFA policy.
6. Add focused tests for callback/linking failure states, invite compatibility,
   Payload auth bridge behavior, and role/tenant invariants.

#### Closure — 2026-06-11
Implemented passwordless CMS login through Better Auth email magic links and
social providers for Google, Microsoft, and Apple. Better Auth owns provider
identity, account linking, OAuth callback handling, magic-link verification, and
its own prefixed tables; Payload `users` remain the CMS authorization source for
roles, tenant membership, sessions, and route gates.

The implementation keeps signup closed: provider login or email-link
verification can create/link a Better Auth user only when the verified email
matches exactly one existing invited Payload user, and that Payload user still
satisfies the role/tenant invariants. The final callback mints a normal Payload
session cookie after evaluating the existing host/tenant gate, so tenant admin
hosts such as `admin.ami-care.nl` do not route through or become super-admin
context.

Added explicit Better Auth Postgres tables via a Payload migration, environment
template entries for Google/Microsoft/Apple credentials, login UI provider and
email-link buttons, logout cleanup for both Payload and Better Auth sessions,
dynamic host validation against Payload tenants, and a social-auth runbook for
provider/email setup and validation. Operational follow-up is to register
provider callback URLs per environment and ensure `RESEND_API_KEY`/`EMAIL_FROM`
are configured for email-link delivery; `BETTER_AUTH_ALLOWED_HOSTS` is now only
an escape hatch for non-tenant or preview admin hosts.

Verification: local `pnpm typecheck`,
`pnpm test tests/unit/social-auth.test.ts tests/unit/social-auth-complete-route.test.ts`,
`pnpm test`, `pnpm payload:contract`, `pnpm registry:check`, and
`pnpm lint:no-css` passed on the local Node 24 runtime with the repo's expected
Node 26 engine warning. GitHub CI and GHCR image smoke-start passed for
`5ee46ce`, production pulled/recreated `siab-payload`, the Better Auth
migration is applied, fresh boot logs show no pending migrations and no Better
Auth base-url warning, and `https://admin.siteinabox.nl/api/health` plus
`https://admin.siteinabox.nl/login` return 200/healthy.

### OBS-102 — Amicare hero floating cards are not rendered/editable in canvas

**Status:** Active · **Layer:** multi-repo (`siab-payload` + `site-amicare-zorg` + future templates/themes)
**Discovered in:** Session 2026-06-05 (operator backlog request)

#### Description
On the Amicare site specifically, the animated floating cards over the hero /
banner image are visible on the live site but are not rendered in the CMS canvas
and are not editable. This may be a site-specific renderer gap, a manifest
field-contract gap, a canvas renderer simplification, or an intentional
non-editable decorative layer that needs clearer handling.

#### Suggested fix shape
Research the Amicare live hero/banner implementation, the CMS canvas hero
renderer, and the site manifest field contract. Decide whether these floating
cards should be editable content, theme-owned decoration, a toggleable visual
variant, or read-only canvas decoration. Apply the decision in a way future
generated sites can follow without hardcoding Amicare-only behavior into the
generic editor.

### OBS-103 — Verify route access and navigation parity for every role

**Status:** Closed 2026-06-05 · **Layer:** full-stack / access QA
**Discovered in:** Session 2026-06-05 (operator backlog request)

#### Description
Every route should match the navigation and role model. If a user can navigate
to a URL from the sidebar, menu, dashboard card, editor affordance, or other
in-app link, that route must be accessible to that user. If a route is not
intended for a role/user context, that role should not see a navigable affordance
to it, and direct URL access should redirect or 404 consistently.

#### Suggested fix shape
Build a role × mode × route matrix for `super-admin`, `owner`, `editor`, and
`viewer` across the super-admin host, tenant host, and selected-site routes.
Audit `AppSidebar`, dashboard cards, table row actions, editor/header/footer
navigation links, settings/team/navigation/pages/media/forms routes, and
selected-site routes. Add focused tests where practical and document intentional
redirect vs 404 behavior.

#### Implementation progress — 2026-06-05
First verification slice covered selected-site owner-capable routes. The audit
found that `/sites/[slug]/settings` and `/sites/[slug]/users` did not share the
tenant-slug boundary already present on `/sites/[slug]/navigation`: a
tenant-host owner could direct-URL a different tenant slug, and selected-site
team could be reached by editor/viewer via direct URL.

Added a shared selected-tenant route boundary helper and applied it to selected
site settings, navigation, and team routes. Selected-site team now uses
`requireRole(["super-admin", "owner"])`, matching the sidebar's hidden
editor/viewer affordance. Super-admin can still inspect any selected site;
tenant-host owners are limited to their own tenant slug; cross-tenant selected
site URLs 404. Focused unit coverage now pins the selected-tenant boundary and
source-level parity between the selected-site owner-capable routes and
`AppSidebar`.

OBS-103 remains active for the rest of the role × mode × route matrix,
including dashboard/table/editor links and documenting intended redirect vs 404
behavior across every route.

Second same-day verification slice aligned slugless tenant-host settings/team
routes and selected-site page chrome with the same role/navigation model. The
slugless `/settings` and `/users` routes now redirect editor/viewer direct URL
access to `/?error=forbidden`, matching `AppSidebar`'s owner-only settings/team
affordances. Owner-only selected-site pages keep using the selected-tenant
boundary, and their `TenantPill` now links tenant-host users back to `/`
instead of the super-admin-only `/sites/[slug]` overview. Super-admin selected
site pages keep the original `/sites/[slug]` pill target.

The API-key route was reviewed during this slice and left unchanged: the account
menu hides `/api-key` for non-super-admin, while direct access intentionally
renders the documented AMD-3 explanatory placeholder instead of mounting
`ApiKeyManager`.

Third same-day verification slice aligned tenant viewer content routes with the
existing access contract in `roleHelpers`: viewers can read tenant content but
cannot write pages/media. Tenant-host Pages hides New/Delete affordances for
viewers, `/pages/new` redirects viewer direct URL access to
`/?error=forbidden`, and `/pages/[id]` now renders a read-only editor/canvas
view for viewers. The read-only page detail hides save, draft recovery, theme
bar, sidebar block forms, page settings, delete, and mutation chrome, and passes
read-only selection/no-op update behavior into the canvas. Tenant-host Media
hides upload, selection, and delete affordances for viewers. Media "Used in"
rows remain informational for viewers and no longer link to forbidden page
editor mutation routes.

Fourth same-day verification slice documented the current route × role × host
matrix in `docs/backlog/features/route-access-matrix.md`. Remaining routes
reviewed in this slice did not show another clear code mismatch: analytics is
available to authenticated roles where linked and intentionally redirects on
mobile; forms are list/sheet read routes; profile is available to all
authenticated roles; `/api-key` keeps the existing AMD-3 non-super-admin
placeholder behavior; and selected-site super-admin routes remain
super-admin-only.

#### Resolution — 2026-06-05
Closed. The route/navigation contract is now documented in
`docs/backlog/features/route-access-matrix.md` and guarded by focused source and
pure logic coverage. Fixed mismatches found during the audit:

- Selected-site owner-capable routes now share one selected-tenant boundary.
- Tenant-host settings/team direct URLs now match the owner-only sidebar model.
- Tenant-host selected-site pills no longer send owners to the super-admin-only
  site overview route.
- Viewers can open page detail through a read-only editor/canvas view while
  page/media write affordances remain hidden or forbidden.
- Media usage links no longer point viewers at page mutation routes.

Validation passed on 2026-06-05: focused OBS-103 unit/source coverage,
`pnpm typecheck`, `pnpm lint:no-css`, and `pnpm registry:check`. Playwright E2E
was not run during this closeout. Docker is not installed on Shimmy's Linux dev
box, but Podman is a supported local substitute for the Postgres/dev-server E2E
path; see `docs/runbooks/local-dev.md` for the direct Podman commands.

### OBS-81 — Site settings schema/projection must finish moving to the settings contract

**Status:** Closed 2026-06-05 · **Layer:** full-stack
**Discovered in:** Session 2026-05-26 (operator settings review)

#### Description
The client-facing settings detail page is now contract-driven, but the backend
compatibility layer is still too Amicare-shaped. `SiteSettings` keeps global
fields for contact/business/opening-hour style data and `settingsToJson()` still
projects those fields unconditionally when present. Not every generated site
will support or need those details. The remaining work is to make storage and
projection obey the same explicit settings/site contract as the form surface.

#### Suggested fix shape
Plan before implementation. Keep the current contract-rendered form behavior,
then migrate the collection/projection compatibility layer toward the same
contract: identity, logo/favicon, maintenance banner, navigation zones, footer
zones, contact channels, legal/business identifiers, JSON-LD fields, and any
site-specific chrome. Existing Amicare fields can remain as one concrete
contract instance; future sites should not inherit Amicare-specific footer
assumptions by default.

#### Research update — 2026-05-26
`language` is not dead data: generated sites consume it for `<html lang>` and
SEO locale. `contactEmail`, phone/address-style data, and NAP fields are also
projected into `site.json`; Amicare consumes `contactEmail` in the footer and
JSON-LD, and consumes NAP/contact fields for local-business JSON-LD and footer
business identifiers. The item remains active because the CMS form is still a
hardcoded global field list instead of a site/manifest-declared settings
contract.

#### Progress — 2026-05-27
Batch 4 added the first local contract layer without changing the database
schema: `siteManifest.settings` now validates through the tenant manifest schema,
both settings routes resolve that contract from the current tenant, and
`SettingsForm` renders optional identity/details/operations fields from the
resolved contract instead of unconditionally showing the full Amicare-shaped
field set. Tenants with no declared contract retain the previous full settings
surface as a legacy fallback so existing Amicare management stays usable until
its manifest is updated explicitly.

The previously ambiguous General fields are now labelled/documented by consumer:
`language` is shown as site language and described as projected `site.json` data
for generated-site `<html lang>` / SEO locale consumers. `contactEmail`, phone,
address, description, and footer text now explain that they are projected only
for themes that support those surfaces.

Operator correction same session: the compatibility fallback was too broad for
client-facing settings. The default settings surface is now deliberately slim:
General keeps site name, URL, and description; Brand keeps logo/favicon; and
Operations keeps maintenance plus GDPR export. Site language, contact email,
footer text/copyright, business identifiers (KVK / vestigingsnummer), service
areas, and opening hours no longer appear by default. Header/footer-specific
content should move to page-editor chrome/section handling instead of living on
the Settings page. Projection/collection fields remain for compatibility until a
later schema cleanup or a future explicit contract reintroduces them.

Same-session follow-up moved the first header/footer-specific content back into
the page editor chrome flow: Header/Footer chrome can now be inspected from the
editor, edited through the explicit page Save cycle, and projected as
`chrome.header.logo`, `chrome.footer.logo`, `chrome.footer.tagline`, and
`chrome.footer.copyright`. Settings remains slim; global logo/favicon stay in
Brand and chrome-specific overrides fall back to those brand defaults.

Planning checkpoint 2026-06-05:
`docs/backlog/features/obs-81-settings-contract-plan.md` defines the
contract-gated projection cleanup and records the decision outcomes.

Closure update 2026-06-05: Settings projection now receives the resolved
`siteManifest.settings` contract from `projectToDisk` and gates Settings-page
fields by that contract in `settingsToJson`. There is no legacy broad projection
mode: tenants are expected to declare `siteManifest.settings`. Page-editor
chrome, navigation, footer column composition, and analytics continue to project
as separate runtime/editor contracts; footer tagline/copyright remain page
editor chrome data, not Settings-page fields. The collection still carries
compatibility fields until a future migration proves them unused, but generated
`site.json` no longer exposes optional Settings-page data without an explicit
manifest contract.

Same-session cross-repo follow-up: the local `optidigi/site-amicare-zorg`
`siteManifest.json` now declares Amicare's optional settings contract for the
fields it still needs projected. Footer tagline/copyright remain page-editor
chrome fields only.

Renderer/projection follow-up same session: `site-amicare-zorg` now consumes
those logo fields. Its live header uses `chrome.header.logo` with fallback to
`branding.logo`, and its footer accepts `chrome.footer.logo` with the same
fallback. The settings projection hook also reloads `SiteSettings` at depth 1
before writing `site.json`, so media-backed logos are projected with filename /
URL data even when the save payload itself only carried a media ID. This closes
the Amicare renderer/projection half of the "logo appears saved in CMS but does
not show on the site" issue; the local dev DB still needs the new
site-chrome-logo migration applied before the CMS PATCH can persist the new
columns.

#### Research verification — 2026-05-28
The settings detail page portion is no longer open: `siteManifest.settings` is
resolved by both settings routes and `SettingsForm` renders optional groups from
that contract. The active remainder is backend compatibility cleanup:
`SiteSettings` and `settingsToJson()` still carry/project global legacy fields
that should become contract-scoped before future non-Amicare sites rely on this
surface.

#### Current verification — 2026-05-28
Still current and correctly narrowed. `src/lib/settingsContract.ts` gates the
client form, but `src/collections/SiteSettings.ts` still stores global contact,
NAP, hours, service-area, and social fields, and
`src/lib/projection/settingsToJson.ts` still projects them whenever present.

---

### OBS-77 — Implement real CMS 2FA/MFA flow before exposing settings UI

**Status:** Active · **Layer:** full-stack
**Discovered in:** Session 2026-05-26 (settings review)

#### Description
The settings page briefly showed a 2FA/TOTP research notice, but there is no
working CMS 2FA flow. Showing a non-functional security control is
counterintuitive for admins and makes the product look broken.

#### Suggested fix shape
Keep all 2FA/MFA UI hidden until a real implementation exists. Future work
must design the full auth flow first: enrollment, recovery, verification on
login, disable flow, admin recovery, session behavior, and Payload auth-field
access controls per the security doctrine.

#### Progress
- 2026-05-26: removed the non-functional 2FA notice from the settings page and
  deleted the unused locale keys. This item remains open for a real 2FA/MFA
  implementation.

#### Current verification — 2026-05-28
Still current. Repo search found no TOTP/MFA enrollment, login challenge,
recovery, disable, or admin recovery flow. The settings page no longer exposes a
fake 2FA control, so this remains future implementation work rather than a
visible broken UI.

---

### OBS-22 — Dashboard metrics — richer role-scoped data and charts

**Status:** Closed 2026-06-08 · **Layer:** full-stack
**Discovered in:** GitHub #4
**File:** `src/lib/activity.ts`, `src/lib/queries/`, `src/components/dashboard/`

#### Description
Dashboard shows basic stats. Operators want richer role-scoped metrics: edits per block type, edit time-of-day heatmap, most edited pages, performance metrics. Super-admin and tenant roles must only see data scoped to their context. Issue notes suggestions are not conclusive — metric set needs agreement before building.

#### Suggested fix shape
1. Audit `src/lib/activity.ts` for current tracking; extend if block-type granularity is missing.
2. Add aggregation queries to `src/lib/queries/`.
3. Add chart components using existing `@siab/chart` primitive.
4. All queries accept `tenantId` param; super-admin passes `null` for global view.

#### Current verification — 2026-05-28
Still current. `src/lib/activity.ts` provides basic counts, recent page/form
activity, and a simple page-updated time series. It does not yet track or
aggregate block-type edits, heatmaps, most-edited pages, or performance metrics.

#### Planning direction — 2026-06-04
OBS-22 is now part of the OBS-99 PostHog analytics program rather than a
standalone local-dashboard expansion. Dashboard highlights should be designed
from the same PostHog-backed event/query layer used by OBS-26, with existing
local Payload activity retained only where it is still the right source of
truth. Do not build a separate dashboard-only metric model before the OBS-99
event taxonomy and tenant-scoped query contract are agreed.

#### Implementation progress — 2026-06-04
The first OBS-22 slice now uses the OBS-99 query layer for dashboard analytics
highlights: visitors 30d, conversions 30d, conversion rate, and CTA clicks 30d
render for tenant dashboards and selected-site super-admin dashboards when
PostHog query credentials are configured. Existing local Payload activity stats
and recent activity remain the fallback/source of truth for authoring activity.
Richer local editor metrics, block-type activity, heatmaps, and configurable
chart controls remain open.

#### Implementation progress — 2026-06-05
The analytics presentation layer now makes fuller use of the existing
PostHog-backed datasets without inventing new metrics: top pages, acquisition,
device split, form funnel, CTAs, sections, components, journey/scroll, and
geography are grouped into chart/table clusters for all analytics roles.
This does not close OBS-22 because block-type edit metrics, authoring heatmaps,
most-edited-page aggregates, and performance metrics still require new tracking
or query work.

#### Closure — 2026-06-08
Closed by operator decision. The broad "richer dashboard metrics" placeholder
has been superseded by the completed OBS-99/OBS-26 analytics program, the
current PostHog-backed analytics/dashboard surfaces, and narrower active
follow-ups:

- OBS-114 covers Web Vitals semantics plus Lighthouse-style performance and
  SEO/site-quality scoring.
- OBS-115 covers PostHog-native tracking completeness, pageleave, Web Vitals
  completeness, and duplicate-prevention.
- FE-107 covers remaining analytics chart selection/color review.

Do not keep OBS-22 open for generic future metric ideas. File narrower follow-up
items when a specific dashboard metric or tracking source is agreed.

---

### OBS-27 — Dashboard charts — dynamic and user-configurable

**Status:** Closed 2026-06-08 · **Layer:** full-stack
**Discovered in:** GitHub #32 (extends GitHub #4)
**File:** `src/components/dashboard/`, `src/app/(frontend)/(admin)/dashboard/`

#### Description
The current dashboard chart (EditsChart) is static — fixed time range, fixed metric, no user control. Operators want charts they can interact with: adjustable date ranges, toggleable metrics, possibly chart-type switching. Distinct from OBS-22 which is about adding richer underlying data; this is about making the chart presentation layer configurable by the user.

#### Why deferred
Depends on OBS-22 to settle the data model and available metrics first — no point building a configurable UI over a thin data layer.

#### Suggested fix shape
1. Add date-range picker (e.g. last 7 / 30 / 90 days, custom) wired to EditsChart query.
2. Allow metric toggling if OBS-22 introduces multiple series (e.g. edits by block type).
3. Persist user preferences (selected range, visible metrics) in `localStorage` initially; escalate to a `Users.dashboardPrefs` JSON field if cross-device sync is needed.
4. Use existing `@siab/chart` primitive — no new chart library.
5. Scope: each role sees only its permitted metrics (enforced server-side per OBS-22).

**Cross-reference:** OBS-22 — build or at least design the data layer before this.

#### Current verification — 2026-05-28
Still current. `src/components/dashboard/EditsChart.tsx` remains a fixed
30-day, single-series area chart with no range picker, metric toggles, chart
type choice, or persisted chart preferences.

#### Planning direction — 2026-06-04
Keep OBS-27 separate from the initial OBS-99 / OBS-26 / OBS-22 implementation.
The first analytics delivery should prioritize the event model, generated-site
instrumentation, tenant-scoped query layer, curated analytics page, and dashboard
highlights. Pick up configurable date ranges, metric toggles, chart switching,
and persisted chart preferences after those fixed views are trusted.

#### Implementation note — 2026-06-05
The fixed analytics views now use richer chart types and clearer grouping, but
OBS-27 remains active. User-configurable chart ranges beyond the existing
7/30/90 controls, metric toggles, chart switching, and persisted dashboard
preferences were intentionally not added in this slice.

#### Closure — 2026-06-08
Closed by operator decision. The useful chart-configuration direction has been
absorbed into the current analytics UI work and the narrower active FE-107
review item. The analytics pages now have period controls, richer chart/table
clusters, chart-type/metric controls where they are valuable, responsive
dashboard charts, and production-tested chart rendering. Do not keep OBS-27 as
a broad dashboard configurability placeholder; file a new narrow item if a
specific persisted preference or chart control is still required.

---

### OBS-23 — Settings page refactor

**Status:** Closed 2026-05-28 · **Layer:** full-stack
**Discovered in:** GitHub #30
**File:** `src/app/(frontend)/(admin)/settings/`

#### Description
Settings page diverged from the rest of the design language. Requested additions
were design alignment, profile management, plan visibility, GDPR data-request
flow, maintenance banner, and logo/favicon upload. Plan sub-items are deferred
until a billing system exists. 2FA/MFA is tracked separately in OBS-77 and must
not be exposed until it works end to end.

#### Suggested fix shape
Tackle in sequence:
1. **Design alignment** (frontend-only) — bring tabs/layout in line with other pages and keep it consistent with the page/navigation editor save-state model.
2. **Plan** — deferred until billing system exists.
3. **Dynamic settings contract** — split remaining per-site footer/contact/detail hardcoding into OBS-81 instead of continuing to grow this broad settings item.

#### Progress
- 2026-05-19: sub-item 2 partially landed — `logo` field present on `SiteSettings`. Favicon, maintenance banner, GDPR, and plan visibility still outstanding at that time.
- 2026-05-26: settings was expanded with favicon upload, maintenance banner fields, full site identity/contact/availability sections, and a GDPR data-export request action at `POST /api/users/request-data`. `site.json` projection now includes `branding.favicon`, `maintenance`, and supported footer text/copyright content. Payload v3.84 research found no built-in TOTP/2FA toggle or local MFA implementation; 2FA/MFA is now OBS-77 and was removed from the settings UI until it works. Plan visibility remains deferred until billing exists.
- 2026-05-26 audit correction: the favicon, maintenance banner, and GDPR request pieces are no longer open sub-items. Remaining OBS-23 scope is design alignment plus future plan/billing visibility. Dynamic per-site settings shape is tracked in OBS-81.
- 2026-05-27 Batch 4: the settings page now consumes the OBS-81 contract when
  deciding which optional groups/fields to display and adds clearer projected
  consumer descriptions for General/Details fields. Design-shell alignment was
  already mostly handled by FE-56; future plan/billing visibility remains
  deferred until a billing system exists.
- 2026-05-27 correction: the Settings surface was reduced after operator
  feedback. The old Identity tab is now Brand, only logo/favicon stay there,
  technical projection descriptions were removed from the client UI, site
  language is hidden, and the Details/legal/hours fields are not shown by the
  default contract.
- 2026-05-27 follow-up: header/footer-specific content moved to the page editor
  chrome inspector. Settings keeps only global brand logo/favicon; Header/Footer
  can override logo in the editor and Footer owns its text/copyright there.
- Closure verification 2026-05-28: logo/favicon, maintenance banner, GDPR data
  export request, slim settings layout, Brand tab naming, client-facing copy
  cleanup, and explicit save-state behavior are implemented. Future plan/billing
  visibility should be tracked as a billing item once that product surface
  exists. Dynamic settings schema/projection cleanup continues under OBS-81 and
  real MFA remains OBS-77.

---

### OBS-63 — Header/footer rendered in canvas as selectable site chrome

**Status:** Closed 2026-05-26 · **Layer:** full-stack
**Discovered in:** Session 2026-05-19
**File:** `src/components/editor/canvas/`, `src/components/editor/sidebar-inspector/`, `src/components/editor/mobile-inspector/`, `src/collections/SiteSettings.ts`

#### Resolution
CMS-side site chrome is now visible in the page editor canvas. `@siab/canvas-chrome` exposes host-rendered `headerChrome` / `footerChrome` slots, and `siab-payload` renders app-owned header/footer previews from `SiteSettings` above and below the editable block stack. The previews are selectable and non-draggable; selecting one switches to the sidebar inspector on desktop, or opens a mobile full-screen editor from the page-actions area.

The chrome inspector edits only non-navigation content: logo, tagline/footer text, CTA label/link, and copyright. Navigation remains delegated to the dedicated navigation manager through an "Edit navigation" handoff row. `SiteSettings` now carries `chrome.header` / `chrome.footer` fields, and projection writes them into `site.json` for site renderers.

Correction 2026-05-26: the inline chrome inspector was removed after product review. Header and footer now behave as contextual site chrome: they render in the canvas with tenant/site styling, appear as non-draggable rows in the sidebar/mobile overview, and open an action menu that routes users to the dedicated navigation or settings pages. Unsupported header/footer CTA fields and header tagline fields were removed from the schema/projection with a cleanup migration; logo/footer text/copyright remain owned by the settings page.

Follow-up 2026-05-26: sidebar/mobile chrome rows now use the same compact row language as normal sections and are labelled simply "Header" / "Footer" in both EN and NL. The chrome action menu is click-positioned instead of anchored to the row edge. Same-day correction made the Header/Footer row labels literal in this chrome component to prevent missing-key fallbacks such as `editor.header`, and portals the action menu to the admin document body so it follows CMS styling rather than tenant canvas styling.

Follow-up 2026-05-27: chrome inspection was restored in the narrower product
shape requested after the Settings refactor. In sidebar mode, selecting Header
or Footer opens the right-hand chrome inspector. In desktop canvas mode, clicking
Header/Footer opens a dialog inspector so the WYSIWYG mode does not gain a
permanent sidebar. Header/Footer remain non-draggable/non-reorderable. The
inspector supports logo overrides for Header/Footer, Footer text/copyright, and
keeps navigation management as a handoff button. Edits are local draft state and
persist only through the page editor Save button.

#### Original description
The canvas currently renders only the page block stack. The site header and footer — visible chrome on every published page — are invisible while editing, so authors can't see the surrounding context and have no in-canvas affordance for editing their non-nav content (logo, tagline text, header/footer buttons, copyright line, etc.).

Render header and footer in the canvas as **non-draggable, non-droppable** chrome above and below the block stack. They must be **clickable / selectable** in the same selection model used for blocks: selecting them on desktop opens the sidebar inspector; on mobile opens the bottom-sheet inspector. The inspector exposes only the non-nav content (logo, text, buttons, etc.) — nav links and link structure are **not** editable from this surface.

When the user selects a nav link (or a "Manage navigation" affordance on the chrome itself), the editor routes them to the OBS-20 navigation management page rather than attempting inline nav editing.

#### Why deferred
Depends on OBS-20 — the "click a nav link → go to nav page" handoff has nowhere to route until the navigation page exists.

#### Suggested fix shape
1. Render header / footer inside the canvas using the same site renderer used in projection, gated by a `selectable: true, draggable: false` mode (no drag handles, no insert-slots, no gap buttons around them).
2. Extend the canvas selection model to recognise `header` / `footer` as selection targets distinct from blocks; ensure the existing "click empty canvas → deselect" path still works.
3. Add a chrome inspector variant in both `@siab/sidebar-inspector` and `@siab/mobile-inspector` that lists the editable non-nav fields (logo, text, buttons). Nav-related fields render as a single "Edit navigation →" row that routes to `/sites/[slug]/navigation` (the OBS-20 route).
4. Confirm `SiteSettings` carries every non-nav field the inspector needs (logo, header/footer text, button labels, copyright line, etc.). If gaps exist, add fields + migration in this work item — flag separately if the scope grows.
5. Persist edits via the same SiteSettings update path used by today's Settings → Branding flow.

**Cross-reference:** OBS-20 (nav page — hard dependency for the nav-edit handoff), OBS-21 (per-page nav toggle — orthogonal but ships in the same workstream).

---

## Multi-repo Items

### OBS-122 — CMS-ify `sites/amblast` generated site snapshot

**Status:** Active · **Layer:** multi-repo (`apps/cms` + `packages/site-template` + `sites/amblast` + orchestrator)
**Discovered in:** Session 2026-06-16, post-SIAB package split follow-up

#### Description
`sites/amblast` is a generated site snapshot, but it has not been CMS-ified
yet. It currently builds as a static generated site and does not consume the
shared CMS/generated-site contracts in `@siteinabox/contracts`.

Do not opportunistically migrate `amblast` to CMS contracts just because
`ami-care` and `packages/site-template` now share them. The right moment is the
explicit CMS-ification workflow, where template drift, tenant-specific content,
manifest shape, renderers, CMS CSS, analytics, image/deploy contract, and
Payload seeding can be reviewed as one tenant conversion.

#### Suggested fix shape
1. Run the `/add-cms amblast` workflow preflight and confirm the current
   tenant/deploy contract before touching the snapshot.
2. Compare `sites/amblast` against `packages/site-template` and decide which
   template changes should be adopted versus which tenant-specific code should
   remain frozen.
3. Add the generated-site CMS contract surface only when needed:
   `@siteinabox/contracts`, local compatibility re-exports if useful, RtRoot
   renderers, `siteManifest.json`, CMS CSS output, analytics/runtime hooks, and
   Payload seeding inputs.
4. Keep tenant-specific content, theme, route shape, public image name, and
   deploy contract stable unless the operator explicitly approves a deploy
   contract change.
5. Validate with the template checks, `sites/amblast` build/check commands,
   CMS projection/seed smoke coverage, and the responsive canvas contract before
   sign-off.

#### Current state — 2026-06-16
`sites/amblast` was deliberately left untouched during OBS-118 package
extraction. It has no RtRoot/site projection type surface today, so adding
`@siteinabox/contracts` now would be premature and would risk creating a
half-CMS snapshot outside the real conversion workflow.

---

### OBS-88 — Manifest-driven footer composition with columns and footer sub-blocks

**Status:** Active · **Layer:** multi-repo (`siab-payload` + `site-amicare-zorg` + `siab-site-template`)
**Discovered in:** Session 2026-05-27 (operator page-editor chrome review)

#### Description
Footer editing needs to move beyond a few hardcoded fields. A site should be
able to declare how many footer columns its theme supports and which content
types can appear in each column. Editors then choose intuitive footer
sub-blocks, such as text rows, link lists, contact/info groups, or an outro,
inside the supported structure for that site.

This must not become an Amicare-specific footer form in Payload. Different
sites can support different footer layouts, column counts, and content types, so
the CMS surface and renderer contract need to be manifest-driven like normal
page blocks.

#### Suggested fix shape
Plan this as a multirepo feature before implementation:

1. Extend the site manifest contract with a `footer`/`chrome.footer`
   composition declaration: supported column counts, default layout, allowed
   column item types, labels, limits, and renderer IDs.
2. Add Payload schema/projection support for structured footer composition
   data, keeping existing logo/text/copyright as a compatibility bridge or
   migrating them into the new footer content model.
3. Render a footer composition inspector in the page editor chrome surface,
   using the manifest declaration to show only supported column counts and
   sub-block types for the current site.
4. Update `site-amicare-zorg` to render its declared footer composition, and
   update `siab-site-template` so future sites inherit the same manifest-driven
   contract rather than a static footer shape.
5. Add focused tests for manifest validation, projection shape, editor
   persistence, Amicare rendering fallback, and template type compatibility.

#### Interim state — 2026-05-27
The current batch deliberately keeps footer editing narrow: Header/Footer logo
overrides plus Footer text/copyright persist through `SiteSettings.chrome`.
Column composition is tracked here because it needs a broader contract and
renderer implementation across all site repos.

#### Progress — 2026-05-27
First implementation slice landed across the three repos:

- `siab-payload` now validates a manifest-level `footer` contract with
  supported column counts and allowed item types, stores
  `SiteSettings.chrome.footer.columns` as structured JSON, projects normalized
  footer columns to `site.json`, and exposes a manifest-driven Footer
  composition editor in the page-editor chrome inspector.
- The CMS canvas preview renders structured footer columns when present, with a
  compatibility fallback to the older footer text/copyright preview.
- `site-amicare-zorg` declares its supported footer contract and renders
  projected footer columns for brand, business, contact, navigation, links, and
  text items.
- `siab-site-template` includes the example footer manifest contract and shared
  footer composition types so new tenant sites inherit the same shape.

OBS-88 remains active for richer footer sub-block behaviour and any
site-specific renderer refinements discovered during author testing, but the
core manifest/schema/editor/projection/rendering path is now in place.

Correction 2026-05-27: the CMS footer editor now treats structured footer
columns and footer items as selectable canvas targets instead of only exposing
them through the whole-Footer chrome inspector. In canvas mode, clicking a
footer column or sub-block selects that target and opens the matching focused
inspector; in sidebar mode the same target opens in the right-hand drill-down.
The available footer sub-block types still come from the site's manifest
contract.

Follow-up correction 2026-05-27: footer composition was simplified to match the
normal section-inspector model. Footer columns now normalize to exactly one
content item each; the editor no longer supports stacking several footer
rows/items inside a column. Clicking any footer child selects Footer as the
section, not a nested persistent target. Canvas mode opens a compact floating
Footer menu for column count/type changes and navigation/sidebar handoff instead
of opening the full dialog automatically. Text footer items can be edited
directly in the canvas.

Final polish 2026-05-27: footer hover affordances now show one square column
outline instead of nested rounded outlines, ordinary tenant links inside the
canvas are inert through a canvas-level link guard, the Footer quick menu can
set a custom logo and uses matching outline buttons for Navigation and
Inspector actions, and phone section overview no longer duplicates Header /
Footer rows because those controls live under mobile page settings.

Same-day text-item correction: the bespoke footer text input was replaced with
the same `RtSlot`/floating-toolbar canvas editing path used by Hero title and
body copy. Footer text item title/body remain projected as plain strings for
the current footer contract. The canvas quick menu was split into focused
submenus for column amount, column content type, and custom logo so it does not
grow out of the viewport.

Follow-up fix 2026-05-28: in canvas mode, footer column outlines no longer stay
visibly stuck in a selected state after the operator deselects the column or
clicks outside footer elements. Normal canvas selection clearing, selecting a
page block/field, and dismissing the footer quick menu now also clear
`selectedChrome`.

Production hotfix 2026-05-28: restored Amicare's `business` / Bedrijfsgegevens
footer item in the site manifest contract, fixed footer chrome dirty detection
so generated default column IDs do not count as a real unsaved change, and
hardened projection-manifest reads so a malformed tenant projection
`manifest.json` recovers to an empty `entries` list instead of breaking every
subsequent save.

Open follow-up 2026-05-28: footer-only saves are still not reliable enough.
Operator QA observed that a footer text/content-type change may not appear on
the live Amicare site until much later, and that saving another normal page
section afterward can cause the earlier footer change to show up. Footer chrome
currently saves through a separate `site-settings` PATCH after the page save;
make footer-only saves project and refresh immediately like normal page-section
edits, with coverage for text columns, repeated/same content columns, and
footer-only save cycles.

Execution 2026-05-28: footer-only saves now skip the unrelated page PATCH when
the React Hook Form page body is clean. Chrome/footer, nav-membership, and
theme-only saves go straight through their owning persistence paths and then
refresh the route, so footer changes project through the `site-settings`
after-change hook immediately instead of being coupled to page re-projection.

Follow-up fix 2026-05-28: footer canvas edits still had a race that normal
page-block edits did not. The footer editor writes through `chromeDraft`
instead of React Hook Form; if an inline footer text/type edit was still pending
when Save was clicked, the save handler could snapshot the previous rendered
draft and only send the footer change on a later save. The save path now reads
from a synchronously-maintained chrome draft ref and compares against a chrome
baseline ref. Amicare's SSR middleware also marks dynamic HTML as
`Cache-Control: no-store, max-age=0`, so public footer output is not reused from
a stale rendered `/` response after the CMS has projected `site.json`.

Second follow-up fix 2026-05-28: projection itself still had a one-save-behind
path. `projectSettingsToDisk` received the updated SiteSettings hook document,
but `writeSiteJson` immediately reloaded the same `site-settings` row at depth
1 before writing `site.json`; inside the update hook this could read the
pre-update row and project the previous footer. Projection now trusts the fresh
hook document for settings/footer values and only populates known media upload
fields by ID, so footer-only saves write the just-submitted footer state.

Follow-up fix 2026-05-28: footer text columns now materialize the visible
canvas defaults as real saved content. Selecting a text column seeds/saves
`Info` as the label and `Text` as the body when the operator leaves those
defaults unchanged, and inline canvas edits no longer special-case `Text` back
to `null`.

Follow-up fix 2026-05-28: footer selected outlines now clear when the operator
clicks back into normal page canvas content, clears canvas selection, or
dismisses the footer quick menu. `selectedChrome` no longer stays set after the
footer menu is closed or another canvas element takes selection.

#### Research verification — 2026-05-28
The `siab-payload` core slice is now implemented: manifest validation,
structured normalization, schema/migration support, editor UI, canvas rendering,
and immediate projection are all present. The current intended selection model
is whole-Footer selection from footer child clicks, not persistent nested
footer-column inspectors. Keep OBS-88 active only for multi-repo author-testing
refinements and renderer polish outside the fixed Payload save/selection bugs.

#### Current verification — 2026-05-28
Still active only in that narrowed sense. No new Payload-side footer save or
selection defect was found during this re-audit; the open work is author-testing
feedback and renderer polish across tenant/template repos.

**Next bundle — Rich-text editor/toolbar, 2026-06-03:** Pick up OBS-78,
OBS-79, and OBS-80 together as one authoring-quality bundle, with security
OBS-92 as the required backend validation prerequisite. Start by making nested
RtRoot validation recursive so malformed nested rich text cannot be persisted.
Then run a concrete CMS editor QA pass over every visible toolbar command and
record exact failures before changing command wiring. Fix broken commands and
active/pressed affordances in the registry-owned `@siab/rich-text-toolbar`
source, then re-pull into `siab-payload`. Treat theme-specific effects as a
contract/design step: use existing manifest mechanisms where possible, and only
extend the RtRoot/site renderer contract if the current `typeStyles` /
`themedNodes` / color / font primitives cannot represent the required effect.

Verification for the bundle should include focused rich-text validation tests,
toolbar command/active-state tests where the local test surface supports them,
`pnpm registry:check`, `pnpm lint:no-css`, and `pnpm typecheck` in
`siab-payload`. Multi-repo renderer changes require matching checks in the
affected registry/template/site repos.

**Implementation update — 2026-06-03:** The backend prerequisite OBS-92 is
implemented and closed in the security backlog. The local
`optidigi/design-systems` source for `@siab/rich-text-toolbar` now derives
active state for marks, links, and block alignment through the shared
`useActiveTextStyle` hook; visible controls expose `aria-pressed` and selected
styling. Mark, link, and alignment buttons preserve the Lexical selection on
mouse down before dispatching commands. Color, font, and style triggers now
also reflect active state on the trigger itself.

**Rollback update — 2026-06-03:** The manifest-driven toolbar text-effects chip
was removed per operator feedback. Keep the mark/link/alignment active-state
fixes, but do not surface `themedNodes` as a Sparkles/text-effects toolbar
button. The older slash-menu/themed-node infrastructure remains available for
the existing themed-node contract.

**Closure update — 2026-06-03:** OBS-78, OBS-79, and OBS-80 are closed. The
registry source was deployed to `registries.optidigi.nl`, `siab-payload` was
re-pulled from deployed `@siab`, CI passed, and production was rolled to app
revision `b284a92`. The active-state and command-affordance fixes remain
shipped; the text-effects toolbar chip is intentionally removed.

### OBS-78 — Rich text toolbar/editor active state affordances are not intuitive

**Status:** Closed 2026-06-03 · **Layer:** multi-repo (`@siab/rich-text-toolbar` / CMS editor consumers)
**Discovered in:** Session 2026-05-26 (operator editor review)

#### Description
Toolbar and editor controls should make the current selection state obvious. If
a mark, style, alignment, font, link state, or themed text option is active for
the current selection/caret, the control should visually resemble that active
state in a way that is intuitive for an admin user.

#### Suggested fix shape
Audit toolbar active-state detection across collapsed selections, partial
selections, mixed selections, rich-text blocks, and themed nodes. Use consistent
selected/pressed affordances from the registry primitives, expose accessible
`aria-pressed`/labels where relevant, and verify both persistent and floating
toolbars.

#### Research verification — 2026-05-28
Color/font/style active-state plumbing exists, but marks, link, and alignment
buttons still need clearer selected/pressed state verification. Keep this item
active for the narrower affordance gap rather than a full toolbar rebuild.

#### Current verification — 2026-05-28
Still current and narrowed. `use-active-text-style` covers style/color/font,
but the mark/link/alignment command buttons still need explicit active-state
verification and accessible pressed-state coverage.

#### Resolution — 2026-06-03
Closed by the rich-text toolbar bundle. `@siab/rich-text-toolbar` now derives
mark, link, block alignment, color, font, and style active state through the
shared active-style hook and reflects selected controls with accessible
`aria-pressed` plus visible selected styling. The CMS app was re-pulled from the
deployed registry and production now runs the updated toolbar without the
rolled-back text-effects chip.

### OBS-79 — Some rich text toolbar tools do not work

**Status:** Closed 2026-06-03 · **Layer:** multi-repo (`@siab/rich-text-toolbar` / CMS rich-text integration)
**Discovered in:** Session 2026-05-26 (operator editor review)

#### Description
Some toolbar tools are visible but do not reliably perform their command. This
creates a broken authoring surface and should be treated as a functional
regression, not a polish issue.

#### Suggested fix shape
Reproduce every toolbar command in the CMS editor: marks, links, headings,
paragraph styles, lists/blocks if present, color/font controls, undo/redo, and
any floating-toolbar-only actions. For each command, pin the Lexical command
wiring with focused tests and ensure disabled/unavailable tools are hidden or
disabled instead of appearing clickable.

#### Research verification — 2026-05-28
Static code inspection still shows multiple command surfaces, but this item
needs concrete failing command repros before implementation. Keep active as an
authoring QA item, and record exact broken tools when retested locally.

#### Current verification — 2026-05-28
Still current as a QA/repro item. No exact failing command was promoted during
this re-audit; do not implement blindly until a local editor pass records which
visible toolbar tools fail.

#### Resolution — 2026-06-03
Closed by the rich-text toolbar bundle. The concrete shipped fixes preserve the
Lexical selection on mouse down before mark, link, and alignment commands run,
so visible controls dispatch against the intended selection/caret instead of
losing context. Color, font, style, link, mark, and alignment controls were
kept in the toolbar; the separate text-effects chip was removed per operator
feedback and is not part of this closure.

### OBS-80 — Theme-specific text accents/effects need toolbar support

**Status:** Closed 2026-06-03 · **Layer:** multi-repo (`siteManifest` contract + `@siab/rich-text-toolbar` + site renderers)
**Discovered in:** Session 2026-05-26 (operator editor review)

#### Description
If a tenant theme has special text accents, treatments, or effects, editors need
a first-class way to apply those to page text/content from the toolbar. These
effects should be theme-owned and constrained by the tenant manifest rather than
hard-coded into CMS controls.

#### Suggested fix shape
Extend the tenant manifest contract to declare supported text effects/accent
styles with labels and stable IDs. Surface those options in the rich-text
toolbar only when the manifest provides them, persist the selected effect in the
RtRoot schema, and render the same effect in CMS canvas, preview, template, and
tenant site renderers. Themes without declared effects should see no extra UI.

#### Research verification — 2026-05-26
The base manifest/RtRoot plumbing is already partly present: `siteManifest`
supports `typeStyles`, `themedNodes`, `colorTokens`, and `fontFamilies`; the
CMS toolbar has a `StyleChip` for `typeStyles`, and themed nodes can be inserted
through the slash-menu path. The active gap is narrower than "create the first
contract": Amicare's special eyebrow/accent treatment is still represented as a
theme-specific themed node or block-specific field rendering, not as an obvious
toolbar text-effect control. Keep this item active for discoverable toolbar
support and a renderer contract that lets themes expose their effects without
hard-coding CMS controls.

#### Current verification — 2026-05-28
Still current and narrowed. Theme-bound fonts, colors, type styles, and themed
nodes exist, but there is no first-class toolbar affordance for broader
theme-specific text effects beyond the current style/themed-node mechanisms.

#### Resolution — 2026-06-03
Closed by operator decision after the toolbar bundle. A manifest-driven
Sparkles/text-effects toolbar chip was implemented, deployed for review, then
removed because this affordance should not be exposed in the CMS toolbar. No
new RtRoot schema or renderer contract was added. Theme-bound fonts, colors,
type styles, and the existing slash-menu/themed-node infrastructure remain the
supported mechanisms for now.

---

### OBS-118 — Move shared frontend into monorepo packages after SIAB monorepo migration

**Status:** Closed 2026-06-16 · **Layer:** multi-repo / frontend architecture
**Discovered in:** Session 2026-06-15, private SIAB registry deprecation decision

#### Description
The private `optidigi/design-systems` / `@siab/*` shadcn registry is no longer
the intended source of truth for SIAB frontend code. `siab-payload` now treats
the installed shadcn-style files as local source, keeps custom CMS/frontend
components in the app, and uses token discipline locally instead of routing
every UI change through registry build/deploy/pull cycles.

The operator plans to consolidate SIAB sites, services, and apps into a single
monorepo. When that happens, the shared frontend should move into appropriate
`packages/*` folders rather than reintroducing the separate registry repo as the
authoring source.

#### Suggested fix shape
1. During the monorepo migration, audit the current frontend and classify code
   by ownership:
   - generic primitives and theme/token helpers → candidate `packages/ui`
   - CMS/editor-specific reusable surfaces → candidate `packages/cms-ui`
   - site block renderers and public-site runtime helpers → candidate
     `packages/site-renderer`
   - RtRoot, manifest, projection, theme, and block contracts → candidate
     `packages/contracts`
   - one-off Payload workflows → keep in the app
2. Decide package boundaries before moving code. Do not create a broad
   "everything frontend" package.
3. Keep shadcn/upstream primitive updates as a local/package maintenance task.
   A shadcn registry may exist later as a distribution artifact if external
   consumers need it, but it should not be the primary authoring workflow.
4. Preserve the local token rules: use token utilities and role vars, avoid
   hard-coded component colors, arbitrary color utilities, and inline style
   overrides for visual theming.

#### Current state
`siab-payload` has removed the private `@siab` registry configuration and CI
drift gate. Existing installed UI files remain in place as local source. The
actual package extraction is deferred until the broader SIAB monorepo exists.

2026-06-15 progress note: the frontend CSS boundary is now prepared for that
future extraction. `src/styles/globals.css` is a stable import shell,
`src/styles/shadcn.css` is the shadcn/Tailwind overwrite target configured in
`components.json`, and `src/styles/siab.css` holds protected SIAB
app/editor/canvas CSS. `pnpm lint:ui-boundary` locks that split.

Later same session: custom CMS/editor composites were moved out of
`src/components/ui` into app-owned paths under `src/components/editor/`,
`src/components/save-ui/`, and `src/components/common/`. The UI boundary check
now requires `src/components/ui` to be upstream-name-only. Primitive overwrite
policy is documented in `docs/runbooks/ui-overwrite-boundary.md`; several
upstream-name primitives intentionally remain local forks and must be reviewed
one at a time with `shadcn add --diff`.

2026-06-16 verification: the SIAB platform monorepo exists, but this item was
not complete. The workspace had no shared frontend/contract packages yet:
`packages/` only contained `site-template`, `site-themes`, and tooling, while
the generated-site projection/RtRoot contract was still duplicated between
`packages/site-template/src/lib/types.ts`, `sites/ami-care/src/lib/types.ts`,
and `sites/ami-care/src/lib/richText.ts`.

First extraction slice added `packages/contracts` as
`@siteinabox/contracts`, containing the shared RtRoot/rich-text node contract
and public site projection types for page blocks, media references, analytics
metadata, footer composition, navigation, and site settings. `site-template`
now depends on the workspace package, and `ami-care` uses the same package via
a local file dependency while preserving its existing `src/lib/types.ts` and
`src/lib/richText.ts` import paths as compatibility re-exports. OBS-118 remained
active until the remaining shared frontend boundaries were audited and the
shared UI extraction was completed.

Second extraction slice added `packages/ui` as `@siteinabox/ui`. Shared
shadcn-style primitives, the shadcn/Tailwind token CSS, `cn`, CSP-safe style
helpers, and the mobile breakpoint hook now live in that package. The CMS keeps
`src/components/ui/*`, `src/lib/utils.ts`, `src/components/csp-*.tsx`, and
`src/hooks/use-mobile.ts` as compatibility re-export shims, so existing app
imports keep working while the package is the source of truth. CMS-specific
layouts, route components, editor/canvas workflows, forms, analytics, and other
composites remain in `apps/cms`, which is the intended ownership boundary.

#### Resolution — 2026-06-16
Closed by the SIAB monorepo extraction. Shared data contracts now live in
`packages/contracts`, and shared primitives/tokens/low-level UI helpers now live
in `packages/ui`. CMS-specific layouts, editor/canvas workflows, forms,
analytics, and other composites stay in `apps/cms`. Site generation/rendering
behavior stays in `packages/site-template`, which is the canonical source of
truth for generated sites; tenant sites remain snapshots of that template.

---

### OBS-75 — Make SIAB registry composites adapter-driven and app-portable

**Status:** Closed 2026-06-15 · obsolete by registry deprecation decision · **Layer:** multi-repo (`optidigi/design-systems` registry API + `siab-payload` consumer wiring)
**Discovered in:** Session 2026-05-25, post-OBS-54 registry portability review
**Files:** `optidigi/design-systems/packages/siab/registry/default/*`, `siab-payload/src/components/ui/*`, `siab-payload/src/components/forms/PageForm.tsx`, `siab-payload/tests/unit/components/*`

#### Description
OBS-54 closed the immediate editor-composition problem by exposing slot contexts and default layouts for the current desktop/mobile inspector surfaces. That makes layout rearrangements host-composable, but it does **not** make every SIAB registry composite a generic drop-in for unrelated apps.

Current state:
- Core primitives (`button`, `card`, `dialog`, `dropdown-menu`, `input`, `badge`, `tabs`, `sheet`, etc.) are normal shadcn-style reusable components.
- Editor composites are reusable only by apps that adopt the SIAB editor contracts (`RtManifest`, `ThemeTokens`, block metadata, block presets, canvas selection, Lexical rich-text nodes, tenant CSS conventions).
- Some copied registry files still import app/domain modules such as `@/blocks/registry`, `@/components/editor/canvas/BlockPresetsContext`, `@/components/editor/canvas/useCanvasBlocks`, `@/components/editor/richText/LexicalField`, `@/lib/richText/manifest`, and `@/lib/theme/schema`.

This means the registry is **not hardcoded to PayloadCMS database/API behavior**, but several composites are still hardwired to the SIAB CMS/editor architecture. A different app can use them only if it carries those same contracts.

#### Expected behavior
SIAB registry composites should behave like portable shadcn registry source:
- The registry component owns layout, interaction affordances, animation, accessibility, and tokenized styling.
- The consuming app owns data, domain state, persistence, block definitions, field rendering, and custom actions.
- App-specific behavior flows in through props, render props, adapter objects, or explicit slot contexts.
- A consuming app should be able to import a composite and wire its own logic without needing `siab-payload` internals to compile.

#### Suggested fix shape
1. **Audit and classify registry items**
   - `portable`: primitives with only standard shadcn-style dependencies.
   - `SIAB-contract`: reusable by apps that adopt SIAB manifest/theme/rich-text contracts.
   - `app-wired`: imports `siab-payload` editor/domain modules directly.
2. **Extract app/domain dependencies into adapters**
   - Replace `blockBySlug` imports with a `getBlockMeta(block)` or `blockMetaByType` prop.
   - Replace `BlockPresetsContext` imports with `renderBlockPicker`, `openBlockPicker`, or explicit picker props.
   - Replace direct `BlockFormFields` / `LexicalField` dependencies with `renderFields(block, context)` slots where practical.
   - Keep default SIAB adapters in `siab-payload` so the current editor behavior stays unchanged.
3. **Preserve default layouts**
   - Keep exports like `SidebarListLayout`, `SidebarBlockFormLayout`, `MobileSectionListLayout`, and `MobileInspectorBarLayout`.
   - Add adapter-driven examples showing how `siab-payload` composes current defaults.
4. **Move app glue out of registry-owned UI files**
   - App-specific glue should live under `src/components/editor/...` or `src/components/forms/...`.
   - `src/components/ui/*` copies from the registry should avoid direct imports from `@/blocks`, `@/collections`, `@/app`, and `@/components/editor`.
5. **Add portability guard tests**
   - Static tests should fail if portable registry items import app/domain modules.
   - Any SIAB-contract exception must be documented and intentional.

#### Suggested execution order
1. Sidebar/mobile inspector adapter extraction (lowest risk because OBS-54 already added slots).
2. Block picker and block metadata adapter extraction.
3. Canvas chrome adapter extraction.
4. Rich-text/editor contract cleanup and explicit SIAB-contract documentation.
5. Add registry portability guard tests in both registry and consumer repos.

#### Why separate from OBS-54
OBS-54 was about **composition inside current editor surfaces**: moving buttons, headers, footers, and page-settings chrome without registry churn. OBS-75 is about **cross-app portability**: removing direct app-domain imports from composites so other apps can use the SIAB registry with their own logic.

#### Current verification — 2026-05-28
Still current. The registry has useful slot/layout extraction from OBS-54, but
several registry-owned composites still import SIAB app/editor contracts
directly, including `canvas-block-renderer`, `canvas-mode`,
`block-form-fields`, `mobile-section-edit`, `mobile-component-editor`,
`sidebar-drill-down`, and `theme-bar`. Keep this open for adapter extraction
and portability guard tests.

#### Resolution — 2026-06-15
Closed as obsolete. The operator decided to stop treating the private
`@siab/*` shadcn registry / `optidigi/design-systems` repo as the app frontend
source of truth. `siab-payload` now keeps the installed shadcn-style UI files as
local source and removes the registry drift gate. The future portability problem
is no longer "make registry composites adapter-driven"; it is "when SIAB moves
to a unified monorepo, decide which frontend pieces belong in `packages/ui`,
`packages/cms-ui`, `packages/site-renderer`, or `packages/contracts`." That
follow-up is tracked as OBS-118.

---

### OBS-74 — SIAB registry theme refresh from tweakcn reference needs token-contract planning

**Status:** Closed 2026-05-25 · **Layer:** multi-repo (`optidigi/design-systems` → consumed by `siab-payload`)
**Discovered in:** Session 2026-05-22, operator request to make the SIAB design system follow tweakcn theme `cmmi2mi8n000804jl0ml82ewn`
**Files:** `optidigi/design-systems/packages/siab/registry.json`, `optidigi/design-systems/packages/siab/registry/default/*`, `siab-payload/src/styles/globals.css`, `siab-payload/components.json`

#### Description
The operator wants the private `@siab/*` shadcn registry to visually move closer to a tweakcn theme reference: softer neutral admin surfaces, orange accent/primary direction, tighter radius, stronger vertical shadows, and possible DM Sans / DM Mono typography.

This should **not** be handled by pasting the tweakcn `global.css` into `siab-payload` or reinstalling upstream/tweakcn primitives over SIAB files. The SIAB registry is source-code distribution: `@siab/theme` provides token values, while `@siab/button`, `@siab/input`, `@siab/mobile-inspector`, `@siab/theme-bar`, `@siab/canvas-chrome`, etc. are copied component source with SIAB-specific behaviour. A safe theme refresh changes token values first; it does not overwrite primitives unless a later visual review proves a component-level tweak is needed.

The tweakcn reference mostly uses standard shadcn token names (`background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-*`, `sidebar-*`), so it maps well to the existing `@siab/theme` contract. But SIAB has additional semantic tokens that the reference does not define (`brand`, `brand-foreground`, `success`, `success-foreground`, `warning`, `warning-foreground`) and custom product components that depend on those meanings.

#### Planning guardrails
- Treat the tweakcn theme as a style reference, not a drop-in replacement.
- Plan/spar before coding: make an explicit token mapping table for `primary`, `brand`, `destructive`, `success`, `warning`, `ring`, `sidebar-*`, radius, shadows, fonts, and dark mode.
- Do not make `destructive` visually identical to `primary` unless deliberately accepted. The tweakcn reference uses the same orange for both; in the CMS that could blur primary/save actions and delete/destructive actions.
- Preserve SIAB custom tokens or intentionally remap them. Missing `brand` / `success` / `warning` would break visual semantics in save states, mobile pills, and product-specific chrome.
- Do not adopt global negative tracking (`--tracking-normal: -0.025em`) without a separate typography review; dense admin/mobile UI should keep neutral letter spacing unless proven otherwise.
- Do not switch to DM Sans / DM Mono by token name alone. If fonts change, add a proper font-loading strategy in the registry/consumer path or keep the current loaded/system stack.
- Radius and shadow changes have broad blast radius because many primitives use `rounded-*` and `shadow-*`; review screenshots before shipping.

#### Suggested fix shape
1. Research/planning pass: compare current `@siab/theme` tokens with the tweakcn reference and produce a proposed mapping. Decide whether orange is `primary`, `brand`, or both; decide a destructive color; decide whether radius moves from `1rem` to `0.75rem` or all the way to `0.5rem`.
2. Implement the first pass as a token-only change in `optidigi/design-systems/packages/siab/registry.json` (`@siab/theme`). Avoid `@siab/base` and primitive edits in the first pass unless planning identifies a specific required component change.
3. Build the registry (`pnpm build:siab`), inspect generated `public/r/v1/siab/theme.json`, deploy the registry image, then pull the updated `@siab/theme` into `siab-payload` through shadcn. Do not hand-edit `src/components/ui/*`.
4. Run gates in `siab-payload`: `pnpm registry:check`, `pnpm lint:no-css`, `pnpm typecheck`, plus focused visual/manual QA.
5. Visual QA must cover light/dark, login, dashboard, forms, dialogs, popovers, dropdowns, destructive actions, save/delete/close mobile pills, page editor desktop, page editor mobile bottom sheet, and tenant canvas/theme isolation (`.rt-canvas` should keep tenant theme behaviour separate from admin chrome).
6. Only after screenshots/user review, make narrow primitive-level registry tweaks if the token-only pass exposes an actual problem.

#### Why deferred
This is a broad design-system change with low code complexity but high visual blast radius. It should be picked up with a short planning/sparring round first so the token semantics stay correct and the custom SIAB registry behaviour is preserved.

#### Follow-up — 2026-06-02
Implemented the token-only first pass. `optidigi/design-systems`
`@siab/theme` now maps standard shadcn tokens to tweakcn Vermillion, including
surface/action colours, `chart-*`, `sidebar-*`, radius, shadow, spacing, and
font tokens. SIAB yellow is preserved only as the explicit `brand` /
`brand-foreground` extension. `sidebar-primary` now follows Vermillion because
registry usage showed it is a generic active-sidebar indicator stripe, not the
only SIAB nav identity path. `siab-payload` consumed the rebuilt SIAB theme into
`src/styles/globals.css` and now loads the Vermillion DM font stack via
`next/font/google`.

#### Follow-up — 2026-06-02 neutral correction
Operator review rejected the red/orange Vermillion accent as the CMS action
language. The registry now keeps Vermillion's neutral surface, typography,
radius, and shadow direction but maps standard action/focus/destructive/chart
tokens to neutral light/dark values instead of red. SIAB yellow remains only in
the explicit `brand` / `brand-foreground` tokens. Follow-up registry pulls also
tightened the custom editor/admin chrome that still used larger pill-era
corners: mode/theme bars, mobile floating actions, mobile component close,
save-count badges, cards, and floating/inset sidebar shells.

#### Follow-up — 2026-06-02 destructive correction
The neutral correction overreached by making `destructive` neutral too, which
removed the intended danger/delete affordance from danger zones and destructive
buttons. `@siab/theme` now keeps primary, focus rings, chart tokens, and
sidebar selection neutral, but restores `destructive` to red in light and dark
mode so delete/error UI remains visually explicit.

#### Follow-up — 2026-06-02 font correction
Operator review found the DM Sans / DM Serif / DM Mono stack too informal for
the CMS. `@siab/theme` now uses Inter for the admin sans token, JetBrains Mono
for code/tabular UI, and a restrained system serif fallback. `siab-payload`
loads Inter and JetBrains Mono through `next/font/google` so the runtime font
variables match the registry tokens.

---

### OBS-71 — Border radius is not part of the theme preset (palettes + fonts are)

**Status:** Closed 2026-05-25 · **Layer:** multi-repo (siab-payload theme presets/schema + registry ThemeBar)
**Discovered in:** Session 2026-05-20, FE-45 / Bundle 3 research

#### Description
Theme presets (`siab-payload/src/lib/theme/presets.ts`) define `PALETTE_PRESETS` (colour palettes) and `FONT_PRESETS` (font schemes) — but **not radius**. Radius is a single `Tenant.theme.radius` value, set only via the CMS ThemeBar's `RadiusControl` (3 hardcoded tiers: Sharp `0` / Soft `0.5rem` / Round `1.5rem`), then expanded into `--radius-sm/md/lg` by `toCssVars` `deriveRadii()`. Consequence: a theme/preset can carry a brand's colours + fonts but **not its radius character** (sharp vs round) — the editor must set radius post-generation. The `RadiusControl` tiers are also hardcoded in the registry component, unlike the palette/font pickers which take their options as props.

#### Suggested fix shape
Decide whether radius belongs in the preset alongside palette + fonts. If yes: add a `radius` to the preset shape, have the orchestrator's theme-integration phase seed `Tenant.theme.radius` from it, and make `RadiusControl`'s tiers data-driven (props, like the other pickers).

#### Resolution
Radius is now represented as CMS-side `RADIUS_PRESETS` alongside the palette and font preset catalogs. `PageForm` passes those presets into `ThemeBar`, and the private `@siab/theme-bar` registry component now accepts `radiusLevels` so `RadiusControl` is data-driven instead of hardcoded.

The implementation deliberately kept the persisted tenant shape unchanged: `Tenant.theme.radius` remains the single saved value, and `deriveRadii()` still expands it into `--radius-sm/md/lg`. This closes the CMS/editor consistency gap without adding a second radius source of truth. Orchestrator preset seeding can now target the existing `Tenant.theme.radius` field directly.

---

### OBS-62 — Canvas responsive preview via container-query authoring contract (supersedes FE-47)

**Status:** Closed 2026-06-03 · **Layer:** multi-repo (`siab-payload` checker + `siab-site-template` + `siab-payload-orchestrator` + `siab-site-orchestrator` + `siab-site-themes` + per-tenant deploys)
**Discovered in:** Session 2026-05-18 (rescoped from FE-47 after three-researcher consensus on architecture)
**Supersedes:** FE-47 (canvas-side-only scope), FE-26 (narrow `xl:`/`2xl:` mismatch — closed earlier same session)

#### Problem
The CMS editor canvas renders tenant page blocks at a fixed 1280px design width with CSS `zoom` fitting it into the editor pane (`canvas-mode.tsx:204` `useFitZoom(CANVAS_DESIGN_WIDTH)`, line 312 `style={{ width: 1280, zoom }}`). At narrow pane widths the canvas shows the desktop layout downscaled, not the tenant's mobile layout — because CSS `@media` queries evaluate against the document viewport (the editor's browser window), not the canvas element width.

Iframe is ruled out (breaks Lexical in-place editing — selection/focus/contentEditable assume same-document access). Runtime CSS transform (rewriting `@media` → `@container` at canvas load) is too fragile across diverse multi-tenant CSS — viewport units (`vh`/`vw`), `<picture media>`, JS `matchMedia`, third-party embeds, custom CSS frameworks each contribute unbounded drift.

#### Suggested direction — standardize tenant site authoring on container queries
Tenant sites adopt CSS container queries as the primary responsive primitive instead of media queries. The CMS canvas declares itself as the same named query container that the site root declares, so the same authored CSS evaluates correctly in both contexts (live site = body container ≈ viewport; canvas = `.rt-canvas` container = pane width). No iframe, no runtime transform, no per-tenant adaptation. Hybrid pattern — `@media` retained for non-width concerns (`prefers-color-scheme`, `prefers-reduced-motion`, `hover`, `pointer`, `print`, `orientation`); `@container` for all width-based responsiveness.

#### Architecture (three-researcher consensus, 2026-05-18)
All three independent research lines (multi-repo contract patterns, LLM-agent enforcement reliability, container query authoring) converged on: **ship one shared responsive contract and make multiple defense-in-depth layers invoke the same checks.**

1. **Responsive contract/checker** — currently implemented in Payload as `src/scripts/check-responsive.mjs` and mirrored by the active repos that need the gate. A future published `@siab/responsive-canvas-lint` package may still be useful if more repos need to consume the exact same CLI/tailwind preset, but the current `siab-payload` implementation does not depend on that package.
2. **`siab-payload`** — `globals.css` declares `.rt-canvas { container-type: inline-size; container-name: site-frame; contain: layout; }`; `useFitZoom`/`CANVAS_DESIGN_WIDTH` were removed; `pnpm check:responsive` runs in CI alongside existing gates; Claude Code Stop hook guidance should invoke the same checker with binding semantics where configured.
3. **`siab-site-template`** — install package; `BaseLayout.astro <body>` declares same container (`container-type: inline-size; container-name: site-frame; contain: layout;`); apply the Tailwind preset; CI gate via `publish.yml`. New tenant forks inherit automatically.
4. **`siab-payload-orchestrator` + `siab-site-orchestrator`** — `.claude/settings.json` Stop hooks running the script with exit 2 (the only mechanism with binding semantics per LLM-agent research). `cms-reviewer.md` / `auditor.md` rewritten to **invoke the CLI, not inline grep, no `BLOCKING` markers** ("BLOCKING/MUST" markers in agent markdown are documented to drift ~5.6%/step). One-paragraph contract reference in `prompt.md`; do not restate rules. Builder/validator agent split — separate agent triages failures, doer doesn't self-fix.
5. **`siab-site-themes`** — README requires the convention for any future theme; consumes the package as peer dep.
6. **Per-tenant migrations** — install package; convert viewport width variants to named `site-frame` container variants; add body container declaration; one-time per tenant. ami-care first (~35 class swaps across 7 cms/* files plus 1 `vh` hit), then amblast, then siteinabox.

#### Research update 2026-05-26
Tailwind v4's container breakpoint names are not threshold-equivalent to viewport breakpoint names. A blind `md:` → `@md/site-frame:` migration would move `md` from the viewport breakpoint `48rem` to Tailwind's container breakpoint `28rem`. Preserve existing layout thresholds with named arbitrary variants such as `@min-[48rem]/site-frame:` or with project-defined container aliases that mirror the viewport scale (`sm=40rem`, `md=48rem`, `lg=64rem`, `xl=80rem`, `2xl=96rem`). Verified locally with Tailwind v4.3.0 that `@min-[48rem]/site-frame:flex` compiles to `@container site-frame (width >= 48rem)`.

#### Implementation update 2026-05-26
Initial OBS-62 implementation landed locally across the active repos, but keep the item open until the private registry is deployed and the canvas is visually audited:

- `design-systems`: added registry item `@siab/responsive-canvas-lint` (shared checker + contract note), updated `@siab/canvas-chrome` to remove fixed `1280px`/`useFitZoom`/CSS `zoom`, and declared `.rt-canvas` as `container-type: inline-size; container-name: site-frame; contain: layout`.
- `siab-payload`: pulled the updated canvas chrome, deleted the stale `use-fit-zoom` helper/test, added `pnpm check:responsive`, and wired the CI step after registry drift.
- `siab-site-template`: added the responsive checker, Docker build gate, live `<body>` `site-frame` container, and `.site-frame-root` wrapper.
- `site-amicare-zorg`: added the checker/Docker build gate/body container/root wrapper and migrated width-based Tailwind variants to threshold-preserving `@min-[48rem]/site-frame:` / `@min-[64rem]/site-frame:` variants.
- Orchestrators: updated sitegen and sitegen-cms runbooks/reviewers to invoke `pnpm check:responsive` instead of carrying prompt-local grep rules.

Verification so far: `pnpm build:siab`, `pnpm typecheck` in `siab-payload`, `pnpm lint:no-css`, `pnpm check:responsive` in `siab-payload`/template/Amicare, and `pnpm build` in template/Amicare all pass. `pnpm registry:check` in `siab-payload` is intentionally deferred until `design-systems` is deployed to `registries.optidigi.nl`; otherwise it will pull the old production registry. Canvas visual audit still pending.

Follow-up correction 2026-05-26: the first pass still left viewport Tailwind variants in Payload's tenant-facing canvas renderers (`src/components/editor/canvas/blocks/*` and `SiteChromePreview`). Those classes are emitted by the CMS bundle itself, so they key off the admin browser viewport and can override/diverge from the tenant CSS's container-query behavior. Convert those classes to the same threshold-preserving `@min-[48rem]/site-frame:` / `@min-[64rem]/site-frame:` variants and extend `check:responsive --mode=payload` to scan tenant-facing canvas renderers, not only the canvas shell.

Second correction 2026-05-26: the threshold must be pixel-equivalent in the
CMS bundle, not `rem`-authored. The live Amicare site sets `html { font-size:
17px }`, so `48rem` resolves to `816px` and `64rem` resolves to `1088px`.
Payload's admin document root is 16px; leaving CMS-side classes as
`@min-[48rem]/site-frame:` made canvas chrome/blocks flip at 768px while the
live site stayed mobile until 816px. Payload canvas renderers now use
`@min-[816px]/site-frame:` / `@min-[1088px]/site-frame:` and
`loadTenantCss()` rebases both tenant CSS `rem` values and escaped arbitrary
selector names so the injected tenant bundle matches those class names. Local
visual audit (`pnpm audit:canvas-parity`) confirms exact geometry parity for the
Amicare page at effective canvas widths 1136px, 776px, and 610px: total frame
height, header, footer, and all five rendered blocks match the live site.

Compatibility requirement clarified 2026-05-26: generated sites and
`siab-payload` canvas handling must remain contract-compatible by construction,
not by per-tenant patching. The orchestrators/templates must emit sites that:

- declare the live root as the named `site-frame` container and ship the same
  compiled CMS stylesheet/artifacts consumed by Payload;
- avoid width-based viewport media queries in tenant block/chrome styling unless
  the behavior is intentionally outside canvas fidelity;
- avoid JS layout decisions based on `window.innerWidth`, `matchMedia`, or
  viewport-only measurements for tenant blocks/chrome unless an equivalent
  container-driven adapter is provided;
- keep `siteManifest`, block schemas, projection JSON, tenant CSS, and canvas
  renderers in lockstep so a generated site does not rely on fields/classes that
  the CMS cannot render faithfully;
- run the same responsive contract checker in generated site repos,
  orchestrator review flows, and `siab-payload` before sign-off.

This is the standard for future generated sites, not an Amicare-specific
exception. Any new site that cannot satisfy the contract needs an explicit
planning item before being treated as canvas-faithful.

#### Research verification — 2026-05-26
Current `siab-payload` no longer has registry-deploy drift for this item:
`pnpm registry:check` passes with no drift across 55 `@siab/*` items, and
`pnpm check:responsive` passes in Payload. The registry-deployment caveat in
the initial implementation note is therefore stale.

Keep OBS-62 active only for the remaining visual/product sign-off and for any
new generated-site/theme conversion that fails the shared responsive contract.
Future `amblast` / `siteinabox` CMS conversions are still tracked by OBS-56,
but they must satisfy the OBS-62 checker before sign-off.

#### Research verification — 2026-05-28
The current `siab-payload` slice is implemented and `pnpm check:responsive`
passes. The earlier package-first wording was ahead of the actual repo state:
Payload currently uses its local checker script rather than an installed
`@siab/responsive-canvas-lint` dependency. Keep the item active only for
visual/product sign-off and future repo conversions that need the same contract.

#### Current verification — 2026-05-28
Still active only for sign-off/conversion enforcement. `siab-payload` has the
container-query canvas contract and local checker; future `amblast` /
`siteinabox` conversions must satisfy the same checker before sign-off.

#### Resolution — 2026-06-03
Closed by operator confirmation. The `siab-payload` implementation is complete:
the container-query canvas contract is in place, the local responsive checker is
the active gate, registry drift was resolved, and the Amicare parity audit
passed. Future generated-site conversions must still satisfy the responsive
contract before sign-off, but that is treated as normal conversion acceptance
rather than an active `siab-payload` backlog blocker.

#### Gotchas to encode in the package
Per container-query architecture research:
- **Chrome 129 containment regression** — `container-type` no longer implicitly creates a containing block for `position: absolute` children. Tailwind preset must auto-pair `contain: layout` with every `container-type` declaration.
- **"Container styles itself" trap** — container element must NOT be the same element as the styled element. Site uses `<body>` as container + styles its descendants; canvas uses `.rt-canvas` as container + renders blocks inside it.
- **`cqh`/`cqb` vs `cqi`/`cqw`** — block-axis container units require `container-type: size` (which adds block-axis containment side-effects). Default to inline-axis units (`cqi`/`cqw`); reserve `cqh` for explicit per-component opt-in.
- **Named containers required** — always `container-name: site-frame`. Unnamed container queries bind to the nearest ancestor with matching `container-type`, which in a multi-tenant CMS can silently bind to a tenant-introduced container (slider, gallery, etc.).
- **No `var()` in `@container` conditions** — breakpoint values must be literals. Tailwind v4's token system sidesteps this for `@`-modifiers but tenant-authored raw `@container` rules need to know.

#### Migration order
Package first → siab-payload structural changes → site-template structural changes → orchestrator agent updates → site-themes README → per-tenant migrations (separate timeline, ami-care reference first).

#### Out of scope for this entry
- `<picture media="...">` source selection (still document-viewport-bound; convention covers ~95%, document the escape)
- JS `matchMedia` reads in tenant blocks (still document-viewport-bound; tenant blocks today are Astro server-rendered, no client reads — document the constraint for future interactive blocks)
- Third-party embedded stylesheets (transform doesn't reach them; future-tense concern, not currently used)

#### Related
- FE-47 (closed — narrower scope; this entry is the rescoped successor)
- FE-26 (closed earlier 2026-05-18; the `xl:`/`2xl:` mismatch falls out as side-effect)
- OBS-54 (registry composability — broader principle of "ship primitives, not opinionated arrangements"; the package-first pattern here mirrors it)
- OBS-56 (sister-repo + existing-tenant updates — per-tenant migration step here is part of OBS-56's execution order)

---

### OBS-54 — Registry composite components should expose slot-based composition

**Status:** Closed 2026-05-25 · **Layer:** multi-repo (`optidigi/design-systems` → consumed by `siab-payload`)
**Discovered in:** Session 2026-05-18, sidebar-drill-down restructure request

#### Description
Several composite items in the `@siab/*` registry — `@siab/sidebar-inspector`, `@siab/mobile-inspector`, `@siab/canvas-chrome`, `@siab/page-form-chrome` — bundle multiple internal sub-components (headers, footers, drill-down states, button arrangements) into a single registry item. Today, when a consumer wants to tweak the **internal layout** of one of these composites — e.g. "move the back button from the footer to a new header above the section-name header" or "move the Add block button from the footer into the scrollable list" — the only path is:

1. Edit the entire `sidebar-drill-down.tsx` in `optidigi/design-systems`
2. Bump the registry image
3. Re-pull into siab-payload via `shadcn add`
4. Coordinate two-repo deploys

Even small structural reorderings (which are NOT design-system-level concerns — they're application-shell decisions) require touching the whole composite + a multi-repo deploy cycle.

The user's words 2026-05-18: "components in registry should mostly be usable separately instead of having to change a complete component consisting of several components; and without having to add css."

#### Why this is a problem
- **Consumer can't compose**: the host project (`siab-payload`) renders `<SidebarDrillDown ... />` and passes data + callbacks. The internal `<header>`, `<footer>`, button placement, button labels, button order — all live inside the registry. The host has no slot to inject "render the back button here" or "render this list of actions in the header instead of footer".
- **CSS overrides are blocked**: the lint:no-css gate (D7) rejects hand-rolled CSS in the host. So even working around composition gaps via CSS positioning hacks isn't an option.
- **Single-tenant variations cause registry churn**: every host-specific layout preference becomes a design-systems commit, a registry rebuild, a coordinated deploy. The registry should be the source of truth for **design-token + primitive-component** decisions, not for every layout permutation.

#### Suggested fix shape
Two complementary changes:

1. **Break composites into frame + slot primitives.** For each composite:
   - Ship a `<XFrame>` primitive that owns the structural shell (drill-down state machine, animation, sticky positioning) but accepts `header`, `body`, `footer`, and `actions` slot props as ReactNodes.
   - Ship the existing default content (`<XDefaultHeader>`, `<XDefaultFooter>`) as separate registry items, composable independently.
   - Hosts that want the canonical layout: `<XFrame header={<XDefaultHeader/>} body={<XBlockForm/>} footer={<XDefaultFooter/>} />` — identical visual to today.
   - Hosts that want to reorder: swap the slot content from their own JSX. No registry change required.

2. **Make the registry's job clear**: ship design tokens + primitive components (button, dialog, drawer, card, etc.) + frame primitives. **Don't** ship opinionated arrangements of those primitives as monolithic blobs.

#### Concrete first target
`@siab/sidebar-inspector` is the immediate motivator. After today's restructure ships (back+delete header swap + Add block button position), the next iteration should refactor that item into:
- `@siab/sidebar-drill-down-frame` (state machine + animation only)
- `@siab/block-list` (the list view with sortable rows)
- `@siab/block-form-header`, `@siab/block-form-footer` (the default chrome)

So a future "move Add block button" request lands in siab-payload as `<BlockList ... action={<AddBlockButton/>} />` without touching design-systems.

#### Related
- D5b (canvas block renderers + inline primitives portability — also blocked by composability) is the deeper version of this concern
- D7 lint gate (commit `1c6e451`) intentionally blocks the CSS-override escape valve, making composability the only sanctioned path forward
- OBS-58 closed the narrowest instance of this principle by letting `@siab/canvas-chrome` pass host-owned manifest context into `useCanvasBlocks(manifest)`. The broader frame/slot decomposition remains open.

#### Update — 2026-05-25
First slice landed for `@siab/sidebar-inspector`: the block-form drill-down state now exposes a `renderBlockForm` slot plus exported `SidebarBlockFormLayout` / `SidebarBlockFormSlotContext` pieces. `siab-payload` composes the current default block-form layout through that slot in `PageForm`, so future block-form chrome rearrangements can move in the host without editing the registry source.

Second slice landed for the desktop sidebar list state: `@siab/sidebar-inspector` now exposes `renderList` plus `SidebarListLayout` / `SidebarListSlotContext`, including the header, empty state, sortable block rows, Add block button, and controlled block-type picker nodes. `siab-payload` composes the current default list layout through that slot, so future list chrome changes can move in the host without registry churn.

Third slice landed for the desktop sidebar page-settings state: `@siab/sidebar-inspector` now exposes `renderPageSettings` plus `SidebarPageSettingsLayout` / `SidebarPageSettingsSlotContext`, including the page-settings header, body, footer, back button, SEO slot, and danger-zone slot. `siab-payload` composes the current default page-settings layout through that slot.

Follow-up correction: page settings now uses the same top-action placement as the block inspector. The back button sits in a top header above the "Page settings" title row instead of being pinned in a bottom footer.

Final slice landed for mobile inspector/canvas chrome composition: `@siab/mobile-inspector` now exposes slot contexts and default layout exports for the mobile overview section list, focused section editor, bottom inspector drawer, page settings, and SEO settings. `@siab/canvas-chrome` forwards those render slots through `CanvasMode` / `CanvasMobile`, and `siab-payload` composes the current default mobile layouts through `PageForm`.

The broad extraction goal is satisfied for the current editor surfaces by exported layout primitives plus slot contexts rather than separate package names for every sub-part. Future primitive split-outs can be tracked as new concrete reuse requests; no OBS-54 work remains.

---

### OBS-24 — More block types + richer WYSIWYG editing

**Status:** Active · **Layer:** multi-repo (`siab-payload` + `siab-site-template`)
**Discovered in:** GitHub #27
**File:** `src/collections/BlockPresets.ts`, `src/components/editor/BlockTypePicker.tsx`, `src/components/editor/FieldRenderer.tsx`

#### Description
Current block type set is still limited and names need product-level cleanup.
The baseline WYSIWYG/rich-text authoring work exists, so the active scope is
now more block types plus any remaining label/menu polish. Every new block type
added here must be rendered by `siab-site-template` before it is usable in
production.

#### Suggested fix shape
1. Agree on block types to add (suggested: Pricing, Gallery, Team, Steps, LogoCloud at minimum).
2. Add block schemas to `BlockPresets.ts` and `Pages.ts` block union + migrate.
3. Add field renderer UI in `FieldRenderer.tsx`.
4. Add corresponding Preact/Astro renderer in `siab-site-template/src/components/cms/`.
5. Update `Blocks.astro` switch in `siab-site-template`.
6. Improve user-facing names in `BlockTypePicker.tsx` ("Hero Banner" not "hero", "Text Block" not "RichText").

**Cross-repo:** `siab-site-template` must ship renderers before new block types
are enabled for production tenants.

#### Research verification — 2026-05-28
The active block union remains Hero, FeatureList, Testimonials, FAQ, CTA,
RichText, and ContactSection. Rich-text editing now uses structured Lexical JSON
and canvas inline primitives, so this item should not be treated as the first
WYSIWYG implementation pass anymore.

#### Current verification — 2026-05-28
Still current. `src/collections/Pages.ts` still declares exactly the seven block
types listed above; there are no Pricing, Gallery, Team, Steps, LogoCloud, or
other new production block schemas/renderers in this repo.

---

### OBS-25 — Blog posts feature

**Status:** Active · **Layer:** multi-repo (`siab-payload` + `siab-site-template`)
**Discovered in:** GitHub #7
**File:** New collection required

#### Description
Higher-tier tenants need blog post functionality: a `Posts` collection,
blog-specific editor, and `siab-site-template` renderers for blog list + detail
pages.

#### Why deferred
Requires product decision on data model (separate `Posts` collection vs `type: "blog"` variant on `Pages`) and tier/access gating design.

#### Suggested fix shape
1. Decision: separate `Posts` collection (cleaner for querying and access control).
2. Add `Posts` with `title`, `slug`, `publishedAt`, `author` (Users relationship), `blocks` (same union as Pages), `tenant` (multi-tenant scoped).
3. Add `Posts` to `multiTenantPlugin` collections + migrate.
4. Add list + detail views in frontend (`/sites/[slug]/posts/`).
5. Add blog list + post detail renderers in `siab-site-template`.
6. Update projection to output `posts/` to disk.

**Cross-repo:** `siab-site-template` must ship blog renderers before this is
usable in production.

#### Current verification — 2026-05-28
Still current. There is no `Posts` collection, no `posts` entry in the Payload
multi-tenant plugin config, no `/sites/[slug]/posts` admin route, and no
projection output for blog posts in `siab-payload`.

---

### OBS-26 — Client-facing website analytics dashboard

**Status:** Closed 2026-06-05 · **Layer:** multi-repo (`siab-payload` + `siab-site-template`)
**Discovered in:** GitHub #31
**File:** `src/collections/SiteSettings.ts`, new route `src/app/(frontend)/(admin)/sites/[slug]/analytics/`

#### Description
Tenant CMS users should see a clear, curated analytics dashboard for their own
website. This is distinct from SIAB's full internal intelligence layer in
OBS-99. The client view should be useful and confidence-building, not an
exposure of the complete SIAB event warehouse.

PostHog is the chosen provider. Plausible/Matomo are no longer the intended
provider path for this item because SIAB needs event-level section/component
performance, funnels, unique visitors, experiments, and cross-site learning in
one analytics model.

The client-facing dashboard should show generic site performance: unique
visitors, pageviews, sessions/visits, conversion rate, form submissions, CTA
clicks, top pages, traffic sources/referrers, device split, and simple trends
over 7/30/90 day ranges. Section/component data should be summarized as
actionable client-safe insights such as top-performing sections, most-clicked
CTAs, and pages with traffic but weak conversion.

Do not expose raw PostHog access, raw event streams, individual visitor
profiles, session replay, exact scoring formulas, A/B experiment internals, or
cross-tenant benchmarks to normal tenant users.

#### Suggested fix shape
1. Add site analytics settings/contract fields: analytics enabled, dashboard
   visibility, consent mode, conversion goal type(s), and any PostHog project
   or site key metadata needed by generated sites.
2. Update generated site templates to emit PostHog events from the OBS-99 event
   taxonomy with stable SIAB tenant/site/page/section metadata and
   consent-aware persistence behavior.
3. Add `/sites/[slug]/analytics` in the CMS. It must call a server-side SIAB
   analytics API, not PostHog directly from the browser.
4. Add a server-side PostHog query helper/API that validates the current user's
   tenant/site access, queries PostHog with tenant/site filters, and returns
   only curated metrics.
5. Render overview cards, trends, and tables with existing chart/table
   primitives: unique visitors, pageviews, conversions, conversion rate, top
   pages, top CTAs, traffic sources, and basic section performance.
6. Add a client-safe insight layer after the baseline metrics are trusted:
   "homepage conversions are up", "hero CTA is the most-clicked action",
   "services page gets traffic but converts below site average", etc.
7. Role behavior: owners/editors/viewers may see tenant-scoped read-only
   analytics if enabled for the site; super-admins can view tenant dashboards
   and SIAB-internal analytics separately.

**Cross-repo:** generated site templates must emit the PostHog runtime and
event metadata before the CMS dashboard can show meaningful data.

#### Current verification — 2026-06-02
Still current. PostHog has been selected conceptually, but `siab-payload` does
not yet have site analytics settings, a tenant-scoped PostHog query helper, a
`/sites/[slug]/analytics` dashboard route, or generated-site PostHog event
instrumentation.

#### Planning direction — 2026-06-04
OBS-26 is the tenant-facing slice of the OBS-99 PostHog analytics program.
SIAB will use one shared PostHog project; this route must never expose raw
PostHog access or client-side query credentials. All analytics reads go through
a server-side SIAB query layer that filters by tenant/site and returns only the
curated metrics relevant to SIAB customers.

The generated-site runtime, `siab-site-template`, and orchestrator/sitegen flow
must be updated in the same plan so future sites automatically emit the shared
event taxonomy and metadata. Different sites may have different section and
component types, but the event shape should stay consistent so SIAB can compare
site builds and learn across tenants internally while showing each tenant only
their own client-safe analytics.

Consent behavior follows OBS-99: analytics support is enabled by default when
configured, but public-site PostHog tracking starts only after visitor consent.
Before consent, the runtime may keep memory-only local observations but must not
send analytics events or persist visitor identifiers.

The tenant-facing analytics page should build first from the approved OBS-99
public-site V1 events: `site_page_viewed`, `site_section_viewed`,
`site_section_engaged`, `site_cta_clicked`, `site_contact_clicked`,
`site_form_started`, `site_form_submitted`, `site_form_accepted`, and
`site_conversion_completed`.

#### Implementation progress — 2026-06-04
The first tenant-facing analytics route is implemented in `siab-payload` as
slugless `/analytics` for tenant-mode users and `/sites/[slug]/analytics` for
super-admin selected-site views. It reads from the server-only OBS-99 PostHog
query helpers and renders overview cards, 7/30/90-day traffic trend, top pages,
top actions, form funnel, traffic sources, device split, and section
performance with empty/unavailable states when query configuration is absent.
Client-safe insight copy, deeper form attribution, and production PostHog data
verification remain open.

#### Resolution — 2026-06-05
Closed as part of the completed OBS-99 PostHog analytics program. Tenant-facing
website analytics are available through the CMS analytics route with
tenant/site-scoped PostHog queries, curated client-safe metrics, traffic
sources, device and geography breakdowns, top pages/actions, form and
conversion signals, section/component performance, 7/30/90-day ranges, loading
states, and mobile route gating. Public-site tracking is consent gated and uses
the shared SIAB event taxonomy introduced for generated sites.

Validation for the combined analytics slice included focused analytics/query
tests, `pnpm typecheck`, `pnpm lint:no-css`, `pnpm registry:check`, production
deploys, and green production health checks. Deeper configurable/custom chart
building remains intentionally separate under OBS-27.

---

## Closed — earlier items

### FE-67 — Mobile editor: bottom sheet displaced + canvas scroll-lock when typing from the half detent (CLOSED 2026-05-21)

**Resolved via:** design-systems `5477629`, re-pulled into siab-payload `7586637`. Operator's precise repro after FE-66: it happens *only* when the sheet is at the `0.42` ("half") detent and an input is focused. Root-caused (research + code review, verified against vaul 1.1.2 source) to a vaul bug: `onVisualViewportChange` (its keyboard handler) guards its core sheet-position correction with `if (… && activeSnapPointIndex)`. The `0.42` detent is snap **index 0**, and `0` is falsy in JS — so at the half detent vaul drops a ~58%-of-viewport correction, mis-positions the sheet ("shifts away"), and the corrupted geometry intermittently rejects canvas drags ("scroll-lock"). FE-66's `repositionInputs={true}` had *enabled* this very handler. Fix:
- `mobile-inspector-bar.tsx` — `repositionInputs={false}` (disable vaul's broken handler) + a manual `visualViewport` listener: it writes the keyboard height to a `--mobile-kb-inset` CSS property and, on the keyboard's rising edge, `scrollIntoView`-centres the focused field.
- `mobile-component-editor.tsx` — the editor scroll body pads itself by `--mobile-kb-inset` so the focused field clears the keyboard, and `onFocusCapture` promotes the sheet to the top detent for *all* field kinds (text/cta/richtext/array — previously only richtext); a focus while the keyboard is already open re-centres the new field.

#### Supersedes
FE-66's keyboard half (`repositionInputs={true}`) — see its follow-up note. FE-66's `.rt-content` 16px auto-zoom fix was correct and is unaffected.

**Follow-up (FE-68):** still broken on device. A deep vaul-source review found FE-67's stated root cause — the snap-0 `activeSnapPointIndex` falsy guard — is **unreachable**: `repositionInputs={false}` makes vaul's `onVisualViewportChange` early-return (`vaul/dist/index.mjs:1115`) before that guard runs. The real mechanism is iOS Safari's native page-scroll-on-focus, unsuppressed because `modal={false}` disables vaul's `preventScrollMobileSafari`. FE-67's manual `visualViewport` listener + `scrollIntoView` *appended* a second scroll on top of iOS's rather than fixing it. FE-68 strips that custom keyboard code; the `repositionInputs={false}` change made here is retained.

---

### FE-66 — Mobile editor: iOS auto-zoom on the rich-text field breaks the layout (CLOSED 2026-05-20)

**Resolved via:** design-systems `fc20ca4`, re-pulled into siab-payload `f973140`. Operator re-tested the FE-65 bundle on a real iPhone — canvas still wouldn't scroll, "zooms a bit in and locks", and the on-screen keyboard pushed the bottom sheet away. Root-caused (research + code review, verified against vaul 1.1.2 source) to a single cause: **iOS Safari auto-zooms on focus of any editable element with computed `font-size < 16px`** — `contenteditable` included. The Lexical rich-text editor's `.rt-content` was `15px`; the mobile-only 16px CSS guard only listed `input/select/textarea`, not `[contenteditable]`. Focusing a rich-text field zoomed the viewport, and the zoomed visual viewport then broke every `position:fixed` / `overflow` element — so the unscrollable canvas, the "zoom + lock", and the displaced sheet were all that one zoom. Fixes:
- `@siab/rich-text-toolbar` — `.rt-content` `font-size` `15px → 16px` (the iOS threshold is strictly `< 16px`). CMS-owned value; tenant themes inject only font-*family*, never size, so no tenant can regress it.
- `@siab/mobile-inspector` `mobile-inspector-bar.tsx` — Vaul `repositionInputs` `false → true` so the sheet tracks the keyboard (vaul's `isInput()` covers contenteditable). The prior `false` + "handled manually" comment was false — nothing handled it.

#### Supersedes
FE-61 and FE-62 were both closed on partial/wrong premises — see their follow-up notes. FE-66 is the entry that resolves the user-visible cluster.

**Follow-up (FE-67):** the second fix here — `repositionInputs` `false → true` — was wrong: it *enabled* vaul's keyboard handler, which is itself broken at snap index 0. Reverted to `false` + manual keyboard handling in FE-67. The `.rt-content` 16px auto-zoom fix (the first fix) was correct and stands.

---

### FE-65 — Mobile editor: bottom-sheet interaction revision + nav buttons (CLOSED 2026-05-20)

**Resolved via:** design-systems `8a239ce`, re-pulled into siab-payload `1bbf4f6`. Operator feedback on the Bundle 4 mobile editor; scoped with a code-review + UX-specialist pass — the UX review overrode the originally-requested tap-to-step and 10%-peek mechanics. Changes to `@siab/mobile-inspector`:
- **Two detents `[0.42, 0.92]`** (compact / near-full) replace the 3-snap `[0.3, 0.5, 1]` set. `MobileSnap` type + `MobileEditorContext` snap values updated host-side.
- **Drag-to-dismiss** — `dismissible`; a handle drag past the low detent dismisses the sheet and `onOpenChange` clears the element selection. Re-summon by tapping another canvas element.
- **Drag-only handle** — `Vaul.Handle preventCycle`; tap-to-cycle removed (not a real convention, near-zero discoverability).
- **Single scroll owner** — the inspector-bar region is `overflow-hidden`; `MobileComponentEditor`'s body owns scroll with `overscroll-contain` and scrolls (visible bar) only at the top detent — fixes an iOS rubber-band where the canvas scrolled behind the sheet. Richtext / media editors auto-promote to the top detent.
- Removed the canvas-background-tap `expandTo` auto-collapse (shrank the sheet on stray taps).
- Section nav prev/next buttons → `secondary` variant + larger, so they read as buttons against the header.

#### Cross-reference
FE-60's `maxHeight` snap-cap is retained (clips content to the visible detent). FE-61 (canvas unscrollable) fixed in the same bundle — see its entry.

---

### FE-59 — Mobile inspector shows "No editor for this element" for some selectable elements (CLOSED 2026-05-20)

**Resolved via:** Bundle 4 — siab-payload `acccb75`. Root cause confirmed: the CTA block renders its primary button via `InlineCtaButton` with `elementPath={field:"primary"}` (`blocks/CTA.tsx:65`), but `BLOCK_ELEMENTS.cta` carried no spec for `primary` — the inspector found no `ElementSpec` and `MobileFieldRenderer` fell through. An audit confirmed `primary` was the *only* unspecced selectable field across all 7 blocks. Fix: added `{ field: "primary", label: "Button", kind: "cta" }` to `BLOCK_ELEMENTS.cta` — the generic `cta`-kind editor body already resolves value/setValue by `elementPath`, so no editor change was needed (also surfaces the button row in the desktop sidebar). Regression guard: `tests/unit/fe-59-block-element-specs.test.ts` statically audits every `elementPath` in the block renderers against `BLOCK_ELEMENTS` (8 cases).

---

### FE-60 — Mobile bottom sheet content not scrollable past the visible snap height (CLOSED 2026-05-20)

**Resolved via:** Bundle 4 — design-systems `7104b41`, re-pulled into siab-payload `acccb75`. The editor scroll region was `flex-1` of a `h-[100dvh]` `Vaul.Content` — sized to the whole sheet, so content shorter than 100dvh never overflowed and its lower portion sat unreachable below the visible snap fold. Fix: cap the scroll region's `max-height` to `calc(activeSnapPoint * 100dvh - 1rem)`; the `h-full` chain propagates the constraint down to `MobileComponentEditor`'s inner scroller, so content past the fold now produces real overflow at every snap.

---

### FE-61 — Canvas scroll intermittently intercepted / becomes unscrollable (CLOSED 2026-05-20)

**Resolved via:** FE-65 bundle — design-systems `8a239ce`, re-pulled into siab-payload `1bbf4f6`. **The Bundle 4 fix (`7104b41`) was inert** — the operator confirmed the bug still reproduced. A Vaul-source review established that vaul 1.1.2 with `modal={false}` never sets `body{pointer-events:none}`, so the Bundle 4 pointer-events override guarded a behaviour that does not exist (now removed). Real cause: `[data-mobile-canvas]` in `mobile-section-edit.tsx` is a `flex-1` scroll child with no `min-h-0` — a flex item's default `min-height:auto` won't shrink it below content height, so a section taller than the column grows past it instead of engaging `overflow-y-auto`, and the `fixed … overflow-hidden` ancestor clips the excess unreachably (matches the operator's "after section switch" repro — switching to a tall section). Fix: add `min-h-0` to the canvas flex child so `overflow-y-auto` engages.

**Follow-up (FE-66):** the `min-h-0` fix is correct and stays, but it was not the cause of the *visible* "won't scroll" symptom the operator kept hitting — that was iOS input-focus auto-zoom (FE-66) masking it. The flex chain is now structurally sound.

---

### FE-62 — Canvas occasionally zooms / scales unexpectedly (CLOSED 2026-05-20)

**Resolved via:** Bundle 4 (defensive hardening) — design-systems `7104b41`, re-pulled into siab-payload `acccb75`. The entry's `useFitZoom` premise was wrong: `useFitZoom` is desktop-only and is not in the mobile component tree, so the unexpected scale is native browser pinch-zoom — the mobile canvas had no `touch-action` guard. Fix (operator chose canvas-surface-only over a site-wide viewport lock, to avoid an accessibility regression): `touch-pan-x touch-pan-y` on the `[data-mobile-canvas]` surface in `mobile-section-edit.tsx` suppresses pinch-zoom on the canvas while leaving the rest of the admin app zoomable. Non-deterministic — shipped as hardening; operator confirms on-device post-deploy.

**Follow-up (FE-66):** the `touch-action` guard blocks *pinch* zoom only — correct as far as it goes, but the operator's reported "zoom" was iOS input-focus auto-zoom, a different mechanism entirely. Real fix in FE-66.

---

### OBS-42 — ContactSection: submit button label hardcoded as "Send" in renderer (CLOSED 2026-05-20)

**Resolved via:** Bundle 3 (Full Pipeline) — siab-payload `9512e23`, siab-site-template `61029d2`, siab-payload-orchestrator `88cfbf1`, site-amicare-zorg `42e87e8`. Added a `submitLabel` text field (required, default "Send") to the ContactSection block schema; migration `20260520_170754_add_contact_submit_label` adds the column `DEFAULT 'Send' NOT NULL` (backfills existing rows → CMS-canonical data). The label is now editor-set across the whole autogeneration pipeline: the siab-payload canvas renderer; the `siab-site-template` renderer + `ContactSectionBlock` type + preview-island dispatch (so future generated sites inherit it); the `site-converter.md` scaffold codeblocks — `types.ts` + `Blocks.astro` dispatch — which are canonical for future site conversions; and the live `site-amicare-zorg` renderer + both dispatchers. Renderers read `{submitLabel ?? "Send"}`; the type is `submitLabel?: string | null` (optional — already-projected page JSON lacks it until re-save).

---

### FE-45 — Hero image stylistic radius should track the ThemeBar radius setting (CLOSED 2026-05-20)

**Resolved via:** Bundle 3 — site-amicare-zorg `42e87e8`, siab-payload `9512e23`. Research corrected the original premise: **no new `--radius-display` token was needed.** `siab-site-template`'s Hero image already uses the theme-driven `var(--radius-lg)` — the bug was that **site-amicare-zorg had drifted** to a hardcoded `rounded-[3rem]`, bypassing the ThemeBar. Fix: amicare's Hero image → `rounded-[var(--radius-lg)]` (matches the template); the siab-payload canvas Hero dropped its stale duplicate `rounded-[3rem]`. The hero image now tracks the tenant's ThemeBar radius like every other surface — no theme-system change, no new token. (Radius is *not* part of theme presets — see OBS-71.)

---

### FE-64 — Tenants (/sites) and Users (/users) lists cap silently, no pagination UI (CLOSED 2026-05-20)

**Resolved via:** OBS-7 follow-up — siab-payload `80b77bd`. Discovered while seeding a test tenant for OBS-7: `listTenants` capped at `limit: 200` and `listAllUsers` at `limit: 500` — the same silent-truncation class as OBS-7, one rung up. With 100+ tenants expected short-term, those ceilings would eventually drop rows with no indication.

Fix mirrors OBS-7: new `listTenantsPaginated` / `listUsersPaginated` query variants (server-side `?page=` + `?q=` search — name/slug/domain for tenants, name/email for users). `/sites`, `/users` (both super-admin all-users and tenant-mode team) and `/sites/[slug]/users` rewired to RSC pagination composing the existing `ListSearch` + `ListPagination`; the `DataTable` client filter dropped on `TenantsTable` / `UsersTable`. Legacy `listAllUsers` / `listUsersForTenant` removed (now unused); `listTenants` kept for the user-edit tenant picker. Coverage: `tests/unit/fe-64-tenants-users-pagination.test.ts` (8 cases).

**Still capped — pickers, not lists:** the user-edit tenant dropdown (`listTenants`, 200) and the nav page-picker (FE-63) load an unpaginated set into a `<select>`. At 1000+ rows those want a searchable async combobox, not just a higher cap — a UX change, tracked under FE-63.

---

### FE-49 — Mobile bottom sheet needs iOS-native drag-to-snap behavior on the handle (CLOSED 2026-05-20)

**Resolved via:** Bundle 2 — design-systems `8ddbdb7`, re-pulled into siab-payload `820f159`. Root cause: `mobile-inspector-bar.tsx` set Vaul's `handleOnly` but rendered the grip as a plain `<div>` — Vaul only wires drag onto a real `<Vaul.Handle>`, so the sheet could not be dragged at all. Fix: swapped the grip div for `<Vaul.Handle>`; with `snapPoints` + controlled `activeSnapPoint` already in place, native drag-to-snap (and tap-to-cycle) now works. Handle background overridden to a theme token (Vaul's default `[data-vaul-handle]` colour is hard-coded grey). The scroll-vs-drag concern from the original entry — content taller than the visible snap not scrollable — is split out as **FE-60**.

---

### FE-48 — Mobile keyboard overlays bottom sheet when editing pills/links (CLOSED 2026-05-20)

**Resolved via:** Bundle 2 — design-systems `8ddbdb7`, re-pulled into siab-payload `820f159`. Operator repro reframed the bug: it is not pill/link-specific — any editor that auto-focuses an input on open pops the soft keyboard *during* the bottom-sheet open transition, so the sheet never shifts up. Root cause: `mobile-component-editor.tsx` set `autoFocus` on the `text` and `cta` inputs. Fix: dropped `autoFocus` — the editor opens clean and the keyboard only opens on an explicit field tap, the path that already shifted the sheet correctly for richtext fields.

---

### FE-58 — Unsaved-changes counter sticks at 1, stops counting subsequent edits (CLOSED 2026-05-20)

**Resolved via:** standalone fix (session 2026-05-20). Root cause: only the page editor counted properly — its `countLeafDirty` recurses RHF's nested `dirtyFields` and counts the `true` leaves (FN-2026-0065). The entity-edit forms never got that: `TenantEditForm` / `UserEditForm` / `SettingsForm` passed `SaveButton` **no `dirtyCount`** (badge fell back to `?? 1`) and their `MobileSavePill` got `isDirty ? 1 : 0` — a 0/1 boolean, never a count.

Fix: `countLeafDirty` extracted to a shared `src/lib/countLeafDirty.ts` (the page editor now imports it, dropping its local copy); the three edit forms compute `countLeafDirty(form.formState.dirtyFields)` and pass it to both `SaveButton` and `MobileSavePill`. `NavigationManager` isn't an RHF form — its prior 0–2 "dirty menus" count is replaced by `countEntryDiff`, a position-wise per-entry diff across header + footer, so its badge climbs per change too (a reorder/removal can over-count slightly — acceptable for a rough hint).

---

### FE-57 — Unify the Save button across all CMS forms to the page-editor pattern (CLOSED 2026-05-20)

**Resolved via:** Bundle 4. The save button was extracted from `PublishControls` into a standalone registry component, **`@siab/save-button`** (`SaveButton` — inverted-surface pill, amber dirty border / destructive on errors, floating count badge). `PublishControls` now composes it; `NavigationManager` dropped its hand-copied duplicate; the entity-edit forms `TenantEditForm`, `UserEditForm` and `ProfileForm` (name form) adopted it. One canonical save button across the CMS. Scope per operator: edit forms only — create forms (`TenantForm`, `UserInviteForm`) and auth/action buttons (login, password change) keep their own "Create"/"Sign in"/"Change password" buttons.

---

### FE-56 — Settings page should adopt the navigation page's UI shell (CLOSED 2026-05-20)

**Resolved via:** Bundle 4. `SettingsForm` reworked to the `NavigationManager` shell — `Tabs`/`TabsList` replaced by a `SegmentedPill` (General / Details) inside the shared `FLOATING_PILL_CLASS` surface, and `StickyFormFooter` + plain button replaced by a toolbar row (segmented switch left, `SaveButton` right). Sections stay mounted (inactive hidden) so react-hook-form keeps every field registered across switches. Settings and Navigation now read with the same chrome.

---

### FE-55 — Navigation sidebar link should sit directly under Pages (CLOSED 2026-05-20)

**Resolved via:** Bundle 1. `AppSidebar.tsx` Content group reordered — the Navigation `SidebarMenuItem` now sits directly after Pages (Pages → Navigation → Media → Forms → Settings → Team → Onboarding). Role-visibility wrapper unchanged.

---

### FE-22 — Expose `siteManifest` in the custom super-admin Tenant form (CLOSED 2026-05-20)

**Resolved via:** Bundle 1 — minimum tier. `TenantEditForm.tsx` gains a "Site manifest" `<Textarea>` field (raw JSON, monospace), defaulted from `tenant.siteManifest`. A zod `superRefine` validates on save that the text parses and matches `manifestSchema` (`src/lib/richText/manifest.ts`); the parsed object — or `null` when empty — is threaded into the `PATCH /api/tenants/:id` body. Tier 2 (a structured `SiteManifestForm`) stays a future option, but the operator UX gap (no manifest access without bouncing to the raw Payload admin) is closed.

---

### FE-2 — Delete modals — insufficient spacing between body text and buttons (CLOSED 2026-05-20)

**Resolved via:** the FE frontend-quickwins bundle (session 2026-05-20). Root cause: the registry `DialogContent` nests all children inside one `overflow-y-auto` wrapper with no `gap`, so `DialogHeader` → error → `DialogFooter` stacked flush. Both `confirm-dialog` and `typed-confirm-dialog` are registry-owned (they ship to `src/components/`, in `registry:check`'s DRIFT_PATHS) — fixed in the `optidigi/design-systems` source: `mt-4` on `DialogFooter` + `mt-2` on the body region, then rebuilt + re-pulled. Composition-layer spacing only, no registry-internal override.

---

### FE-6 — Add tenant should use same modal pattern as Add user (CLOSED 2026-05-20)

**Resolved via:** the FE frontend-quickwins bundle. New `TenantCreateDialog` (`src/components/forms/`) mirrors `UserInviteForm` — `Dialog` + `DialogTrigger` wrapping the existing `TenantForm`. `/sites` header + empty-state both trigger it; `/sites/new` now `redirect()`s to `/sites` so old links resolve; `max-w-md` dropped from `TenantForm` so it fills the dialog. Pure siab-payload (forms/ + app routes are not registry-owned).

---

### FE-33 — `ArrayItemCard` sub-field renderer ignores `image` kind (CLOSED 2026-05-20)

**Resolved via:** the FE frontend-quickwins bundle (registry-side — `@siab/sidebar-inspector`). Added an `image` branch to `array-item-card.tsx`'s `SubFieldRenderer` mirroring `FieldRenderer`'s `<InlineImage value onChange />`. `cta` sub-field branch deliberately skipped — no block declares a CTA sub-field inside an array. Testimonials `avatar` is now editable from an expanded card in the sidebar drill-down.

---

### FE-34 — No UI for "duplicate block" in the sidebar drill-down (CLOSED 2026-05-20)

**Resolved via:** the FE frontend-quickwins bundle (registry-side — `@siab/sidebar-inspector`). `BlockListRow` gained a hover-revealed `MoreVertical` `DropdownMenu` (Duplicate / Delete) mirroring the canvas `BlockGutter` — wired to the already-existing `onDuplicateBlock` / `onDeleteBlock` props. `data-[state=open]` keeps it visible while the menu is open; trigger `stopPropagation` prevents the row's select-on-click from firing.

---

### FE-51 — Unify SaveStatusBar saved/error variants (CLOSED 2026-05-20)

**Resolved via:** the FE frontend-quickwins bundle (registry-side — `@siab/save-ui`). `save-status-bar.tsx` status-dependent ternary replaced with a `variant: "success" | "destructive" | "neutral"` derivation + a shared `glassPill` base; success and error now share the translucent glass treatment with only the colour role flipped, neutral (saving) keeps the plain card pill. Error `AlertCircle` icons retinted `text-destructive-foreground` for contrast on the red glass.

---

### FE-53 — Sidebar "+ Add Block" button has no `onClick` handler (CLOSED 2026-05-20)

**Resolved via:** the FE frontend-quickwins bundle (registry-side — `@siab/sidebar-inspector`). `SidebarDrillDownProps` gained `onAddBlock(blockType, seed?)`; the "+ Add block" button now opens a controlled `BlockTypePicker` (via `useBlockPresets`), mirroring `CanvasGapButton`. `registry.json` deps gained `@siab/block-type-picker` + `@siab/dropdown-menu`. Consumer side: `PageForm` adds an `addBlock` helper (mirrors `useCanvasBlocks.insertBlockAt` — defaultAnchor pre-fill, appends at end, selects the new block) and the sidebar-view `BlockPresetsProvider` was hoisted to also wrap the drill-down aside.

---

### OBS-20 — Navigation management as a first-class page (CLOSED 2026-05-20)

**Resolved via:** the 3-bundle navigation feature (session 2026-05-20). Page-flag-driven model, single source of truth on `SiteSettings.navHeader` / `navFooter` — ordered discriminated-union arrays (`page` | `section` | `custom` entries). Serves onepagers (section `#anchor` links) and multi-page sites alike, and stays dynamic as a onepager grows — no per-site mode flag, no migration to switch.

- **I-1** `a1a0d65` — backend: `navHeader`/`navFooter` schema, migration `20260519_220324_nav_restructure` (backfilled the 4 legacy amicare nav rows as `section` entries, dropped `site_settings_navigation`), `resolveNav` projection helper, `settingsToJson`/`projectToDisk` wiring. Also disabled dev-mode push under vitest (`payload.config.ts`) — an OBS-66 follow-up.
- **I-2** `30051b8` + UI polish `42bccca`/`2a42fc5` — the `/sites/[slug]/navigation` admin page: `NavigationManager` (SegmentedPill zone switch in the editor's `FLOATING_PILL_CLASS` surface, dnd-kit reorder, add/edit dialog with auto-enumerated section picker, PublishControls-style Save button), `updateNav` server action, AppSidebar link.
- **I-3** (this commit) — `togglePageInNav` action + the page-editor nav toggles + amicare `Nav.tsx` wired to the projected `navHeader`.

The original "buried under Settings → Navigation" framing was stale (FN-2026-0067 had already removed the Settings nav UI). Cross-ref OBS-63 (header/footer in canvas) — its blocker note ("nowhere to route until OBS-20 exists") is now cleared; OBS-63 itself stays open.

---

### OBS-21 — Page editor: toggle to include a page in header/footer nav (CLOSED 2026-05-20)

**Resolved via:** bundle I-3 of the navigation feature. The page editor's "Include in header navigation" / "Include in footer navigation" `Switch` toggles (in a Navigation card alongside SEO) call the `togglePageInNav` server action — adding/removing a `page`-type entry in `SiteSettings.navHeader`/`navFooter`.

No `includeInHeader`/`includeInFooter` columns on Pages, per the agreed page-flag design — the toggles are a *view* over nav-list membership (the RSC derives initial state via `pageNavMembership`), so there is no flag/list desync. Toggling persists immediately, independent of the page Save cycle. Shown only to nav managers (owner / super-admin — editors edit page content but not nav, consistent with `canUpdateSettings`) and only once a page is saved. Test coverage: `tests/unit/togglePageInNav-action.test.ts` (10 cases).

---

### FE-54 — Settings page/nav-link visible to editors and viewers (CLOSED 2026-05-19)

**Resolved via:** Bundle D — two-file fix matching the suggested-fix shape verbatim.
1. `src/components/layout/AppSidebar.tsx:97` — Settings `<SidebarMenuItem>` now wrapped in `{(role === "super-admin" || role === "owner") && (...)}`. Editors and viewers see Pages / Media / Forms but no Settings entry.
2. `src/app/(frontend)/(admin)/sites/[slug]/settings/page.tsx` — `requireAuth()` swapped for `requireRole(["super-admin", "owner"])`. Direct URL navigation by editor/viewer redirects to `/?error=forbidden` (the project's existing convention from `requireRole`).

`SettingsForm.tsx:182`'s `canEdit`-gated Save button stays as defense-in-depth — left untouched per the suggested-fix shape's option to keep it for any future route that legitimately needs a read-only settings view. With the page-level gate now in front, `canEdit` always resolves to `true` in the current consumer; harmless and removable later if the form is ever simplified.

OBS-20 (navigation as first-class page) and OBS-23 (full settings refactor) inherit a correctly-gated settings surface from here.

---

### OBS-64 — Tenant owner/editor cannot update `Tenant.theme` (CLOSED 2026-05-19)

**Resolved via:** Bundle C — `src/lib/actions/setTenantTheme.ts` is now the authorization boundary for theme writes. The action explicitly checks the caller (super-admin OR owner/editor in the target tenant) and then runs `payload.update({ ..., overrideAccess: true })`. `Tenants.access.update` stays `isSuperAdmin` — no collection-level relaxation, so every other Tenant field (`name`, `slug`, `domain`, `status`, `siteRepo`, `notes`, `siteManifest`) remains firmly super-admin-only at the collection gate. Viewer role is intentionally excluded (viewer is read-only by the role's invariant).

**Why the suggested fix shape was discarded.** The original entry suggested adding `field.access.update` on `theme` to allow tenant members while collection-level access stayed locked. This **cannot work** in Payload v3: collection-level `access.update` is a hard gate that throws Forbidden immediately on `false` (`node_modules/payload/dist/auth/executeAccess.js:10-15`, called from `collections/operations/update.js:50-64`), and field-level `update` access does not exist in Payload v3 — only `field.access.read` is implemented (`fields/hooks/afterRead/promise.js:225-237`; no equivalent in `beforeChange/promise.js`). The only viable shapes were (a) relax the collection gate + lock everything else with `field.access.read` + a beforeChange hook to reject other-field writes; (b) make the server action the auth boundary and use `overrideAccess: true`. Option (b) — Bundle C's choice — is surgical (one file, no new attack surface on other fields) and matches the existing repo pattern (server actions already resolve callers manually per CLAUDE.md § auth patterns).

**siteManifest stayed super-admin-only by design.** Two reasons: (1) no tenant-side UI exists for editing it (FE-22 is the entry that would build one); (2) the source of truth lives in the site repo, with the orchestrator's `payload-seeder` Phase 4 PATCHing `siteManifest.json` onto the field during provisioning (OBS-49) — a tenant-side edit would diverge from the site repo and be clobbered by the next orchestrator sync, with no sync-protection story today.

**Test coverage:** `tests/unit/setTenantTheme-access.test.ts` — 11 cases covering super-admin pass-through, owner self-tenant allow, editor self-tenant allow, owner+editor cross-tenant deny, viewer self-tenant deny, unauthenticated deny, invalid-theme deny (pre-auth), tenant id-shape robustness (populated-object form + string vs number id), and an invariant test pinning `overrideAccess: true` so a future refactor can't silently regress the boundary.

**Reproduction confirmation:** Original 403 trace from `editor+amicare-zorg@optidigi.nl` on `admin.ami-care.local:3000` (2026-05-19 dev session) — should now resolve. Operator visual smoke recommended on next session.

**Cross-reference:** FE-22 still active — when a tenant-side editor for `siteManifest` is wanted, that entry covers the UI; OBS-64's authorization pattern would be the template for opening up the access path at that time (same setTenantTheme-style boundary in a `setTenantManifest` action, or a collection-level relaxation if sync-protection is solved first).

---

### FE-27 — Hero pill items have no client-generated `id` on creation (CLOSED 2026-05-19)

**Resolved via:** Bundle B — canvas block parity. Both pill-creation sites in `src/components/editor/canvas/blocks/Hero.tsx` (the "+ Add pill" button at the bottom and the Enter-key chain-append from inside the pill editor) now stamp `id: crypto.randomUUID()` on the new `{ label: "" }`. `key={pill.id ?? i}` therefore resolves to the stable client id immediately on creation — no more index-key fallback on the unsaved pill, no reorder-before-save reconciliation glitches. The client id is overwritten by Payload's own id on first save (same shape as the existing `id?: string | null` type).

---

### FE-52 — Add inline "+ Add testimonial" affordance to canvas Testimonials block (CLOSED 2026-05-19)

**Resolved via:** Bundle B — canvas block parity. `src/components/editor/canvas/blocks/Testimonials.tsx` now renders a dashed "+ Add testimonial" grid-card sibling at the end of the testimonials grid, mirroring `Hero.tsx:190-202`. Click appends `{ quote: "", author: "", role: "", avatar: null }` (matching the block schema's plain-text + textarea + upload-relation shape — *not* RtRoot; the original suggested-fix entry had this wrong) and stops propagation so the canvas selection model doesn't fight the click. A small `useEffect` keyed to `items.length` scrolls the newly-appended `<figure>` into view via `scrollIntoView({ block: "nearest", behavior: "smooth" })` so it doesn't get pushed off-screen on long pages. Auto-focus on the `quote` field was the optional half of the suggestion — left off; the per-card `ClickToEditField` affordances are unchanged.

---

### FE-30 — Empty-canvas-click deselect — barely reachable (CLOSED 2026-05-19 — fixed)

**Resolved via:** Operator-verified during 2026-05-19 FE walkthrough — the original "barely reachable" concern no longer reproduces on desktop. Canvas deselection works as expected via clicking outside the canvas; the gap exists only on the mobile path, which is now handled by other selection-model affordances. The bug as filed is no longer present.

---

### FE-35 — RichText block: `prose-headings:font-serif` overrides `--font-heading` (CLOSED 2026-05-19 — visual smoke)

**Resolved via:** Operator-verified during 2026-05-19 FE walkthrough — RichText heading nodes now render in the tenant's `--font-heading` value (Fraunces for amicare), not the Tailwind serif fallback. The cascade issue described in this entry no longer reproduces. Either the `prose-headings:font-serif` Tailwind utility was removed in a subsequent edit, or the cascade now resolves in favour of the inline `fontFamily` correctly — re-investigate only if a specific tenant reports the fallback returning.

---

### FE-37 — Tenant `--color-ink` leaks into CMS chrome in dark mode (CLOSED 2026-05-19 — visual smoke)

**Resolved via:** Operator-verified during 2026-05-19 FE walkthrough — chrome elements (insert buttons, gap buttons, canvas selection ring) inside `.rt-canvas` correctly track CMS dark-mode tokens and read legibly. The structural concern in this entry (any future chrome element inheriting `--color-ink`) is still present in principle, but no current canvas-chrome element exhibits the symptom. Re-open only if a new chrome addition reads dark-on-dark.

---

### FE-38 — Mobile section cards should signal completeness state (CLOSED 2026-05-19 — operator decision)

**Resolved via:** Operator-verified during 2026-05-19 FE walkthrough — completeness signals on mobile section cards are intentionally **absent**. Both the original green/amber dot (removed in FE-39 round-2) and the proposed "Incomplete" outline badge would conflict with the desired minimal mobile editor aesthetic. The completeness concern is not a real operator pain. Close as won't-do.

---

### FE-41 — Hoist `<style data-rt-tenant-css>` from body to `<head>` (CLOSED 2026-05-19 — React 19 auto-hoist)

**Resolved via:** Code review during 2026-05-19 FE walkthrough — both `src/components/editor/canvas/CanvasMode.tsx:301-308` and `src/components/editor/canvas/mobile/CanvasMobile.tsx:42-43` still render `<style>` in the JSX body tree, but `package.json` confirms React 19.2.5 is in use. React 19 auto-hoists `<style>` elements emitted from client components to `<head>` deterministically during render, eliminating the HMR-remount flicker class of bug the entry was hedging against. Close as resolved; the data attributes (`data-rt-tenant-css`, `data-rt-theme-overrides`) remain useful for debugging.

---

### FE-24 — Inline image upload-on-paste in rich text editor (CLOSED 2026-05-19 — won't-do)

**Resolved via:** Operator decision during 2026-05-19 FE walkthrough — pasting images into the RichText body is **not** the intended UX. Image uploads belong in the dedicated Image block (via the slash-menu / Media library), not as an inline RichText action. The paste warning directs users to the right surface. Close as won't-do.

---

### FE-7 — Pages overview — DnD row reordering (CLOSED 2026-05-19 — won't-do)

**Resolved via:** Operator decision during 2026-05-19 FE walkthrough — page drag-and-drop reordering would be counter-intuitive for the pages-list UX (pages are conceptually navigable URL routes, not an ordered list authors arrange visually). Close as won't-do. If sort-order persistence ever becomes a real need (e.g. ordering blog posts), file a fresh entry scoped to that collection.

---

### FE-47 — Canvas should render at true pane width (RESCOPED 2026-05-18 → OBS-62)

**Resolved via:** Rescoped after three-researcher consensus during same session. The narrow canvas-side framing didn't capture the multi-repo nature of the solution (lint package, tenant-side authoring contract, orchestrator agent updates, per-tenant migrations). See **OBS-62** for the full consensus shape (`@siab/responsive-canvas-lint` package + container-query authoring convention + defense-in-depth enforcement via CI gates and Claude Code Stop hooks).

---

### FE-26 — Canvas zoom-fit ignores `xl:`+ breakpoints (CLOSED 2026-05-18 — superseded by OBS-62)

**Resolved via:** Closed in favour of a broader entry. The narrow `xl:`/`2xl:` mismatch this entry described is a symptom of the canvas's "fixed 1280px design width + zoom-fit" model not matching how a true responsive preview should behave. The full reframing — canvas should render at the actual pane width and resolve tenant block responsive classes against the canvas width, not the browser viewport — is tracked as **OBS-62** (rescoped from intermediate FE-47). If/when OBS-62 lands (via the container-query authoring contract), the `xl:`/`2xl:` mismatch evaporates as a side-effect.

---

### FE-5 — Filter/search bar UI tweak on list pages (CLOSED 2026-05-18 — backlog audit)

**Resolved via:** Confirmed not reproducing post Phase B registry adoption (`@siab/data-table`). Entry was too vague to action and the underlying surface is now registry-owned, so any future specific defect should be filed as a fresh FE-N rather than re-opening this generic catch-all. Original origin: GitHub #8.

---

### FE-25 — Canvas editor affordances shrink with the zoom-fit factor (CLOSED 2026-05-18 — backlog audit)

**Resolved via:** Not reproducing in practice — the canvas-overall improvements since the original 2026-05-14 round (chrome restructure, registry-owned BlockGutter + CanvasGapButton, sidebar-drill-down replacement of the prior sidebar UI) have made the affordance hit-targets acceptable. The zoom-fit frame is still present (`canvas-mode.tsx:204`, `:312`), so if a narrow-pane regression resurfaces, file a fresh FE-N with the specific defect.

---

### FE-46 — siab-payload as a complete `@siab/*` consumer (CLOSED 2026-05-17, Phase D fully landed)

**Resolved via:** Phase D master plan landed across late May 2026. D1 = `64de26f` (adopt `@siab/theme`), D2 = `fe949ff` (adopt `@siab/base` — base layer resets including the universal `* { @apply border-border outline-ring/50 }` now inside `@layer base`; resolves OBS-30 as a side-effect), D3 = `ce432cb` (adopt `@siab/rich-text-toolbar` CSS — `.rt-content*` registry-managed), D4 = `6a60384` (adopt `@siab/canvas-chrome` CSS — `.rt-canvas*` registry-managed), D5a = `00122ff` (adopt `@siab/onboarding-checklist`), D6 = `ae2c4bb` + `4c0932a` (canvas inline `style={fontFamily/borderRadius}` → Tailwind arbitrary values), D7 = `1c6e451` (`pnpm lint:no-css` gate wired to CI). CLAUDE.md "How this app is built — the registry-driven frontend model" section is the canonical post-state. `src/styles/globals.css` is now 473 lines and 5 `@siab` references; 6/6 token-files registry-gated; 53 `@siab/*` items in `pnpm registry:check`. OBS-53 (publish blocker) closed in lockstep.

#### Residual
The full D5 Layer-2 audit (promote-or-retain composites in `src/components/dashboard/`, `forms/`, `layout/`, etc.) is the smallest remaining slice. File a fresh FE-N if/when picked up — it is small enough to stand alone and doesn't need to keep FE-46 open.

---

### FE-44 — Site radius scale tracks ThemeBar (CLOSED 2026-05-17)

**Resolved via:** commit `84ee704` (feat(editor): theme overhaul, save UI polish, color gating, radius scale) on `feat/fe39-mobile-editor-redesign`.
**Layer:** multi-repo (siab-payload canvas mirrors + site-amicare-zorg styling)
**Origin:** ThemeBar shape control wasn't persisting visually on the published site.

#### Root cause
`projectTenantTheme()` was already emitting `:root { --radius-sm/md/lg }` correctly in `tenant-theme.css`, but the site components used Tailwind utility classes (`rounded-2xl`, `rounded-[2rem]`, `rounded-full`) that compile to literal pixel values and ignore the CSS variables. Only one inline-style instance (Hero pill) was reading `var(--radius-sm)` — every other rounded element stayed at its compile-time literal regardless of the tenant's radius pick.

#### Resolution shape
Mirrored the CMS canvas pattern in the site. Added `--radius-sm/md/lg` defaults inside `site-amicare-zorg/src/styles/global.css`'s existing `@theme { … }` block so Tailwind v4 generates `rounded-sm/md/lg` utilities from those tokens. The runtime `:root` override from `tenant-theme.css` (injected after the compiled bundle by `BaseLayout.astro:46`) replaces them per tenant. Switched 4 surface cards from arbitrary / `2xl` radius classes to `rounded-lg` (Hero floating cards, FeatureList card, FAQ card, Testimonials card); Hero pill from `rounded-full` to `rounded-md`. Canvas mirrors in `src/components/editor/canvas/blocks/{Hero,FeatureList,FAQ,Testimonials}.tsx` updated in lockstep per the rt-dom-contract rule. 12 instances (pill buttons, avatars, icon chips, blur blobs, hero image) intentionally stay literal — see FE-45 for the hero-image decision.

---

### FE-39 — Mobile editor redesign — tap-to-edit canvas + persistent inspector bar (CLOSED 2026-05-17)

**Resolved via:** Implemented across FE-39 round 1 → round 6 (≈50+ commits between 2026-05-16 and 2026-05-17, starting at `85efd6b` (round-2 plan) through `7ffcc0d` (round-6 phase 1 polish) and on to round-6 phase 4c hotfixes). The two-level drill-down + persistent inspector bar pattern is fully in production. All new components shipped to the `@siab/*` registry: `mobile-inspector-bar.tsx`, `mobile-component-editor.tsx`, `mobile-array-drilldown.tsx`, `mobile-page-settings.tsx`, `mobile-seo-settings.tsx`, `mobile-section-list.tsx`, `mobile-section-edit.tsx`, `mobile-floating-pill.tsx`, `mobile-save-pill.tsx`, `mobile-back-pill.tsx`, `mobile-media-sheet.tsx`, `mobile-icon-sheet.tsx`. Closes the entries that already credited FE-39 as their resolver (FE-9, FE-17, FE-18, FE-19, FE-21, FE-32, FE-20). FE-38 (completeness-state signalling) was rolled back in round-2 batch 1 and remains active as a separate reopened entry.

---

### FE-20 — Move phone Save FAB from bottom-right to top-right (CLOSED 2026-05-16)

**Resolved via:** commit `6b47e1e feat(fe39): floating Save pill (top-right, all mobile views) [round2 batch 3]` as part of the FE-39 mobile rewrite. The FAB is now `@siab/mobile-floating-pill` (`src/components/save-ui/mobile-save-pill.tsx`) using `position="top-right"`. The legacy `phone-fab` class, the inline `style={{ bottom: calc(...) }}` in `PageForm.tsx`, and the bottom-right anchor are all gone.

---

### OBS-57 — siab-payload should be first-class multi-site-type (CLOSED 2026-05-18)

**Resolved via:** `feat/obs-57-multi-site-type-consumer` branch — manifestSchema gained optional `blocks[]` (commit `274d2cf`); themed-matcher registry reorganised into per-category MATCHERS[] aggregation (`1433f31`); `anchor` field on all 7 block schemas (`a0b03ac`) + migration (`74c3ba0`) + canvas renderer stamping with legacy-id preservation (`3fd12cf`, `7549640`); `enforceTenantBlockMenu` hook on Pages.beforeValidate (`a7a7a2c`, `9de04d1`); `BlockPresetsContext` consumes manifest (`80e98f3`) with PageForm plumbing (`a185c31`); `useCanvasBlocks` pre-fills `anchor` from manifest `defaultAnchor` (`f307f99`). Spec: `docs/specs/2026-05-18-obs-57-multi-site-type-consumer-design.md`. Plan: `docs/plans/2026-05-18-obs-57-multi-site-type-consumer-plan.md`. Backwards-compatible: tenants without `blocks[]` in their manifest see no behavioural change.

#### Unblocked follow-up specs (each gets its own brainstorm + plan)
1. `siab-site-template` rebuild against the new contract (consumes `siteManifest.example.json` declaring `blocks[]`, reads `block.anchor` in site renderers, ships rt-v2 renderer + role tokens + cms-css build pipeline + docker-entrypoint).
2. `siab-payload-orchestrator` updates: payload-seeder reads `siteManifest.json` from cloned site repo and writes `Tenant.siteManifest`; seeder generates RtRoot-shaped seeds.
3. `siab-site-orchestrator` updates: auditor manifest-presence gate (OBS-50), deploy-time `docker cp` hook for cms-editor.css (OBS-55), contract docs.
4. ami-care cleanup: add `siteManifest.json`, switch from hardcoded section ids to `block.anchor` (drop the canvas-renderer literal fallbacks for `werkwijze` / `contact` / `wat-telt` / `top` once data is filled in), remove `docker-entrypoint.sh` cms-css copy workaround + revert `/data:rw` → `/data:ro`.
5. amblast + siteinabox migrations (deferred per OBS-56).

#### Follow-up
- The OBS-57 `defaultAnchor` pre-fill is built into `useCanvasBlocks(manifest)`. The registry-owned desktop/mobile callers were brought forward in OBS-58 (`@siab/canvas-chrome` now calls `useCanvasBlocks(manifest)`), so default-anchor prefill is active end-to-end in the canvas UI.

#### Follow-up — 2026-06-04
The block menu contract now has a first slice of per-site editable-field
metadata. `siteManifest.blocks[]` may declare `fields[]` for a block slug, and
the CMS desktop sidebar plus mobile inspector prefer those manifest-declared
fields over the local Payload block-schema fallback. This lets generated sites
expose different editable surfaces for the same block slug, while the CMS still
maps only supported editor kinds (`richtext`, `text`, `image`, `icon`, `cta`,
`array`, `select`, `checkbox`).

The fallback `BLOCK_ELEMENTS` map is no longer manually maintained; it is
derived from the Payload block schemas for backwards compatibility with tenants
whose manifests do not yet declare `blocks[].fields`. Registry-owned inspector
components were updated through `optidigi/design-systems` and pulled back via
the SIAB registry.

**Original status:** Active · **Layer:** multi-repo (`siab-payload` + `siab-site-template` + per-tenant sites)
**Discovered in:** Session 2026-05-18

#### Description
Today siab-payload's collection schemas + manifest + RT field assumptions implicitly model ONE site shape — the ami-care shape (Hero, FeatureList, Testimonials, FAQ, CTA, RichText, ContactSection, with specific themed nodes like the script `eyebrow`). The system technically supports multiple tenants, but every tenant is expected to render that same fixed block menu.

For SIAB as a multi-tenant CMS product, this should become first-class:
- **Different tenants → different block menus.** A consultancy site doesn't need a FAQ; a docs site needs a TableOfContents block; a portfolio site needs a Gallery + Project blocks. Each tenant should declare its block menu.
- **Different tenants → different themed nodes / RT manifests.** The `eyebrow` themed node is amicare-specific. Other tenants may want `pullQuote`, `calloutTip`, `pricingTable`, etc.
- **Different tenants → different section/anchor conventions.** Today ami-care navigation uses `#werkwijze` / `#over` etc — hardcoded section IDs in the site renderer. Each tenant should be able to declare its section taxonomy.

Today the path-of-least-resistance is "fork siab-site-template, hand-customize, hand-curate the BlockPresets seed, and treat the site as a one-off". That doesn't scale to "siab-as-a-service" where new tenants self-serve.

#### Why deferred
Phase D + ami-care prod migration filled the available bandwidth this session. This is a meaty architecture conversation that needs design before code.

#### Suggested first-pass shape (rough — to brainstorm)
1. **Tenant-declared block menu**: extend `Tenant.siteManifest` to include a `blocks: [...]` array declaring which block types this tenant exposes (must be a subset of the registry's BLOCKS list).
2. **Themed-node registry per tenant**: the manifest already supports themed-node ids; ensure the registry pattern (matchers under `src/lib/richText/themedMatchers/<tenant>/`) scales — maybe a discovery convention so new tenant matchers register without code edits in core.
3. **Section taxonomy per tenant**: site.json's `navigation` field links to anchors. Block schema should let renderers declare a per-instance `anchor` string (no more hardcoding ids in site code per OBS-55-style hack).
4. **Site template needs a "what site type is this" abstraction**: instead of forking the template per tenant, ship a small CLI / scaffolding step that takes the tenant manifest + emits the right block renderer wiring.
5. **Document the contract** in CLAUDE.md + a new runbook so future agents understand site-type-vs-tenant distinction.

#### Why this matters now
Closing out the per-tenant deploy work for amblast + siteinabox (OBS-56) will surface the gap immediately — both are different from ami-care in their block needs. The temptation is to hardcode each tenant the same way amicare is. Avoid that. Land the multi-site-type story alongside (or just before) those tenant migrations.

#### Related
- OBS-56 (sister-repo + existing-tenant updates) — the trigger for surfacing this
- OBS-54 (registry composability) — composability at the registry level enables the per-tenant flexibility at the application level
- OBS-24 (more block types + richer WYSIWYG) — overlapping concern; this entry is the structural piece, OBS-24 is content menu

---

### OBS-47 — siab-site-template: backport rich-text v2 + baseline rich-text.css (CLOSED 2026-05-19)

**Resolved by:** `siab-site-template` commits `0899365` (baseline `rich-text.css`) + `2c212ae` (RichText renderer). Future site clones now ship v2 rich-text out of the box; FE-42 text-style controls work on new sites without per-clone edits.

**Original status:** Active · **Layer:** multi-repo (siab-site-template). Filed during FE-42 design — `docs/superpowers/specs/2026-05-16-text-style-controls-design.md`. Closed during 2026-05-19 backlog audit.

---

### OBS-48 — siab-site-template: add siteManifest.example.json (CLOSED 2026-05-19)

**Resolved by:** `siab-site-template` commit `7060ca8` — *"feat: siteManifest.example.json — minimal generic example for OBS-48."* Template now ships an in-repo example of the v2 manifest contract.

**Original status:** Active · **Layer:** multi-repo (siab-site-template). Closed during 2026-05-19 backlog audit.

---

### OBS-49 — siab-payload-orchestrator: payload-seeder emits siteManifest (CLOSED 2026-05-19)

**Resolved by:** `siab-payload-orchestrator` commit `4da8347` (2026-05-18) — `.claude/agents/payload-seeder.md` Phase 4 now reads `${SITE_REPO}/siteManifest.json` (or `siteManifest.example.json` fallback) and PATCHes it onto `Tenant.siteManifest` via the Payload API after siteSettings POST succeeds. Non-fatal if both files missing — emits a WARN noting that `DEFAULT_MANIFEST` only supports paragraph + h2/h3 + bold/italic.

**Original status:** Active · **Layer:** multi-repo (siab-payload-orchestrator). Closed during 2026-05-19 backlog audit.

---

### OBS-50 — siab-site-orchestrator: auditor gate on siteManifest.json presence (CLOSED 2026-05-19)

**Resolved by:** `siab-site-orchestrator` commit `b7f61b6` — *"feat(reviewer): gate Phase 7 sign-off on siteManifest.json presence."* Converted sites now require a manifest before sign-off.

**Original status:** Active · **Layer:** multi-repo (siab-site-orchestrator). Closed during 2026-05-19 backlog audit.

---

### OBS-51 — site-amicare-zorg: rename hart-underline CSS rule to explicit class (CLOSED 2026-05-19 — superseded by FE-42)

**Resolved by:** FE-42 (2026-05-16) — the implicit `.cms-block--hero h1 .rt-i:first-of-type::after` rule was replaced by an explicit `.rt-type-highlight::after` class. Data migration applied via commit `47146d3` (marking existing hero italics with `style: "hart-underline"`) and one-shot script `migrate-hero-hart-underline.mjs` (subsequently deleted in commit `f97c6ad` once migration completed). Note: the final CSS class shipped as `.rt-type-highlight`, not `.rt-type-hart-underline` as this entry originally proposed.

**Original status:** Active · **Layer:** multi-repo (site-amicare-zorg). Closed during 2026-05-19 backlog audit after confirming `hart-underline` no longer exists anywhere in `site-amicare-zorg`.

---

### OBS-52 — Dark mode persists to the published site (CLOSED 2026-05-19 — code-complete)

**Resolved by:** Full chain wired across siab-payload + site-amicare-zorg. CMS-side: `Tenants.ts:93` accepts `{ palette, darkPalette, mode }`; `projectTenantTheme` hook calls `toCssVars(theme, ":root")` which collapses to a single `:root { ... }` ruleset when `theme.mode === "dark"` (using `darkPalette` values or `DEFAULT_DARK` fallback) and writes `/tenants/{id}/tenant-theme.css`. Site-side: `site-amicare-zorg/src/layouts/BaseLayout.astro:22-46` reads `tenant-theme.css` from `CMS_DATA_DIR` and injects it as `<style data-tenant-theme>` in `<head>`; `<body class="bg-bg text-ink">` uses Tailwind v4 semantic-token utilities generated from `@theme` block in `global.css`.

**Visual confirmation pending** — code-side complete; any leak through hard-coded color classes on `site-amicare-zorg/src/components/cms/*` would only surface on a deployed tenant with `theme: { mode: "dark" }`. Track any leaks under a fresh entry if they surface.

**Original status:** Active · **Layer:** multi-repo. Closed during 2026-05-19 backlog audit pending visual smoke.

#### Clarifier — 2026-05-19 (paired with OBS-38 close-out)
The initial close-note over-narrowed the scope to "CMS canvas". The same `:root`-collapse mechanism described above ALSO covers the **live-site half** that OBS-38 originally tracked separately. Operator confirmed visually that changing theme in the CMS toolbar propagates to the live site. The earlier "visual confirmation pending" caveat refers narrowly to ensuring no hard-coded color classes leak through specific `cms/*` block renderers — not to the wiring itself.

---

### OBS-41 — Cross-repo schema-prop drift for site-amicare-zorg CMS components (CLOSED 2026-05-19)

**Resolved by:** A cluster of 2026-05-16 commits in `site-amicare-zorg` reconciled all 7 block types (Hero, FeatureList, Testimonials, FAQ, CTA, RichText, ContactSection) with their corresponding `src/collections/blocks/*.ts` schemas in siab-payload:

- `f4f8564` — Hero pills now rendered from props instead of hardcoded `PULL_QUOTE` constant
- `5b3caf2` — Testimonials title corrected to plain string (not RtField)
- `b344ef3` — CTA eyebrow + secondary button wiring
- `dedb9d3` — Hero pills dispatcher thread + `HeroBlock` type update (the main drift fix)
- `cd3900e` — Hero `imageAlt` field wiring
- `a0b03ac` (in siab-payload) — `anchor` field rolled out across all 7 blocks; matching anchor support landed in `site-amicare-zorg` blocks at `c233e0a` – `b45d2be`

Every CMS schema field now flows through `pageToJson.ts` projection → `Blocks.astro` dispatcher → component prop → rendered output. No silent-drop fields detected.

**Per-block status after reconciliation:**
| Block | Drift? |
|---|---|
| Hero | None |
| FeatureList | None |
| Testimonials | None |
| FAQ | None |
| CTA | None |
| RichText | None |
| ContactSection | None (`submitLabel` not yet on schema, but that's OBS-42's scope, not drift) |

**Long-term concern preserved as future work:** Pushing this fix to `sitegen-template` so future tenants inherit it (currently `site-amicare-zorg`-only) belongs under OBS-56. Adding a CI check that diffs CMS block schemas against renderer props remains a discrete future improvement, not blocking.

**Original status:** Active · **Layer:** multi-repo. Filed 2026-05-16 (FE-39 round-3 item 7). Closed during 2026-05-19 backlog audit.

---

### OBS-46 — Tenant cms-editor.css is raw Tailwind v4 source, not compiled

**Resolved via:** Session 2026-05-16 (FE-39 mobile drawer + parity batch), commit `0b36297` — `loadTenantCss` now runs an `@theme {} → :root {}` pre-pass before scoping, so the existing `:root → .rt-canvas` rewrite hydrates tenant tokens into the canvas. Verified live: canvas h1 resolves to `'Fraunces Variable', Georgia, serif`; pills paint `--color-secondary: #EFE9DD`; `--color-rule` reaches `--border`. A proper compiled-bundle build (the originally-suggested fix in the tenant build pipeline) is still the cleaner long-term shape — if that ever lands, the pre-pass becomes a no-op rather than a workaround.

**Original status:** Active · **Layer:** multi-repo (sitegen-template build pipeline + siab-payload canvas)
**Discovered in:** Session 2026-05-16, FE-39 round-6 Phase 4c review
**Files:**
- `siab-payload/src/lib/editor/loadTenantCss.ts` (loader, now does the transform)
- `siab-payload/.data-out/tenants/<id>/cms-editor.css` (still raw — tenant build can clean up later)

#### Description
The tenant CSS bundle loaded into the CMS canvas (`<style data-rt-tenant-css>`) shipped as raw Tailwind v4 source. Browsers ignore `@theme { --font-serif: 'Fraunces Variable' }` directives — they only become CSS variables after Tailwind compiles them. Canvas `var(--font-serif)` resolved to nothing inside `.rt-canvas` and h1 rendered as generic ui-serif system fallback instead of the tenant's Fraunces.

---

### FE-42 — Text-style controls in editor toolbar (closed)

**Status:** Closed by branch `feat/fe39-mobile-editor-redesign` (TBD: commit SHA after merge)
**Summary:** Manifest-driven toolbar chips: font role, marks, block type, color (from palette), type-style presets (incl. special headings like hart-underline). Mobile parity above soft keyboard. Canvas fidelity fix on hero h1.
**Spec:** `docs/superpowers/specs/2026-05-16-text-style-controls-design.md`
**Plan:** `docs/superpowers/plans/2026-05-16-text-style-controls-implementation.md`
**Cross-repo follow-ups:** OBS-47, OBS-48, OBS-49, OBS-50, OBS-51

---

### OBS-45 — Bridge ThemeBar font picks (and other tokens) to live-site :root

**Resolved via:** Session 2026-05-16 (FE-39 mobile drawer + parity batch), commits `a8130b5` + `09aca1a` + `fefde07` (siab-payload) and `efe7c1c` (site-amicare-zorg). `toCssVars` gained a `scope` parameter; a new `projectTenantTheme` writer emits `tenant-theme.css` to `<DATA_DIR>/tenants/<id>/`; a Tenants `afterChange` hook calls it on theme updates; the Astro `BaseLayout` reads the file at SSR request time and inlines it after the main stylesheet. Verified live: switching the ThemeBar palette to Slate & Sky propagated `--color-accent: #3b82f6` to the live site on reload without rebuild.

**Original status:** Active · **Layer:** multi-repo (siab-payload theme pipeline + site-amicare-zorg styling)
**Discovered in:** Session 2026-05-16, FE-39 round-6 Phase 4c

#### Description
ThemeBar picks updated the canvas via the `.rt-canvas { --color-accent: … }` overlay emitted by `toCssVars`, but the live site's `:root` only had the static defaults from `global.css` — no tenant override reached the live render. Now the same `toCssVars` output, scoped at `:root` instead of `.rt-canvas`, is written to disk and consumed by the Astro layout.

---

### OBS-34 — Testimonials block: `title` type mismatch between CMS schema and site component

**Resolved via:** site-amicare-zorg branch `feat/cms-editor-css` commit (Phase B nit 4 — Testimonials title type aligned to plain string in renderer + types).

**Original status:** Active · **Layer:** multi-repo (`siab-payload` + `sitegen-template`)
**Discovered in:** Session 2026-05-14 (canvas renderer C8 implementation)
**Files:** `src/blocks/Testimonials.ts` (this repo), `site-amicare-zorg/src/components/cms/Testimonials.tsx`

#### Description
The CMS block schema (`Testimonials.ts`) declares `title` as `type: "text"` — a plain string. The rendered-site component in `site-amicare-zorg` typed it as `RtField` and rendered it via `RtNodeRenderer`, expecting a structured rich-text JSON value. This is a type contract mismatch: the database stores a plain string but the renderer tries to walk it as an Rt node tree.

The canvas renderer (C8) was built to match the block schema (plain text, `ClickToEditField`) — this is the correct source of truth for what is actually persisted.

Also noted: the site component reads `item.avatarUrl` (a resolved URL string) but the block stores `item.avatar` as a Payload upload relation. `InlineImage.resolveUrl` handles this correctly on the canvas side; the sitegen-template component's `avatarUrl` prop resolution should be verified to confirm it is already handled by projection (projection may already resolve the URL before writing `site.json` — confirm and document).

---

### FE-40 — Page duplication action
**Resolved via:** Won't do — feature removed from mobile UX per FE-39 round-2 user feedback (Session 2026-05-16). Mobile overview no longer offers a "Duplicate page" row. If a duplicate-page action is needed in the future, file a fresh FE-N entry with the relevant context.

#### Description
The FE-39 mobile redesign spec assumed a working "Duplicate page" action; it does not exist in the codebase today. PageForm has `duplicateBlock` (block-level) but no page-level duplicate. The FE-39 mobile overview no longer offers a duplicate-page row; if that action returns, it should use the shared status badge provider for any temporary unavailable-state feedback.

#### Suggested fix shape
1. Decide deep-copy semantics — drop the page id + slug (suffix with `-copy` or prompt), keep blocks + SEO. Strip block ids so Payload regenerates them.
2. Add a `duplicatePage` server action in `src/lib/actions/duplicatePage.ts` that takes `pageId`, authenticates the caller, and creates a new page in the same tenant via the Payload Local API with `user: caller`.
3. Wire the action into `PageForm` (desktop danger zone / future "more actions" menu) and any future mobile "Duplicate page" row.
4. Test: unit test for the action (forbidden if no caller; correct tenant scope; id-strip), Playwright smoke (duplicate from mobile row → redirect to new page edit URL).

### FE-38 — Mobile section cards should signal completeness state
*(Superseded — reopened above. Original implementation rolled back in FE-39 round-2 batch 1.)*

### FE-32 — Mobile path bypasses selection-remap wrappers
**Resolved via:** FE-39 mobile redesign — `src/components/editor/canvas/CanvasMobile.tsx`, `mobile/SectionList.tsx`, `mobile/SectionEdit.tsx`. The mobile path now receives `reorderBlocks` / `deleteBlock` / `duplicateBlock` as props from `PageForm` (the `*WithRemap` variants), threaded through `CanvasMode → CanvasMobile`. The raw `useCanvasBlocks` mutators are no longer called from mobile code. Selection state stays coherent after mobile block mutations.

### FE-3 — Unsaved changes badge — poor UI
**Resolved via:** SaveStatusBar redesign · `src/components/editor/SaveStatusBar.tsx:97–122`
The dirty-state indicator now uses the registry `Badge` primitive (the exact suggested fix shape) — an amber-toned `Badge variant="outline"` with `AlertCircle` icon, integrated into the editor chrome. User confirmed (backlog audit 2026-05-16) the integration is acceptable.

### FE-9 — Mobile page editor — separate views per section
**Resolved via:** Mobile editor rewrite — `src/components/editor/canvas/mobile/SectionList.tsx`, `SectionEdit.tsx`, `BottomSheet.tsx`
The three navigable views are in place: section-list landing (cards), per-section drill-down (`MobileSectionEdit`), and page title/slug in the sticky header (`PageMetaInline`). SEO and Danger Zone render at the bottom of the section list. The remaining "incomplete cards should signal state" requirement is carried forward as FE-38.

### FE-17 — InsertSlot "+ Add" affordance too prominent on mobile page editor
**Resolved via:** 2-view editor rewrite (commit `8302215`) — `InsertSlot.tsx` deleted
The legacy editor that drew dark "+ Add" pills between blocks on mobile no longer exists. The new mobile path renders a single, full-width outline `Add section` button at the bottom of the section list (`MobileSectionList.tsx`), not inter-block chips. The described symptom is structurally impossible in the current code.

### FE-18 — Block cards should expand on full-card click, not only the chevron
**Resolved via:** 2-view editor rewrite (commit `8302215`) — `BlockListItem.tsx` deleted; new `BlockListRow` in `SidebarDrillDown.tsx:200–269`
The new desktop sidebar `BlockListRow` is fully clickable with `role="button"`, `tabIndex={0}`, Enter/Space keyboard handling, and `e.stopPropagation()` on the grip handle so dragging doesn't double as a navigate. Mobile `SortableSectionCard` follows the same pattern. The chevron-only expand semantics that motivated FE-18 no longer exist.

### FE-19 — Expand-all / Collapse-all button should align with the "Blocks" section header
**Resolved via:** 2-view editor rewrite — `BlockEditor.tsx` deleted; expand-all/collapse-all toolbar removed entirely
Zero references to `setAllOpen` / `allOpen` / `openMap` / "Expand all" remain in `src/`. The "Blocks" section header is also gone — `SidebarDrillDown` uses "Page" instead. The alignment target the entry described is no longer reachable; the concern is superseded.

### FE-21 — Animate currently-instant transitions using existing shadcn / tw-animate-css utilities
**Resolved via:** 2-view editor rewrite + SidebarDrillDown animation
Both enumerated targets are gone: block expand/collapse (`BlockListItem.tsx` deleted) and preview overlay (`previewMode` no longer referenced anywhere in `src/`). The surviving sidebar state transitions are already animated via `tw-animate-css` (`animate-in slide-in-from-right-3 duration-150`) in `SidebarDrillDown.tsx:190`. The "other instant-toggle surfaces" catch-all is too generic to ground a defined item; if specific surfaces are still problematic, they warrant new entries.

### FE-36 — Sidebar aside `h-full` chain relies on `max-height` without explicit `height`
**Resolved via:** R6 Task 2 (commit `ac7a9f6`) · `src/components/forms/PageForm.tsx`
Added `height: "calc(100dvh - 10.125rem)"` alongside the existing `maxHeight` so the inner `flex h-full flex-col` chain resolves against an authoritative parent height. The inner `flex-1 overflow-y-auto` body now correctly scrolls when content overflows (e.g. Hero block inspector).

### FE-28 — `<h2>` heading nesting in sidebar view
**Resolved via:** Round 3 SidebarDrillDown rewrite (Task 18, commit `4c1bf60`) · `src/components/editor/canvas/sidebar/SidebarDrillDown.tsx`
The new drill-down panel has a single `<h2>` ("Page") at the list state; State 2 and State 1b use a small `<span>` label, not a heading. No duplicate-rank siblings remain in the sidebar panel.

### FE-29 — Lexical toolbar is not sticky inside the 45vh-capped pinned inspector
**Resolved via:** Round 3 SidebarDrillDown rewrite (Task 18, commit `4c1bf60`) · `src/components/editor/canvas/sidebar/BlockFormFields.tsx`
The 45vh-capped pinned inspector slot is gone — BlockFormFields renders inside the drill-down's `flex-1 overflow-y-auto` body region, with full available height. Lexical's own toolbar still scrolls with its content, but is no longer constrained to a sub-region.

### FE-31 — Pill canvas `elementPath` vs tree "Label" sub-field path mismatch
**Resolved via:** Round 3 SidebarDrillDown rewrite (Task 18, commit `4c1bf60`) · `src/components/editor/canvas/sidebar/SidebarDrillDown.tsx`
The tree's "Label" sub-field row no longer exists — the new flat drill-down model has no sub-leaf row to misalign with. Canvas pill clicks select the block, which the drill-down then opens in State 2.

### FE-CLOSED-1 — Remove counter from save button
**Resolved via:** GitHub #1 (closed 2026-05-10) · `src/components/editor/PublishControls.tsx`

### FE-CLOSED-2 — Different icon when blocks list is empty
**Resolved via:** GitHub #3 (closed 2026-05-07) · `src/components/editor/BlockEditor.tsx`

### FE-CLOSED-3 — Dark mode for generated websites
**Resolved via:** GitHub #6 (closed 2026-05-08) · `sitegen-template` repo

### FE-CLOSED-4 — Prettier login screen with logo (shadcn login-04)
**Resolved via:** GitHub #9 (closed 2026-05-10) · `src/app/(frontend)/login/`

### FE-CLOSED-5 — Mobile "..." button placement on list rows
**Resolved via:** GitHub #10 (closed 2026-05-10) · `src/components/data-table.tsx`

### FE-CLOSED-6 — Settings tab icons too small
**Resolved via:** GitHub #11 (closed 2026-05-10) · `src/app/(frontend)/(admin)/settings/`

### FE-CLOSED-7 — Tenant name badge awkward position in page editor
**Resolved via:** GitHub #12 (closed 2026-05-10) · `src/components/editor/PageMetaInline.tsx`

### FE-CLOSED-8 — Block type name/content not centered in block card
**Resolved via:** GitHub #14 (closed 2026-05-10) · `src/components/editor/BlockListItem.tsx`

### FE-CLOSED-9 — Activity feed horizontal overflow on dashboard
**Resolved via:** GitHub #15 (closed 2026-05-10) · `src/components/dashboard/ActivityFeed.tsx`

### FE-CLOSED-10 — Cards on mobile slightly too wide
**Resolved via:** GitHub #16 (closed 2026-05-10) · layout

### FE-CLOSED-11 — Media library — select all images
**Resolved via:** GitHub #18 (closed 2026-05-10) · `src/app/(frontend)/(admin)/sites/[slug]/media/`

### FE-CLOSED-12 — Blocks collapsed by default in page editor
**Resolved via:** branch `feat/editor-visual-pass-fe1-fe4-fe8` · commit `79f301a` (FE-1) · `src/components/editor/BlockListItem.tsx`, `src/components/editor/BlockEditor.tsx`

### FE-CLOSED-13 — Add block button visual distinction
**Resolved via:** branch `feat/editor-visual-pass-fe1-fe4-fe8` · commit `bf75921` (FE-4) · `src/components/editor/BlockEditor.tsx`

### FE-CLOSED-14 — Block cards visual contrast from background
**Resolved via:** branch `feat/editor-visual-pass-fe1-fe4-fe8` · commit `fb6597c` (FE-8) · `src/components/editor/BlockListItem.tsx`

### FE-CLOSED-15 — Block-card theme-aware outline
**Resolved via:** branch `feat/editor-visual-pass-fe1-fe4-fe8` · commit `63edcb0` (FE-13, bundled mid-flight after smoke) · `src/components/editor/BlockListItem.tsx`

### FE-CLOSED-16 — Media page empty state lacks an icon
**Resolved via:** branch `fix/fe-14-media-empty-state-icon` · commit `ab743c6` (FE-14) · `src/components/media/MediaGrid.tsx`

### FE-CLOSED-17 — Toolbar Expand/Collapse-all label tracks actual block states
**Resolved via:** branch `feat/editor-polish-fe11-12-15-16` · commit `059006b` (FE-11) · `src/components/editor/BlockEditor.tsx`, `src/components/editor/BlockListItem.tsx`

### FE-CLOSED-18 — Preview-toggle Button is a labeled chip with native shadcn hover
**Resolved via:** branch `feat/editor-polish-fe11-12-15-16` · commit `f3bf776` (FE-12, evolved through smoke iterations to binary "Preview"/"Close preview" Button) · `src/components/editor/SaveStatusBar.tsx`

### FE-CLOSED-19 — Block-card outline upgraded to a subtle theme-aware ring
**Resolved via:** branch `feat/editor-polish-fe11-12-15-16` · commit `02eb65f` (FE-15, evolved through smoke iterations to `ring-2 ring-muted-foreground/50` because the registry's unlayered `*` rule in globals.css blocks `border-*-color` utilities — see OBS-30) · `src/components/editor/BlockListItem.tsx`

### FE-CLOSED-20 — Collapsed-block bottom-corner radius bug
**Resolved via:** branch `feat/editor-polish-fe11-12-15-16` · commit `687acc7` (FE-16, folded into FE-15 via `overflow-hidden`) · `src/components/editor/BlockListItem.tsx`
