# Feature Backlog

This backlog was reset after the platform cleanup that removed obsolete
generation flows and the provisional product app shell. Historical entries that
depended on command-run site generation are no longer current source of truth.

## Current State

- The CMS remains the tenant/content authority.
- The public marketing site remains `apps/landing`; public intake work belongs
  in `apps/intake`.
- Shared data contracts live in `packages/contracts`.
- Shared UI primitives and app-neutral composites live in `packages/ui`.
- Existing generated-site runtime is CMS data plus the generic renderer and
  shared `packages/site-renderer` code. Tenant-specific source folders under
  `sites/*` and the removed template package are not part of the current
  architecture.

## Current Product Rules

- Future product architecture is under reconsideration.
- Do not add a new self-serve product surface until its architecture is
  approved.
- Do not generate per-client source code for new sites.
- AI-assisted generation, if reintroduced, must produce validated structured
  data that matches shared contracts.
- Mollie is the selected payment provider. Payment-provider-specific code must
  stay behind the CMS Mollie adapter/service boundary and must not publish or
  activate sites by itself.
- The public `apps/landing` marketing site uses Google Analytics. Do not add
  PostHog there unless this product decision changes.
- Generic self-serve generated-site generation now starts with active
  exact-source Tailwind Plus Marketing provider page sections:
  `tailwindplus.marketing.hero.simple-centered`,
  `tailwindplus.marketing.feature.with-product-screenshot`,
  `tailwindplus.marketing.feature.centered-2x2-grid`,
  `tailwindplus.marketing.cta.dark-panel-with-app-screenshot`,
  `tailwindplus.marketing.contact.centered`,
  `tailwindplus.marketing.testimonial.simple-centered`,
  `tailwindplus.marketing.stats.simple`, and
  `tailwindplus.marketing.logo-cloud.simple-with-heading`; active header chrome
  `tailwindplus.marketing.header.with-stacked-flyout-menu`; and active
  known-tenant 404 fallback `tailwindplus.marketing.feedback.404-simple`.
  Other Tailwind Plus candidates, Preline, Tailblocks, SIAB-owned generic
  visual variants, and shadcn blocks are not active generated public-site
  inputs.

## Open Follow-Up

- Write a new architecture decision before starting any replacement product
  surface.
- Revisit tenant provisioning, preview, approval, payment handoff, and publish
  responsibilities as part of that decision.
- Keep CMS feature work tracked in focused entries or runbooks that match the
  current codebase, not removed generation workflows.
- Improve the CMS analytics UI so it is more intuitive for operators and
  customers. The dashboard should make visitors, conversions, section behavior,
  block performance, funnel health, and recommended actions easier to scan and
  compare.
- Harden generated-site analytics into a consistent product-intelligence layer:
  reliably track section performance, block variant performance, UI block
  combinations, palette/font/theme combinations, CTA/form outcomes, device
  context, consent state, and page/funnel context. Use this data to learn which
  blocks, block sequences, colors, and generated layouts perform best.
- Confirm the generated-site block/UI catalog covers every required site
  surface, including consent/cookie banners, legal/privacy links, forms,
  navigation, footer, error/empty states, and any required conversion or trust
  sections. Add missing surfaces through the same contract/catalog/schema/
  renderer/canvas path instead of one-off code.
- Confirm and enforce that every generated site receives complete SIAB-owned
  PostHog analytics configuration by default, with correct consent behavior,
  public proxy/host config, tenant/site/page/block metadata, and publish-time
  snapshot config. Site creation should also validate that required generated
  site config is complete before publish/activation.
- Rework desktop canvas chrome hover behavior with a simpler section-anchored
  model. Current header/footer badges can still flicker, and block badges can
  feel like they shift between sections. Defer further tuning until the canvas
  chrome model is simplified around one rule: hovering a section/header/footer
  shows only that section's badge, leaving that area hides it, and badge
  placement remains visually anchored to its owner.
