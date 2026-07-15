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
- The public `apps/landing` marketing site does not load optional analytics by
  default. Any future analytics integration must be disclosed, consent-gated
  where required, and reflected in the legal release and retention registers.
- Generic self-serve generation uses the pinned MIT-licensed
  `akash3444/shadcn-ui-blocks` Radix catalog: 148 explicit public variants and
  eight explicit not-found system templates. The generated canonical manifest
  drives contracts, CMS choices, AI input, canvas/preview, and public runtime.
  Missing or unknown variants fail closed; native generic defaults and the
  retired provider are not generated public-site inputs.

## Open Follow-Up

- POSTHOG RETENTION: production project `193842` currently reports
  `event_retention_months=84` and `events_retention_enforced=false`, while the
  SIAB analytics policy requires 13 months with enforcement. This was verified
  from the production CMS environment and the GitHub privacy audit on
  2026-07-11. The personal API key has `project:write`; PostHog's live API
  schema marks both retention fields as plan-derived and read-only, so another
  key or project PATCH cannot resolve it. Keep the daily
  `posthog-privacy-audit` failing visibly, do not expand collection or enable
  generated-site analytics, and do not claim that 13-month deletion is
  enforced. Resolve through PostHog billing/support, or implement and verify a
  supported scheduled deletion process for timestamped events older than 13
  months, including associated person/property data. Reconsider the provider
  if neither route can provide demonstrable deletion.
- Production browser-smoke-test the mandatory legal notice after deployment. With the notice present, verify ordinary CMS navigation, settings controls, form edits, and save actions against the same flows with no notice present; record browser, route, and reproduction details if interaction is interrupted. The notice is an in-flow alert with no overlay or global event handler, so close this item only after deployed testing confirms the localhost-reported click interruption does not persist.
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
  The privacy foundation is enforced: public tracking fails closed without an
  approved versioned consent contract, legal consent-renewal actions rotate
  that version, CMS events use purpose/property allowlists, and PostHog drift is
  checked daily. This remains open for the approved consent UI and the product
  intelligence expansion itself.
- Confirm the generated-site block/UI catalog covers every required site
  surface, including consent/cookie banners, legal/privacy links, forms,
  navigation, footer, error/empty states, and any required conversion or trust
  sections. Add missing surfaces through the same contract/catalog/schema/
  renderer/canvas path instead of one-off code.
- Approve and register a generated-site consent chrome component before
  enabling public PostHog analytics. The component must use the shared catalog,
  render identically in CMS preview and the public renderer, and expose runtime
  hooks for versioned category consent and withdrawal. Until that approved UI
  exists, generated-site analytics stays disabled rather than falling back to
  renderer-authored banner markup.
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
- Improve CMS editing affordances per active provider component. Every editable
  slot that exists in a block/chrome manifest should have a clear sidebar or
  canvas editing path, visible hover/select cues, empty-state affordances that
  do not leak placeholders to live output, and component-specific controls that
  respect the provider's fixed layout contract. This includes repeaters, media
  fields, optional CTAs, logo-cloud items, bento cells, newsletter form copy,
  banner copy/action, and other provider-owned slots as they are activated.
- Expand the density theme control from outer section padding into a finite
  provider-aware page-rhythm system. Density must still be tenant-wide and
  token-driven, not arbitrary spacing/class editing. For each active
  `shadcnui-blocks` provider variant, map the source's known spacing utilities to approved
  compact/comfortable/spacious values across the whole component: hero inner
  padding such as `py-32 sm:py-48 lg:py-56`, section padding, vertical stacks,
  card/list gaps, grid gaps, media margins, CTA spacing, form spacing, and
  header/banner chrome spacing where appropriate. Keep default/comfortable equal
  to the upstream source values so exact-source parity remains the baseline;
  compact and spacious may adjust only through explicit renderer-owned bridge
  rules for known source classes. Generation and CMS must not output spacing
  classes, layout spans, breakpoints, or per-block spacing overrides.
- Add consistent skeleton or loading affordances on slow customer and operator
  surfaces. Priority gaps today include preview checkout, alternative-domain
  suggestion loading, and generation-run list/detail routes that currently rely
  on spinners, muted placeholders, or no route-level loading shell.
- Improve preview checkout domain availability UX for both actual and perceived
  speed. Keep OpenProvider as the availability source of truth, but tighten the
  domain step UI: faster feedback while checks and suggestions run, clearer
  checking/ready/unavailable states, and a small visual polish pass on the
  alternative-domain picker.
