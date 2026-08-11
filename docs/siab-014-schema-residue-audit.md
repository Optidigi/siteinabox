# SIAB-014 physical schema residue audit plan

Status: research complete; physical removal remains deferred. This document
does not authorize a migration, data update, or deletion of migration history.
The bounded read-only production evidence recorded below was collected under
explicit operator approval; no schema or data write was performed.

Physical schema cleanup is separate from normal maintainability cleanup because
the database may contain records written by older application versions,
published snapshots, rollback state, legal history, commerce evidence, or
provider reconciliation data.

## Current conclusion

No physical removal candidate is removal-ready from repository evidence alone.
The apparently old values and fields below are still referenced by active code,
current collection schemas, rollback logic, or migration history:

| Artifact | Current evidence | Disposition |
| --- | --- | --- |
| `paused_supplemental_order` | `apps/cms/src/app/(frontend)/(admin)/operations/migrations/[id]/page.tsx:77-82`, `apps/cms/src/lib/domains/migrationDecisions.ts:44`, and `apps/cms/src/lib/domains/migrationOperatorRecovery.ts:89-128` | Retain. |
| `custom_quote_required` | `apps/cms/src/collections/DomainMigrations.ts:174-199`, `apps/cms/src/lib/domains/migrationDecisions.ts:36`, and `apps/cms/src/components/preview/checkout/checkoutLifecycle.ts:29` | Retain. |
| `siteinabox_incident_recovery` | `apps/cms/src/collections/DomainMigrations.ts:187,356` and `apps/cms/src/lib/domains/migrationOperatorRecovery.ts:98-128` | Retain as incident and operator history. |
| `non_billable_incident_authorized` | `apps/cms/src/collections/DomainMigrations.ts:78-82,199` and `apps/cms/src/lib/domains/migrationOperatorRecovery.ts:100-128` | Retain as governed commerce/operator evidence. |
| `incident_recovery_migration_fee_charged` | `apps/cms/src/migrations/20260726_201427_phase4_mollie_payments.ts:10` and `apps/cms/src/lib/payments/molliePayments.ts:3109` | Retain as accounting/refund history. |
| `providerTransferState` | `apps/cms/src/collections/DomainMigrations.ts:96,444` and `apps/cms/src/lib/domains/migration.ts:559-575,3922-4702` | Retain for provider reconciliation and rollback. |
| `provider_customer_handle` | `apps/cms/src/migrations/20260726_211516_phase5_new_nl_domain.ts:12,31,45,55` and active migration/provisioning code | Retain until provider-data and retry compatibility are proven. |
| Operator-work fields and enum types | `apps/cms/src/collections/DomainMigrations.ts:348-398` and `apps/cms/src/migrations/20260727_142003_phase10_assisted_migration.ts:5-47` | Retain; current operator recovery uses them. |
| `migration_checkout_secrets` | `apps/cms/src/collections/MigrationCheckoutSecrets.ts:67-133` and `apps/cms/src/lib/domains/migrationCheckoutSecret.ts:34-425` | Retain; encrypted secret lifecycle is security-relevant. |
| `migration_source_authorizations` | `apps/cms/src/collections/MigrationSourceAuthorizations.ts:72-133` and `apps/cms/src/migrations/20260730_030555_cloudflare_source_oauth.ts:5-37` | Retain; authorization and revocation state is security-relevant. |

## Repository inventory to audit in production

### Fields and values

The read-only audit must account for these fields and values, not only search
for one suspected column:

| Area | Fields or values |
| --- | --- |
| Migration state | `state`, including `paused_supplemental_order` and `custom_quote_required`; `state_history`. |
| Operator work | `operator_work_classification`, `operator_work_cause`, `operator_work_scope`, `operator_work_authorization_state`, `operator_work_authorization_order_id`, `operator_work_authorization_payment_attempt_id`, authorization/start/completion timestamps and actor fields, `operator_work_completion_notes`, `automation_resumed_at`. |
| Provider transfer | `provider_transfer_state`, `provider_transfer_id`, `provider_domain_id`, `provider_customer_handle`, `encrypted_transfer_code`, transfer timestamps and reconciliation fields. |
| Incident and accounting | `siteinabox_incident_recovery`, `non_billable_incident_authorized`, `incident_recovery_migration_fee_charged`, and related refund/accounting scenarios. |
| Migration checkout secrets | `secret_key`, `generation_run_id`, `order_id`, `domain_name_ascii`, `source_zone_hash`, `encrypted_input`, `state`, `expires_at`, `consumed_at`. Values must be counted or digested, never printed. |
| Source authorizations | `authorization_key`, `state_digest`, `generation_run_id`, tenant/client/domain identifiers, `customer_email_digest`, encrypted authority, state and expiry fields. Values must be counted or digested, never printed. |
| Related commerce/profile/legal history | Checkout-profile, payment-attempt, order, accounting, consent, legal-publication, and customer-handle fields named by the schema and historical migrations. Exact removal candidates remain unknown until the schema and data inventories are reconciled. |