- Re-evaluate editor iframe chrome isolation after the canonical site-rendering
  and generation flow work settles. The remaining issue to verify is whether
  iframe-mounted editor chrome can still inherit tenant/site styling instead of
  CMS editor chrome tokens; resolve through the canonical editor chrome boundary,
  not Ami-care-specific overrides.
- Re-evaluate Ami-care `featureList` / `amicareCareCards` parity after the
  canonical site-rendering and generation flow work settles. The known visual
  delta is in the "drie dingen" / "wat voor mij centraal staat" section:
  heading color and card top background differ between site output and the
  editor canvas. Verify whether this remains relevant once the new renderer and
  generated block flow are in place before making another targeted parity patch.
- Refactor the Forms/submissions management UI instead of patching the current
  sheet in place. The current `/forms` surface can show viewer users a
  submission status control that the server rejects, but this should be solved
  as part of the planned full forms UI redesign so read-only and management
  states are modeled deliberately rather than hidden with a small conditional.
- Production-smoke-test the live intake-to-live flow with real Mollie,
  OpenProvider, and Cloudflare credentials plus a disposable `.nl` domain
  before trusting unattended production activation. Capture provider ids, DNS
  records, sender status, active snapshot, renderer response, and final handoff
  mail log. `.nl` is the only offered TLD for now.
- Continue expanding generic self-serve generation around exact-source Tailwind
  Plus provider surfaces. Tailwind Plus source is the UI source of truth; CMS
  owns editable content/chrome slots; site-wide tokens may configure only
  approved color, font, and shape/radius behavior. Do not reintroduce adapted
  Tailwind Plus renderers, Preline, Tailblocks, SIAB-owned generic visual
  variants, raw AI HTML/classes, or any Amicare changes. A provider surface
  becomes generation-eligible only after exact source, renderer, CMS/sidebar or
  settings editing where applicable, canvas/preview/public behavior, token
  behavior, and structural/runtime/source-integrity tests are complete. Browser
  screenshots, pixel diffs, computed-style checks, and visual parity gates are
  out of scope for the current provider completion pass.

## Implemented Foundation

### Phase 6 — Intake and mocked generation runs

**Status:** Foundation added 2026-06-25.

The CMS now has operational records for `intake-submissions` and
`site-generation-runs`, plus a minimal `POST /api/intake` route. The route
normalizes submitted intake data, records an idempotency key and status
transitions, loads mocked `SiteGenerationSpec` data from shared fixtures, and
applies it through the CMS SiteGenerationSpec importer to create draft
tenant/page/settings data. The workflow records hashes, validation, apply
results, linked CMS records, and failure details.

Remaining integration point:

- Add the later approval/payment/publish handoff after product architecture is
  approved.

Phase 4 hardening on 2026-06-26 aligned generated root pages on the renderer's
`index` convention, rejected public test-only fixture controls at the intake
route boundary, kept fixture selection available only through internal test
hooks, and made draft import writes skip projection/source-file hooks.

Follow-up on 2026-07-02 connected the public `apps/intake` form UI to CMS
`POST /api/intake` through the intake app submission client and CMS route.

Same-day follow-up made CMS `POST /api/intake` store the normalized intake and
start provider-backed draft generation from that stored intake automatically.
The generated output remains validated CMS data only. As of 2026-07-04, generic
self-serve generation is limited to active exact-source Tailwind Plus Marketing
provider surfaces: page sections backed by the executable source-block registry
and header chrome backed by the executable source-chrome registry. The active
page-section set is hero, feature sections, CTA, contact, testimonial, stats,
and logo-cloud blocks. The provider-backed known-tenant 404 fallback is renderer
system behavior, not generated page content.
Preview access and customer email sending remain gated from the generation-run
detail flow. Existing operational preview-ready records may remain from earlier
deployments.

