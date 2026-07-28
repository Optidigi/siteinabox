# Commerce production evidence

This dossier separates code readiness from approval-gated provider and
deployment evidence. It is a template, not authorization to make a live
payment, register or transfer a domain, change DNS, or deploy.

Never record credentials, transfer codes, customer data, raw provider
responses, payment identifiers, or personal workstation paths in this
repository. Store environment-specific evidence in the approved operational
system and link it from the release change record.

## Current fail-closed matrix

The effective TLD catalogue models the intended contract surface, but its
operation-specific production flags remain disabled until each row has its own
approved evidence. A modeled capability is not production enablement.

| TLD | Registration | Incoming transfer | Renewal | Registrant verification | Restoration |
| --- | --- | --- | --- | --- | --- |
| `.nl` | disabled | disabled | disabled | disabled | disabled |
| `.be` | disabled | disabled | disabled | disabled | disabled |
| `.com` | disabled | disabled | disabled | disabled | disabled |
| `.eu` | disabled | disabled | disabled | disabled | disabled |
| `.org` | disabled | disabled | disabled | disabled | disabled |
| `.net` | disabled | disabled | disabled | disabled | disabled |
| `.de` | disabled | disabled | disabled | disabled | disabled |
| `.info` | disabled | disabled | disabled | disabled | disabled |
| `.online` | disabled | disabled | disabled | disabled | disabled |
| `.shop` | disabled | disabled | disabled | disabled | disabled |

Global production evidence also remains disabled:

- authenticated provider connector, authorized AXFR/IXFR, and automatic
  validated-export DNS sources;
- assisted migration;
- renderer multi-TLD routing;
- verified edge/origin trust;
- application-created recurring Mollie payments.

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

- complete authenticated source, assisted standard, customer action required,
  transfer pending, invalid authorization, DNSSEC cutover, and rollback;
- mail, DKIM/TXT, wildcard, delegated-zone, and specialist-record
  preservation;
- unsupported/custom-quote and transfer-out paths;
- unexpected operator work blocked until the immutable supplemental order is
  paid.

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
3. Apply the committed migrations and run the production-readiness preflight.
4. Deploy with `COMMERCE_RELEASE_STAGE=shadow`; verify read-only reconciliation.
5. Establish and verify private/authenticated Cloudflare-to-origin routing.
6. Rehearse the approved provider scenarios and record redacted evidence.
7. Enable one operation for one TLD in the effective capability catalogue,
   review and deploy that code change, then perform a controlled canary.
8. Enable the matching global feature and production stage only after its
   evidence row passes.
9. Monitor reconciliation, renewal dates, certificate readiness, alerts, and
   customer-visible state before expanding scope.

Do not combine TLD expansion with a payment, migration, or origin-topology
change.

## Rollback

Set the commerce stage to `shadow` to stop new writes. Disable the affected
operation-specific TLD flag in a reviewed code change. Preserve accepted
orders, invoices, payment attempts, domains, nameservers, DNS records, and
transfer-out access. Continue paid or provider-committed renewal obligations
and provider reconciliation. Use forward recovery when a migration guard
protects immutable legal, secret-audit, supplemental-order, or transfer-out
records.

For an existing-domain cutover, restore the frozen source nameserver/DNSSEC
plan and validate authoritative plus recursive answers before declaring
rollback complete. Never delete or appropriate a customer-owned domain as a
rollback action.
