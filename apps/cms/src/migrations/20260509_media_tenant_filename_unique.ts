import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { queryRows } from '@/lib/record'

/**
 * Audit finding #15 (P3, T8) — `media.filename` globally UNIQUE → cross-tenant
 * naming side-channel.
 *
 * Why: the initial schema (`20260505_172626_initial_schema.ts:336`) declared
 * `CREATE UNIQUE INDEX "media_filename_idx" ON "media" ("filename")` —
 * globally unique, not per-tenant. Tenant A uploading `logo.png` causes
 * Tenant B's later upload of `logo.png` to land at `logo-1.png`, leaking
 * filename existence across tenants and creating support churn. Same shape
 * the audit calls out at finding #15. See `audits/01-FINAL.md`.
 *
 * This migration is one half of a two-half fix:
 *  - DB-level (this file): drop the global unique, install a compound unique
 *    on `(tenant_id, filename)` so the same filename can coexist in different
 *    tenants but not within one.
 *  - Application-level (`src/collections/Media.ts`): a `beforeValidate` hook
 *    `ensureUniqueTenantFilename` pre-empts the Postgres unique-violation
 *    with a clean ValidationError — admins see "A file named X already
 *    exists in this tenant" rather than the raw constraint name.
 *
 * Up:
 *   1. DROP the existing global `media_filename_idx`. The new compound
 *      unique is named differently (`media_tenant_filename_idx`), so the
 *      DROP is strictly required to remove the old constraint surface — a
 *      future operator must not be left with the global unique still in
 *      place. IF EXISTS so the migration is retry-safe across partially-
 *      applied states.
 *   2. Detect existing duplicates within `(tenant_id, filename)` BEFORE
 *      creating the new index. Per-tenant duplicates SHOULD be zero today
 *      (the old global unique enforced a stricter constraint). The check
 *      is canonical safety: silent data mutation by a migration is forbidden
 *      in this codebase. Operator decides resolution; migration enforces.
 *   3. CREATE UNIQUE INDEX `media_tenant_filename_idx` ON media
 *      (tenant_id, filename).
 *
 * Down: throws unconditionally. Per audit P0 #3 finding the auto-generated
 * `down()` pattern in this codebase historically used DROP TABLE CASCADE
 * which is a footgun. The cascade-FK migration's `down()`
 * (`20260505_202447_cascade_tenant_delete.ts:56-72`) is the canonical
 * "throw rather than reverse" template. Rolling back this index permits
 * cross-tenant filename collisions which silently leak filename existence
 * across tenants — exactly what the migration exists to prevent. An operator
 * who genuinely needs to roll back must `DROP INDEX media_tenant_filename_idx`
 * AND `CREATE UNIQUE INDEX media_filename_idx ON media (filename)` manually
 * after accepting the cross-tenant disclosure implications.
 *
 * Production deployment note for the operator: BEFORE running migrate:up,
 * detect per-tenant duplicates with the same SELECT this migration uses
 * internally:
 *   SELECT tenant_id, filename, COUNT(*) AS cnt
 *   FROM media
 *   WHERE tenant_id IS NOT NULL AND filename IS NOT NULL
 *   GROUP BY tenant_id, filename
 *   HAVING COUNT(*) > 1;
 * Resolve any duplicates by renaming or deleting the offending media rows.
 * The migration aborts with a clear message if any remain at apply time.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Step 1 — drop the existing global unique index. IF EXISTS so the
  // migration is retry-safe across partially-applied states.
  await db.execute(sql`
    DROP INDEX IF EXISTS "media_filename_idx"
  `)

  // Step 2 — duplicate detection. Must run BEFORE the CREATE UNIQUE INDEX
  // so the migration refuses with a clear, actionable error instead of
  // failing on an opaque "could not create unique index" Postgres message.
  const result = await db.execute(sql`
    SELECT tenant_id, filename, COUNT(*)::int AS cnt
    FROM media
    WHERE tenant_id IS NOT NULL AND filename IS NOT NULL
    GROUP BY tenant_id, filename
    HAVING COUNT(*) > 1
  `)
  // node-postgres returns { rows: [...] } via the drizzle wrapper; defend
  // against shape variation by reading both `.rows` and the iterable form.
  const duplicates = queryRows<{ tenant_id: unknown; filename: unknown; cnt: number }>(result)
  if (duplicates.length > 0) {
    const sample = duplicates
      .slice(0, 10)
      .map((r) => ({ tenant_id: r.tenant_id, filename: r.filename, count: r.cnt }))
    throw new Error(
      `Cannot apply migration 20260509_media_tenant_filename_unique: ` +
        `${duplicates.length} duplicate (tenant_id, filename) pair(s) exist in the media table. ` +
        `Resolve manually (rename or delete duplicates) before retrying. ` +
        `Sample (up to 10): ${JSON.stringify(sample)}`,
    )
  }

  // Step 3 — create the per-tenant compound unique index.
  await db.execute(sql`
    CREATE UNIQUE INDEX "media_tenant_filename_idx" ON "media" ("tenant_id", "filename")
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    "20260509_media_tenant_filename_unique: down is intentionally unsupported. " +
      "Rolling back media_tenant_filename_idx is destructive — it permits cross-" +
      "tenant filename collisions, re-arming the cross-tenant naming side-" +
      "channel that audit finding #15 (T8) was filed to close (Tenant A's " +
      "filename inventory becomes inferable from Tenant B's upload responses). " +
      "If you genuinely need to roll back, run " +
      "`DROP INDEX media_tenant_filename_idx; CREATE UNIQUE INDEX media_filename_idx ON media (filename)` " +
      "manually after accepting the cross-tenant disclosure implications.",
  )
}
