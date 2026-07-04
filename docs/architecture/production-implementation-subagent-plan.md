# Production Implementation Subagent Plan

This plan is the next execution plan after the data-driven generation review and
the earlier product-completion phases. It records the updated product decisions:
the landing app rename, the dedicated intake app, Better Auth preview access,
Mollie, official tenant renderer migration, the block catalog policy, and the deferred
OpenProvider/Cloudflare domain automation path.

This document is a plan only. It does not authorize broad refactors, generated
tenant source code, new `sites/*` folders, tenant-specific workflows, or
tenant-specific images.

## Operating Model

- The architect/overseer keeps the high-level architecture context and reviews
  every handoff before the next phase starts.
- Each phase is handled by exactly one focused subagent.
- Subagents should use GPT-5.5 medium reasoning effort when the tool supports
  that model/effort selection. If unavailable, the handoff must state the
  fallback model/effort used.
- Phases run sequentially. Do not run ahead into later phases.
- Every phase has three required subphases: research, implement, and
  review/test.
- Every implementation subphase must stay within the phase scope.
- Every subagent handoff must include changed files, commands run, observed
  behavior, remaining risk, and blocked decisions.
- The architect reviews code, tests, docs, and architecture fit before opening
  the next phase.

## Updated Product Decisions

- `apps/site` should become `apps/landing`. It owns the public marketing site,
  not the intake product app.
- The intake experience must be a separate app under `apps/intake`, served at
  `https://www.siteinabox.nl/intake`.
- The existing demo/placeholder intake scaffold may remain, but it belongs in
  `apps/intake`, not in the landing app.
- The full intake app is being built separately by the operator. Agents must not
  overwrite it. They should integrate it once present and preserve its KVK,
  Zod, business-rule, and output logic.
- Preview must be available at `https://preview.siteinabox.nl/{clientSlug}`.
  The `clientSlug` is derived from the customer's wanted/reserved domain before
  the domain is purchased.
- Preview access must use Better Auth magic-link behavior. The current signed
  HMAC preview link can remain only as an internal implementation detail or be
  replaced if Better Auth makes it redundant.
- A customer should be able to reach preview from:
  - a button in the intake/customer journey when the site is ready;
  - an email sent when the generated site is ready;
  - direct navigation to the preview URL, which should show a login/request
    magic-link screen when the user is not authenticated.
- Mollie is the selected payment service provider. Provider-neutral
  placeholders should be replaced with a Mollie adapter while preserving clear
  payment state in CMS.
- Historical note: this plan originally treated OpenProvider purchase and
  Cloudflare DNS/server routing as deferred work with a manual/stubbed gate.
  That state is superseded by the current AGENTS.md and readiness docs:
  provider automation belongs in approved application/service boundaries, while
  prompt-runbook provisioning flows and tenant-specific deploy artifacts remain
  prohibited.
- Amicare must stay on the data-driven renderer runtime. Its tenant parity
  behavior belongs in scoped renderer/CMS snapshot data and
  `packages/site-renderer`, not restored tenant app source.
- Generic self-serve generated-site styling currently has no active
  provider-backed block sources. The next active family must be exact-source
  Tailwind Plus only; Tailblocks, Preline, adapted Tailwind Plus renderers, and
  SIAB-owned generic visual variants are not active self-serve sources.
- Automated pixel-level block verification is not a priority for the next pass.
  The priority is deterministic catalog metadata, source provenance, renderer
  tests, and manual visual review when catalog variants are added or changed.

## Global Architecture Invariants

- Generation creates structured data, not code.
- AI output must be validated `SiteGenerationSpec` data.
- No generated tenant folders under `sites/*`.
- No generated tenant Astro, React, HTML, CSS, or workflow source.
- No tenant-specific Docker images for generated sites.
- `apps/landing` is the marketing site after rename.
- `apps/intake` is the public intake app after extraction.
- `apps/cms` is the control plane, editor, generation, preview, publishing, and
  operational authority.
- `apps/renderer` is the generic public runtime.
- `packages/contracts` owns shared data contracts and runtime schemas.
- `packages/site-renderer` owns shared rendering logic used by preview and live
  renderer.
- Preview/customizer must not use an iframe.
- Draft CMS data must not affect live output until a new immutable published
  snapshot is created and activated.
- Live renderer output must come only from active published snapshots.
- Domain and payment gates must block activation until their required states are
  satisfied.

## Target Route Shape

