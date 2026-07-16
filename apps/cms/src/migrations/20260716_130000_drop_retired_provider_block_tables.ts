import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "pages_blocks_newsletter_benefits";
    DROP TABLE IF EXISTS "pages_blocks_newsletter";
    DROP TABLE IF EXISTS "pages_blocks_bento_grid_items";
    DROP TABLE IF EXISTS "pages_blocks_bento_grid";
    DROP TABLE IF EXISTS "pages_blocks_rich_text";
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    '20260716_130000_drop_retired_provider_block_tables is intentionally irreversible: the retired rows were migrated to canonical semantic blocks by 20260715_120000_migrate_shadcnui_blocks_provider.',
  )
}
