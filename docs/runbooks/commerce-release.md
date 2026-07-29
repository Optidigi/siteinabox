# Commerce staged release

The commerce lifecycle is a High-risk production operation. Provider writes
remain disabled unless the runtime release gate is satisfied. Never use these
settings as authorization for an unreviewed live provider operation.

## Stages

`COMMERCE_RELEASE_STAGE` has four values:

- `disabled` is the default. Account-wide provider discovery and all new or
  uncommitted writes are blocked. Synchronization of a known webhook/payment
  reference and safety reconciliation for an already paid or
  provider-committed renewal remain allowed.
- `shadow` enables read-only Mollie/Openprovider reconciliation, balance and
  expiry alerts, and transfer-out status checks. It does not enable provider
  writes.
- `sandbox` enables writes only when the current evidence version is present,
  the explicit write acknowledgement is set, Mollie uses a test key, and both
  Openprovider and Cloudflare use explicit reserved `.test` API hosts. Do not
  route these names to live services and use sandbox-only credentials.
- `production` additionally requires `NODE_ENV=production`, a Mollie live key,
  the official Openprovider and Cloudflare API hosts, all webhook/provider and
  migration-encryption secrets, and
  `COMMERCE_ORIGIN_ISOLATION_VERIFIED=1` after the
  [renderer origin-isolation](renderer-origin-isolation.md) contract has been
  rerun for that environment.

The current evidence version is
`commerce-production-readiness-2026-07-28.1`. Set
`COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED=1` only in the separately approved
release environment. This flag is a deployment interlock, not approval by
itself.

## Required evidence

Before moving to the next stage:

1. Complete the fail-closed operation matrix and redacted scenario dossier in
   [Commerce production evidence](commerce-production-evidence.md).
2. Run `pnpm --dir apps/cms check:commerce-release`.
3. Run the complete CMS test suite against disposable PostgreSQL 18 and apply
   the committed migration chain from an empty database.
4. Run `pnpm renderer:deploy-contract`, `pnpm renderer:test`, and
   `pnpm renderer:build`.
5. In provider sandbox or HTTP contract fixtures, rehearse duplicate Mollie
   payments, a missing webhook, an indeterminate registration, low provider
   balance, imminent expiry, transfer-out, and migration rollback.
6. Verify that the transfer-out rehearsal captures the complete authoritative
   Cloudflare zone and DNSSEC status, retains nameservers, mail records, HTTPS
   and renderer entitlement, and requires both contracting-customer
   confirmation and two separated provider-missing observations before
   custody moves.
7. Review open critical commerce alerts. Production writes must not be enabled
   while payment-duplication, provider-balance, expiry, transfer-out, tenancy,
   or origin-isolation alerts remain unresolved.
8. On the target release database, run
   `pnpm --dir apps/cms check:commerce-production-readiness`. This command
   fails when any runtime interlock is missing or any critical payment/domain
   alert remains open. It is a required deployment preflight, not a provider
   write.

Record environment-specific evidence outside the repository. Do not commit
credentials, customer data, provider responses, transfer codes, operator
transcripts, or machine paths.

Existing-domain checkout has an additional fail-closed feature flag and
evidence matrix. Follow
[Existing-domain migration](existing-domain-migration.md); advancing the
general commerce stage does not enable that customer journey.

Every TLD operation is independently fail-closed in the effective capability
catalogue. Advancing the global stage does not enable registration, incoming
transfer, renewal, registrant verification, or restoration for any TLD.

## Paid checkout canary: expected customer and operator flow

For a new-domain canary, the expected sequence is:

1. Checkout shows one server-issued quote. Mollie receives exactly its gross
   amount; returning from Mollie does not fulfill the order.
2. The classic Mollie webhook schedules authoritative synchronization. Once
   Mollie reports the payment paid, the customer sees a six-stage status
   timeline in checkout and an idempotent **Betaling ontvangen** email is
   queued.
3. Openprovider registration starts only after that paid state. A successful
   registration POST is followed by an authoritative domain read. The workflow
   does not advance on the POST response alone. New registrations keep provider
   autorenew off until the accepted renewal obligation has financial coverage;
   the renewal planner retains that obligation even when new renewal
   commitments are feature-gated.
4. If Openprovider reports registrant verification, checkout shows
   **Actie van jou vereist**, including the deadline when available, and a
   durable verification-action email is queued. The customer follows the
   registrar email; Siteinabox never asks for that verification secret.
5. After verified/not-required status, the worker creates or reconciles the
   Cloudflare zone, apex and `www` records, preserves the customer as
   registrant, verifies authoritative DNS and edge HTTPS, and updates the site
   settings with the canonical apex plus explicit `www` alias.
6. Publication occurs only after those checks and entitlement activation. The
   final tenant-admin magic link is recorded as a
   `site_live_handoff` commerce delivery and retried by the existing delivery
   queue on transient failure. Its admin link uses
   `https://admin.<customer-domain>` so the existing host-based tenant gate
   can authorize the owner. DNS, edge TLS, and the CMS route for that exact
   hostname must be active before the paid canary; a tenant owner is
   intentionally rejected on the central super-admin host.

Customer-visible status never contains provider IDs, raw provider payloads,
failure details, transfer codes, or full DNS evidence. Operators inspect:

- `/admin/collections/orders` for accepted/payment/fulfillment state;
- `/admin/collections/payment-attempts` for Mollie synchronization;
- `/admin/collections/managed-domains` for registrar, verification, DNS,
  HTTPS, and entitlement state;
- `/admin/collections/commerce-notification-deliveries` for queued, sent, or
  retrying customer mail;
- operational alerts for manual-review or reconciliation exceptions.

Before the live canary, confirm the production SMTP token and sender work with
a non-customer transactional mail, the delivery worker is running, the
provider balance/readiness check passes, and the chosen domain is deliberately
approved for purchase. Do not use an availability check alone as authorization
to register a real domain.

## Rollback

Move the release stage to `shadow` to stop new provider writes while retaining
reconciliation reads. Do not delete or transfer a customer domain as rollback.
Paid or provider-committed renewal cycles continue, including the narrowly
scoped provider autorenew write needed to complete that obligation. An
uncovered autorenew safety write blocked by the gate raises a critical alert
for explicit operator handling. Governed refunds retain pending credit-note
evidence and raise a critical alert until writes are re-enabled; they are then
coalesced and requeued. Transfer-out keeps DNS, mail, HTTPS and
entitlement intact until customer and provider confirmation; the encrypted
authorization code is deleted only after terminal transfer confirmation.

Before rolling back the schema, resolve or preserve managed-domain offboarding
records and drain both queued and completed `prepare-domain-transfer-out` job
rows. The generated down migration recreates the previous task enum and cannot
cast that Phase 11 task value. Rehearse the drain plus down/forward migration
against disposable PostgreSQL before production rollback. Reverting
application code before the database migration is safe because the added
managed-domain fields are backward-compatible and default custody remains
`managed`.
