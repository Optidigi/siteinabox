# Security Backlog

Canonical source of truth for security findings, vulnerability observations, and access-control gaps surfaced during audits, PR reviews, or adversarial review passes.

## How this file is used

- IDs use the `OBS-N` scheme inherited from the 2026-05 audit cycle. New security items continue the same sequence (current high water mark: OBS-128 across all backlog files — next OBS = OBS-129).
- **Status tiers:** Active (real, deferred), Latent (not exploitable today — trigger documented), Audit-deferred (explicitly punted per audit text), Closed (resolved).
- **When a trigger condition fires**, promote the item immediately to a fix batch. Do not defer further.
- **When a PR touches a Payload auth feature** (`useAPIKey`, `verify`, `loginWithUsername`, etc.), check the Doctrine section below and audit auto-injected fields the same day.

Cross-reference: product features at `../features/README.md`, infra items at `../infra/README.md`.

The full audit cycle's working artifacts (threat model, batch reports, adversarial-review verdicts) live at `~/Desktop/env/siab-payload-fixer/audits/`. Per-batch reports reference these `OBS-N` IDs — do not renumber.

---

## Active

### OBS-128 — Public CMS magic-link metadata selected privileged mail templates

**Status:** Closed 2026-07-13.
**Discovered in:** production mail-route invocation review
**Files:** `src/lib/betterAuth.ts`, `src/lib/auth/privilegedMagicLinkMetadata.ts`, `src/lib/auth/sendCmsMagicLinkEmail.ts`

#### Description
The public Better Auth magic-link endpoint forwarded caller-controlled metadata
to the CMS mail dispatcher. An anonymous caller could name `user_invite` or
`site_live_handoff` and select privileged message content for an existing CMS
user without going through the authorized invitation or activation workflows.

#### Resolution
Privileged CMS magic-link metadata is now signed server-side with a
domain-separated HMAC derived from the configured Better Auth/Payload secret.
The envelope is purpose- and claim-bound, expires after 60 seconds, and binds
the normalized recipient plus target admin origin. The dispatcher uses a
timing-safe signature comparison and rejects unsigned, expired, tampered,
cross-recipient, or cross-origin privileged metadata before rendering or
sending privileged content. Ordinary unsigned login metadata continues through
the generic `auth.magic_link` template. The signed envelope is a short-lived
internal bearer between the server action and Better Auth; it is not returned
to the browser or written to mail logs.

#### Validation
Execution tests cover valid internal invitation and live-handoff delivery,
unsigned public metadata, claim and purpose tampering, expiry, recipient/origin
rebinding, and the ordinary public magic-link fallback.

### OBS-127 — Public preview metadata could select privileged site-ready mail

**Status:** Closed 2026-07-13.
**Discovered in:** outbound mail route audit
**Files:** `src/lib/preview/betterAuth.ts`, `src/lib/actions/previewAccess.ts`

#### Description
Preview Better Auth selected the operator-only `preview.site_ready` template
from a caller-controlled `metadata.previewSiteReady` boolean. A public caller
with an active preview grant could forge that metadata through the Better Auth
endpoint and receive the privileged site-ready message instead of the ordinary
preview login message.

#### Resolution
The super-admin preview-send action now attaches a five-minute HMAC
authorization bound to the normalized recipient email, preview client slug,
expiry, and intent version. Preview Better Auth selects the site-ready template
and `preview.site_ready` intent only when that authorization verifies with the
server-held preview/auth secret. Missing, forged, expired, or recipient- or
preview-rebound metadata falls back to the ordinary `preview.magic_link`
template after the existing active-grant check. Cloudflare `sendEmail` remains
the only delivery path.

Focused tests cover the authorized operator path plus unsigned, forged,
expired, recipient-rebound, and preview-rebound metadata.

### OBS-126 — Untrusted mail template/header interpolation

**Status:** Closed 2026-07-13.
**Discovered in:** outbound mail route audit
**Files:** `src/lib/email/templates/*`, `src/lib/contact/platformContact.ts`,
`src/lib/intake/storeIntakeSubmission.ts`, `src/collections/Forms.ts`

#### Description
Magic-link and preview-ready URLs were interpolated into HTML without escaping,
and dynamic contact, intake, and generated-form subject fragments could retain
line/control characters. Several active transactional templates also lacked a
plain-text alternative.

#### Resolution
Shared helpers now escape email HTML and normalize dynamic header fragments to
one control-character-free line. Active magic-link and preview-ready templates
emit escaped HTML plus plain text; privacy exports now include plain text; and
contact, intake, and form-notification subjects normalize untrusted fragments.
Focused tests cover HTML metacharacters, query-string ampersands, header control
characters, and HTML/text parity.

### OBS-124 — Auth completion leaked internal redirect origins

**Status:** Closed 2026-07-02.
**Discovered in:** production magic-link login verification
**File:** `src/app/api/siab-auth/complete/route.ts`

#### Description
The Better Auth magic-link route normalized incoming requests to the trusted
public admin host, but the SIAB completion bridge still built redirect targets
from `req.url`. Behind Traefik/Next this could expose container-local origins
such as `0.0.0.0:3000` or loopback hosts in the final browser redirect after a
magic-link click.

#### Resolution — 2026-07-02
Closed. The completion bridge now uses the same Payload-backed host gate and
public request normalization as `/api/auth/[...all]` before reading the Better
Auth session, minting the Payload session cookie, or redirecting. Regression
coverage verifies platform admin, current tenant admin, future
`admin.{tenantdomain}` hosts, internal-origin forwarded requests, and unknown
host rejection before session lookup.

### OBS-125 — User team role controls and unsafe user deletion

**Status:** Closed 2026-07-02.
**Discovered in:** owner team management review
**File:** `src/collections/Users.ts`

#### Description
Owners could see role and tenant controls on user edit pages, but field-level
access still stripped those fields on update because only super-admins were
allowed to mutate `role` and `tenants`. User deletion was also too broad for
owners and did not explicitly block self-delete or deleting the final
super-admin account.

#### Resolution — 2026-07-02
Closed. Owner role/tenant updates now pass only when the resulting user remains
`owner`, `editor`, or `viewer` with exactly one tenant matching the owner's own
tenant. Super-admin users still have zero tenants. Owner delete access is scoped
to users in the owner's tenant, and a before-delete hook blocks self-delete plus
deletion of the last remaining super-admin. The users/team UI now hides
self-delete actions and constrains owner tenant choices to the owner's tenant.
Focused tests cover the owner update gate and deletion safety.

### OBS-33 — CSP `style-src 'unsafe-inline'` removed

**Status:** Closed 2026-06-03.
**Discovered in:** OBS-18 narrowed during rich text v2 Phase 1 (2026-05-13)
**File:** `src/proxy.ts`

#### Description
Phase 1 closed `script-src` to nonces but kept `style-src 'unsafe-inline'` because Tailwind v4 still emits runtime style elements without a build-time consolidation pass. T9 (stored XSS) impact via styles alone is bounded by browser style isolation but `style-src 'unsafe-inline'` does enable some attribute-style attacks.

#### Suggested fix shape
1. Audit whether Tailwind v4 can run in build-time-only mode for the admin (no runtime style emission).
2. If yes: add nonce to `style-src` per the same mechanism used for `script-src` in OBS-1's resolution.
3. If no: track upstream Tailwind progress; revisit when build-time-only becomes viable.

#### Update — 2026-05-22
Batch 8 audit confirmed this still cannot be safely closed. In addition to Tailwind/runtime style emission, the current admin uses React `style` attributes for layout and token plumbing (for example fixed chrome sizing and canvas/editor positioning). CSP nonces authorize `<style nonce>` elements, not arbitrary `style=""` attributes, so replacing `'unsafe-inline'` with a nonce-only `style-src` would break current UI rendering. Keep active until those inline style dependencies are removed or replaced with class/token plumbing and verified in browser.

