import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

/**
 * Services 02 adds a presentation choice to the existing semantic services
 * contract. Service content is unchanged; the enum is extended so persisted
 * Payload blocks can select the new owned renderer.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE public.enum_pages_blocks_services_variant
      ADD VALUE IF NOT EXISTS 'services-02';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    "PostgreSQL enum values cannot be removed safely; restore a database backup to roll back this migration.",
  )
}
