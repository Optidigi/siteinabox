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
`commerce-production-readiness-2026-07-30.1`. Set
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
   Size the production PostgreSQL connection budget for Payload, both Better
   Auth pools, and four dedicated commerce advisory-lock connections per CMS
   process. The lock pool is deliberately separate so lock waiters cannot
   exhaust the application pool.
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
8. From the exact reviewed CMS image, keep the long-lived service in `shadow`
   and run the read-only inventory gate:

   ```bash
   docker compose run --rm --no-deps \
     --entrypoint node \
     -e COMMERCE_RELEASE_STAGE=production \
     -e PAYLOAD_DISABLE_JOBS_AUTORUN=1 \
     siteinabox-cms \
     /app/dist-runtime/check-commerce-edge-inventory.bundled.mjs
   ```

9. After explicit approval for the Cloudflare production write, run the
   narrowly scoped edge bootstrap from that same image. It accepts every
   production interlock except the origin-isolation flag that this operation
   exists to establish:

   ```bash
   docker compose run --rm --no-deps \
     --entrypoint node \
     -e COMMERCE_RELEASE_STAGE=production \
     -e COMMERCE_ORIGIN_ISOLATION_VERIFIED= \
     -e PAYLOAD_DISABLE_JOBS_AUTORUN=1 \
     siteinabox-cms \
     /app/dist-runtime/reconcile-commerce-edge-routing.bundled.mjs
   ```

   This command only reconciles exact customer apex, `www`, and
   `admin.<domain>` Cloudflare/Tunnel routes. A pending certificate exits
   non-zero and is rerun; it does not enable unrelated payment, registrar, or
   renewal writes.

10. Prove Tunnel identity, terminal 404 ingress, direct-origin rejection,
    apex/`www`/admin HTTPS, unknown/inactive/cross-tenant rejection, and
    certificate readiness. Only then set
    `COMMERCE_ORIGIN_ISOLATION_VERIFIED=1` in the reviewed deployment
    environment and run the read-only readiness gate:

   ```bash
   docker compose run --rm --no-deps \
     --entrypoint node \
     -e COMMERCE_RELEASE_STAGE=production \
     -e PAYLOAD_DISABLE_JOBS_AUTORUN=1 \
     siteinabox-cms \
     /app/dist-runtime/check-commerce-production-readiness.bundled.mjs
   ```

   The readiness command evaluates all production interlocks without changing
   the running service stage or performing provider writes. It fails when an
   interlock is missing, a critical payment/domain alert remains open, or the
   exact deployed credentials cannot complete the bounded read-only provider
   evidence below:

   - Mollie current-profile and enabled first/recurring payment-method reads;
   - Openprovider login plus EUR reseller-balance read;
   - renderer and CMS Cloudflare Tunnel identity, remote configuration,
     healthy connection, and terminal `http_status:404` reads;
   - active-tenant Cloudflare zone, DNS usage, DNSSEC, Universal SSL, and
     certificate coverage reads.

   Requests go only to the official production API origins, reject redirects,
   enforce per-request and overall deadlines, bound response size, and report
   stable blocker codes without provider bodies or credentials. No additional
   environment variable is required: the command uses the existing provider,
   Tunnel, release-stage, and active-tenant configuration.

   Successful reads are necessary evidence, not write authorization. They do
   not prove Cloudflare Tunnel/DNS Edit, future-zone scope, Mollie payment or
   refund creation, Openprovider registration/transfer/renewal, webhook
   delivery, or transactional email. Keep those exact scopes operator-verified
   and complete the controlled canaries before enabling their independent
   production flags. Primary read contracts:

   - [Mollie current profile](https://docs.mollie.com/reference/get-current-profile)
     and [enabled methods](https://docs.mollie.com/reference/list-methods);
   - [Openprovider API](https://developers.openprovider.com/);
   - [Cloudflare Tunnel read](https://developers.cloudflare.com/api/resources/zero_trust/subresources/tunnels/subresources/cloudflared/methods/get/),
     [configuration read](https://developers.cloudflare.com/api/resources/zero_trust/subresources/tunnels/subresources/cloudflared/subresources/configurations/methods/get/),
     and [connection read](https://developers.cloudflare.com/api/resources/zero_trust/subresources/tunnels/subresources/cloudflared/subresources/connections/methods/get/).

Record environment-specific evidence outside the repository. Do not commit
credentials, customer data, provider responses, transfer codes, operator
transcripts, or machine paths.

Existing-domain checkout has an additional fail-closed feature flag and
evidence matrix. Follow
[Existing-domain migration](existing-domain-migration.md); advancing the
general commerce stage does not enable that customer journey.

Every TLD operation is independently governed in the effective capability
catalogue. The current intended catalogue enables registration, incoming
transfer, provider-autorenew renewal, registrant verification, and restoration
for all ten reviewed TLDs. Advancing the global stage still cannot bypass the
selected TLD contract, accepted payment/order state, or provider-write gate.

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
