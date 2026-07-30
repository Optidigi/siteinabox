# Existing-domain migration

Existing-domain checkout is High risk and defaults to disabled. The customer
remains the registrant. A failed subscription, failed migration, or rollback
must not delete, appropriate, or prematurely expire the customer domain.

## Release boundary

The checkout always lets a customer select **Ik heb al een domein** and run a
read-only public preflight. That preflight normalizes the domain and reports
authoritative nameservers, DNSSEC presence, probable DNS provider, and
available registrar evidence. It never requests a transfer code, treats public
DNS as complete-source evidence, issues a payable quote, or starts a transfer.

`COMMERCE_EXISTING_DOMAIN_MIGRATION_ENABLED=1` exposes the subsequent
authorized-source and payable migration journey only when the commerce release
gate also permits provider reads. Each source is independently fail-closed:

- `COMMERCE_MIGRATION_SOURCE_CLOUDFLARE_ENABLED=1` enables a customer-scoped
  Cloudflare API connector. The token needs only Zone Read and DNS Read for the
  selected zone. A dedicated encrypted refresh authority is retained for at
  most 30 days, revalidated before registrar commit and nameserver cutover,
  and is never replaced with the Siteinabox destination token.
- `COMMERCE_MIGRATION_SOURCE_AXFR_ENABLED=1` enables authorized AXFR from a
  currently authoritative public nameserver, optionally with an encrypted TSIG
  secret. The server pins the resolved public address, requires matching
  opening/closing SOAs, validates the zone with BIND, and captures twice.
- Generic provider-export uploads are not an automatic checkout mechanism. A
  syntactically valid but partial file cannot prove completeness, so the
  historical parser has no production enablement flag.

Keep both the global flag and the relevant source flag unset in production
until every gate below has current environment-specific evidence:

1. incoming transfer is enabled in the effective TLD capability;
2. Openprovider returns deterministic transfer pricing for that TLD;
3. the transfer authorization contract and operational renewal effect have
   been verified against current provider/registry documentation;
4. `DOMAIN_MIGRATION_ENCRYPTION_KEY` is a stable, backed-up 32-byte key stored
   outside Git;
5. BIND validation is installed in the CMS image and the selected source
   adapter has passed complete/truncated/stale evidence tests;
6. the Cloudflare zone, record-count, and import limits have been rehearsed;
7. authoritative and recursive DNS, preserved mail/service records, renderer
   routing, HTTPS readiness, and rollback have passed in the approved
   environment;
8. provider-write and edge/origin release gates are separately approved.

The Cloudflare connector and AXFR path are automatic. Both perform two stable
captures, freeze the exact source authority hash before payment, and reacquire
the same source after payment before any destination or registrar write.
Changed or revoked evidence returns to a method-specific customer
reauthorization form; the accepted source mechanism and hash cannot change.
Public DNS/RDAP discovery remains supplemental evidence and is never treated
as a complete source. Unsupported records, stale or changed authority,
unsupported TLD behavior, nondeterministic pricing, and any source over the
effective destination capacity stop before payment.

The current pre-payment capacity policy is effective-dated with this release:
new Cloudflare Free zones guarantee 200 DNS records, so checkout accepts at
most 198 source records and reserves two managed website routes. After the
destination zone exists, the worker reads
`GET /zones/{zone_id}/dns_records/usage` and stops before registrar transfer if
the exact quota is insufficient. That exceptional path queues the existing
idempotent full-refund workflow.

Primary contracts:

