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

## SIAB-002 — PostHog retention exceeds the governance target

- **Classification:** Accepted external constraint / closed; **confidence:**
  high as of the recorded provider verification.
- **Scope:** Analytics privacy and operations.
- **Evidence:** PostHog MCP and API verification on 2026-07-11 found event
  retention set to 84 months with enforcement disabled. Repository governance
  requires 13 months. The strict privacy audit continues to report this
  difference as a monitoring signal.
- **Disposition:** On 2026-07-18, the owner explicitly accepted the current
  plan-derived 84-month, unenforced provider retention as an external
  constraint. No implementation action remains. This acceptance does not
  represent 84 months as the repository governance target or as provider-
  enforced deletion.
- **Review trigger:** Reopen only if the PostHog plan/API gains a supported
  13-month enforcement control, applicable legal obligations change, or the
  actual provider retention exceeds the accepted 84-month state.

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

## SIAB-009 — Ami Care compatibility renderer retirement

- **Classification:** Historical / closed; **confidence:** high from production
  migration and browser verification.
- **Scope:** Contracts, shared renderer, CMS preview, persisted CMS data, and
  published snapshots.
- **Evidence:** The canonical Ami Care fixture now uses approved provider
  blocks and chrome, the shared terracotta theme, structured media and contact
  bindings, and the generic published-snapshot schema. Tenant-by-host renderer
  selection, tenant-only variants, CSS, rich-text import matchers, repair tools,
  and save-time auto-publish wiring were removed. The owning migration rebuilds
  current Ami Care CMS rows and activates a generic snapshot before dropping
  the retired chrome enum values; focused contract, renderer, CMS, and migration
  tests cover the cutover. A fresh disposable PostgreSQL migration rehearsal
  and local desktop/mobile browser smoke cover the schema, provider blocks,
  media bindings, navigation, terracotta theme, consent chrome, and responsive
  layout without contacting real analytics ingestion. Production deployment on
  2026-07-19 applied both cutover migrations and activated snapshot version 112.
  Read-only browser verification proved the home and privacy routes return 200,
  the intended provider variants and terracotta tokens are active, all bound
  media loads, the fixed consent chrome remains in the viewport, desktop and
  mobile have no horizontal overflow or browser errors, the privacy link and
  legal-content block render, and retired `amicZen` output is absent. Form
  submission behavior remains covered by CI and was intentionally not exercised
  against production.
- **Review trigger:** Reopen if Ami Care regains tenant-specific renderer code,
  retired variants or tokens, non-provider snapshots, or loses its media,
  consent, contact, or legal-page coverage.

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

- **Classification:** Historical / closed; **confidence:** high from hosted
  workflow selection and repository coverage.
- **Scope:** Renderer image publication and governed legal content.
- **Evidence:** `apps/renderer/package.json` directly depends on
  `@siteinabox/legal-content`, and its Dockerfile copies that workspace package,
  while `build-renderer-image.yml` now includes `packages/legal-content/**` in
  its push paths. The deploy-contract check exercises a legal-content-only
  changed-path fixture and requires that dependency/path relationship. Push
  `c9b8f179136bc81ae502d735101b276e650c166e` selected and completed the hosted
  `build-renderer-image` workflow successfully in GitHub Actions run
  `29639715030`.
- **Review trigger:** Reopen if the renderer loses its legal-content workspace
  dependency, Docker build input, workflow path selection, or deploy-contract
  fixture.

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

## SIAB-013 — Page-editor saves can diverge from the active snapshot

- **Classification:** Confirmed defect; implementation deployed, authenticated
  save verification pending; **confidence:** high from production database,
  release, and browser evidence.
- **Scope:** CMS page editor, tenant themes/settings, snapshot publication, and
  generated-site consent chrome.
- **Evidence:** On 2026-07-19 the Ami Care tenant stored the newer
  `red-confident`/`rounded` theme and a four-block home page while active
  snapshot version 112 still served `terracotta-warm`/`soft` and five blocks.
  The former browser save flow committed related writes before a separate
  publication request, collapsed every related failure to “Save failed,” and
  logged no publication error. `banner-03` also used a deliberately translucent
  `bg-primary/10` surface. The replacement route owns page, theme, navigation,
  chrome, snapshot construction, and activation in one Payload/PostgreSQL
  transaction, returns and logs the failing stage, and the banner now uses an
  opaque semantic surface. Focused tests cover commit and rollback behavior and
  the opaque banner contract. Commit `0c062027` was deployed to both production
  images on 2026-07-19 after the CMS and renderer image workflows, packaged
  image smokes, complete CMS suite, renderer browser suite, and four-mode
  provider parity matrix passed. Both containers were healthy, CMS boot found
  no pending migrations, and desktop/mobile production probes showed the
  consent chrome fixed at the viewport bottom with an opaque semantic surface.
- **Resolution requirement:** Perform one authenticated Ami Care save and prove
  the committed page/theme values match the newly active snapshot and live
  renderer output before closing.
