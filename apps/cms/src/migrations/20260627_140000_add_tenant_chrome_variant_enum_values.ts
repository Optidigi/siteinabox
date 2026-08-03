import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF to_regtype('public.enum_site_settings_chrome_header_variant') IS NOT NULL THEN
        ALTER TYPE "public"."enum_site_settings_chrome_header_variant" ADD VALUE IF NOT EXISTS 'amicareZen';
      END IF;
    END $$;
    DO $$ BEGIN
      IF to_regtype('public.enum_site_settings_chrome_footer_variant') IS NOT NULL THEN
        ALTER TYPE "public"."enum_site_settings_chrome_footer_variant" ADD VALUE IF NOT EXISTS 'amicareZen';
      END IF;
    END $$;
  `)
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // Postgres cannot safely remove enum values while preserving existing data.
}