### Tables and collections

The first audit scope is:

| Table or collection | Why it is in scope |
| --- | --- |
| `domain_migrations` | Migration state, provider writes, operator work, state history, rollback and reconciliation. |
| `migration_checkout_secrets` | Encrypted, attached, consumed, and expired checkout authority. |
| `migration_source_authorizations` | OAuth/source authorization lifecycle and revocation. |
| `managed_domains` | Provider customer handle and domain provisioning state. |
| `checkout_profiles` | Profile data referenced by migration and commerce records. |
| `payment_attempts`, `orders`, `accounting_documents` | Payment, authorization, refund, and incident-recovery evidence. |
| Legal and publication collections | Consent, legal release, publication, and snapshot rollback evidence. |

The exact physical table names must be taken from the live schema and the
current generated migration snapshots. Do not infer them from collection slugs
when running the production audit.

### Schema types and indexes

Known governed types include:

| Type | Source evidence |
| --- | --- |
| `enum_domain_migrations_state` | `apps/cms/src/migrations/20260727_120231_phase9_automatic_domain_migration.ts:6` |
| `enum_domain_migrations_provider_transfer_state` | `apps/cms/src/migrations/20260727_120231_phase9_automatic_domain_migration.ts:8` |
| `enum_domain_migrations_operator_work_classification` | `apps/cms/src/migrations/20260727_142003_phase10_assisted_migration.ts:5` |
| `enum_domain_migrations_operator_work_cause` | `apps/cms/src/migrations/20260727_142003_phase10_assisted_migration.ts:6` |
| `enum_domain_migrations_operator_work_authorization_state` | `apps/cms/src/migrations/20260727_142003_phase10_assisted_migration.ts:7` and the later value addition in `apps/cms/src/migrations/20260728_130835_commerce_existing_domain_safety.ts:6` |
| `enum_accounting_documents_refund_scenario` | `apps/cms/src/migrations/20260726_201427_phase4_mollie_payments.ts:10` |
| `enum_migration_checkout_secrets_state` | `apps/cms/src/migrations/20260728_130835_commerce_existing_domain_safety.ts:5` |
| `enum_migration_source_authorizations_state` | `apps/cms/src/migrations/20260730_030555_cloudflare_source_oauth.ts:5` |

Index families that require counts and dependency checks include
`domain_migrations_*`, `managed_domains_provider_customer_handle_idx`,
`migration_checkout_secrets_*`, and `migration_source_authorizations_*`.
The phase 9, phase 10, commerce-safety, and OAuth migrations contain the
authoritative historical definitions and down paths.

Known index names that must be counted and dependency-checked include:

```text
domain_migrations_provider_customer_handle_idx
domain_migrations_provider_transfer_state_idx
domain_migrations_provider_transfer_id_idx
domain_migrations_provider_domain_id_idx
domain_migrations_supplemental_order_idx
domain_migrations_operator_work_classification_idx
domain_migrations_operator_work_cause_idx
domain_migrations_operator_work_authorization_state_idx
domain_migrations_operator_work_authorization_order_idx
domain_migrations_operator_work_authorization_payment_at_idx
domain_migrations_operator_work_authorized_at_idx
domain_migrations_operator_work_started_at_idx
domain_migrations_operator_work_started_by_idx
domain_migrations_operator_work_completed_at_idx
domain_migrations_operator_work_completed_by_idx
domain_migrations_automation_resumed_at_idx
managed_domains_provider_customer_handle_idx
migration_checkout_secrets_secret_key_idx
migration_checkout_secrets_generation_run_idx
migration_checkout_secrets_order_idx
migration_checkout_secrets_domain_name_ascii_idx
migration_checkout_secrets_source_zone_hash_idx
migration_checkout_secrets_state_idx
migration_checkout_secrets_expires_at_idx
migration_checkout_secrets_consumed_at_idx
migration_source_authorizations_authorization_key_idx
migration_source_authorizations_state_digest_idx
migration_source_authorizations_generation_run_idx
migration_source_authorizations_tenant_idx
migration_source_authorizations_customer_email_digest_idx
migration_source_authorizations_domain_name_ascii_idx
migration_source_authorizations_state_idx
migration_source_authorizations_expires_at_idx
```

## Read-only production audit query plan

The query plan below is the reviewable baseline for any future audit extension.
The bounded production probe recorded later in this document did not execute
these full queries and did not perform a schema or data write.

### Preconditions

1. Obtain an approved read-only database role with no write, DDL, advisory-lock,
   or function-execution privilege.