| Surface | Target route | App | Auth |
| --- | --- | --- | --- |
| Marketing | `https://www.siteinabox.nl/` | `apps/landing` | Public |
| Intake app | `https://www.siteinabox.nl/intake` | `apps/intake` | Public until account/magic-link steps require auth |
| CMS control plane | `https://admin.siteinabox.nl/` | `apps/cms` | CMS admin auth and role/tenant gates |
| Preview home | `https://preview.siteinabox.nl/{clientSlug}` | `apps/cms` preview surface unless a later phase approves a separate app | Better Auth magic-link session or request-link screen |
| Preview subpage | `https://preview.siteinabox.nl/{clientSlug}/pages/{pageSlug}` | Same preview surface | Better Auth magic-link session |
| Preview auth API | `https://preview.siteinabox.nl/api/auth/*` or approved equivalent | `apps/cms` | Better Auth |
| Intake API | `/api/intake` routed to CMS or a stable CMS origin | `apps/cms` | Public with validation, rate limit, anti-spam |
| Mollie webhook | `/api/payments/mollie/webhook` or approved equivalent | `apps/cms` | Mollie webhook verification and idempotency |
| Domain purchase API | Deferred until full intake/domain phase | `apps/cms` plus `apps/intake` caller | Auth/session or signed intake continuation |
| Renderer live site | `https://{customer-domain}/` | `apps/renderer` | Public, active snapshot only |
| Renderer snapshot API | CMS internal renderer endpoint | `apps/cms` | Bearer token in production |

## Phase 1: App Boundary And Rename Agent

Goal: make app ownership match the product architecture before adding more
customer-facing flows.

### Research

- Inspect `apps/site`, root workspace scripts, deployment docs, Docker/build
  metadata, Traefik assumptions, CI workflows, and package names.
- Identify all references to `apps/site`, `site:build`, public marketing app
  names, and the current `/intake` scaffold.
- Check whether any deploy contract still requires the image/name
  `siteinabox-site`; if so, plan a compatibility alias instead of a hard break.
- Identify the safest way to introduce `apps/intake` without overwriting the
  operator's in-progress intake app.

### Implement

- Rename `apps/site` to `apps/landing`, including package name, local docs,
  scripts, build config references, and workspace scripts.
- Keep a temporary compatibility script such as `site:build` if CI, docs, or
  deployment still depend on it during transition.
- Create or preserve `apps/intake` as the dedicated intake app boundary.
- Move the current demo/placeholder `/intake` scaffold out of the landing app
  and into `apps/intake`, unless the operator's in-progress app is already
  present. If present, integrate around it instead of replacing it.
- Update landing CTAs/navigation so `www.siteinabox.nl/intake` reaches the
  intake app.
- Update docs and AGENTS guidance so future work routes marketing changes to
  `apps/landing` and intake product work to `apps/intake`.

### Review/Test

- Run affected workspace scripts, including landing build/typecheck/test and
  intake build/typecheck/test once available.
- Run root script discovery to ensure no broken `apps/site` references remain
  except intentional compatibility aliases.
- Confirm `www.siteinabox.nl/` still renders marketing content.
- Confirm `www.siteinabox.nl/intake` reaches the intake app scaffold or
  operator-provided app.
- Confirm no tenant source folders, workflows, or images were generated.

## Phase 2: Better Auth Preview Access Agent

Goal: replace the HMAC-only preview-sharing product flow with Better Auth
magic-link access at `preview.siteinabox.nl/{clientSlug}`.

### Research

- Review the current preview route, preview token route, preview customizer
  actions, Better Auth setup, Payload/CMS auth, tenant/user relations, email
  infrastructure, and environment variables.
- Check current Better Auth documentation before implementation.
- Define preview identity: customer email, tenant id, generation run id,
  client slug, allowed pages, expiry, and revocation behavior.
- Decide whether the existing HMAC preview token remains as a secondary
  resource token behind the Better Auth session or is replaced by Better Auth
  session plus server-side access grants.
- Define the customer states:
  - no site ready yet;
  - site ready and magic email sent;
  - direct URL visit without session;
  - expired link/session;
  - authenticated but wrong customer/slug;
  - archived/suspended tenant.

### Implement

- Add preview routes on the preview host shape:
  `/{clientSlug}` and `/{clientSlug}/pages/{pageSlug}`.
- Add a login/request-magic-link screen for unauthenticated preview visitors.
- Add Better Auth magic-link email issuance for preview access.
- Add a server-side preview access grant model or equivalent relation that
  scopes an authenticated customer to the correct tenant, generation run, and
  client slug.
- Add CMS/operator and service hooks to send or resend the "site ready" preview
  email when a run reaches preview-ready state.
- Add an intake/customer-journey entry point that can take the customer to the
  preview URL once the site is ready.
- Preserve renderer-backed preview through the canonical renderer-frame path.
- Preserve the style-token customizer and approval action, but require the
  Better Auth preview access check before loading or mutating preview data.

### Review/Test

