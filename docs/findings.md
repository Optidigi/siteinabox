# Active findings

This register contains unresolved defects, risks, accepted constraints, and
unknowns. It is not a roadmap or implementation diary. Reverify external-state
observations before acting on them.

## SIAB-001 — Generated-site visual fidelity is not accepted

- **Classification:** Risk; **confidence:** high for the recorded acceptance gap.
- **Scope:** Shared renderer and provider variants.
- **Evidence:** A 2026-07-17 smoke review recorded an unacceptable `/overzicht`
  hero despite automated parity passing; current output remains unknown.
- **Next:** Reproduce the exact snapshot, variant, viewport, and color mode; fix
  only a demonstrated shared-renderer cause.

## SIAB-002 — PostHog retention exceeds the approved target

- **Classification:** Confirmed external privacy risk; **confidence:** high as
  of the recorded provider verification.
- **Scope:** Analytics privacy and operations.
- **Evidence:** PostHog MCP and API verification on 2026-07-11 found event
  retention set to 84 months with enforcement disabled. Repository governance
  requires 13 months. The scheduled privacy audit intentionally stays red while
  this difference remains.
- **Next:** A privacy owner and named operator must change the plan-derived
  retention entitlement through PostHog billing/support, then rerun
  `pnpm --dir apps/cms posthog:check-settings`. Do not represent the repository
  target as provider-enforced until that check passes.

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

## SIAB-006 — Production activation has not been rehearsed

- **Classification:** Unknown; **scope:** payment, domain/DNS, publishing,
  renderer, and handoff mail.
- **Next:** Run an explicitly approved disposable-domain rehearsal and capture
  provider identifiers, DNS, sender, snapshot, response, and mail evidence.

## SIAB-007 — Bot protection is outside the CMS surface

- **Classification:** Intentional / accepted constraint.
- **Scope:** Public generated-site forms.
- **Review trigger:** Bot-token validation becomes a shared CMS/renderer
  requirement. Existing rate and payload limits are not bot protection.

## SIAB-008 — Manifest/storage locking assumes one writer

- **Classification:** Accepted constraint with concurrency risk.
- **Review trigger:** Horizontal scaling, multiple writer processes, or shared
  storage-topology changes.

## SIAB-009 — Amicare uses a compatibility renderer

- **Classification:** Accepted constraint with migration risk.
- **Scope:** Contracts, shared renderer, CMS preview, and snapshots.
- **Next:** No new tenant may use it. Remove it only with a published and
  visually accepted generic-provider replacement covering all content and
  interaction surfaces.

## SIAB-010 — Renderer page-lifecycle ownership conflicts with the contract

- **Classification:** Historical / closed; **confidence:** high from event-level
  browser regression.
- **Scope:** Public renderer analytics counts and PostHog web analytics.
- **Evidence:** The renderer now delegates `$pageview` and `$pageleave` only to
  PostHog JS. The local intercepted-ingestion browser regression decodes SDK
  batches and beacons, proves one event of each kind after consent, preserves
  native duration and scroll properties, and rejects real PostHog requests.
- **Review trigger:** Reopen if lifecycle events are emitted outside PostHog JS
  or the event-level browser regression loses native duration/scroll coverage.

## SIAB-011 — Legal-content changes do not trigger a renderer image

- **Classification:** Confirmed release-integrity defect; **confidence:** high.
- **Scope:** Renderer image publication and governed legal content.
- **Evidence:** `apps/renderer/package.json` directly depends on
  `@siteinabox/legal-content`, and its Dockerfile copies that workspace package,
  but `build-renderer-image.yml` does not include
  `packages/legal-content/**` in its push paths.
- **Impact:** A legal-content-only merge can leave the published renderer image
  serving the previous legal content.
- **Next:** Add the missing path in a separate release-behavior commit and
  verify a legal-content-only change selects the renderer workflow.