#### Current verification — 2026-05-28
Still current. `src/middleware.ts` emits
`style-src 'self' 'unsafe-inline'`, and the admin/canvas still contains
runtime inline style usage for layout, token plumbing, tenant CSS/theme
injection, and editor positioning. Do not close this until a browser-verified
nonce/class-only style path exists.

#### Current verification — 2026-06-03
Still active and not safely closable in this batch. The CSP source is now
`src/proxy.ts` rather than the older `src/middleware.ts` path, and it still
emits `style-src 'self' 'unsafe-inline'`.

Repo audit found then-current inline-style dependencies in app-owned
editor/canvas code including `LexicalField`, `InlineImage`, `RtStaticView`,
site chrome preview, in-process canvas mode, canvas chrome gutter overlay,
`PageForm`, `NavEntryRow`, and `status-feedback`. The registry-owned
`src/components/ui/*` tree also still contains inline styles and runtime
`<style>` injection for
canvas/theme/chart/mobile toolbar behavior. CSP nonces can authorize `<style>`
elements, but they do not authorize `style=""` attributes; removing
`'unsafe-inline'` now would break current admin rendering.

Do not close OBS-33 until inline style attributes and runtime style-tag
dependencies are replaced with class/token plumbing or nonce-bearing style
elements, including the registry-owned primitives via `optidigi/design-systems`,
then browser-verified under a nonce-only `style-src`.

#### Implementation progress — 2026-06-03
Started the nonce-capable style path without tightening CSP yet. The frontend
layout exposes the request nonce through an app-level client provider, and the
app-owned desktop canvas style tags for scoped tenant CSS (`data-rt-tenant-css`)
and live theme overrides (`data-rt-theme-overrides`) now render with that nonce.

This is intentionally additive and does not alter tenant `siteManifest.cssEntry`,
the `loadTenantCss` scoping/rewrite pipeline, tenant site CSS imports, or
public-site cloning/projection behavior. OBS-33 remains active because React
`style=""` attributes still exist in app-owned surfaces and registry-owned
`src/components/ui/*` primitives; CSP nonces do not authorize those attributes.
`src/proxy.ts` therefore keeps `style-src 'self' 'unsafe-inline'` for now; adding
a nonce source to `style-src` before the inline-style cleanup can make modern
browsers ignore `'unsafe-inline'` and break the current admin. The next
implementation slices must remove/replace inline style attributes and route
registry-owned fixes through `optidigi/design-systems` before switching
`style-src` to nonce-only.

Same-session follow-up removed several finite app-owned inline style attributes
without changing tenant CSS imports or manifest behavior: read-only bare
Lexical surfaces now use pointer/select utility classes; read-only rich-text
paragraph/heading alignment now uses text alignment classes; empty inline icon
placeholders now use a fixed size class; the ThemeBar sticky offset and desktop
sidebar initial sizing now use class-based values; and the global status
feedback badge now uses finite sidebar-offset classes. Dynamic coordinates,
drag transforms, measured sidebar height writes, image background URLs,
manifest-driven font previews, and registry-owned primitives remain open.

Second same-session follow-up added a nonce-backed runtime style helper for
app-owned unbounded fixed-position geometry. Canvas gap overlays, block context
menus, block gutter chrome, inline image chrome, site-chrome action menus, and
the site-chrome quick menu now place `left` / `top` / `width` through generated
CSS rules in nonce-bearing `<style data-siab-csp-style>` tags instead of React
`style=""` attributes. At that point, DnD transforms, measured sidebar height
writes, image/background style passthroughs, manifest-driven font previews,
navigation sortable transforms, and registry-owned primitives remained open.

Third same-session follow-up used the same nonce-backed helper for app-owned
sortable transforms in the desktop canvas block wrapper and navigation row
wrapper. Runtime transform/transition values are filtered before becoming CSS
declarations, and drag opacity now uses utility classes. Remaining app-owned
inline style attributes are intentionally tied to media/background passthroughs,
manifest-driven font previews, and generic rich-text/site style passthroughs;
registry-owned sortable/mobile primitives still need the design-system route.

Fourth same-session follow-up removed the remaining app-owned `style=""`
attributes outside `src/components/ui/*`. `InlineImage` and `RtSlot` no longer
accept generic React style passthroughs; the dormant `InlineImage as="div"`
background-image path now uses escaped URLs in nonce-backed generated CSS; and
`RtStaticView` now renders font spans as class-only to match the live/template
`RtNodeRenderer` DOM. The app-owned scan outside registry primitives now only
finds the helper's nonce-bearing `<style data-siab-csp-style>` element. OBS-33
still cannot close until registry-owned primitives are updated through
`optidigi/design-systems`, pulled back into this repo, and browser-verified
under nonce-only `style-src`.

#### Resolution — 2026-06-03
Closed. Registry-owned primitives were updated through
`optidigi/design-systems`, rebuilt, and pulled into this repo through the SIAB
registry path. The remaining `src/components/ui/*` inline style attributes in
`sidebar`, `color-chip`, and `mobile-floating-pill` were replaced by utility
classes or nonce-backed generated CSS rules.

`src/proxy.ts` now emits `style-src 'self' 'nonce-<request nonce>'` in
production/test and no longer ships `style-src 'unsafe-inline'` there. Local
development keeps a documented `style-src 'unsafe-inline'` exception because
Next devtools injects diagnostic style elements that cannot receive the request
nonce. Static source scan across `src/components`, `src/app`, `src/lib`, and
`src/hooks` finds no React `style=""` attributes; the only source match is the
shared helper's nonce-bearing `<style data-siab-csp-style>` element. Tenant CSS
imports, `siteManifest.cssEntry`, `loadTenantCss`, and canvas
cloning/projection remain unchanged; tenant/theme runtime CSS is still emitted
through scoped `<style>` tags, now with the request nonce.

#### Follow-up — 2026-06-03
Operator mobile testing exposed a production-CSP dependency missed by the
closure scan: Vaul injects its drawer stylesheet at runtime without the request
nonce. The strict `style-src` remains correct, but the registry-owned mobile
inspector now carries the required bottom-sheet snap mechanics in a
nonce-bearing component `<style data-mobile-inspector-vaul-css>` tag instead of
depending on Vaul's blocked runtime injection. No `style-src 'unsafe-inline'`
exception was restored.

#### Follow-up — 2026-06-07
Production analytics reload testing exposed a second CSP compatibility gap:
Recharts `ResponsiveContainer` server-renders inline `style=""` attributes for
its responsive wrapper (`width`, `height`, `min-width`, inner overflow shim, and
initial chart wrapper dimensions). Those attributes are blocked by the
nonce-only production `style-src`, and React hydration does not reliably
reapply them on hard reload because the server/client props already match. This
made some analytics/dashboard charts disappear or retain narrow initial sizing
until client-side navigation remounted them.

The production CSP remains nonce-only. App-owned analytics/dashboard chart
surfaces now use a client-only wrapper around the registry `ChartContainer`,
so Recharts is not emitted into SSR HTML and no blocked Recharts inline style
attributes are present on hard reload. A regression test verifies the wrapper
SSR output contains only the fixed-size placeholder and no
`recharts-responsive-container` or `style=` markup.

---

### OBS-11 — hCaptcha / Turnstile on public form

**Status:** Closed 2026-06-03.
**Discovered in:** 2026-05 audit cycle
**T-ID:** T4