Same-day hardening tightened generated-site preview and rendering reliability:
preview theme edits now preserve mode-only choices, merge rapid toolbar changes,
and save with a latest-wins queue so stale writes cannot revert the stored
theme. Generic page saves now reject tenant-exclusive Amicare block variants,
while official Amicare compatibility remains isolated to tenant-renderer
slugs/domains. Generic style presets no longer expose `warm-care`. A later
2026-07-04 cleanup removed the adapted Tailwind Plus runtime path. Subsequent
provider passes reintroduced only active exact-source Tailwind Plus Marketing
surfaces: page sections through the executable source-block registry, header
chrome through the executable source-chrome registry, and the known-tenant 404
fallback through the executable source-template registry.

Same-day iframe editor follow-up completed the desktop iframe shape for the CMS
page editor and customer preview surfaces. `PageForm` remains the RHF/save/
ThemeBar/sidebar source of truth, while the authenticated `/editor-frame` iframe
owns rendering, inline editing, DnD, gutters, chrome selection, and block
inspector requests through the shared `iframe-editor` protocol on desktop.
Customer preview uses the separate `/renderer-frame` route and remains
token-only: frames accept only `page.replace` and `theme.patch`. The previous
in-process editor path and the `NEXT_PUBLIC_IFRAME_PAGE_EDITOR` kill switch were
removed.

Follow-up on 2026-07-04 made `MobileFrameEditor` the canonical phone editor
shell on top of the iframe renderer. The parent owns the section list, focused
section screen, page/SEO settings, save/close/trash pills, media/icon sheets,
and the two-detent bottom inspector. The iframe renders only the selected
section in focused mode, with chrome/gutters/add controls hidden and inline
editing disabled on phone. Section opening happens only from the section list,
and section reorder remains list-only. `PageEditorFrameHost` auto-sizes
canvas-view iframes to the rendered frame document height, including focused
sections, so the parent editor page scrolls naturally while sidebar/read-only
view keeps the bounded viewport-height iframe needed by the sticky inspector
layout.

### Phase 7 — AI generation service

**Status:** Foundation added 2026-06-25.

The intake workflow uses a provider-backed AI generation service instead of
calling the fixture loader directly. Generic self-serve provider-backed
generation is currently limited to active exact-source Tailwind Plus Marketing
page sections backed by the executable source-block registry: hero, feature
sections, CTA, contact, testimonial, stats, and logo-cloud. It may also select
the active Tailwind Plus Marketing header chrome through structured
`SiteSettings.chrome.header.variant` data. The known-tenant 404 fallback is
provider-backed in the renderer and is not generated as page content. The
default provider remains `mock` for local development and tests, while
`SITE_GENERATION_PROVIDER=openai` enables the OpenAI Responses API path.
Generation runs record provider, model,
prompt version, input/output hashes, raw/parsed output where available,
validation, apply results, attempts, and errors.

Generated output is still only accepted as structured `SiteGenerationSpec` data.
CMS validation rejects malformed specs, tenant/domain mismatches, duplicate or
invalid slugs, empty pages, and unsupported block slugs before the importer can
create or update tenant/page/settings records.

### Phase 9 — Published snapshots and live activation

**Status:** Foundation added 2026-06-25.

The CMS can now freeze approved draft/generated tenant data into immutable
`published-site-snapshots` records using the shared `PublishedSiteSnapshot`
contract. Activation is a CMS data operation: set the tenant active snapshot
pointer, mark the tenant active, and let `apps/renderer` resolve the request
Host to that active snapshot. Later draft/page/settings changes do not change
live output until another snapshot is published and activated.

Activation now accepts completed Mollie payment or manual super-admin waiver
through the payment abstraction. Client approval is required, and payment must
be completed or waived unless a super-admin performs an explicit manual
activation override. Domain verification is recorded on the tenant and
run-linked generated-site activation also requires verified tenant Email
Sending state, normally the Cloudflare Email Sending subdomain
`mail.<tenant-domain>`. Manual activation bypasses approval/payment only; it
does not bypass domain or sender verification. Rollback is implemented by
reactivating an older snapshot.

