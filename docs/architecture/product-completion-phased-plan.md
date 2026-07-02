# Product Completion Phased Plan

This plan closes the remaining gap between the current data-driven generation
foundation and a production-ready self-serve Site in a Box flow.

It uses the same operating model as the prior remediation plan: one focused
agent per phase, phases run sequentially, and every phase has research,
implement, and review subphases.

When execution begins, the project overseer/architect should stay in xhigh
reasoning mode and should delegate one phase at a time to a single focused
subagent using the GPT medium-thinking model, when available. The overseer
reviews each phase before the next phase starts, and subagents should not run
ahead into later phases without explicit approval.

## Current State

### Can The System Generate A Site?

Yes, but only as a draft-data workflow.

The CMS can accept a structured intake through `POST /api/intake`, normalize it,
run the configured generation provider, validate the resulting
`SiteGenerationSpec`, and import draft tenant, site settings, pages, theme, SEO,
manifest, and generation-run data.

This does not yet mean a generated site is live. Generated pages are imported as
draft CMS data. Publishing requires an approved generation run and published
run-linked pages before a `PublishedSiteSnapshot` can be created and activated.
Activation then still respects domain verification and payment/manual override
rules.

### Intake UI Status

There is a production intake app routed at `/intake` and connected to the CMS
intake route. The CMS route stores normalized submissions for SIAB review; it
does not automatically generate a site from the public POST.

`apps/landing` has public marketing pages and a contact form on `/contact`.
That form posts to CMS `POST /api/contact` for platform mail to
`admin@siteinabox.nl`; it is not the generation intake flow. The home-page CTA
should navigate into the dedicated intake surface.

The intended public intake surface is a dedicated, substantial intake
application/form mounted at `www.siteinabox.nl/intake`. The marketing site should
navigate users into that intake surface, but intake itself should not be treated
as a small contact-section replacement. The intake app is expected to own its own
multi-step UI, KVK API lookup/enrichment, Zod validation/schema logic, business
rules, normalized output shape, and wiring into the CMS intake API.

The CMS has tenant form/submission management screens and generation operations
screens for reviewing intake submissions and triggering draft generation after
super-admin approval.

### Preview UI Status

The current preview/customizer UI exists under
`apps/cms/src/app/(frontend)/(site-preview)/[clientSlug]` and renders directly
with `@siteinabox/site-renderer`; it does not use an iframe. The legacy
`apps/cms/src/app/(frontend)/(site-preview)/preview/[token]` route remains a
compatibility path and is disabled in production unless explicitly enabled.

It currently supports:

- Better Auth magic-link preview access with scoped active grants;
- tenant/page availability checks;
- shared-renderer canvas output;
- style-token changes for palette/color mode, fonts, radius, density, and style
  preset;
- approval recording through the preview action.

It is not product-complete yet:

- there is no full customer review/comment workflow;
- page switching is loaded in the service data but not exposed as a polished
  preview navigation control;
- save/error/status feedback is minimal;
- the button says "Approve & Pay", but no real payment adapter or payment
  handoff exists;
- approval does not perform publish or activation, which is correct, but the
  UI does not clearly expose the later steps;
- preview-token creation exists as an API, but no complete operator/customer UI
  flow for issuing and sharing preview links is implemented.

### Block Catalog And Source Styling Status

A source-backed block catalog exists in
`packages/contracts/src/block-catalog.ts`, with renderer classes and fixtures in
`packages/site-renderer`.

Confirmed source-backed entries currently include:

- Tailwind Plus free/public blocks:
  - `hero:tailwindPlusSimpleCentered`;
  - `featureList:tailwindPlusCentered2x2`;
  - `contactSection:tailwindPlusNewsletterDetails`.
- Tailblocks:
  - `richText:tailblocksContentA`;
  - `cta:tailblocksCtaA`.
- Mamba UI:
  - `faq:mambaFaq1`;
  - `testimonials:mambaTestimonial1`.
- HyperUI:
  - `contactSection:hyperUiNewsletterCentered`.
- Preline free:
  - `contactSection:prelineCenteredNewsletter`.

Those entries are locally available as catalog provenance, section variants, and
renderer implementations. They are not all stored as vendored upstream HTML
source files. Tailwind Plus entries are recorded as public-page-payload sources,
so the next agent should verify the public/free source access again before
expanding the catalog.

The current implementation uses `adapted-exact-style` rather than literal tenant
source generation. That matches the data-driven architecture, but it means visual
exactness must be reviewed against the approved source block before each source
variant is accepted.

### Existing UIs

Current useful UI surfaces include:

- `apps/landing` marketing home and contact page;
- CMS login, profile, API key, dashboard, sites list, site dashboard;
- CMS page list and page editor/canvas;
- CMS site settings, navigation, media, users, forms, analytics, onboarding;
- signed preview/customizer route.

