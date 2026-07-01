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
  `sites/*` and the old `packages/site-template` package have been removed.

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

## Open Follow-Up

- Write a new architecture decision before starting any replacement product
  surface.
- Revisit tenant provisioning, preview, approval, payment handoff, and publish
  responsibilities as part of that decision.
- Keep CMS feature work tracked in focused entries or runbooks that match the
  current codebase, not removed generation workflows.
- Add PostHog analytics to the public `apps/landing` Site in a Box marketing
  site. Track complete SIAB funnel and content-performance context there too,
  not only generated tenant sites and CMS/admin usage.
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
- Introduce approved shadcn blocks as future site-generation source material.
  They need provenance, license/availability review, structured CMS field
  mappings, renderer-owned implementations, editable canvas support, and tests
  before AI can use them.
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
- Simplify the CMS Operations dashboard further. The current manager-facing
  language is better than the original generation-run terminology, but the
  screen is still too dense. Next pass should make the dashboard feel like one
  task queue with only the next required action visible by default. Align the
  UI to the intended product workflow: client submits intake; SIAB reviews the
  brief and uses AI to create the draft site; SIAB sends preview; client
  approves and pays in the preview UI while choosing/filling domain details;
  payment triggers deployment/domain registration and tenant sender verification;
  deployment completion sends the client the live site and CMS/admin access
  email. Keep technical snapshot,
  publish, activation, provider/model, hashes, validation, and manual override
  details behind Advanced controls.

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

Remaining integration points:

- Connect the public `siteinabox.nl/intake` form UI to `POST /api/intake`.
- Add the later approval/payment/publish handoff after product architecture is
  approved.

Phase 4 hardening on 2026-06-26 aligned generated root pages on the renderer's
`index` convention, rejected public test-only fixture controls at the intake
route boundary, kept fixture selection available only through internal test
hooks, and made draft import writes skip projection/source-file hooks.

### Phase 7 — AI generation service

**Status:** Foundation added 2026-06-25.

The intake workflow now uses a provider-backed AI generation service instead of
calling the fixture loader directly. The default provider remains `mock` for
local development and tests, while `SITE_GENERATION_PROVIDER=openai` enables the
OpenAI Responses API path. Generation runs record provider, model, prompt
version, input/output hashes, raw/parsed output where available, validation,
apply results, attempts, and errors.

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

Follow-up on 2026-06-28 added CMS-side guardrails for tenant-exclusive legacy
chrome variants. Amicare variants remain editable for their official
legacy tenant slugs, but SiteSettings validation rejects those variants for
future/generated tenants through server-side collection validation. The
SiteSettings admin select fields also filter tenant-exclusive choices out for
generic tenants while keeping them available to the official legacy slugs. The
publish projection now preserves editable chrome variant, banner, CTA, and
legal-link settings in immutable snapshots, and snapshot tests cover renderer
analytics metadata in the published settings shape. A later hardening follow-up
omits hidden or empty announcement banner shells from the published projection.

### Phase 3 — Mollie payment gate

**Status:** Foundation added 2026-06-26.

The generation-run payment gate now has a Mollie checkout and webhook path in
CMS. Approved preview/customer flows and super-admin operator flows can create a
Mollie hosted checkout scoped to the generation run, tenant, customer email, and
preview client slug. Mollie webhooks update only the generation-run payment JSON
state after fetching the payment from Mollie; they do not publish snapshots or
activate tenants. Live-key paid checkout can continue into approved
OpenProvider/Cloudflare domain provisioning and Cloudflare Email Sending
subdomain setup, but those provider actions still do not publish or activate a
site by themselves.

Manual waiver remains available to super-admins. Activation continues to require
client approval plus either completed Mollie payment or manual waiver unless a
super-admin uses the existing explicit manual activation override. Domain and
tenant sender verification remain separate activation gates.

### 2026-07-01 — Mail observability and tenant sender gate

**Status:** Foundation added 2026-07-01.

Cloudflare Email Sending is now represented in CMS operations as both a
platform SMTP delivery path and tenant sender state. The CMS records
metadata-only outbound delivery rows in `mail-logs` and writes
super-admin-visible `operational-alerts` for important or repeated mail
failures. Rendered subjects, bodies, and secrets are not stored.

Public intake storage sends an internal notification to the SIAB admin mailbox
through the platform sender. Generated-site form notifications send only when
the tenant has a verified Cloudflare sender and a Site Settings contact email.
Tenant provisioning stores non-secret Email Sending API state on
`tenants.emailSending`; generated-site activation for a run is blocked until
that state is verified.
