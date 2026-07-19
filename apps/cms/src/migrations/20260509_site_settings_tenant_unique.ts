import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { queryRows } from '../lib/record'

/**
 * Audit finding #11 (P2, T8) — site_settings: missing UNIQUE on tenant_id.
 *
 * Why: site_settings is a per-tenant singleton, but the initial schema
 * (`20260505_172626_initial_schema.ts:377`) declares only a non-unique
 * `site_settings_tenant_idx` on (tenant_id). The application path
 * (`src/lib/queries/settings.ts:5-19`) does find-then-create with no
 * transactional guard, so two concurrent first-loads from the same
 * freshly-provisioned tenant both miss and both create — yielding two rows.
 * Subsequent admin queries `limit:1` silently pick whichever sorts first;
 * settings edits go to one row while reads may hit the other. See
 * `audits/01-FINAL.md` finding #11.
 *
 * This migration is one half of a two-half fix:
 *  - DB-level (this file): UNIQUE INDEX on (tenant_id) — makes the second
 *    `payload.create` for the same tenant fail with Postgres SQLSTATE 23505,
 *    forcing the application to surface or handle the race.
 *  - Application-level (`src/lib/queries/settings.ts`): wraps the create in
 *    try/catch; on 23505 re-fetches and returns the row that landed. The
 *    loser's caller observes the winner's row, not a raw 23505 error.
 *
 * Up:
 *   1. DROP the existing non-unique `site_settings_tenant_idx`. (Postgres
 *      forbids two indexes with the same name; we re-use the same name to
 *      keep the schema delta minimal and to make the audit's intent obvious
 *      in the schema browser.)
 *   2. Detect existing duplicates BEFORE creating the unique index. Same
 *      operator-safety contract as P1 #8: silent data mutation by a migration
 *      is forbidden in this codebase. The operator decides resolution
 *      (rename / delete duplicates and retry); the migration enforces.
 *   3. CREATE UNIQUE INDEX site_settings_tenant_idx ON site_settings
 *      (tenant_id).
 *
 * Down: throws unconditionally. Per audit P0 #3 finding the auto-generated
 * `down()` pattern in this codebase historically used DROP TABLE CASCADE
 * which is a footgun. The cascade-FK migration's `down()`
 * (`20260505_202447_cascade_tenant_delete.ts:56-72`) is the canonical
 * "throw rather than reverse" template. Rolling back this index permits
 * duplicate (tenant_id) pairs which produce unstable settings rows
 * silently — exactly what the migration exists to prevent. An operator who
 * genuinely needs to roll back must `DROP INDEX site_settings_tenant_idx`
 * and recreate the non-unique form manually after accepting the data-
 * integrity implications.
 *
 * Production deployment note for the operator: BEFORE running migrate:up,
 * detect duplicates with the same SELECT this migration uses internally:
 *   SELECT tenant_id, COUNT(*) AS cnt
 *   FROM site_settings
 *   GROUP BY tenant_id
 *   HAVING COUNT(*) > 1;
 * Resolve any duplicates by keeping the most recently-edited row and
 * deleting the others. The migration aborts with a clear message if any
 * remain at apply time.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Step 1 — drop the existing non-unique index. IF EXISTS so the migration
  // is retry-safe across partially-applied states (e.g. a previous run
  // crashed between the drop and the create-unique).
  await db.execute(sql`
    DROP INDEX IF EXISTS "site_settings_tenant_idx"
  `)

  // Step 2 — duplicate detection. Must run BEFORE the CREATE UNIQUE INDEX
  // so the migration refuses with a clear, actionable error instead of
  // failing on an opaque "could not create unique index" Postgres message.
  const result = await db.execute(sql`
    SELECT tenant_id, COUNT(*)::int AS cnt
    FROM site_settings
    WHERE tenant_id IS NOT NULL
    GROUP BY tenant_id
    HAVING COUNT(*) > 1
  `)
  // node-postgres returns { rows: [...] } via the drizzle wrapper; defend
  // against shape variation by reading both `.rows` and the iterable form.
  const duplicates = queryRows<{ tenant_id: unknown; cnt: number }>(result)
  if (duplicates.length > 0) {
    const sample = duplicates
      .slice(0, 10)
      .map((r) => ({ tenant_id: r.tenant_id, count: r.cnt }))
    throw new Error(
      `Cannot apply migration 20260509_site_settings_tenant_unique: ` +
        `${duplicates.length} tenant_id(s) have duplicate site_settings rows. ` +
        `Resolve manually (keep most-recently-edited row per tenant; delete others) before retrying. ` +
        `Sample (up to 10): ${JSON.stringify(sample)}`,
    )
  }

  // Step 3 — recreate the index as UNIQUE on (tenant_id). Per-tenant, not
  // global; site_settings is a per-tenant singleton.
  await db.execute(sql`
    CREATE UNIQUE INDEX "site_settings_tenant_idx" ON "site_settings" ("tenant_id")
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    "20260509_site_settings_tenant_unique: down is intentionally unsupported. " +
      "Rolling back site_settings_tenant_idx is destructive — it permits duplicate " +
      "(tenant_id) rows in site_settings which produce silently-unstable per-tenant " +
      "settings (admin reads may pick either row; edits land on one row while reads " +
      "hit the other). If you genuinely need to roll back, run " +
      "`DROP INDEX site_settings_tenant_idx; CREATE INDEX site_settings_tenant_idx ON site_settings (tenant_id)` " +
      "manually after accepting the data-integrity implications.",
  )
}