- Test direct unauthenticated visit shows request-link/login behavior.
- Test magic-link email creation and callback with a deterministic test mailer.
- Test authenticated correct customer can view only their preview slug/pages.
- Test wrong email, wrong tenant, wrong slug, expired link, revoked access, and
  archived/suspended tenant are blocked.
- Test preview style persistence and approval still work after auth changes.
- Test preview does not expose draft data for another tenant.
- Run CMS typecheck, preview tests, Better Auth route tests, and CMS UI gates.

## Phase 3: Mollie Payment Agent

Goal: replace placeholder payment states with a real Mollie checkout and webhook
flow while preserving activation gates.

### Research

- Review current generation-run payment state, approval flow, activation gate,
  publish services, and operator payment UI.
- Check current Mollie documentation before implementation.
- Define Mollie objects and metadata: generation run id, tenant id, customer
  email, client slug, amount, currency, product/price strategy, and idempotency
  key.
- Define required environment variables and secret handling.
- Define failure states: canceled checkout, expired session, failed payment,
  duplicate webhook, refund/dispute if in scope, and manual waiver.

### Implement

- Add a Mollie payment adapter in CMS.
- Add checkout-session creation from approved preview/customer flow.
- Add Mollie webhook handling with verification and idempotent updates
  to generation-run payment state.
- Keep manual waiver available for super-admins.
- Update activation logic so completed Mollie payment or waiver satisfies the
  payment gate.
- Update customer UI copy so approval, checkout, payment completion, and next
  steps are distinct.
- Document Mollie env vars without committing secret values.

### Review/Test

- Test checkout creation auth and tenant/run scoping.
- Test webhook signature failure, duplicate event, completed payment, canceled
  session, and pending/failed states.
- Test activation blocked before payment and allowed after completed/waived
  payment when all other gates pass.
- Test payment does not publish or activate by itself unless explicitly wired
  and approved.
- Run CMS payment tests, publish/activation tests, typecheck, and UI gates.

## Deferred Phase: Domain Purchase And DNS Provisioning Agent

Status: deferred until the operator's full intake app is ready.

Goal: later automate the domain path with OpenProvider purchase and Cloudflare
DNS readiness while keeping activation safe. This phase is not required for the
current production-readiness pass.

### Research

- Review current tenant domain fields, aliases, domain verification fields,
  renderer host resolution, activation gates, and deployment docs.
- Check current OpenProvider and Cloudflare API documentation before
  implementation.
- Define the domain lifecycle:
  wanted domain, reserved client slug, availability checked, purchase pending,
  purchased, DNS provisioning pending, DNS provisioned, renderer routable,
  live activation ready, failed/manual review.
- Define which app owns each step: intake UI, CMS service, operator UI, or
  background job.
- Define how wildcard Cloudflare DNS to the server interacts with customer
  apex/root domains, aliases, SSL, Traefik, and renderer host resolution.
- Define idempotency and recovery for partial failures: purchased but DNS
  failed, DNS created but CMS update failed, OpenProvider unavailable, or
  Cloudflare unavailable.

### Implement

- Add OpenProvider domain availability and purchase service boundaries.
- Wire the intake/customer flow to store wanted/reserved domain data without
  requiring purchase before preview.
- Add Cloudflare DNS/proxy provisioning service boundaries for purchased
  domains and aliases.
- Replace or extend manual `domainVerification` with automated provisioning
  readiness fields and audit metadata.
- Keep manual override/retry controls for super-admins.
- Update activation checks to require domain provisioning readiness instead of
  a purely manual checkbox, while preserving tenant status and payment gates.
- Update deployment docs for Cloudflare, Traefik, renderer host forwarding, and
  required env vars.

### Review/Test

- Use mocked OpenProvider and Cloudflare clients for tests.
- Test available/unavailable domain, purchase success, purchase failure,
  duplicate purchase attempt, DNS success, DNS failure, retry, and manual review.
- Test preview still works before domain purchase at
  `preview.siteinabox.nl/{clientSlug}`.
- Test live activation remains blocked until domain provisioning is ready.
- Test renderer serves the purchased domain only after snapshot activation.
- Run CMS domain/provisioning tests, renderer host tests, typecheck, and docs
  checks.

## Phase 4: Legacy Tenant Runtime Migration Agent

Goal: migrate Amicare toward the generic renderer runtime without
breaking their current live snapshot paths.

### Research

- Inventory current Amicare CMS/snapshot data,
  `packages/site-renderer` tenant-renderer fixtures, published snapshot fixtures,
  and renderer output.
- Compare current tenant pages, navigation, SEO, media, forms, theme, and
  interaction behavior against renderer-compatible data.
- Identify parity gaps and decide which gaps are required before cutover.
- Identify deployment and rollback requirements for keeping the current tenant
  runtime available during migration.

### Implement