Missing or incomplete product UIs:

- dedicated public intake app at `/intake`, with KVK/Zod/business-logic output
  wired to `POST /api/intake`;
- generation-run dashboard/status/error detail;
- generated draft review/promotion UI;
- preview-link issuance/share UI;
- payment/waiver UI;
- publish/activate/rollback operator UI;
- domain verification UI;
- renderer/live-site health and snapshot diagnostics UI.

## Global Invariants

- Generation creates structured data, not code.
- No new generated tenant folders under `sites/*`.
- No tenant-specific workflows or images for generated sites.
- `apps/landing` remains the marketing surface.
- `apps/intake` owns the public-intake surface.
- The public intake experience should be a dedicated intake application/surface
  under `www.siteinabox.nl/intake`; `apps/landing` may route or link users there,
  but intake owns its own validation, enrichment, and output contract before it
  posts to CMS.
- `apps/cms` remains the control plane.
- `apps/renderer` remains the generic public runtime.
- Preview/customizer must render with `packages/site-renderer` directly and must
  not use an iframe.
- Draft data must not affect live output until a new snapshot is published and
  activated.
- Activation must respect approval, payment/manual override, tenant status, and
  domain verification rules.
- Generated-site styling must come from approved catalog variants only:
  shadcn-owned primitives, Tailwind Plus free/public blocks, Tailblocks, Mamba
  UI, HyperUI, Preline free, or later SIAB-owned custom blocks that have passed
  source, license, accessibility, and visual review.
- External blocks must be exact-style implementations of approved source blocks,
  not loose inspiration. Paid, locked, or license-incompatible blocks stay
  unavailable.

## Phase 1: Product Flow Inventory Agent

Goal: turn the current implementation into an exact workflow map so the next
phases build the missing UI and operations without changing architecture.

### Research

- Trace the current API/service flow from `POST /api/intake` through generation,
  import, preview, approval, publish, activation, renderer lookup, and rollback.
- Inventory all UI surfaces that already exist in `apps/landing`, `apps/intake`,
  and `apps/cms`.
- Identify which operations are API-only, service-only, hidden in tests, or
  fully user-operable.
- Document every state transition for intake submissions, generation runs,
  page status, approval, payment, snapshot status, domain verification, and
  tenant status.

### Implement

- Add or update a short architecture/workflow doc that records the current
  product-state map.
- Do not add product behavior in this phase.
- If route or status naming is ambiguous, document the ambiguity instead of
  renaming it.

### Review

- Confirm the doc covers public customer, operator, CMS admin, and renderer
  perspectives.
- Verify no code generation, tenant source folders, workflows, or images were
  introduced.
- Run docs-only checks if available; otherwise run `git diff --check`.

## Phase 2: Block Source Catalog And Visual Exactness Agent

Goal: lock down the approved block-source catalog and make it enforceable before
new generated sites depend on it.

### Research

- Re-read `packages/contracts/src/block-catalog.ts`,
  `packages/site-renderer/src/styles.css`, renderer block components, fixtures,
  and `apps/cms/tests/unit/blockCatalog.test.ts`.
- Verify every source-backed variant has source URL, license status, free/public
  availability, upstream block name/id, renderer class, fixture coverage, and
  visual source notes.
- Re-check Tailwind Plus free/public access for the current variants and record
  whether source payloads are publicly available and compatible with compact
  provenance.
- Review Tailblocks, Mamba UI, HyperUI, and Preline free source access and
  confirm the current provenance is sufficient for SIAB generated-site use.

### Implement

- Add any missing catalog metadata needed to prove source, license, approval,
  visual-exactness status, and free/public availability.
- Add or update tests so unsupported, paid, locked, or license-incompatible
  source variants cannot enter `SITE_SOURCE_BACKED_BLOCK_VARIANTS`.
- If exact upstream markup is needed for auditability, add a minimal local
  source-manifest path or documented retrieval process. Do not generate tenant
  source files.
- Keep styling in `packages/site-renderer` and shared UI primitives only.

### Review

- Compare each renderer source-backed variant against its approved source block
  at desktop and mobile widths.
- Confirm every first-catalog source-backed variant is exercised in fixtures and
  tests.
- Run `pnpm packages:typecheck`, focused block-catalog tests, and
  `pnpm renderer:build`.

## Phase 3: Public Intake App Agent

Goal: make it possible for a customer to complete the dedicated intake app at
`www.siteinabox.nl/intake`, producing validated intake output that can be wired
into `POST /api/intake`.

### Research

- Review the public intake schema and validation in `packages/contracts` and
  `apps/cms/src/lib/intake/publicIntakeValidation.ts`.
- Review the in-progress intake app/form work and decide its repo/app/route
  boundary before implementation. Do not assume the intake surface is just a
  small section inside `apps/landing`.
