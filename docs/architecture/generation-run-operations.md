# Generation Run Operations UI

Phase 4 adds the first CMS control-plane UI for intake submissions and
site-generation runs.

## Route Decision

The first operator UI lives in custom CMS routes under `/generation-runs`, with
Payload admin collection screens linked as a raw fallback:

- `/generation-runs` lists generation runs and intake submissions.
- `/generation-runs/[id]` shows a generation-run detail view.
- `/generation-runs/submissions/[id]` shows an intake-submission detail view.

Custom routes are the safer default because they can summarize operational data
without exposing raw provider output, full prompt/input payloads, or
secret-looking keys. Payload admin remains useful for super-admin raw
inspection.

## Access

The routes use `requireRole(["super-admin"])`. Owner, editor, and viewer users
continue to be redirected by the existing CMS auth gate and cannot read the
underlying `intake-submissions` or `site-generation-runs` collections, which
are also super-admin-only.

## Visible Operational Data

The UI surfaces:

- status, provider, model, prompt version, attempts, timestamps, and hashes;
- failed, preview-ready, and needs-review filters;
- validation issue counts and summarized validation payloads;
- apply-result summaries and generated draft links for tenant, pages, and
  settings;
- intake metadata, normalized/raw intake summaries, and error summaries;
- client approval and provider-neutral payment gate state.

Raw provider output and generation input are not rendered in the custom detail
views. JSON summaries redact keys matching common token, secret, authorization,
cookie, password, and raw-output names.

## Retry

No retry action is implemented in Phase 4. The existing service contract retries
transient provider failures only during initial processing and then reuses
identical failed runs by idempotency key. A safe operator retry needs an
explicit service contract for creating or superseding a failed run without
duplicating tenant/page/settings mutations.

## Draft Promotion

Phase 5 uses explicit bulk promotion for the selected, client-approved
generation run.

Promotion is a CMS data operation, not snapshot publishing or activation:

- only `site-generation-runs.pages` entries from the selected run are eligible;
- retained pages from older generation specs stay in CMS and keep their current
  status, but are not promoted by a later run unless that run links them;
- if any page linked by the selected run is missing, promotion fails before any
  page status changes are written;
- promotion changes eligible draft CMS pages to `published` so snapshot creation
  can include them;
- promotion writes with `skipProjection`, so disk projection does not
  make those pages public;
- public output still requires a published snapshot and activation.

Promotion audit metadata is stored in the run's existing `applyResult.promotion`
JSON object with promoted timestamp, actor id, promoted page ids,
and already-published page ids. No schema migration was introduced for Phase 5.

## Preview Link And Customer Review

Phase 6 adds preview sharing to the existing super-admin generation-run detail
route. Operators open `/generation-runs/[id]`, enter the customer email, and
send a Better Auth magic link for `https://preview.siteinabox.nl/{clientSlug}`.
The CMS creates or refreshes a `preview-access-grants` row scoped to the
customer email, tenant, generation run, domain-derived client slug, and pages.

Customer preview remains renderer-backed: preview-host routes load preview data
only after a valid isolated preview Better Auth session and active grant are
verified, then host renderer output through the `/renderer-frame` route. The
preview surface exposes page navigation for the previewable tenant pages,
style-token save/error status, approval state, and the provider-neutral payment
gate state. The old `/preview/[token]` HMAC route is internal compatibility
only and production-disabled unless `ENABLE_LEGACY_PREVIEW_TOKEN_ROUTE=1`.

Approval still records state only on the latest `preview_ready` generation run:
`clientApproval.status = approved` and `payment.status = pending_provider`.
It does not promote pages, publish snapshots, activate tenants, or bypass the
payment gate.

## Payment Gate Operations

Phase 7 centralizes generation-run payment state in the existing
`site-generation-runs.payment` JSON field. The provider-neutral shape supports
`not_started`, `pending_provider`, `completed`, and `waived`, plus audit metadata
for provider, external reference, actor, completion/waiver timestamp, updated
timestamp, and operator note.

The generation-run detail route remains super-admin only and now exposes payment
inspection plus two manual operator actions:

- mark payment completed;
- waive payment.

Both actions write only `site-generation-runs.payment`. The current provider
path is Mollie behind the CMS payment adapter; payment actions do not publish
pages, create snapshots, activate tenants, or roll back snapshots. Phase 8
remains responsible for any publish/activate/rollback operator UI.

Activation continues to rely on `canActivatePublishedSnapshot`: non-manual
activation requires client approval and payment `completed` or `waived`; manual
activation can bypass approval/payment only after tenant safety checks still
pass, including non-suspended/non-archived tenant status and verified domain
ownership.

## Snapshot Lifecycle Operations

Phase 8 adds snapshot lifecycle controls to the existing super-admin
`/generation-runs/[id]` detail route. Operators can:

- publish the selected generation run as an immutable `published-site-snapshots`
  record without activation;
- publish and activate in one explicit operator action;
- activate an existing snapshot for the tenant;
- reactivate an older snapshot in rollback mode, which marks the replaced active
  snapshot as `rolled_back`.

The UI calls server actions guarded with `requireRole(["super-admin"])`; those
actions use the publish services rather than editing snapshot records directly.
Generation-run snapshot publish, publish+activate, and rollback bodies on the
raw `POST /api/publish` route remain super-admin-only for API-level operation.
The route also contains a separate official-tenant current-state path used by
the CMS page editor: owner/editor users may publish and activate all currently
published CMS pages for their own official tenant only. That path does not allow
tenant users to publish generation-run snapshots, rollback, operate on another
tenant, or publish non-official tenants.

The detail route lists tenant snapshots with key, status, version, hash, publish
time, active-snapshot state, linked-page publication state, tenant status, and
manual domain-verification status. It surfaces blockers from the existing
activation gate:

- client approval is required for normal activation;
- payment must be completed or waived for normal activation;
- manual activation can bypass approval/payment only;
- suspended or archived tenants cannot publish or activate;
- domain verification must already be `verified`;
- run-linked generated-site activation requires verified tenant Email Sending,
  normally `noreply@mail.<tenant-domain>` through Cloudflare Email Sending;
- all pages linked to the generation run must be promoted to CMS `published`
  before publishing a snapshot;
- operators are warned when no snapshots exist or when snapshots exist but none
  is active.

No domain verification automation, payment-provider integration, renderer
endpoint change, tenant source folder, workflow, or image is introduced by this
phase.

Review notes/comments are intentionally not implemented in Phase 6. No existing
storage contract was found for customer review threads or page-level comments;
that should be added as a later schema/API/UI phase before collecting comments
inside customer previews.
