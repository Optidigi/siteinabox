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

## SIAB-002 — PostHog retention enforcement is unconfirmed

- **Classification:** Risk; current provider state unknown.
- **Scope:** Analytics privacy and operations.
- **Evidence:** Recorded provider retention differed from the platform maximum.
- **Next:** A privacy owner and named operator must verify enforcement before
  expanding collection or generated-site analytics.

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