#### Description
Audit finding #5's third sub-fix (bot protection on the public form widget) was
explicitly deferred until the v1 contact form landed. That trigger fired when
public site rendering and the CMS canvas `ContactSection` both emitted forms
posting to `/api/forms`. The Forms collection has anonymous create access with
middleware rate limiting and a 32 KB payload cap, but no hCaptcha / Turnstile
token validation exists yet.

#### Suggested fix shape
Add hCaptcha or Cloudflare Turnstile token validation for public form
submissions where the tenant site ships that protection. This is a site-owned
capability, not a CMS-managed setting: do not add CMS UI or tenant-editable
captcha configuration. Server-side validation still needs to happen before a
row is accepted, either in the CMS form endpoint using static/environment
configuration for the deployed site path, or in a site-owned submission proxy
that only forwards verified submissions to the CMS. Combined with P1 #5's
existing rate-limit + 32 KB cap, this closes T4 for protected public form
submissions.

#### Product decision — 2026-06-03
hCaptcha / Turnstile is not managed from the CMS. If a generated or custom site
uses bot protection for forms, that site owns the integration and configuration;
the CMS should not expose controls to enable, disable, or configure it.

#### Resolution — 2026-06-03
Closed by operator decision. Bot protection for public forms is outside the CMS
product surface: sites that need hCaptcha / Turnstile own that integration and
configuration directly. No `siab-payload` CMS settings UI or tenant-managed
captcha feature should be added for this item.

#### Current state
OBS-11 is not implemented. A Turnstile/forms batch was attempted on
2026-05-26, then reverted before acceptance because the public form routing and
tenant resolution path was not stable enough to keep. The rollback commits are:

- CMS app: `0d573e0 revert: undo public forms turnstile batch`
- Previous Amicare site app: `ea1185e revert: undo turnstile form batch`
- Previous site template package: `6210245 revert: undo turnstile form batch`

The current stable runtime remains the pre-batch behavior: anonymous public
forms still have the existing middleware rate limit, bogus-auth rejection, and
32 KB `Forms.data` cap, but no hCaptcha / Turnstile server-side token
validation.

#### Current verification — 2026-05-28
Still current. Repo search found no hCaptcha/Turnstile token verification path.
The middleware rate limiter still covers anonymous `POST /api/forms` and
`POST /api/users/forgot-password`, and the existing form payload-size tests
still document the 32 KB cap, but bot-token validation remains absent.

#### Update — 2026-07-01
The anonymous public POST limiter now also covers `POST /api/intake`.
Generated-site forms also have a second anonymous limiter keyed by tenant/form
target. Bot-token validation remains absent by product decision for the CMS
surface.

#### Update — 2026-07-02
The anonymous public POST limiter now also covers `POST /api/contact` for the
platform marketing contact route.

#### Rollback validation
Rollback verification passed on 2026-05-26:

- CMS app: `pnpm typecheck`, CI, and build-image smoke-start passed.
- Previous Amicare site app: `pnpm astro check`, `pnpm build`, and image
  publish passed with existing baseline hints only.
- Previous site template package: `pnpm exec astro check`, `pnpm build`, and
  image publish passed with existing baseline hints only.
- Production health passed for `https://admin.siteinabox.nl/api/health` and
  `https://ami-care.nl/healthz`.

---

### OBS-90 — Media filename traversal can write/delete outside tenant media directory

**Status:** Closed 2026-06-03.
**Discovered in:** 2026-05-28 static CMS security audit.
**Severity:** High.
**Audit ID:** AUDIT-20260528-1.
**Files:** `src/collections/Media.ts`, `src/hooks/ensureUniqueTenantFilename.ts`, `src/hooks/projectToDisk.ts`, `src/hooks/deleteFileFromDisk.ts`.

#### Description
An authenticated editor or owner who can update or delete media for their tenant
can set a crafted `media.filename` containing path separators or dot segments.
`ensureUniqueTenantFilename` checks same-tenant filename uniqueness but does not
reject traversal syntax. Projection and deletion paths then join the untrusted
filename under tenant media or staging directories:

- `projectToDisk.ts` joins `_uploads-tmp/<filename>` and
  `tenants/<tenantId>/media/<filename>`.
- `deleteFileFromDisk.ts` joins the same tenant media and staging paths before
  `fs.rm`.

This can turn an otherwise tenant-local media update/delete into a filesystem
boundary bypass, for example deleting a sibling tenant's projected file if the
process user has filesystem permissions.

