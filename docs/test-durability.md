# Test durability

This document records which tests are retained because they protect governed
behavior, which tests are candidates for behavior-based replacement, and which
tests cannot be removed until compatibility evidence exists. It is a companion
to [the test taxonomy](test-taxonomy.md), not a second test inventory source.

The audit was run on 2026-08-11 with the following commands:

```text
git grep -l -E 'readFileSync|fs\.readFileSync' -- apps packages | rg '\.(test|spec)\.'
git ls-files | rg '(^|/)([^/]*(visual|regression)[^/]*|[^/]*migration[^/]*)\.(test|spec)\.[^.]+$'
git grep -nEi 'visual regression|toHaveScreenshot|page\.screenshot|screenshot' -- apps packages
git grep -nEi 'catalog.*(length|count)|inventory\.counts|variants\.length|count.*catalog' -- apps packages
```

The first search returned 49 test files. A source read is not evidence that a
test is obsolete. Each source assertion needs an invariant and a replacement
gate before it can be removed.

## Disposition rules

| Test shape | Default disposition | Removal or replacement gate |
| --- | --- | --- |
| Authentication, authorization, tenancy, CSP, privacy, or secret-handling source contract | Retain | A runtime or integration test must prove the same security invariant, and the old test must remain through one hosted cycle. |
| Migration, rollback, restore, schema, or published snapshot test | Retain | Compatibility and rollback windows must be closed, with disposable-database rehearsal and persisted-data evidence. |
| Source assertion for a pure UI composition detail | Replace | Assert rendered behavior or a public contract after the replacement test is green. |
| Exact string assertion for legal, consent, release, or provider policy | Retain | The governed source/data owner must approve a contract-level replacement. |
| Screenshot capture without pixel comparison | Relabel or replace | Call it evidence capture, or add a real baseline comparison before calling it visual regression. |
| Raw catalog count | Defer | Replace with semantic parity and a reviewed catalog fingerprint when the catalog itself changes. |
| Browser and unit tests with apparently similar names | Unknown | Compare assertions and boundaries before deleting either test. Naming similarity is not duplicate coverage. |

## Retained source-inspection tests

These files contain source reads or source-level assertions. The listed
dispositions are intentional and do not authorize deletion.

| Evidence | Invariant protected | Disposition |
| --- | --- | --- |
| `apps/cms/tests/unit/audit-p0-1-inviteUser-auth.test.ts:197-203` | Invite validation and required user-facing invite fields remain wired into the form. | Replace with rendered form behavior only after the auth and validation path is covered. |
| `apps/cms/tests/unit/audit-p1-7-password-session.test.ts:762` | Password-change/session behavior retains its reviewed implementation contract. | Retain until a complete authenticated password-change integration test covers session invalidation. |
| `apps/cms/tests/unit/audit-p1-8-pages-tenant-slug-unique.test.ts:307-329` | Tenant-scoped uniqueness SQL and its migration/index history remain explicit. | Retain through schema compatibility and rollback windows. |
| `apps/cms/tests/unit/audit-p2-11-site-settings-tenant-unique.test.ts:312-369` | Site-settings tenant uniqueness and index removal safety remain explicit. | Retain through schema compatibility and rollback windows. |
| `apps/cms/tests/unit/audit-p3-14-noopener.test.ts:30-78` | External links keep `noopener noreferrer` behavior. | Replace with rendered-link security assertions only after CSP/link coverage is equivalent. |
| `apps/cms/tests/unit/audit-p3-15-media-tenant-filename-unique.test.ts:272-324` | Tenant media uniqueness, indexes, and route authorization remain explicit. | Retain; this is tenancy and schema safety, not cleanup residue. |
| `apps/cms/tests/unit/audit-p3-16-graphql-playground-env-gate.test.ts` | GraphQL playground exposure remains environment-gated. | Retain until an environment-matrix integration test proves the same boundary. |
| `apps/cms/tests/unit/audit-p3-rearm.test.ts` | One-time operational rearm behavior remains guarded. | Retain until the operator workflow has an equivalent integration harness. |
| `apps/cms/tests/integration/migrate-restore-roundtrip.test.ts:67` | Backup and restore output remains round-trippable. | Retain for migration and rollback support. |
| `packages/legal-content/tests/runtime-type-export-parity.test.mjs` | Legal runtime exports and declarations remain in parity. | Retain; legal release behavior is governed. |

The remaining source-inspection files are mostly UI composition, email, locale,
preview, generated-output, and operational safety contracts. They are
replacement candidates only when their enduring invariant is identified and a
behavior-level test is added in the same change.