- [Openprovider transfer API](https://support.openprovider.eu/hc/en-us/articles/360024922953-14-Domains-API-How-to-transfer-a-domain)
- [Openprovider TLD pricing API](https://support.openprovider.eu/hc/en-us/articles/360023656573-1-TLD-API-Search-an-extension)
- [Cloudflare DNS import/export limits](https://developers.cloudflare.com/dns/manage-dns-records/how-to/import-and-export/)
- [SIDN transfer and DNSSEC guidance](https://www.sidn.nl/en/nl-domain-name/transferring-your-domain-name)

## Accepted authority

Before redirecting to Mollie, checkout freezes:

- selected domain and TLD capability version;
- current provider transfer price and quote timestamp;
- automatic classification and exact source mechanism;
- the semantic source-zone hash;
- an opaque reference to the dedicated encrypted checkout-secret record;
- plan, domain allowance/surcharge, migration fee, VAT, and gross amount;
- contracting profile, legal versions, business-use declaration, request
  evidence, and immutable order authority hash.

The immutable order never stores the encrypted zone or transfer code. The
dedicated secret record is access-denied, expires fail-closed, and has its
ciphertext cleared after migration acquisition. The browser formats this quote
but does not calculate it. A changed provider
price produces a new quote requiring explicit acceptance. A cancelled payment
return reissues a short-lived signature over the exact accepted nonvolatile
authority; it never asks the browser to reconstruct the zone or transfer code.

## Customer states

The preview checkout shows a redacted status projection bound to the
authenticated preview grant, generation run, and customer email. It contains
only the domain, migration state, classification, customer action status and
deadline. It never includes a transfer code, zone snapshot, provider payload,
or internal evidence.

`sourceZoneSnapshot`, `targetZoneSnapshot`, and `rollbackEvidence` are
system-internal operational evidence. Payload field access denies them even to
routine collection reads; only reviewed system workflows using
`overrideAccess` may load them. Keep the minimum normalized records needed to
prove semantic preservation and execute rollback. Do not copy the snapshots
into alerts, notes, customer status responses, logs, analytics, or support
exports. Retain them while transfer, DNSSEC, rollback, transfer-out, or a
commerce exception can still require proof or recovery. Any later purge must
be a separately reviewed retention change that preserves immutable hashes,
legal/accounting evidence, and transfer-out obligations; there is currently no
automatic snapshot purge.

There is no new assisted-migration sale or EUR 49 operator step. A source that
cannot be proven and executed automatically is rejected before payment.
Historical assisted orders remain immutable and visible for audit, but they do
not create a new checkout path.

## Rollback and recovery

Before nameserver cutover, a failed or paused migration leaves the old
nameservers and source service in place. During cutover, the rollback workflow:

1. loads the frozen old authoritative nameservers;
2. reconciles any indeterminate provider write before repeating it;
3. restores and verifies the old nameservers;
4. restores the prior tenant verification state;
5. moves the managed domain to manual review without deleting DNS;
6. deletes the encrypted transfer code only after terminal rollback;
7. marks the originating order as an exception for reconciliation.

To stop new migrations, unset
`COMMERCE_EXISTING_DOMAIN_MIGRATION_ENABLED` first. Move
`COMMERCE_RELEASE_STAGE` to `shadow` if forward provider writes must also stop;
this retains reconciliation and safety behavior. Do not remove customer DNS,
mail records, transfer access, or an unexpired domain as rollback.

The `commerce_existing_domain_safety` database migration is forward-recovery
only after it contains any checkout-secret audit row or an unaccepted
supplemental-work proposal. Its down migration deliberately aborts instead of
deleting encrypted input, terminal audit evidence, or changing a customer's
proposal state.

The follow-up `migration_checkout_secret_nullable_run` migration aligns the
`generationRun` relationship with its existing `ON DELETE SET NULL` rule. Its
down migration can restore `NOT NULL` only when no orphaned audit row exists.
If an orphan exists, preserve it and repair forward; do not delete the audit
row to force a schema rollback.

Before a production schema rollback, stop checkout and migration workers and
inspect the secret collection plus migrations in
`awaiting_customer_acceptance`. Do not delete, copy, or decrypt those records
as a rollback shortcut. Keep the current schema, correct the application
forward, and run the normal migration command again. A down migration is
permitted only on an empty disposable schema where both guards are empty.
