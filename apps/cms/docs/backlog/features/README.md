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
- Rework desktop canvas chrome hover behavior with a simpler section-anchored
  model. Current header/footer badges can still flicker, and block badges can
  feel like they shift between sections. Defer further tuning until the canvas
  chrome model is simplified around one rule: hovering a section/header/footer
  shows only that section's badge, leaving that area hides it, and badge
  placement remains visually anchored to its owner.

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
activation override. Domain verification is manual in v1 and recorded on the
tenant; DNS automation is still outside the CMS workflow. Rollback is
implemented by reactivating an older snapshot.

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
state after fetching the payment from Mollie; they do not publish snapshots,
activate tenants, or perform domain automation.

Manual waiver remains available to super-admins. Activation continues to require
client approval plus either completed Mollie payment or manual waiver unless a
super-admin uses the existing explicit manual activation override.
