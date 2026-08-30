import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

/** Adds the two optional consent labels used by the first-party consent rail. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.site_settings
      ADD COLUMN IF NOT EXISTS consent_preferences_label varchar,
      ADD COLUMN IF NOT EXISTS consent_marketing_label varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.site_settings
      DROP COLUMN IF EXISTS consent_marketing_label,
      DROP COLUMN IF EXISTS consent_preferences_label;
  `)
}