- Convert Amicare content into renderer-compatible CMS/snapshot data
  where gaps are understood and approved.
- Add migration scripts or fixtures that create data, not tenant source files.
- Add renderer parity fixtures/tests for root pages, key subpages, SEO,
  navigation, theme, and media behavior.
- Do not use tenant-specific source structure as the model for new generated
  sites.

### Review/Test

- Build and test renderer output for migrated tenant data.
- Compare key pages manually at desktop and mobile widths.
- Confirm DNS/host routing points tenant domains to the generic renderer.
- Run renderer build/typecheck, fixture tests, and migration tests.

## Phase 5: Block Catalog Governance Agent

Goal: rebuild generated-site blocks around exact-source Tailwind Plus blocks
without reintroducing adapted provider approximations.

### Research

- Review `packages/contracts` block catalog, `packages/site-renderer` block
  implementations, CMS tests, fixtures, and generation prompts.
- Reconfirm Tailwind Plus free/public approval metadata and source availability;
  shadcn blocks are CMS/admin primitives, not generated public-site blocks.
- Identify any path where generation can request unsupported block slugs,
  arbitrary Tailwind classes, raw HTML, or generated component source.
- Identify whether the AI prompt and runtime validation already force catalog
  variants.

### Implement

- Ensure generation prompts and schemas allow only approved Tailwind Plus
  exact-source block slugs and variants once the catalog is re-enabled.
- Add or tighten catalog metadata for source, license, approval state, variant
  id, renderer support, and manual visual-review status.
- Add tests that reject unsupported blocks, unsupported variants, raw HTML,
  arbitrary class names, and paid/license-incompatible sources.
- Add a lightweight manual visual-review checklist for adding or changing a
  catalog variant.
- Defer automated screenshot/pixel matching unless a later phase adds many new
  variants or manual review becomes unreliable.

### Review/Test

- Test AI/mock generation cannot escape the catalog.
- Test renderer supports every approved V1 block and selected variants.
- Test CMS import rejects unsupported block slugs or variants before mutation.
- Run package typecheck, catalog tests, renderer build, and relevant CMS tests.

## Phase 6: End-To-End Staging And CI Agent

Goal: prove the full production-intended flow under staging-like conditions.

### Research

- Inventory required local/staging services: landing, intake scaffold or
  operator-provided intake app, CMS, renderer, Postgres, mailer, Better Auth,
  Mollie test mode, manual/stubbed domain-ready state, and proxy host routing.
- Define deterministic test fixtures for customer email, client slug, requested
  domain/client slug, generated site, payment, manual/stubbed domain readiness,
  and renderer host.
- Define which checks belong in CI and which require a staging runbook.

### Implement

- Add browser/integration coverage for:
  - landing to intake navigation;
  - intake submission and generated draft data;
  - preview-ready email and Better Auth magic-link preview;
  - direct preview URL request-link flow;
  - preview style edit and approval;
  - Mollie checkout/webhook completion in test mode or mocked adapter;
  - manual/stubbed domain readiness gate;
  - publish, activate, renderer root/subpage/404;
  - draft/live isolation, republish, rollback;
  - unknown host and inactive/suspended/archived tenant.
- Add stable CI gates only after they are deterministic.
- Add a staging runbook for provider keys, webhook secrets, DNS/proxy setup,
  and rollback.

### Review/Test

- Run the full workspace matrix:
  `pnpm packages:typecheck`, `pnpm cms:typecheck`, `pnpm cms:test`,
  `pnpm renderer:typecheck`, `pnpm renderer:build`, landing build/test,
  intake build/test.
- Run CMS UI gates and E2E tests.
- Produce a final route matrix, operation matrix, env-var inventory, migration
  inventory, and staging/prod readiness verdict.

## Execution Notes For The Architect

- Do not start a phase until the previous phase has a reviewed handoff.
- If the operator's in-progress intake app appears during Phase 1 or Phase 2,
  pause that phase long enough to inspect it and avoid conflicting edits.
- Better Auth preview access should be solved before Mollie and domain
  automation depend on customer identity.
- Preview slug reservation should happen before domain purchase. For the current
  pass, live-domain automation stays deferred and activation tests should use a
  manual/stubbed domain-ready state.
- The tenant-renderer migration phase must not remove or disable current tenant
  runtime paths until renderer parity and rollback have been reviewed.
- Any phase that changes external provider assumptions must update env docs and
  deployment/runbook docs in the same phase.

## Phase Handoff Template

```txt
Phase:
Subagent/model/effort:

Research summary:
Implementation summary:
Review/test summary:

Changed files:
Commands run:
Routes changed:
Env vars changed:
Migrations/schema changed:
Deployment assumptions changed:

Architecture invariants checked:
Remaining risks:
Blocked decisions:
Recommended next phase:
```