2. Record the exact database identifier, host class, schema, application image
   SHA, migration ledger state, and UTC start time.
3. Confirm a restorable backup exists and record its backup identifier and
   retention date before collecting data counts.
4. Run against a read replica or approved consistent snapshot where possible.
5. Redact secret material, customer email, DNS contents, and legal content from
   logs. Return counts, hashes, nullability, and state distributions only.

### Schema and migration ledger

Collect the following read-only facts:

```sql
select current_database(), current_schema(), current_setting('server_version');

select table_schema, table_name, column_name, data_type, udt_name,
       is_nullable, column_default
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema')
order by table_schema, table_name, ordinal_position;

select n.nspname as schema_name, c.relname as table_name,
       c.relnatts, c.reltuples
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and n.nspname not in ('pg_catalog', 'information_schema')
order by n.nspname, c.relname;

-- Replace <payload_migrations_table> with the table name discovered above.
select * from <payload_migrations_table> order by batch desc, created_at desc;
```

The migration ledger query must use the actual table name discovered from the
installed Payload schema. Do not assume the table name or fabricate a ledger
row.

### Enum values, constraints, and indexes

For every suspected enum, collect labels and ownership without changing them:

```sql
select n.nspname as schema_name, t.typname as type_name, e.enumsortorder,
       e.enumlabel
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where t.typname in (
  'enum_domain_migrations_state',
  'enum_domain_migrations_provider_transfer_state',
  'enum_domain_migrations_operator_work_classification',
  'enum_domain_migrations_operator_work_cause',
  'enum_domain_migrations_operator_work_authorization_state',
  'enum_accounting_documents_refund_scenario',
  'enum_migration_checkout_secrets_state',
  'enum_migration_source_authorizations_state'
)
order by type_name, e.enumsortorder;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where tablename in (
  'domain_migrations', 'managed_domains', 'migration_checkout_secrets',
  'migration_source_authorizations'
)
order by schemaname, tablename, indexname;
```

Also collect foreign-key and check-constraint dependencies for every candidate
column before considering an index or type change.

### Data counts and references

For each candidate value, collect total, non-null, distinct, and per-state
counts. Use parameterized queries or reviewed fixed SQL; do not build SQL from
untrusted values. At minimum, count:

1. Each migration state and operator-work state.
2. Incident and refund scenarios.
3. Provider transfer states and presence of provider identifiers.
4. Active, attached, consumed, and expired checkout secrets.
5. Source authorizations by lifecycle state and expiry bucket.
6. Rows with state history, rollback state, reconciliation required, or
   published snapshot references.
7. Foreign-key orphans and rows whose referenced tenant, order, payment,
   managed domain, snapshot, or user no longer exists.

For JSONB and snapshot columns, return key-frequency and SHA-256 digests of
canonicalized values, never raw payloads. Check published snapshots, migration
state history, audit/event payloads, and rollback records for old field names or
values before declaring a field unused.

## Disposable rehearsal

Before any physical change:

1. Restore the approved backup into an isolated disposable PostgreSQL instance.
2. Install the exact current application image and run the owning migration
   checks without external provider credentials or writes.
3. Rehearse the proposed migration forward and backward where the migration
   supports a down path; record failures instead of fabricating a clean state.
4. Exercise old supported application versions against the rehearsal database
   if the support window permits them.
5. Verify tenant isolation, commerce reads, legal history, migration recovery,
   published renderer snapshots, and admin/operator screens.
6. Compare schema dumps, enum labels, index definitions, row counts, and
   representative redacted hashes before and after.

## Deployment and rollback plan

Physical removal must not be included in a normal cleanup PR.

1. Ship an application version that no longer writes the candidate field only
   after the data audit proves the writer set is closed.
2. Keep reads and rollback tooling compatible for the agreed support window.
3. Take and verify a fresh restorable backup immediately before deployment.
4. Apply the schema migration in a separately reviewed high-risk change with
   explicit lock and statement-timeout handling.
5. Verify counts, constraints, indexes, application health, migration ledger,
   tenant access, commerce reconciliation, legal records, and renderer
   snapshots after deployment.
6. Roll back by restoring the previous application image and backup or by using
   the reviewed down migration only if its reversibility was rehearsed. Never
   invent a down migration during an incident.
7. Keep migration files permanently as repository history. Reversing physical
   schema does not justify deleting historical migration files.

## Removal gate

A future PR may propose physical removal only when all of these are attached:

- read-only production counts and state distributions;
- backup identifier, restore test, and retention decision;
- current and supported old application-version compatibility results;
- provider, tenancy, commerce, legal, renderer, snapshot, and rollback consumer
  evidence;
- disposable PostgreSQL forward/rollback rehearsal logs;
- exact deployment ordering, lock behavior, verification, and rollback plan;
- owner approval from database operations and the affected product owners.