## Historical, incident, tenant, and migration names

Ticket-era names provide traceability and are not a dead-code signal. The
current migration-named test set includes:

| Test | Required treatment |
| --- | --- |
| `apps/cms/tests/integration/existing-domain-safety-migration.test.ts` | Retain while existing-domain migration compatibility is supported. |
| `apps/cms/tests/integration/phase11-migration-rollback.test.ts` | Retain for the rollback window. |
| `apps/cms/tests/integration/pre-commerce-routing-adoption-migration.test.ts` | Retain while old routing/data states can be encountered. |
| `apps/cms/tests/unit/amicare-privacy-page-migration.test.ts` | Retain while the published tenant snapshot and legal page history matter. |
| `apps/cms/tests/unit/amicare-provider-rebuild-migration.test.ts` | Retain while the tenant rebuild compatibility path exists. |
| `apps/cms/tests/unit/migrationCheckoutSecret.test.ts` | Retain for secret lifecycle, expiry, and access safety. |
| `apps/cms/tests/unit/migrationDecisions.test.ts` | Retain for migration decision semantics. |
| `apps/cms/tests/unit/migrationOperatorRecovery.test.ts` | Retain for incident recovery and concurrency behavior. |
| `apps/cms/tests/unit/migrationSourceAuthorizationsCollection.test.ts` | Retain for encrypted authorization access boundaries. |
| `apps/cms/tests/unit/shadcnui-blocks-migration.test.ts` | Defer with the renderer/catalog replacement; do not remove independently. |
| `apps/cms/tests/unit/ui-regression-bugs.test.ts` | Replace source-string assertions incrementally with behavior tests; do not delete the regression cases. |

## Visual evidence classification

`apps/cms/tests/unit/checkout-visual-regression.test.ts:8-19` validates the
checkout visual evidence manifest: viewport coverage, light/dark themes,
locales, unique case IDs, and six intentional prototype differences. It does
not call `toHaveScreenshot` or compare pixels in that file. Its current name
therefore overstates the guarantee.

Disposition: retain as a visual-evidence manifest contract, and either rename
it to make that boundary explicit or add a real screenshot baseline comparison
in a focused browser-test change. Do not weaken the viewport, locale, theme, or
intentional-difference assertions.

The renderer screenshot tests under
`packages/site-renderer/src/visual-parity/screenshot-capture.test.mjs` test
capture failure and retry behavior. They are operational screenshot-pipeline
tests, not pixel-parity tests, and should retain that narrower classification.

## Catalog and count assertions

The following count assertions have different meanings and must not be treated
as one category:

| Evidence | Meaning | Disposition |
| --- | --- | --- |
| `packages/contracts/src/tld-capabilities.test.ts:31` | Every catalog entry has a unique TLD key. | Retain as a semantic uniqueness invariant; the reviewed catalog fingerprint is additionally guarded by `tld-capabilities-snapshot.test.ts`. |
| `packages/site-renderer/src/providers/shadcnui-blocks/block-views.test.mjs:15` | Current authored block view inventory has the expected size. | Defer with F17 and the planned catalog replacement. |
| `packages/site-renderer/src/providers/shadcnui-blocks/catalog-integrity.test.mjs:25-33,68-70` | Runtime, audit, and generated catalog inventories agree. | Retain until the replacement catalog has equivalent parity checks. |
| `packages/site-renderer/src/providers/shadcnui-blocks/token-coverage.test.mjs:43-44` | Current token coverage spans the audited variant inventory. | Defer with F17; do not remove as cosmetic cleanup. |

The F07 fingerprint protects the current contracts catalog from unreviewed
drift. It does not authorize deletion of historical TLD data or renderer
catalog entries.

## Replacement sequence

1. Keep security, tenancy, legal, commerce, migration, and rollback tests in
   place.
2. For source-sensitive UI tests, add a rendered behavior test and run the old
   and new checks together for one hosted cycle.
3. For migration tests, use disposable PostgreSQL and representative persisted
   records before changing the test boundary.
4. Relabel checkout screenshot evidence or add real pixel comparison; do not
   claim visual regression coverage from screenshot capture alone.
5. Revisit raw renderer counts only with the F17 replacement catalog and its
   published-snapshot and rollback evidence.

## Review rule

Every proposed test deletion or rename must record the enduring invariant,
replacement test, compatibility window, exact commands, and rollback plan in
the PR description. A passing static-import search, an old ticket name, or a
shorter test file is not sufficient evidence.