Follow-up on 2026-06-28 added CMS-side guardrails for tenant-exclusive
chrome variants. Amicare variants remain editable for their official
tenant-renderer slugs, but SiteSettings validation rejects those variants for
future/generated tenants through server-side collection validation. The
SiteSettings admin select fields also filter tenant-exclusive choices out for
generic tenants while keeping them available to the official tenant slugs. The
publish projection now preserves editable chrome variant, banner, CTA, and
legal-link settings in immutable snapshots, and snapshot tests cover renderer
analytics metadata in the published settings shape. A later hardening follow-up
omits hidden or empty announcement banner shells from the published projection.

### Phase 3 — Mollie payment gate

**Status:** Foundation added 2026-06-26.

The generation-run payment gate now has a Mollie checkout and webhook path in
CMS. Approved preview/customer flows and super-admin operator flows can create a
Mollie hosted checkout scoped to the generation run, tenant, customer email, and
preview client slug. Mollie webhooks update the generation-run payment JSON
state after fetching the payment from Mollie. Live-key paid checkout can
continue into approved OpenProvider/Cloudflare domain provisioning, Cloudflare
Email Sending subdomain setup, and automatic snapshot publish/activation when
all activation gates pass.

Manual waiver remains available to super-admins. Activation continues to require
client approval plus either completed Mollie payment or manual waiver unless a
super-admin uses the existing explicit manual activation override. Domain and
tenant sender verification remain separate activation gates.

### 2026-07-01 — Mail observability and tenant sender gate

**Status:** Foundation added 2026-07-01.

Cloudflare Email Sending is now represented in CMS operations as both a
platform REST delivery path with SMTP fallback and tenant sender state. The CMS records
metadata-only outbound delivery rows in `mail-logs` and writes
super-admin-visible `operational-alerts` for important or repeated mail
failures. Rendered subjects, bodies, and secrets are not stored.

Public intake storage sends an internal notification to the SIAB admin mailbox
through the platform sender. Generated-site form notifications send only when
the tenant has a verified Cloudflare sender and a Site Settings contact email.
Tenant provisioning stores non-secret Email Sending API state on
`tenants.emailSending`; generated-site activation for a run is blocked until
that state is verified.

### 2026-07-02 — Public contact, generated forms, and live handoff mail

**Status:** Foundation added 2026-07-02.

The public marketing contact form now posts to CMS `POST /api/contact` instead
of Web3Forms. The CMS validates the small contact payload, rate-limits the
anonymous public POST surface, and sends platform mail to `admin@siteinabox.nl`
through the centralized Cloudflare-backed `sendEmail` path.

Generated-site contact sections now have a renderer-owned ingress path at
`POST /api/forms`. The renderer derives the tenant from the active published
snapshot for the request host and forwards normalized submissions to CMS Forms;
CMS notification still requires a verified tenant sender and a Site Settings
contact email, with no platform fallback for normal tenant mail.

Generated-site activation sends a non-blocking `site.live_notice` handoff email
after first activation of a run-linked drafted snapshot. Rollbacks, current
state activations, and reactivations skip the normal live-site handoff.
The final live handoff intentionally uses the platform sender for reliability;
tenant senders remain for generated-site customer/contact mail after sender
verification.

### 2026-07-02 — Operations UI simplification

**Status:** Applied.

The CMS Operations overview now presents `/generation-runs` as one task queue
with search and Advanced filters instead of prominent dashboard cards. The
generation-run detail view keeps manual preview send visible, surfaces
automatic generation, client feedback, payment/subscription, domain order,
tenant sender provisioning, and live status, and keeps checkout, domain
verification, snapshot publish/activation, provider/model, hashes, validation,
and manual override controls behind Advanced. Backend generation, payment,
publish, and activation behavior was not changed.

### 2026-07-02 — Post-payment recovery controls

**Status:** Applied.

Operations Advanced exposes post-payment automation recovery for failed
subscription creation, domain provisioning, sender/provisioning refresh, and
publish/activation. Provider-step failures remain recorded until that step is
retried successfully, and publish/activation retries reuse existing drafted or
active snapshots for the generation run.