- Review the current marketing CTAs and contact form in `apps/landing` only to
  decide how users navigate to `/intake`.
- Inventory KVK API usage, required env vars, rate limits, error modes,
  consent/privacy copy, and fallback behavior when enrichment fails.
- Review the intake app's Zod schemas, normalization logic, business rules, and
  expected output payload before wiring it into the CMS API.
- Identify CORS/origin, spam, consent, analytics, and error-display
  requirements for posting from the `/intake` app to the CMS API.

### Implement

- Add or wire the dedicated public intake app/route at `/intake`, keeping the
  route reachable from `www.siteinabox.nl/intake`.
- Update the marketing site CTA/navigation to send users to `/intake`.
- Keep the contact form separate; do not repurpose platform contact mail as
  generation intake.
- Use the intake app's KVK enrichment, Zod schema validation, normalization, and
  business logic to produce the payload sent to `POST /api/intake`.
- Show submission, validation, queued/generating, success, and failure states.
- Do not expose test-only controls such as mock fixture selection.
- Keep generated output as data only; do not create tenant source files.

### Review

- Test happy path and validation failures from the UI.
- Test KVK lookup success, failure, timeout/rate-limit handling, and manual
  fallback behavior.
- Confirm failed intake does not mutate CMS beyond allowed intake/error records.
- Confirm duplicate/retry behavior is coherent and idempotent.
- Run the intake app's own typecheck/build/test commands, `pnpm site:build`, and
  relevant CMS intake tests.

## Phase 4: Generation Run Operations UI Agent

Goal: give operators visibility into intake submissions and generation runs,
including failures and generated draft records.

### Research

- Review `IntakeSubmissions` and `SiteGenerationRuns` collection fields and
  current Payload admin visibility.
- Identify data needed for an operator list/detail screen: status, provider,
  model, timestamps, hashes, validation issues, apply result, tenant, pages,
  settings, and error payloads.
- Decide whether the first UI belongs in custom CMS routes, Payload admin, or
  both.

### Implement

- Add CMS control-plane list/detail UI for intake submissions and generation
  runs.
- Include filters for failed, preview-ready, and needs-review runs.
- Surface validation/apply errors without exposing secrets or raw provider data
  unnecessarily.
- Add an operator action to retry failed generation only if the existing service
  contract already supports it safely; otherwise document retry as a follow-up.

### Review

- Verify super-admin/owner/editor/viewer access behavior.
- Test failed generation, invalid output, and preview-ready run display.
- Run `pnpm cms:typecheck`, focused generation-run tests, and CMS UI gates.

## Phase 5: Draft Review And Promotion Agent

Goal: close the current P1 gap where generation imports draft pages but publish
requires published run-linked pages.

### Research

- Trace page status handling in the importer, page editor, publish snapshot
  builder, and generation-run page relationships.
- Decide the approved product rule: manual page-by-page promotion, bulk promote
  approved run pages, or publish-time controlled promotion.
- Identify how removed/stale generated pages should stay retained but not be
  promoted.

### Implement

- Add an explicit promotion operation for approved generation-run pages.
- Keep promotion separate from snapshot activation; promotion should make draft
  CMS pages publishable, not live.
- Only promote pages linked to the selected generation run.
- Record who promoted the run and when, if the current schema supports it; if
  not, add a minimal schema/migration only with operator approval.

### Review

- Test same-run promotion, changed spec promotion, removed page retention, and
  no-page failure.
- Confirm drafts cannot become public until snapshot publish and activation.
- Run focused importer/publish tests, `pnpm cms:typecheck`, and migration checks
  if schema changed.

## Phase 6: Preview Link And Customer Review Agent

Goal: make preview sharing and customer review complete enough for staging.

### Research

- Trace `/api/preview-tokens`, `/preview/[token]`, and preview customizer data.
- Identify who can issue preview links and how customers receive them.
- Review what a customer needs: page switching, preview expiry, style controls,
  comments or feedback, approval state, payment handoff clarity.

### Implement

- Add an operator UI to create/copy preview links for a selected generation run
  or page.
- Add page navigation in the preview/customizer for all previewable pages.
- Improve save/error/status feedback for theme-token persistence.
- Add review notes/comments only if there is an existing storage contract;
  otherwise document as a follow-up.
- Keep preview iframe-free and directly rendered through `packages/site-renderer`.

### Review

- Test valid, expired, invalid, wrong-tenant, suspended/archived tenant, and
  wrong-page tokens.
- Test page switching and persisted style-token reload.
- Confirm approval records state only and does not publish, activate, or bypass
  payment.
- Run focused preview tests and CMS UI gates.

## Phase 7: Payment And Waiver Agent

Goal: replace the payment placeholder with a provider-neutral operational gate.