- Add settings search in the CMS so operators can find a setting or section
  without drilling through every Settings group manually. Scope this to the
  existing Settings contract/sidebar model rather than inventing a separate
  settings information architecture.
- Add a cancel-subscription affordance for eligible customers or operators when
  Mollie renewal subscriptions exist. Eligibility must follow the commercial
  contract: for example, a one-year upfront term followed by monthly renewal
  should keep cancel disabled or ghosted until the committed term allows it.
  Wire UI state to real subscription metadata; do not add a cosmetic button the
  server would reject.
- Polish the public customer journey across preview, checkout, intake handoffs,
  and related transactional messages. Align naming conventions, styled HTML/email
  copy, step labels, and success/error states so the flow feels cohesive from
  intake through preview approval, domain selection, payment, and live-site
  handoff.
- Decide the commercial pricing strategy and make Mollie/product logic match it.
  Today deploy config uses fixed first-year and monthly renewal amounts; product
  rules for discounts, launch actions, included-domain surcharges, and renewal
  timing must be explicit in contracts and reflected in checkout/payment state
  rather than only in environment variables.
- Fix canvas block right-click behavior in the page editor. Right-clicking a
  block currently opens the block context menu through a full-viewport overlay
  that greys out or visually obscures the canvas; header/footer chrome does not
  show the same regression because it uses the separate site-chrome context-menu
  path. Resolve through the canonical canvas editor chrome boundary rather than
  a one-off overlay workaround.

## Implemented Foundation

### 2026-07-14 — Operations workspace aligned with Legal

**Status:** Applied.

The former `/generation-runs` task-card page is now the canonical
`/operations` workspace. It follows the Legal workspace information
architecture with an overview, real resource tabs for intake requests and site
runs, global workflow metrics, an attention-first exceptions table, and
searchable/filterable framed registers. Run status filtering is applied to the
derived workflow state before pagination, and overview counts cover the full
active data set instead of only the current result page.

Intake and run detail views retain their existing workflow and recovery logic
while showing the Operations tabs and using canonical `/operations` links.
Preview quick-send remains available from the run register. Legacy
`/generation-runs` list and detail URLs redirect permanently to the matching
Operations routes.

### 2026-07-14 — Transactional email visual alignment

**Status:** Applied.

The shared transactional email shell now loads the same Chivo body font and
Familjen Grotesk heading font used by `www.siteinabox.nl`. Its primary CTA uses
the compact rendered `.btn-eighteen` contract from the public header: the same
anchor class, 15px bold Chivo typography, square yellow surface, two-pixel black
border, and spacing. The five-pixel black right/bottom backdrop is structural
table markup rather than CSS-only `box-shadow`, including the source component's
true five-pixel x/y offset before each visible shadow strip, so restrictive
email clients do not silently remove it. The same system and generic sans-serif
fallbacks as the public site remain for clients that block web fonts.

All shared email typography roles now mirror the public-site contract: Chivo
400 for body/UI copy, Chivo 700 for CTA and emphasized UI labels, and thick
Familjen Grotesk 700 with `-.01em` tracking for email headings. The heading face
is exposed to supporting clients through a direct 700-weight font file. Clients
such as TransIP's Roundcube-derived webmail that strip the webfont fall back to
system sans at a true 700 weight instead of presenting a visibly light title.
The privacy-export
JSON block also uses Chivo instead of introducing a separate monospace family,
and a source-level test prevents outbound email producers from adding unrelated
font families.

### 2026-07-12 — Communication preferences and email policy

**Status:** Implemented.

The CMS now records personal marketing consent with source, statement version,
and immutable preference events, including intake assertions without allowing a
delayed intake request to overwrite a newer decision. Authenticated users can
manage personal product and marketing mail choices in Settings. Tenant owners
can manage per-member operational notification routing while database-level
guards preserve at least one recipient for critical publishing, domain,
billing, and team events.

Optional delivery is enforced centrally: the mail sender validates the current
preference subject and tenant subscription, rejects mismatched or batched
optional recipients, and emits browser-safe preference links plus RFC one-click
unsubscribe headers. Signed public preference and unsubscribe routes allow
future marketing templates to provide an opt-out without requiring a session.
The super-admin Legal workspace exposes a read-only Communications view with
masked preference lists, consent filters, immutable per-person event history,
and tenant notification routing. Direct Payload editing of preference and
routing state is disabled; audited intake, settings, unsubscribe, and provider
workflows remain authoritative.

