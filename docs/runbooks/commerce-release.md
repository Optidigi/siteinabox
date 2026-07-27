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
  `COMMERCE_ORIGIN_ISOLATION_VERIFIED=1` after the Phase 6 edge/origin contract
  has been rerun for that environment.

The current evidence version is `phase11-2026-07-27.1`. Set
`COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED=1` only in the separately approved
release environment. This flag is a deployment interlock, not approval by
itself.

## Required evidence

Before moving to the next stage:

1. Run `pnpm --dir apps/cms check:commerce-release`.
2. Run the complete CMS test suite against disposable PostgreSQL 18 and apply
   the committed migration chain from an empty database.
3. Run `pnpm renderer:deploy-contract`, `pnpm renderer:test`, and
   `pnpm renderer:build`.
4. In provider sandbox or HTTP contract fixtures, rehearse duplicate Mollie
   payments, a missing webhook, an indeterminate registration, low provider
   balance, imminent expiry, transfer-out, and migration rollback.
5. Verify that the transfer-out rehearsal captures the complete authoritative
   Cloudflare zone and DNSSEC status, retains nameservers, mail records, HTTPS
   and renderer entitlement, and requires both contracting-customer
   confirmation and two separated provider-missing observations before
   custody moves.
6. Review open critical commerce alerts. Production writes must not be enabled
   while payment-duplication, provider-balance, expiry, transfer-out, tenancy,
   or origin-isolation alerts remain unresolved.
7. On the target release database, run
   `pnpm --dir apps/cms check:commerce-production-readiness`. This command
   fails when any runtime interlock is missing or any critical payment/domain
   alert remains open. It is a required deployment preflight, not a provider
   write.

Record environment-specific evidence outside the repository. Do not commit
credentials, customer data, provider responses, transfer codes, operator
transcripts, or machine paths.

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