#### Suggested fix shape
Add a central media filename guard before create/update and before any disk
operation. Reject `/`, `\`, NUL, absolute paths, empty names, and dot segments.
For defense in depth, resolve final staging/media paths and assert they remain
under the expected tenant directory before write/copy/delete.

#### Verification
Add focused unit tests around `deleteMediaFile` and media projection with a temp
`DATA_DIR`, including filenames such as `../manifest.json`,
`../../2/site.json`, and `nested/file.png`. Assert no file outside the expected
tenant media directory is touched.

#### Resolution — 2026-06-03
Added a central `mediaFilename` guard used by `ensureUniqueTenantFilename`,
`projectMediaToDisk`, and `deleteMediaFile`. Media filenames now reject empty
names, `/`, `\`, NUL bytes, absolute paths, and dot-segment/path-segment forms
before create/update validation continues.

Projection and delete hooks now perform defense-in-depth checks before touching
disk: unsafe stored filenames are logged and skipped, and valid filenames are
resolved under the expected tenant media or staging directory before write,
copy, delete, or manifest update work proceeds.

#### Validation — 2026-06-03
Added `tests/unit/mediaFilenameTraversal.test.ts` with temp `DATA_DIR` coverage
for `../manifest.json`, `../../2/site.json`, `nested/file.png`,
`nested\file.png`, dot segments, empty names, absolute paths, and NUL bytes.
The suite asserts unsafe names are blocked before the uniqueness query and that
projection/delete hooks leave sentinel files outside the allowed media filename
surface untouched. Existing per-tenant filename uniqueness coverage was also
rerun.

#### Dynamic verification — 2026-05-28
Confirmed with a temp-only local harness that imported the real
`deleteMediaFile` and `projectMediaToDisk` hooks. With
`DATA_DIR=/tmp/siab-obs90-*`, a media doc filename of `../site.json` caused
`deleteMediaFile` to remove `tenants/1/site.json`, and caused
`projectMediaToDisk` to overwrite `tenants/1/site.json` with the upload buffer.
No production data or repo data was touched.

#### Current verification — 2026-05-28
Still current after backlog re-audit. `deleteMediaFile` and
`projectMediaToDisk` still join `doc.filename` into tenant/staging paths without
a path-segment guard or resolved-path containment assertion. The authenticated
serving route has its own containment check, but the write/delete hooks remain
the vulnerable surface.

#### Notes
Related to OBS-17's media isolation lineage, but not covered by that resolved
item because OBS-17 addressed cross-tenant filename collision and authenticated
serving, not filename path containment.

---

### OBS-91 — Public tenant-assets route exposes projected tenant files and media

**Status:** Closed 2026-06-03.
**Discovered in:** 2026-05-28 static CMS security audit.
**Severity:** High.
**Audit ID:** AUDIT-20260528-2.
**Files:** `src/app/(payload)/api/tenant-assets/[tenantId]/[...path]/route.ts`, `src/hooks/projectToDisk.ts`, `src/hooks/tenantLifecycle.ts`.

#### Description
The public `tenant-assets` route was introduced for CMS canvas asset loading,
but it currently serves any file under `DATA_DIR/tenants/<tenantId>` after only a
tenant-root containment check. That includes `manifest.json`, `site.json`,
`pages/*.json`, and `media/*` in addition to intended editor assets such as
fonts or CSS.

Anonymous users who know or guess a numeric tenant id can fetch projected tenant
content and media. Because the manifest also includes media entries, the route
can reveal media keys and bypass the authenticated `/api/tenant-media/...`
serving path.

#### Suggested fix shape
Narrow the route to an explicit allowlist for the editor asset surface, such as
`files/*` and any required `cms-editor.css` path. Block `manifest.json`,
`site.json`, `pages/*`, `media/*`, and unknown tenant-root files. Keep CORS and
long-lived cache headers only for the allowlisted asset paths that require them.

#### Verification
Add route-level tests using a temp tenant directory. Assert allowed font/CSS
paths are served, while `manifest.json`, `site.json`, `pages/home.json`, and
`media/example.png` return 404 or 403.

#### Dynamic verification — 2026-05-28
Confirmed with a temp tenant data dir and the local Next dev server. Anonymous
GETs returned 200 for intended editor assets
`/api/tenant-assets/77/files/font.woff2` and
`/api/tenant-assets/77/cms-editor.css`, but also returned 200 for
`/api/tenant-assets/77/manifest.json`, `/site.json`, `/pages/home.json`, and
`/media/secret.png`. The exposed responses carried public immutable caching and
`Access-Control-Allow-Origin: *`.

Local DB-backed comparison against `/api/tenant-media/...` could not be
completed in that environment because Postgres was not running and Docker was
not installed; the tenant-assets exposure itself is DB-free and reproducible.

#### Current verification — 2026-05-28
Still current. The route still accepts any resolved path under
`DATA_DIR/tenants/<tenantId>` and returns it with public immutable cache headers
and permissive CORS. There is no allowlist restricting the route to
`files/*`/`cms-editor.css`.

#### Resolution — 2026-06-03
Closed by narrowing the public route to the intended editor asset surface only:
`cms-editor.css` at the tenant root and files under `files/*`. Unknown
tenant-root paths such as `manifest.json`, `site.json`, `pages/*`, `media/*`,
and `tenant-theme.css` now return 404 before disk read. Unsafe path segments
including empty, dot, dot-dot, backslash, and NUL are rejected before the
existing resolved-path containment check runs.

#### Validation
Added focused unit coverage for the route with a temp tenant data directory.
Tests prove `cms-editor.css` and `files/font.woff2` are served, projected data
and media paths return 404, unsafe `files/../...` style paths return 403,
missing allowed files return 404, and non-numeric tenant ids return 400.

#### Notes
This is related to infra OBS-35 and closed security OBS-17, but neither item
tracks the over-broad public tenant-root serving behavior.

---

### OBS-92 — Nested rich-text fields bypass RtRoot validation

**Status:** Closed 2026-06-03.
**Discovered in:** 2026-05-28 static CMS security audit.
**Severity:** High.
**Audit ID:** AUDIT-20260528-3.
**Files:** `src/hooks/validateRichTextOnSave.ts`, `src/blocks/FeatureList.ts`, `src/blocks/FAQ.ts`, `src/components/editor/canvas/inline/RtStaticView.tsx`.

#### Description
The rich-text save hook validates top-level block fields listed by the
block/field manifest, but it does not recurse into nested arrays. Blocks such as
`featureList.features[]` and `faq.items[]` declare nested rich-text JSON fields
for titles, descriptions, questions, and answers. A direct API or client-side
mutation can therefore store malformed or policy-violating nested `RtRoot`
payloads that top-level rich-text fields would reject.

The admin canvas renderer consumes these values as structured rich text, and
`RtStaticView` renders link hrefs directly. Unsafe nested rich-text payloads can
therefore drift into admin rendering and projected site JSON.

#### Suggested fix shape
Make rich-text validation recursive and schema-driven for every declared rich
text slot, including nested arrays. Validate each value with `rtRootSchema` and
the rich-text manifest variant expected for that exact block path.

#### Verification
Add unit tests that attempt to save invalid nested values in
`featureList.features[0].title`, `featureList.features[0].description`,
`faq.items[0].question`, and `faq.items[0].answer`, including wrong variants and
unsafe link hrefs.

#### Dynamic verification — 2026-05-28
Confirmed with a focused Vitest harness against the real
`validateRichTextOnSave` hook and a mocked tenant manifest. Invalid nested
`featureList.features[0].title` and wrong-variant
`featureList.features[0].description` were accepted, while an invalid
top-level `featureList.title` was rejected by the same hook. Full Payload Local
API persistence was not run because the local Postgres service was unavailable.

#### Current verification — 2026-05-28
Still current. `validateRichTextOnSave` still iterates only the top-level
entries of each block and maps variants through `fieldVariantForBlock(blockType,
fieldName)`. Nested array fields declared in `FeatureList` and `FAQ` remain
outside that traversal.

#### Bundle note — 2026-06-03
Handle this as the backend safety prerequisite for the rich-text
editor/toolbar bundle tracked in the features backlog with OBS-78, OBS-79, and
OBS-80. Recursive RtRoot validation should land before toolbar affordance or
theme-effect work so the editor cannot persist malformed nested rich text while
the authoring surface is being improved.

#### Resolution — 2026-06-03
Closed by recursive, schema-driven validation in `validateRichTextOnSave`.
The hook now walks each block's field schema and validates every
`admin.editor: "richTextBlock" | "richTextInline"` slot, including rich-text
fields nested inside array rows such as `featureList.features[]` and
`faq.items[]`. Each discovered slot is parsed with `rtRootSchema`, checked
against the expected block/inline variant, and validated against the tenant
manifest. DB-free unit coverage pins malformed nested FeatureList and FAQ
payloads; the existing integration test also carries the same cases, but could
not be run locally on 2026-06-03 because Postgres/Docker were unavailable in
the environment.

---

### OBS-93 — CTA, navigation, and social URLs need server-side safe-href validation

**Status:** Closed 2026-06-03.
**Discovered in:** 2026-05-28 static CMS security audit.
**Severity:** Medium.
**Audit ID:** AUDIT-20260528-4.
**Files:** `src/blocks/CTA.ts`, `src/blocks/Hero.ts`, `src/collections/SiteSettings.ts`, `src/lib/projection/resolveNav.ts`, `src/lib/projection/pageToJson.ts`.

#### Description
Several user-controlled URL fields are plain text or only minimally validated on
the server, including CTA block links, hero CTA links, custom navigation URLs,
and social URLs. Projection code passes these values through to site JSON. Some
client-side editor helpers contain partial URL checks, but the server remains
the security boundary for direct API writes and future UI drift.

A malicious tenant content author could persist `javascript:`, `data:`, or
protocol-relative URL values if downstream renderers treat those fields as link
hrefs.

#### Suggested fix shape
Add a shared server-side `validateSafeHref` helper for CMS-authored link fields.
Allow `http:`, `https:`, `mailto:`, `tel:`, `#anchor`, and single-slash relative
paths. Reject `javascript:`, `data:`, protocol-relative `//host`, control
characters, and malformed URL strings. Apply it to CTA, hero CTA, custom nav,
and social URL fields.

#### Verification
Add focused field/action tests for CTA links, hero CTA links, custom nav links,
and social URLs. Include positive cases for allowed schemes and negative cases
for `javascript:alert(1)`, `data:text/html,...`, and `//evil.test/path`.

#### Dynamic verification — 2026-05-28
Confirmed with a focused projection harness against the real `pageToJson` and
`settingsToJson` functions. `javascript:alert(1)`, `data:text/html,...`, and
protocol-relative `//evil.test/path` values survived projection in hero CTA,
CTA primary/secondary links, custom header/footer navigation, and social URLs.
Relevant `design-systems` registry code was also checked: the rich-text link
popover has client-side safe-href checks, but CTA URL editors are plain inputs
and rely on the host server to enforce persistence rules.

#### Current verification — 2026-05-28
Still current. Rich-text links have `rtNodeSchema`/manifest URL validation, but
the plain CMS URL fields in `Hero`, `CTA`, `SiteSettings.nav*`, and
`SiteSettings.contact.social` still lack a shared server-side safe-href
validator.

#### Resolution — 2026-06-03
Added shared server-side safe-href validation for CMS-authored link fields.
Hero CTA, CTA primary/secondary, custom navigation URLs, and social URLs now
allow only `http:`, `https:`, `mailto:`, `tel:`, in-page anchors, and
single-slash relative paths. `javascript:`, `data:`, protocol-relative URLs,
unknown schemes, backslashes, control characters, and malformed strings are
rejected.

#### Follow-up — 2026-06-04
Live save testing surfaced a drift case rather than a new unsafe-href gap:
`InlineCtaButton` still accepted bare `#` while the shared server validator
correctly rejected it. The inline CTA editor now imports the shared
`isSafeHref` helper, and page save normalization treats empty or bare-`#` CTA
href values as absent before Payload validation. Invalid non-empty hrefs remain
invalid so the server boundary still enforces OBS-93.

Projection now also defends against previously stored unsafe values:
`resolveNav` drops unsafe custom navigation links, `settingsToJson` drops unsafe
social URLs, and `pageToJson` removes unsafe Hero/CTA href fields while keeping
the surrounding labels/content.

#### Validation — 2026-06-03
Added `tests/unit/safeHref.test.ts` covering allowed/blocked hrefs, Payload
field-validator wiring for Hero/CTA/custom nav/social URLs, and projection
defense for unsafe stored values. Reran the focused projection/navigation suites
with the new coverage.

---

## Latent — not exploitable today; watch for trigger conditions

No latent security items are currently tracked.

## Audit-deferred — explicitly punted by audit text, tied to future feature

### OBS-12 — DB-backed manifest (architectural alternative to filesystem race fix)

**Status:** Audit-deferred (potential future architectural change)
**Discovered in:** P2 #12 batch (2026-05 audit cycle)
**T-ID:** T8
**File:** `src/lib/projection/manifest.ts`

#### Description
P2 #12's fix uses atomic rename + in-process mutex (correct for single-instance). If deployment ever scales horizontally, filesystem races re-emerge between replicas. Moving manifest state to a `manifests` DB collection would eliminate this entirely.

#### Trigger condition
Deployment moves to multi-replica / horizontal scaling.

#### Suggested fix shape
Create a `manifests` collection scoped per-tenant. `projectToDisk` reads/writes via Payload Local API instead of filesystem ops. Filesystem still holds projected JSON; only the manifest moves to DB.

**Cross-reference:** OBS-16 (same trigger condition — close one, close both).

#### Current verification — 2026-05-28
Still audit-deferred. `src/lib/projection/manifest.ts` continues to use
filesystem-backed `manifest.json` plus atomic writes and an in-process mutex.
No DB-backed manifest collection exists.

#### Ops decision — 2026-06-03
The production scaling model is one CMS application instance serving more
tenants, not multiple CMS writer replicas on the server. Tenant ownership stays
one-site-per-user, while each site may have multiple owner/editor/viewer users.
Under that deployment model this item is not a short-term 1000+ tenant readiness
blocker; keep it audit-deferred only as a warning if horizontal CMS writers are
ever reconsidered.

---

### OBS-16 — In-process mutex doesn't protect multi-replica deployments

**Status:** Latent (architectural — depends on deployment shape)
**Discovered in:** P2 batch-2 (2026-05 audit cycle)
**T-ID:** T8
**File:** `src/lib/projection/manifest.ts:48-58`

#### Description
P2 #12's `Mutex` serializes concurrent writes within the same Node process. Multiple replicas each have their own mutex — concurrent cross-replica writes are not serialized and the lost-update race re-emerges.

#### Trigger condition
Deployment moves to multi-replica (k8s `replicas > 1`, Docker Swarm, ECS `desiredCount > 1`, etc.).

#### Suggested fix shape
Three options: (1) Postgres advisory lock keyed on `tenantId` — smallest delta; (2) DB-backed manifest per OBS-12 — cleanest long-term; (3) `flock` / `proper-lockfile` — works if all replicas share a volume.

**Cross-reference:** OBS-12 (closing one closes both).

#### Current verification — 2026-05-28
Still latent. The mutex in `src/lib/projection/manifest.ts` is process-local,
and the checked compose/runtime contract remains a single CMS instance rather
than a multi-replica deployment. Promote only if horizontal CMS writers are
introduced.

#### Ops decision — 2026-06-03
Current and expected production topology is a single CMS app instance with a
larger tenant/user base, not multiple CMS writer replicas. The process-local
mutex remains appropriate for this topology. Do not treat OBS-16 as a client
scale blocker unless the CMS deployment model changes to multiple concurrent
writer processes.

---

## Closed — handled, kept for lineage

### OBS-8 — `_verified` field has `update: defaultAccess` (default-allow)

**Status:** Closed 2026-06-03.
**Discovered in:** P1 #7 batch (2026-05 audit cycle)
**T-ID:** T2
**File:** `node_modules/payload/dist/auth/baseFields/verification.js`

#### Description
If `auth.verify: true` is ever enabled on Users, Payload auto-injects a `_verified: boolean` field with `access.update: defaultAccess` (allow-all-authed). A non-super-admin attacker could PATCH `{_verified: true}` to bypass email-verification gating.

#### Trigger condition
**The moment anyone sets `auth.verify: true` on Users, this becomes immediately exploitable.**

#### Suggested fix shape
Declare `_verified` explicitly in `Users.fields` with `access: { create: isSuperAdminField, update: isSuperAdminField }`. Also extend `rejectNonSuperAdminCredentialWrites` to reject `_verified` writes from non-super-admin.

#### Current verification — 2026-05-28
Still latent, not active. `src/collections/Users.ts` configures
`auth.useAPIKey` and `auth.useSessions`, but does not enable `auth.verify:
true`, and no `_verified` field is declared. Keep this item trigger-bound.

#### Product decision — 2026-06-03
Client onboarding is invite/login-link oriented: accounts are created and users
receive CMS access email, and tenant owners can invite editors/viewers. The CMS
does not plan to require Payload's built-in "verify email before using CMS"
flow. This item is therefore not part of 1000+ tenant readiness and should stay
closed unless `auth.verify: true` is explicitly proposed in the future.

#### Resolution — 2026-06-03
Closed by product decision. SIAB will not use Payload's built-in email
verification route for CMS access. If that route is reconsidered later, enabling
`auth.verify: true` must be treated as a new security-sensitive auth feature
change and reviewed before it is shipped.

---

### OBS-96 — Transitive audit advisories behind Payload / Next exact dependency boundaries — RESOLVED

**Status:** Closed 2026-06-01.
**Discovered in:** Session 2026-06-01 (post-upgrade update-management audit).
**Layer:** dependency security (`payload`, `@payloadcms/*`, `next`, `monaco-editor`, `drizzle-kit`).
**Files:** `pnpm-workspace.yaml`, `pnpm-lock.yaml`.

#### Resolution

Upstream checks on 2026-06-01 showed no compatible first-party release was
available to absorb these advisories: `payload`, `@payloadcms/db-postgres`, and
`@payloadcms/ui` remained at `3.85.0`; `next` remained at `16.2.6`;
`monaco-editor` remained at `0.55.1`; and Payload still pinned
`drizzle-kit@0.31.7`. The issue was resolved with scoped pnpm workspace
overrides on the specific vulnerable transitive edges:

- `monaco-editor>dompurify` -> `3.4.7`
- `next>postcss` -> `8.5.15`
- `@esbuild-kit/core-utils>esbuild` -> `0.25.12`

`pnpm audit --audit-level moderate` is clean, and dependency tracing now shows
the patched versions on the Payload / Next paths that originally triggered the
advisories.

#### Validation

Validated under Node `26.2.0`:

- `pnpm install --frozen-lockfile`
- `pnpm payload generate:types`
- `pnpm payload generate:importmap`
- `pnpm payload:contract`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test` — 100 files / 864 tests passed in 99.91s against Postgres
- `pnpm audit --audit-level moderate`
- Runner image smoke-start via Podman, using the Dockerfile `runner` target:
  migrations applied, Next started, and `/api/health` returned
  `{"status":"ok","db":"connected","dataDir":"writable"}`.

---

### OBS-17 — `media.filename` cross-tenant rename leak — RESOLVED

**Status:** Closed 2026-05-22 (Batch 9).
**Discovered in:** P3 batch (2026-05 audit cycle).
**T-ID:** T8.
**Files:** `src/collections/Media.ts`, `src/hooks/mediaTenantUrls.ts`, `src/hooks/projectToDisk.ts`, `src/app/(payload)/api/tenant-media/[tenantId]/[filename]/route.ts`, `src/migrations/20260522_083500_media_filename_compound_index.ts`.

#### Resolution
Payload's upstream `getSafeFileName` still probes filenames globally before collection `beforeValidate` hooks run, so media uploads now set `overwriteExistingFiles` from a collection `beforeOperation` hook for actual create/update uploads. Same-tenant duplicate filenames remain blocked by `ensureUniqueTenantFilename` and the committed `(tenant_id, filename)` unique index; cross-tenant same-filename uploads no longer get auto-renamed to `-1`.

Serving no longer depends on the shared `_uploads-tmp/<filename>` path. `projectMediaToDisk` writes the request upload buffer directly to `DATA_DIR/tenants/<tenantId>/media/<filename>`, and media `afterRead` rewrites `url`/eligible `thumbnailURL` values to `/api/tenant-media/<tenantId>/<filename>`. That route authenticates with Payload, checks tenant membership for non-super-admin users, verifies a media row exists for the requested `(tenant, filename)`, then streams from the tenant directory.

The collection now declares Payload's `filenameCompoundIndex: ["tenant", "filename"]`, and the follow-up migration renames the existing hand-written compound index to Payload's expected `media_filename_compound_idx` name so dev push and committed migrations agree on schema shape.

#### Validation
`audit-p3-15-media-tenant-filename-unique.test.ts` now pins the `filenameCompoundIndex`, `beforeOperation` overwrite hook, tenant URL rewrite, and tenant-media route auth/source guard.

---

### OBS-2 — `/__preview*` reserved CSP branch is dormant but path-active — RESOLVED

**Status:** Closed 2026-05-22 (Batch 8).
**Discovered in:** P1 batch-1 (2026-05 audit cycle).
**T-ID:** T12.
**File:** `src/middleware.ts`.

#### Resolution
The dormant permissive preview CSP branch was removed. `/__preview*` now fails closed in middleware with a 404 and the same strict admin security headers as normal admin routes (`frame-ancestors 'none'` plus `X-Frame-Options: DENY`). Any future CMS-owned preview route must deliberately change middleware and pass CSP review.

#### Validation
`audit-p1-4-security-headers.test.ts` now asserts `/__preview*` returns 404 and keeps strict anti-framing headers.

---

### OBS-4 — DB-cost amplification on bogus `Authorization: users API-Key <random>` — RESOLVED

**Status:** Closed 2026-05-22 (Batch 8).
**Discovered in:** P1 #5 batch (2026-05 audit cycle).
**T-ID:** T4.
**File:** `src/middleware.ts`.

#### Resolution
Added a cheap middleware pre-check for `Authorization: users API-Key ...`: credentials shorter than 16 chars or longer than 256 chars now receive a 401 before reaching Payload's API-key auth strategy. The middleware matcher now includes `/api/:path*` so malformed API-key probes against Payload API routes are rejected before HMAC + DB lookup work.

Payload's custom auth strategy mechanism cannot short-circuit the built-in API-key strategy on `user:null`; `executeAuthStrategies` continues to the next strategy until a user is found. Middleware is therefore the practical local interception point without forking Payload internals.

#### Validation
Focused middleware tests cover malformed short-key rejection and syntactically plausible key pass-through.

---

### OBS-5 — Authed-tenant-abuse residual on `/api/users/forgot-password` — RESOLVED

**Status:** Closed 2026-05-22 (Batch 8).
**Discovered in:** P1 #5 batch (2026-05 audit cycle).
**T-ID:** T4.
**Files:** `src/hooks/rateLimitForgotPassword.ts`, `src/collections/Users.ts`.

#### Resolution
Added a Payload `beforeOperation` hook for `forgotPassword` that rate-limits by target email after Payload auth has run. This closes the authenticated editor/owner abuse shape that bypasses the anonymous middleware limiter. The limiter allows 3 reset attempts per target mailbox per hour in-process, normalizes email case/whitespace, keeps different target emails isolated for legitimate invite/provisioning bursts, and returns HTTP 429 with retry metadata.

#### Validation
Focused tests cover authenticated caller blocking on the fourth reset for the same target email, target isolation, operation scoping, and missing-email no-op behavior.

#### Passwordless-boundary follow-up — 2026-07-13
Password recovery is now a super-admin-only capability. Tenant hosts receive a
404 for the forgot/reset pages and APIs, and the exact API handlers filter both
forgot-password targets and reset tokens to users whose role is
`super-admin`. Submitting a tenant user's address on the platform admin host
returns the same generic response as an unknown address without creating a
token or sending mail. Payload's reset/session-rotation machinery remains in
use for valid super-admin requests.

Payload's email adapter now delegates lazily to the centralized Cloudflare
REST/SMTP `sendEmail` transport with the `auth.password_reset` intent, HTML and
plain-text content, metadata logging, and operational failure alerts. Reset
links are pinned to the configured platform admin origin and expire after one
hour. Focused tests cover the host matrix, tenant-target no-op, provider
failure, reset-token role gate, trusted URL, and lazy adapter wiring.

---

### OBS-6 — Owner-invite to typo'd email creates account at wrong address — RESOLVED

**Status:** Closed 2026-05-22 (Batch 8).
**Discovered in:** P1 #7 batch (2026-05 audit cycle).
**T-ID:** None.
**File:** `src/components/forms/UserInviteForm.tsx`.

#### Resolution
Added an explicit email confirmation field to the invite dialog and changed the dialog copy to warn that the invite link grants tenant access to that mailbox. The client schema requires `email` and `confirmEmail` to match case-insensitively before the server action runs.

This takes the lightweight UX mitigation path from the suggested fixes. Full email verification remains trigger-bound to OBS-8 because enabling `auth.verify: true` requires the `_verified` field-access prerequisite.

#### Validation
Source-level unit guard verifies the invite form includes `confirmEmail`, the mismatch message, and the caution copy.

#### Delivery follow-up — 2026-07-13
Invitation delivery now uses a dedicated passwordless template selected by
Better Auth metadata. The message includes the actual tenant, recipient, role,
target tenant admin host, and five-minute magic-link lifetime in escaped HTML
and plain text. The create action no longer reports success when delivery
fails after the user was created; the UI exposes that partial outcome and lets
an authorized owner or super-admin resend from the tenant-scoped team menu.
Resend authorization rechecks both the caller tenant and recipient membership.

---

### OBS-7 — List pages cap silently at 50 without pagination UI — RESOLVED

**Status:** Closed 2026-05-20 (Bundle 2 — siab-payload `820f159`).
**Discovered in:** P2 batch-1 (2026-05 audit cycle).
**T-ID:** None (UX paper-cut).

#### Resolution
The pages / media / forms admin list pages — tenant-mode and `sites/[slug]` super-admin variants, 6 pages — now paginate server-side. Each reads a `?page=` URL param, fetches one page via the `*Paginated` query variant, and renders a new `ListPagination` control (`src/components/list-pagination.tsx`) composing the `@siab/pagination` primitive.

The 2026-05-20 "registry-side work" caveat was **wrong**: `@siab/pagination` already exists in the published registry, so no `optidigi/design-systems` change was needed — OBS-7 was a pure siab-payload consumer task. `@siab/data-table`'s built-in client pagination is sidestepped by feeding the table exactly one server page of ≤10 rows on the table surfaces (its footer only shows above one page).

Because server pagination would have reduced `DataTable`'s client text filter to a current-page-only search, that filter was replaced with a URL-driven `?q=` search (`src/components/list-search.tsx`): the query layer searches title+slug for pages and email+name+formName for forms. Legacy `listMedia` / `listForms` wrappers removed (now unused); `listPages` kept for the navigation page-picker — whose own 50-cap is filed as FE-63.

Test coverage: `tests/unit/audit-p2-13-pagination-no-truncation.test.ts` — 5 new cases for the `q` → `where.or` search clause (trim, blank-guard, tenant-scope, no-q regression).

---

### OBS-9 — `Users.access.create` admits owner unconditionally (single-point defense-in-depth) — RESOLVED

**Status:** Closed 2026-05-19 (Bundle G — defense-in-depth promotion, applies OBS-67's canWrite pattern).
**Originally Latent in:** AMD-1 batch (2026-05 audit cycle).
**T-ID:** T1 / T2
**File:** `src/collections/Users.ts:445-468`

#### Resolution
`Users.access.create` now performs the tenant-membership check independently of `canCreateUserField`. Owner callers must provide a `data.tenants[]` array whose every entry's `tenant` id matches their own `ownerTenantIdOf(req.user)` — both populated-object and scalar-id shapes normalised via `String()` compare. Mirror of OBS-67's canWrite pattern.

Three behavioural slices:
1. **Super-admin** — short-circuit `true` (unchanged).
2. **Owner with `data.tenants` provided** — every row must match the owner's tenant id; smuggling extra rows (e.g. `[{ tenant: own }, { tenant: other }]`) also rejected. The OBS-9 trigger condition (canCreateUserField weakened) now no longer collapses the guard — the collection gate would still 403.
3. **Owner with missing/empty `data.tenants`** — pass through; defer to `validateTenants` to surface the canonical "tenant required" validation error (we're not the gate for that class).
4. **Anonymous bootstrap path (audit-p1 #6)** — unchanged. Token + role + empty-table checks intact.
5. **Editor / viewer / any other authed role** — `false` (was already implicitly false via the role-list check; now explicit since the owner branch is split out).

Test coverage: `tests/unit/users-create-tenant-membership.test.ts` — 20 cases across super-admin pass-through, owner same-tenant allow, owner cross-tenant deny (including the multi-tenant smuggling shape and malformed-payload defensive case), missing/empty/null tenants defer, id-shape robustness (string vs number, populated-object form on both sides), non-owner authed callers rejected, and anonymous-bootstrap unchanged.

Verification: full suite 708/708 pass (Bundle F's 688 baseline + 20 new from this bundle, no regressions).

#### Pattern reuse
OBS-9 is the second instance of the "role check without tenant scoping → cross-tenant injection" defense-in-depth pattern established by OBS-67. Both fixes use the same shape: extract tenant id via populated-vs-scalar normalisation, build the caller's allowed-tenants set, reject when target isn't in the set. Future similar findings should adopt the same pattern.

#### Cross-reference
- OBS-67 (closed 2026-05-19) — original pattern. canWrite-style membership check.
- `canCreateUserField` (field-level, Users.ts:65-97) — unchanged. Continues to provide the first layer of the (role, tenants) shape validation. This bundle adds the second layer at the collection level so the chain has two independent gates.

---

### OBS-67 — Cross-tenant data injection via `canWrite` on create — RESOLVED

**Status:** Closed 2026-05-19 (same session as discovery; HIGH severity, prioritised over Bundle F per operator).
**Originally Active in:** Session 2026-05-19 (surfaced when Bundle F enabled the dormant integration test `tenants-isolation.test.ts:90-97` — `editor in t1 cannot create a page in t2`).
**T-ID:** T2 (cross-tenant data flow)
**Files:** `src/access/roleHelpers.ts` (`canWrite` fix), `tests/unit/canWrite-tenant-membership.test.ts` (new).

#### Description (now archival — for lineage)
`canWrite` returned `true` for any super-admin/owner/editor based on role alone, with no check that the caller's `tenants[]` includes the target tenant. An editor in tenant T1 could `POST /api/<collection>` with `{ "tenant": T2_id, ... }` and successfully create a page (or Media / BlockPresets entry; Forms update too) in T2. The multi-tenant plugin's `withTenantAccess` wrapper restricts FIND queries to the user's tenant, but does NOT gate CREATE against `data.tenant` — `canWrite` was the only guard on the create path and it had no membership check.

**Reproduction (confirmed against `payload_test` 2026-05-19):**
```ts
await payload.create({
  collection: "pages", user: editor1, overrideAccess: false,
  data: { tenant: t2.id, title: "leak", slug: "leak", status: "draft" }
})
// Pre-fix: created in T2 successfully
// Post-fix: rejects with Forbidden
```

Affected collections: Pages, Media, BlockPresets (all use `canWrite` for create + update + delete). Forms uses `canWrite` for update only — its create is anonymous-allowed by design; the fix tightens cross-tenant update-with-tenant-change there too.

Why latent: the regression test (`tenant-isolation.test.ts`) was in OBS-29's failure list — it failed at module-load because the test DB wasn't migration-tracked. Once Bundle E/F brought the integration test surface online, the test ran for the first time in months and surfaced the bug. CI not running tests (OBS-19) meant the bug shipped to production without signal.

#### Resolution
`canWrite` now takes the `data` arg, extracts `data.tenant`, normalises both populated-object and scalar-id forms, and rejects when the target tenant isn't in the caller's `tenants[]`. Super-admin path unchanged (always allow). Updates with no `tenant` change defer to the multi-tenant plugin's read-scoping (the doc being updated is already tenant-restricted at fetch time). Test coverage: `tests/unit/canWrite-tenant-membership.test.ts` — 23 cases across auth gate, role gate, same-tenant allow, cross-tenant reject, tenant id-shape robustness (populated-vs-scalar mixed), null/undefined safety, and hypothetical multi-tenant users.

Doctrine update for the file: the comment at top of `roleHelpers.ts` now explicitly documents that the multi-tenant plugin's wrapper does NOT gate creates against incoming data, and that `canWrite` is the gate for that path.

#### Trigger condition (closed)
N/A — fix applied + tested.

#### Cross-reference
- OBS-19 (tests in CI) — directly enabled discovery. Closing OBS-19 will catch the next instance of this class earlier.
- OBS-66 (test setup migrations) — the integration test infra that surfaced this bug. Bundle F (paused) will land both.
- OBS-9 (Users.access.create defense-in-depth) — same class of "role check without tenant scoping" pattern, latent. The pattern in this OBS-67 fix is the canonical defense; OBS-9 should adopt the same shape when promoted.

---

### OBS-13 — i18n fallback-language trapdoor on `getOrCreateSiteSettings` race detection — RESOLVED

**Status:** Closed 2026-05-19 (Bundle A — backend safety quartet).
**Originally Active in:** P2 batch-2 (2026-05 audit cycle)
**T-ID:** T8
**File:** `src/lib/queries/settings.ts` `isUniqueViolation` channel 1

#### Resolution
Channel 1 now matches by `firstErr.path === "tenant"` first (language-invariant) and falls back to the literal `"Value must be unique"` message. A future i18n `fallbackLanguage` change will translate the message but not the field path, so race detection survives the trapdoor. Test `Case 6f` in `tests/unit/audit-p2-11-site-settings-tenant-unique.test.ts` proves a Dutch-translated ValidationError still resolves the race correctly.

---

### OBS-14 — `tenantLifecycle.createTenantDir` writes empty manifest unsynchronized — RESOLVED

**Status:** Closed 2026-05-19 (Bundle A — backend safety quartet).
**Originally Active in:** P2 batch-2 (2026-05 audit cycle)
**T-ID:** T8
**File:** `src/hooks/tenantLifecycle.ts`

#### Resolution
The initial empty-manifest write in `createTenantDir` now goes through `withManifestLock` (the same per-(dataDir, tenantId) helper P2 #12 added in `src/lib/projection/manifest.ts`). Any subsequent projectToDisk write for the same tenant serialises behind it. Theoretical race window pre-empted before async provisioning would ever re-open it.

---

### OBS-15 — `writeAtomic` leaks `.tmp.<pid>.<ts>` files on write failure — RESOLVED

**Status:** Closed 2026-05-19 (Bundle A — backend safety quartet).
**Originally Active in:** P2 batch-2 (2026-05 audit cycle)
**T-ID:** None
**File:** `src/lib/atomicWrite.ts`

#### Resolution
`writeAtomic` now wraps the entire open+write+sync+rename sequence in a try/catch. On any failure path it issues `fs.unlink(tmp).catch(() => {})` — the `.catch(() => {})` is intentional so a missing tmp (e.g. `fs.open` never succeeded) or permission glitch on cleanup doesn't mask the original write/rename failure. New unit test `removes the .tmp file when fs.rename fails` proves a forced EISDIR rename failure leaves no debris.

---

### OBS-32 — Manifest injection: deeply-nested themedNodes could resource-exhaust the validator — RESOLVED

**Status:** Closed 2026-05-19 (Bundle A — backend safety quartet).
**Originally Active in:** rich text v2 Phase 1 spec review (2026-05-13)
**File:** `src/lib/richText/manifest.ts`

#### Resolution
Explicit bounds added to `themedNodeSchema` and to the `themedNodes` array on `manifestSchema`: themedNodes array ≤ 64, themedNode.fields ≤ 32, themedNode.label ≤ 80 chars, themedNode.id ≤ 64 chars. New `bounds (OBS-32)` describe block in `tests/unit/manifest.test.ts` proves rejection at each boundary plus acceptance at the exact-64 ceiling. Other manifest sub-schemas (colorTokens, typeStyles, blocks) intentionally left unbounded — different attack-surface profile and out of this entry's scope.

---

### OBS-1 — `script-src 'unsafe-inline' 'unsafe-eval'` in admin CSP — RESOLVED

**Status:** Closed — `script-src` portion resolved by Phase 1 of rich text v2.
**Originally Active in:** P1 batch-1 (2026-05 audit cycle)
**T-ID:** T9 / T12
**File:** `src/middleware.ts` — `ADMIN_CSP` / `PREVIEW_CSP` constants

#### Resolution
Per-request nonces now replace `'unsafe-inline'` and `'unsafe-eval'` on `script-src`. Trigger condition (T9 escalation when rich-HTML rendering surface ships) was met by the same PR, so the deferral premise no longer applies.

#### Remaining work
`style-src 'unsafe-inline'` is still required by Tailwind v4 runtime CSS. Tracked as OBS-33.

See: `docs/superpowers/specs/2026-05-13-richtext-v2-phase-1-design.md` §10.

---

### OBS-18 — CSP `unsafe-inline` / `unsafe-eval` not tightened to nonces — RESOLVED

**Status:** Closed 2026-05-19 (script-src half landed via OBS-1; style-src residual carried by OBS-33).
**Originally Active in:** audit-p1 batch 4
**File:** `src/middleware.ts` — `ADMIN_CSP` / `PREVIEW_CSP` constants

#### Resolution
The original entry covered both `script-src` and `style-src`. The `script-src` half was closed by OBS-1 (per-request nonces). The `style-src 'unsafe-inline'` half is structurally blocked on Tailwind v4 runtime CSS and is tracked under its own entry — see OBS-33. With the script-src half handled and the style-src half forwarded to OBS-33, OBS-18 itself has no remaining scope.

---

### OBS-10 — `String(target) === String(own)` false-negative on populated-object form — RESOLVED

**Status:** Closed 2026-05-19 (latent trigger pre-empted by AMD-1 helper).
**Originally Latent in:** AMD-1 batch (2026-05 audit cycle)
**File:** `src/collections/Users.ts` `canCreateUserField` Branch C

#### Resolution
`ownerTenantIdOf` helper now normalises both populated-object form (`{ id: 42 }`) and bare-scalar form before comparison, eliminating the `"[object Object]" === "42"` false-negative class. The original `String(target) === String(own)` pattern no longer runs against un-normalised values. Latent trigger (Payload data-loader returning populated objects on the write path) is now harmless.

---

### OBS-3 — GraphQL playground iframable
Closed by `fix/audit-p3-batch-1-cleanup` (P3 #16 env-gate). Playground returns 404 in production unless `ENABLE_GRAPHQL_PLAYGROUND=1` is set; iframable surface no longer exists in default deployments.

### AMD chain (2026-05 audit cycle)
- **AMD-1 — Owner cannot invite team members** → Closed by `fix/audit-amendment-1-owner-invite` (`e8985b4`)
- **AMD-2 — `apiKey` mass-assignment on Users** → Closed by `fix/audit-amendment-2-apikey-access` (`f857ff7`)
- **AMD-3 — `ApiKeyManager` UI silent failure** → Closed by `fix/audit-amendment-3-apikey-honest-rejection` (`4acac39`)

---

## Out of scope — permanent decisions per 2026-05 threat model

- Distributed flood from many real IPs / botnet (network/CDN/WAF concern)
- XFF spoofing for rate-limit bucket evasion (network concern)
- Memory-exhaustion on rate-limit store (network concern)
- OS-level malware / browser extensions with `<all_urls>` (client concern)
- Side-channel timing attacks (except token-comparison timing in HMAC verification — T6)
- Compliance frameworks not signed up for: SOC2, ISO 27001, HIPAA, PCI-DSS
- Race conditions across multi-process/multi-replica deploys (out-of-scope unless horizontally scaled — see OBS-12/OBS-16)

If any become in-scope, open a meta-amendment and re-audit.

---

## Doctrine

Permanent codebase rules surfaced by the 2026-05 audit cycle:

1. **Payload "auth-fields default-allow" rule.** Whenever enabling a Payload auth feature (`useAPIKey`, `verify`, `loginWithUsername`, etc.), audit the auto-injected fields' access defaults the same day. Every Payload auth feature adds new auto-injected fields with default-allow access. Each one needs explicit access locking. Known instances: AMD-2 (apiKey), P1 #7 (email), OBS-8 (`_verified`), OBS-13 (i18n).
2. **Migration safety doctrine.** Hand-write migrations. `down()` MUST throw, never reverse. `up()` MUST refuse on incompatible state. Pre-flight on production with the duplicate-detection query before applying.
3. **No "soft notes" in security review.** Real → Fails. Hand-wavy → drop. No middle ground ships.

---

## Item shape (when adding new entries)

```markdown
### OBS-N — <short title>

**Status:** Active | Latent | Audit-deferred | Closed
**Discovered in:** <cycle / PR / incident / etc.>
**T-ID:** <if applicable>
**File:** `path:line` (if applicable)

#### Description

#### Why deferred

#### Trigger condition

#### Suggested fix shape
```