### 2026-07-11 — Tenant legal requirement workflow

**Status:** Implemented.

The tenant CMS shell now surfaces active legal requirements, and owner-only
`/settings` provides acceptance, objection handling, and compact acceptance history.
Acceptance is tenant-scoped, idempotent, linked to immutable evidence, and
converges duplicate per-owner delivery requirements. Checkout acceptance also
satisfies matching next-transaction requirements. Initial terms acceptance is
required by intake, rechecked at checkout, and required as immutable evidence
before a tenant CMS owner account or live-handoff magic link can be created.
Raw Payload updates to requirement state are disabled; lifecycle changes use
the legal service.

Contract changes eligible for notice plus continued use now have a distinct
`notice_and_continued_use` lifecycle. Successful delivery starts the full
configured objection period; late retries extend rather than shorten that
period. Authenticated tenant publication records qualifying first-party use,
but deemed acceptance occurs only after the objection deadline and only when
delivery, qualifying use, and absence of objection are all proven. These
notices never become overdue and never block CMS use or publication. Material
changes can still be classified for explicit acceptance.

Automatic owner email notification is delivered through the existing platform
mail adapter and Payload scheduler. Continued-use notices contain the complete
updated terms, effective and objection dates, consequences of continued use,
and routes for early acceptance or objection. A system-managed outbox prevents
normal deploy/job retries from duplicating initial or reminder messages.
Delivery attempts remain visible in metadata-only mail logs and failures use
bounded retry backoff, redacted error messages, and operational alerts.

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

Follow-up on 2026-07-15 expanded the internal generic mock fixture into a
realistic five-page shadcnui-blocks smoke site. Each page contains seven normal
landing-page sections and every section uses a different explicit variant,
covering all 13 semantic content block families without turning the fixture
into an exhaustive catalog page. Variant selections are resolved against the
canonical provider manifest. The fixture also exercises system theme mode,
responsive navigation, footer composition, newsletter and announcement
chrome. The normal privacy-page materializer still adds the required legal
system page when the fixture is applied. Contract, CMS validation and canvas
tests pin the five pages, unique approved variants and deliberate invalid-
fixture behavior; no public fixture selector or test bypass was added.

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

### 2026-07-15 — Generated-site provider cutover

**Status:** Complete; provider cutover and production verification gates pass.

The pinned `akash3444/shadcn-ui-blocks` Radix inventory, MIT provenance,
namespaced compatibility primitives, fail-closed contracts, runtime/editor
catalogs, consent-banner materialization, and forward data migration are
present. Read-only inspection of the local legacy PostgreSQL database found 31
applied migrations, four tenants, ten pages, four hero rows, and one
feature-list row; snapshot and generation-run tables are not present at that
schema point. The migration was separately rehearsed on a disposable current
schema and the audited legacy JSON privacy-page shape. CI rejects obsolete
generated-site provider references outside immutable evidence and historical
Payload migrations.

Header/footer settings are now bidirectional with the literal provider views:
tenant page/section/custom links feed flat navigation, `navbar-03` additionally
supports authored flyout groups with described/iconed children, and
`navbar-05` exposes its search and two action regions instead of accepting
links it cannot render. Each layout's item, group, child, column and link limits
are generated once and enforced by contracts, Payload hooks and the editor.
Footer composition preserves every authored item and resolves semantic
contact/business sections from tenant settings; newsletter regions exist only
on `footer-03`/`footer-04`. External-link, sticky/static, active-link and mobile
menu behavior persist through CMS projection and snapshots. Incompatible or
overflowing data fails with a field-specific error rather than truncating or
falling back.

All 132 content variants, 16 chrome variants, and eight system templates now
have explicit literal entries and typed adapters. A canonical importer rerun
reproduces the 542-item audit as 148 public variants, eight system templates,
and 386 explained exclusions. The structured browser suite hydrates all 156
content, chrome and system variants without console/page/network failures and
checks accessibility and available interactions. The self-contained pixel suite matches all 156
imported variants at fixed desktop/mobile viewports in light/dark mode with only
a 0.001% antialias tolerance and no intentional layout deviations. The complete
Payload migration chain also applies successfully to an isolated fresh local
database; the read-only audited legacy database remains untouched.