Current Phase 7 behavior: generation runs keep provider-neutral payment state in
`site-generation-runs.payment` JSON. Preview approval records
`pending_provider`; super-admin operators can mark payment `completed` or
`waived` from `/generation-runs/[id]` with provider/reference/actor/timestamp
and note audit metadata. These actions satisfy the activation payment gate but
do not publish, activate, roll back, or call a payment provider.

### Research

- Review current `payment` state on generation runs and activation checks.
- Define the Mollie adapter boundary and manual waiver flow.
- Identify required audit fields: provider, external reference, status,
  completed/waived timestamp, actor, and note.
- Confirm Mollie checkout/webhook behavior without weakening activation gates.

### Implement

- Add a Mollie payment abstraction that can record completed or waived payment
  without coupling publish/activation to the provider callback.
- Add a CMS operator UI for manual waiver and payment-state inspection.
- Update preview/customer copy so "Approve & Pay" does not imply a completed
  payment when only placeholder state exists.
- Do not activate automatically unless the activation contract explicitly says
  to do so.

### Review

- Test activation blocked with pending payment.
- Test activation allowed with completed payment.
- Test activation allowed with waived payment.
- Test manual activation override still requires tenant/domain safety gates.
- Run focused publish/payment tests and CMS gates.

## Phase 8: Publish, Activate, Rollback UI Agent

Goal: make snapshot lifecycle operations available to operators through a clear
CMS UI.

Current Phase 8 behavior: super-admin operators can manage snapshot lifecycle
from `/generation-runs/[id]`. The UI shows tenant snapshots, active snapshot
state, linked published-page readiness, tenant/domain safety state, approval and
payment activation blockers, and missing-snapshot warnings. Operators can
publish without activation, publish and activate, activate an existing snapshot,
use a manual activation override for approval/payment only, and roll back by
reactivating a previous snapshot. The implementation uses the existing publish
services/API contract and does not add domain verification automation, provider-
specific payment code, renderer endpoint tests, tenant source folders,
workflows, or images.

### Research

- Trace `POST /api/publish`, `publishSiteSnapshot`,
  `activatePublishedSnapshot`, rollback behavior, and route auth.
- Inventory snapshot states and data needed for an operator table/detail view.
- Identify confirmation text for publish, activate, manual override, and
  rollback.

### Implement

- Add CMS UI for snapshots per tenant/generation run.
- Support publish without activation, activate, manual activation override, and
  rollback.
- Show activation blockers: approval, payment, domain verification, tenant
  status, missing published pages, missing active snapshot.
- Add route-level tests for `/api/publish`.

### Review

- Verify unauthenticated and non-super-admin publish fails.
- Verify publish/activate/rollback state transitions.
- Confirm snapshot immutable fields cannot be edited through UI or API.
- Run focused publish tests, `pnpm cms:typecheck`, and CMS gates.

## Phase 9: Domain Verification And Deployment Agent

Goal: make production routing assumptions explicit and operator-verifiable.

### Research

- Review tenant domain fields, aliases, domain verification fields, renderer
  host resolution, and deployment docs.
- Identify whether canonical-domain redirect is in scope or aliases should serve
  the same snapshot.
- Define the production environment contract for CMS, renderer, Traefik, tokens,
  and host forwarding.

### Implement

- Add a domain verification operator UI or checklist tied to existing tenant
  fields.
- Add renderer snapshot endpoint route-level tests for bearer-token behavior,
  unknown host, alias, inactive tenant, and invalid snapshot.
- Update deployment docs for required env vars and expected proxy headers.
- Do not automate DNS changes unless explicitly approved.

### Review

- Test renderer fixture mode is impossible in production.
- Test missing CMS URL fails fast in production.
- Test unknown host/path and inactive tenant behavior.
- Run renderer typecheck/build and focused CMS route tests.

## Phase 10: End-To-End Browser And CI Verification Agent

Goal: prove the full customer/operator/live-site flow works in staging-like
conditions.

### Research

- Identify which local services are required: Postgres, CMS, renderer, optional
  mock payment adapter, and provider env.
- Define test fixtures for a full generated site with at least one subpage.
- Identify CI/runtime constraints, especially Node 26 parity.

### Implement

- Add Playwright or integration coverage for the practical E2E flow:
  intake submit, generation, draft import, preview link, preview style edit,
  approval, page promotion, payment completed/waived, publish, activate,
  renderer root/subpage/404, draft/live isolation, republish, rollback,
  unknown host, inactive tenant.
- Add CI gates only for checks that are stable enough for CI.
- Keep tests data-driven and generic; do not create tenant source.

### Review

- Run the full command matrix:
  `pnpm packages:typecheck`, `pnpm cms:typecheck`, `pnpm cms:test`,
  `pnpm renderer:typecheck`, `pnpm renderer:build`, and `pnpm site:build`.
- Run CMS UI gates and any new E2E tests.
- Produce a final staging/prod readiness report with route and operation
  matrices.
