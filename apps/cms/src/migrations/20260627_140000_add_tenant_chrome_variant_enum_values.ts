import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_site_settings_chrome_header_variant" ADD VALUE IF NOT EXISTS 'amicareZen';
    ALTER TYPE "public"."enum_site_settings_chrome_footer_variant" ADD VALUE IF NOT EXISTS 'amicareZen';
  `)
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // Postgres cannot safely remove enum values while preserving existing data.
}
