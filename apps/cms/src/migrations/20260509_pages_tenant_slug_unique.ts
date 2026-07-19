import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { queryRows } from '../lib/record'

/**
 * Audit finding #8 (P1, T8) — Pages: missing (tenant_id, slug) unique index.
 *
 * Why: Pages.slug is documented as "Unique per tenant" but neither the DB nor a
 * Payload validator enforced it. Two pages with the same (tenant_id, slug) in
 * the same tenant could both be `published`; `projectPageToDisk` then writes
 * `tenants/<id>/pages/<slug>.json` twice (second-writer-wins), the manifest
 * keys on `(type, key)` so it points at only one of them, and deleting that
 * "winner" unlinks the projection while the other row still claims published
 * in DB. Result: per-tenant content integrity loss visible to public site
 * readers. See `audits/01-FINAL.md` finding #8.
 *
 * Investigation finding (recorded in batch report): @payloadcms/plugin-multi-
 * tenant only propagates `unique` to its own `tenant` relationship field
 * (node_modules/@payloadcms/plugin-multi-tenant/dist/fields/tenantField/
 * index.js:100). It does NOT generate a compound (tenant_id, X) unique index
 * for sibling fields. Setting `unique: true` on Pages.slug would generate a
 * globally-unique slug index — wrong shape (slug "home" would only be
 * permitted in one tenant). Hand-written SQL is the only mechanism that
 * produces per-tenant uniqueness.
 *
 * Up:
 *   1. Detect existing duplicates BEFORE creating the index. If any exist,
 *      throw with a message that names the offending pairs so the operator
 *      can resolve manually (rename or delete duplicates) and retry.
 *      Silent data mutation by a migration is forbidden in this codebase.
 *      The operator decides; the migration enforces.
 *   2. Create the unique index `pages_tenant_slug_idx` on (tenant_id, slug).
 *
 * Down: throws unconditionally. Per audit P0 #3 finding the auto-generated
 * `down()` pattern in this codebase historically used DROP TABLE CASCADE
 * which is a footgun. The cascade-FK migration's `down()`
 * (`20260505_202447_cascade_tenant_delete.ts:56-72`) is the canonical
 * "throw rather than reverse" template. Rolling back this index permits
 * duplicate (tenant_id, slug) pairs which corrupt projectPageToDisk —
 * exactly what the migration exists to prevent. An operator who genuinely
 * needs to roll back must `DROP INDEX pages_tenant_slug_idx` manually after
 * accepting the data-integrity implications.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Step 1 — duplicate detection. Must run BEFORE the CREATE UNIQUE INDEX so
  // the migration refuses with a clear, actionable error instead of failing
  // on an opaque "could not create unique index" Postgres message.
  const result = await db.execute(sql`
    SELECT tenant_id, slug, COUNT(*)::int AS cnt
    FROM pages
    WHERE slug IS NOT NULL AND tenant_id IS NOT NULL
    GROUP BY tenant_id, slug
    HAVING COUNT(*) > 1
  `)
  // node-postgres returns { rows: [...] } via the drizzle wrapper; defend
  // against shape variation by reading both `.rows` and the iterable form.
  const duplicates = queryRows<{ tenant_id: unknown; slug: unknown; cnt: number }>(result)
  if (duplicates.length > 0) {
    const sample = duplicates
      .slice(0, 10)
      .map((r) => ({ tenant_id: r.tenant_id, slug: r.slug, count: r.cnt }))
    throw new Error(
      `Cannot apply migration 20260509_pages_tenant_slug_unique: ` +
        `${duplicates.length} duplicate (tenant_id, slug) pair(s) exist in the pages table. ` +
        `Resolve manually (rename or delete duplicates) before retrying. ` +
        `Sample (up to 10): ${JSON.stringify(sample)}`,
    )
  }

  // Step 2 — create the per-tenant unique index. Note: per-tenant, NOT global.
  // (media.filename is currently globally unique per audit P3 #15 — that's a
  // separate finding; this migration deliberately does not touch it.)
  await db.execute(sql`
    CREATE UNIQUE INDEX "pages_tenant_slug_idx" ON "pages" ("tenant_id", "slug")
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    "20260509_pages_tenant_slug_unique: down is intentionally unsupported. " +
      "Rolling back pages_tenant_slug_idx is destructive — it permits duplicate " +
      "(tenant_id, slug) pairs which corrupt projectPageToDisk (the on-disk " +
      "page projections key on slug, so two rows with the same slug overwrite " +
      "each other and the manifest). If you genuinely need to roll back, run " +
      "`DROP INDEX pages_tenant_slug_idx` manually after accepting the data- " +
      "integrity implications.",
  )
}
