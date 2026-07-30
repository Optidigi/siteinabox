# Commerce production evidence

This dossier separates code readiness from approval-gated provider and
deployment evidence. It records capability evidence, not authorization to
make a live payment or register, transfer, renew, or restore a domain.

Never record credentials, transfer codes, customer data, raw provider
responses, payment identifiers, or personal workstation paths in this
repository. Store environment-specific evidence in the approved operational
system and link it from the release change record.

## Current staged matrix

The effective catalogue enables the intended TLD operations from
`2026-07-30T14:30:00Z`. On that date the production Openprovider account
returned every extension as active and transfer-capable, with auth-code
protection, deterministic create/transfer/renew/restore prices, and DNSSEC
key/digest support. These were read-only provider calls: no domain operation
was performed. Provider writes remain governed by the global staged release
gate, payment state, accepted-order evidence, idempotency, and reconciliation.

| TLD | Registration | Incoming transfer | Renewal | Registrant verification | Restoration |
| --- | --- | --- | --- | --- | --- |
| `.nl` | enabled | enabled | provider autorenew | enabled | enabled |
| `.be` | enabled | enabled | provider autorenew | enabled | enabled |
| `.com` | enabled | enabled | provider autorenew | enabled | enabled |
| `.eu` | enabled | enabled | provider autorenew | enabled | enabled |
| `.org` | enabled | enabled | provider autorenew | enabled | enabled |
| `.net` | enabled | enabled | provider autorenew | enabled | enabled |
| `.de` | enabled | enabled | provider autorenew | enabled | enabled |
| `.info` | enabled | enabled | provider autorenew | enabled | enabled |
| `.online` | enabled | enabled | provider autorenew | enabled | enabled |
| `.shop` | enabled | enabled | provider autorenew | enabled | enabled |

Global provider writes remain disabled while the long-lived deployment is in
`shadow`. Before advancing it, complete:

- verified edge/origin trust;
- the public Cloudflare source OAuth client used for customer-authorized zone
  import;
- the controlled paid Mollie checkout/provisioning canary.

Existing paid or provider-committed obligations are not cancelled by a later
feature-gate rollback. Their reconciliation and the minimum safety writes
needed to preserve customer ownership follow the staged release gate in
[Commerce staged release](commerce-release.md).

## Evidence record

For every enabled operation record:

- release SHA and `COMMERCE_RELEASE_EVIDENCE_VERSION`;
- environment and approved operator/change reference;
- provider contract version and primary-document links;
- redacted scenario result, timestamps, and internal correlation key;
- expected and observed monetary, domain, DNS, renewal-date, and publication
  transitions;
- reconciliation result after a worker restart;
- rollback result;
- reviewer and approval references.

An evidence row passes only when the expected provider state was observed,
reconciled to the immutable internal authority, and its rollback was either
successfully rehearsed or explicitly proven forward-only.

## Required rehearsal matrix

### Payments

- first payment: success, cancellation, failure, duplicate and out-of-order
  webhook;
- refund success/failure and chargeback;
- recurring recovery, revoked mandate, and cancellation race;
- unknown provider outcome after payment creation;
- displayed, accepted, paid, invoiced, and credited amount equality;
- duplicate synchronization and duplicate scheduler workers.

Use Mollie test mode. The classic webhook fixture is form-encoded and unsigned.
Do not send a live charge.

### New domains

- registration success, unavailable-after-payment race, indeterminate write,
  registry pending, and registrant verification;
- Cloudflare zone pending and delayed edge certificate;
- publication only after provider, DNS, HTTPS, and renderer verification.

Use only an unambiguously non-production provider sandbox that cannot register
a real domain. Otherwise retain the code gate and run the exact approved live
procedure later.

### Existing domains

- complete authenticated source, customer action required, transfer pending,
  invalid authorization, DNSSEC cutover, and rollback;
- mail, DKIM/TXT, wildcard, delegated-zone, and specialist-record
  preservation;
- unsupported-source and transfer-out paths;
- no new assisted/manual migration sale or EUR 49 operator step. Historical
  assisted and supplemental orders remain immutable audit evidence only.

Public DNS enumeration is supplemental evidence only. Never use it as the
source snapshot.

### Billing and renewals

- monthly and annual cancellation;
- failed payment, day-14 suspension, and recovery;
- covered and uncovered renewal;
- insufficient provider balance, provider flag mismatch, and renewal date not
  advancing;
- 90/60/30/14/7/1 notices and the 7-day admin dossier;
- customer domain and preserved third-party DNS surviving website suspension.

### Renderer and origin

- trusted-edge apex and `www`;
- every candidate enabled TLD;
- unknown, inactive, malformed, cross-tenant, direct-origin, and spoofed-edge
  hosts;
- delayed certificate and renderer restart/reconciliation.

Follow [Renderer origin isolation](renderer-origin-isolation.md). A header by
itself is not origin authentication.

### Database and workers

- empty PostgreSQL 18 migration;
- representative prior schema to current;
- guarded down/forward recovery;
- application and worker startup after migration;
- worker restart, missing-webhook reconciliation, and duplicate worker;
- backup/restore of accepted orders and provider references without replaying
  external writes.

## Safe production action order

These steps require a separate approved production change:

1. Review the release SHA, hosted CI, open critical commerce alerts, and this
   evidence dossier.
2. Back up the database and prove restore availability without restoring over
   production.
3. Deploy the exact reviewed image with `COMMERCE_RELEASE_STAGE=shadow`; its
   boot path applies the committed additive migrations.
4. Verify read-only reconciliation and run the bundled edge-inventory gate.
5. With explicit Cloudflare write approval, run the artifact-contained,
   narrowly scoped edge-routing reconciliation command. Verify the private
   origin and live HTTPS probes, set the origin-isolation evidence flag, then
   run the read-only production-readiness gate. Follow the exact commands in
   [Commerce release](commerce-release.md) and keep the long-lived service in
   `shadow`.
6. Rehearse the controlled paid checkout/provider canary and record redacted
   evidence.
7. Confirm the deployed effective capability catalogue matches the intended
   operation/TLD set.
8. Enable the global production stage only after its
   evidence row passes.
9. Monitor reconciliation, renewal dates, certificate readiness, alerts, and
   customer-visible state before expanding scope.

## Rollback

Set the commerce stage to `shadow` to stop new writes. Disable the affected
operation-specific TLD flag in a reviewed code change. Preserve accepted
orders, invoices, payment attempts, domains, nameservers, DNS records, and
transfer-out access. Continue paid or provider-committed renewal obligations
and provider reconciliation. Use forward recovery when a migration guard
protects immutable legal, secret-audit, supplemental-order, or transfer-out
records.

The additive payment-adjustment enum migration cannot be rolled down after
payment-adjustment evidence exists. Keep the migrated schema, restore the
previous compatible application image if necessary, and correct the
application forward. Never delete accounting evidence to force a schema
rollback.

For an existing-domain cutover, restore the frozen source nameserver/DNSSEC
plan and validate authoritative plus recursive answers before declaring
rollback complete. Never delete or appropriate a customer-owned domain as a
rollback action.
