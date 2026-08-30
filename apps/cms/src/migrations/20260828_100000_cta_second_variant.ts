import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

/**
 * CTA 02 adds the source-aligned Simple centered presentation to the existing
 * semantic CTA contract. Existing CTA rows remain valid as CTA 01.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE public.enum_pages_blocks_cta_variant
      ADD VALUE IF NOT EXISTS 'cta-02';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    "PostgreSQL enum values cannot be removed safely; restore a database backup to roll back this migration.",
  )
}
