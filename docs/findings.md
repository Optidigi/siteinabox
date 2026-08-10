# Active findings

This register contains unresolved defects, risks, accepted constraints, and
unknowns. It is not a roadmap or implementation diary. Reverify external-state
observations before acting on them.

The remaining manual non-commerce production smokes for SIAB-001, SIAB-003,
SIAB-004, and SIAB-005 are tracked together in
[#22](https://github.com/Optidigi/siteinabox/issues/22).

## Status ownership

GitHub Issues own actionable execution state, assignment, and closure. This
register owns the durable engineering record: classification, confidence,
scope, evidence, accepted constraints, compatibility windows, and the proof
required before an issue can be closed. Do not copy issue status into this
file. Link the issue when work is actionable; retain historical and accepted
constraints here even after the related issue is closed.

## SIAB-001 - Generated-site visual fidelity is not accepted

- **Classification:** Risk; **confidence:** high for the recorded acceptance gap.
- **Scope:** Shared renderer and provider variants.
- **Evidence:** A 2026-07-17 smoke review recorded an unacceptable `/overzicht`
  hero despite automated parity passing; current output remains unknown.
- **Next:** Reproduce the exact snapshot, variant, viewport, and color mode; fix
  only a demonstrated shared-renderer cause.

## SIAB-002 — PostHog retention exceeds the governance target

- **Classification:** Accepted external constraint / closed; **confidence:**
  high as of the recorded provider verification.
- **Scope:** Analytics privacy and operations.
- **Evidence:** PostHog MCP and API verification on 2026-08-07 found event
  retention set to 12 months with enforcement disabled (previously 84 months
  on 2026-07-11). Repository governance requires 13 months with enforcement.
  The privacy audit logs this governance gap and fails only when provider
  retention exceeds the accepted 84-month ceiling or mutable privacy settings
  drift.
- **Disposition:** On 2026-07-18, the owner explicitly accepted plan-derived,
  unenforced provider retention as an external constraint within an 84-month
  ceiling. No implementation action remains while retention stays at or below
  that ceiling. This acceptance does not represent the current provider value
  as the repository governance target or as provider-enforced deletion.
- **Review trigger:** Reopen only if the PostHog plan/API gains a supported
  13-month enforcement control, applicable legal obligations change, or the
  actual provider retention exceeds the accepted 84-month ceiling.

## SIAB-003 — Legal-notice interaction needs production smoke

- **Classification:** Unknown; **scope:** CMS legal-notice UI.
- **Evidence:** Local testing suggested click interruption, while source shows no
  overlay or global handler; production behavior was not recorded.
- **Next:** Compare normal navigation, edits, and saves with and without the
  notice after an approved deployment.

## SIAB-004 — Form-retention disclosure conflicts with behavior

- **Classification:** Risk; **confidence:** high for repository sources.
- **Scope:** Privacy disclosure and form-submission retention.
- **Evidence:** The retention register records an active-agreement statement
  while CMS behavior uses a 90-day default purge.
- **Next:** Product/privacy owners must align approved disclosure and verified
  implementation; do not resolve this through wording alone.

## SIAB-005 — Viewer forms UI may expose a rejected action

- **Classification:** Risk; **confidence:** medium, not recently reproduced.
- **Scope:** Viewer and management form states.
- **Next:** Reproduce and separate read-only from management UI; never weaken
  server access.

## SIAB-006 — Paid production activation has not been rehearsed

- **Classification:** External release gate; **scope:** payment, domain/DNS,
  publishing, renderer, and handoff mail.
- **Code evidence:** The commerce failure suite, operation-specific TLD gates,
  renderer origin contract, and committed migration chain are exercised in CI.
  A local PostgreSQL 18 rehearsal applies the full migration chain before the
  CMS suite. Production Openprovider read-only evidence confirms the intended
  TLD catalogue, deterministic operation pricing, transfer availability, and
  DNSSEC support. This evidence does not prove a live paid Mollie-to-domain
  provisioning transaction or customer mail delivery.
- **Deployment evidence:** On 2026-07-30, the merged release passed its hosted
  CI and image builds, the production provider-readiness check, authenticated
  read and identical-configuration write verification for both dedicated
  Cloudflare Tunnels, terminal-404 origin probes, direct-origin rejection, and
  live apex, `www`, and tenant-admin HTTPS probes. The public customer-source
  Cloudflare OAuth client is active. The owner explicitly approved advancing
  the long-lived commerce stage for the controlled paid canary.
- **Next:** Complete the controlled paid checkout/provisioning canary and
  capture redacted payment, provider, DNS, renderer, status, and mail evidence.
  Rotate the live payment credential before that canary. If the canary fails,
  return the global stage to `shadow` immediately while preserving and
  reconciling any provider-committed state. Track the controlled canary in
  [#20](https://github.com/Optidigi/siteinabox/issues/20) and the broader
  external operation matrix in
  [#21](https://github.com/Optidigi/siteinabox/issues/21).

## SIAB-007 — Bot protection is outside the CMS surface

- **Classification:** Intentional / accepted constraint.
- **Scope:** Public generated-site forms.
- **Review trigger:** Bot-token validation becomes a shared CMS/renderer
  requirement. Existing rate and payload limits are not bot protection.

## SIAB-008 — Manifest/storage locking assumes one writer

- **Classification:** Accepted constraint with concurrency risk.
- **Review trigger:** Horizontal scaling, multiple writer processes, or shared
  storage-topology changes.

## SIAB-012 — Public analytics activation requires production proof

- **Classification:** Verification pending; **confidence:** high from the
  production project-settings check and intercepted browser payload.
- **Scope:** Landing and generated tenant-site analytics.
- **Evidence:** Commit `99dced376397b6ce3cb89a37da4cb9290fd3c798` implements
  the approved two-tier contract: a minimized cookieless `$pageview` and Web
  Vitals baseline before a choice and after refusal, with richer native
  lifecycle and semantic capture after acceptance. CI run `29650024523` passed
  the fake-ingestion landing and renderer event regressions. The exact images
  were deployed on 2026-07-18; an intercepted production-browser probe decoded
  one baseline `$pageview` for both `siteinabox.nl` and `ami-care.nl`, with no
  PostHog persistence, sensitive query properties, or real provider write. The
  reviewed project-settings sync then enabled stateless cookieless hashing and
  a read-only recheck reports no privacy drift beyond the owner-accepted
  SIAB-002 retention constraint. Real production probes received successful
  ingestion responses, but fresh baseline rows were not yet queryable.
- **Resolution requirement:** Verify a fresh baseline event through the
  provider before closing. Reopen after closure if the consent version,
  generated tenant defaults, public build token, banner, provider setting, or
  event-level browser regressions are removed or weakened.

## SIAB-014 — Commerce compatibility cleanup is runtime-complete

- **Classification:** Runtime cleanup complete; persisted schema cleanup remains
  separately gated.
- **Confidence:** High for static reachability and owner-confirmed absence of
  customers on the retired routes. No production database or provider inventory
  was queried by the coding task.
- **Removed runtime routes:** assisted-migration supplemental checkout and
  synchronization, the `applyMollieWebhookPayment` alias, the
  `mollie_subscription` retry input, order-only Mollie attempt synthesis,
  provider-export checkout/recollection, and schema-v1 assisted checkout-secret
  compatibility. Current checkout accepts only new-domain registration or an
  automatic transfer backed by Cloudflare OAuth or authorized AXFR.
- **Retained live projections:** the generation-run payment projection remains
  consumed by checkout, fulfillment, publishing, preview, administration, and
  post-payment automation. The generation-run domain-order projection remains
  written by provisioning and consumed by activation/status. The
  `preCommerceRoutingAdoption` evidence remains required by release gating,
  edge readiness, snapshot activation, tenant lifecycle hooks, and deployment
  origin-isolation procedures. These paths earn their presence through current
  runtime consumers and were not compatibility-only candidates.
- **Persisted residue:** generated Payload types, collection fields, enum values,
  constraints, and committed migrations still describe historical supplemental,
  assisted/custom-quote, and provider-export values. They are not reachable from
  current checkout or provider dispatch. Removing them changes the database
  schema and audit history and therefore requires a separately approved
  high-risk schema/migration task. The shared migration customer-handle and
  `providerTransferState` concern has the same boundary.
- **Next:** If physical schema removal is desired, inventory the affected rows
  through the approved read-only operator process, define retention/replay
  disposition, and rehearse a committed migration against disposable
  PostgreSQL. Do not delete or rewrite historical migrations.