Until that evidence exists, SIAB-014 is high-risk deferred work and the current
fields, values, tables, indexes, schema types, and migration history are
retained.

## Commands used for this inventory

```text
git grep -nE 'paused_supplemental_order|custom_quote_required|siteinabox_incident_recovery|non_billable_incident_authorized|incident_recovery_migration_fee_charged|operator_work_cause|operator_work_authorization_state|providerTransferState|customer.?handle|checkout.?secret|MigrationCheckoutSecrets|MigrationSourceAuthorizations' -- apps packages docs
git grep -nE 'CREATE TYPE|ALTER TYPE|DROP TYPE|CREATE TABLE|DROP TABLE|ADD COLUMN|DROP COLUMN|CREATE (UNIQUE )?INDEX|DROP INDEX' -- apps/cms/src/migrations
git grep -nE '20260727_142003_phase10_assisted_migration|20260728_130835_commerce_existing_domain_safety|20260730_030555_cloudflare_source_oauth' -- apps/cms/src/migrations/index.ts apps/cms/src/migrations
```

No migration, provider mutation, or data write was performed. The bounded
read-only production evidence recorded below is intentionally narrower than
this full query plan and does not make any physical removal candidate
removal-ready.

## Production evidence collected on 2026-08-11

A read-only probe was run against the running `siteinabox-cms-postgres`
container using the container's configured database credentials. The session
reported database `payload`, PostgreSQL 18, user `payload`, and
`pg_is_in_recovery() = false`. No application, schema, or provider write was
performed.

Exact current row counts were:

| Table | Rows |
| --- | ---: |
| `accounting_documents` | 0 |
| `checkout_profiles` | 1 |
| `domain_migrations` | 0 |
| `domain_renewal_cycles` | 0 |
| `managed_domains` | 0 |
| `migration_checkout_secrets` | 0 |
| `migration_source_authorizations` | 0 |
| `orders` | 1 |
| `payment_attempts` | 1 |

The following nullable migration/provider fields had zero non-null values:

- `domain_migrations.provider_customer_handle`
- `domain_migrations.provider_transfer_state`
- `domain_migrations.operator_work_classification`
- `domain_migrations.supplemental_order_id`
- `domain_migrations.encrypted_source_refresh_authority`
- `migration_checkout_secrets.secret_key`
- `migration_source_authorizations.authorization_key`
- `managed_domains.provider_customer_handle`

The incident and migration labels remain physical schema objects. Current
production enum labels include `paused_supplemental_order`,
`custom_quote_required`, `non_billable_incident_authorized`,
`siteinabox_incident_recovery`, and `incident_recovery_migration_fee_charged`.
The current migration history contains the commerce and migration migrations
through `20260804_131545_optional_domain_query`; migration history is retained
as permanent rollback and provenance evidence.

A bounded JSONB-key probe over the migration, domain, checkout, order, payment,
and accounting tables found zero rows containing the checked historical keys.
This does not remove compatibility obligations: the application still reads
and writes the typed columns and enum values, and old application versions and
rollback images may depend on them.

### Backup and rehearsal evidence

The VPS contains repeated application/deployment database artifacts, including
pre-deploy dumps through `payload-before-f526be2-20260810T163148Z.dump`, as well
as checksummed dump artifacts. The inspected backup-related systemd timer and
root-cron surfaces did not show an application-specific scheduler. Backup
creation is therefore an infrastructure/deployment responsibility, not a
repository-local application mechanism.

Before any physical schema PR, the operator must select a recent dump, verify
its checksum, restore it into disposable PostgreSQL, run the candidate
migration and rollback rehearsal, and record the old-image compatibility
result. The production ordering remains: verified backup, maintenance/change
window, forward migration, application rollout, read-only post-deployment
checks, and rollback to the previous image plus restored schema only if the
compatibility checks fail.

### Commands and logs

The exact redacted commands and outputs are stored outside the repository:

- `/tmp/siteinabox-maintainability-audit-logs/f18-production-schema-readonly.sql`
- `/tmp/siteinabox-maintainability-audit-logs/f18-production-schema-readonly.txt`
- `/tmp/siteinabox-maintainability-audit-logs/f18-production-counts.sql`
- `/tmp/siteinabox-maintainability-audit-logs/f18-production-counts.txt`
- `/tmp/siteinabox-maintainability-audit-logs/f18-production-targeted.sql`
- `/tmp/siteinabox-maintainability-audit-logs/f18-production-targeted.txt`
- `/tmp/siteinabox-maintainability-audit-logs/f18-vps-backup-evidence.txt`

Disposition remains `defer`: no physical field, enum value, index, table, or
migration file is removal-ready from this evidence alone.
