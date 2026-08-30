import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

/**
 * Restores the settings-owned consent variant after the old reserved chrome
 * columns were removed, and adds the labels needed by consent-01. Existing
 * consent copy remains in place; the new renderer supplies safe language
 * defaults when optional labels are empty.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_consent_variant'
      ) THEN
        CREATE TYPE public.enum_site_settings_consent_variant AS ENUM ('consent-01');
      END IF;
    END $do$;

    ALTER TABLE public.site_settings
      ADD COLUMN IF NOT EXISTS consent_variant public.enum_site_settings_consent_variant DEFAULT 'consent-01',
      ADD COLUMN IF NOT EXISTS consent_allow_selection_label varchar,
      ADD COLUMN IF NOT EXISTS consent_necessary_label varchar,
      ADD COLUMN IF NOT EXISTS consent_statistics_label varchar,
      ADD COLUMN IF NOT EXISTS consent_manage_label varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.site_settings
      DROP COLUMN IF EXISTS consent_manage_label,
      DROP COLUMN IF EXISTS consent_statistics_label,
      DROP COLUMN IF EXISTS consent_necessary_label,
      DROP COLUMN IF EXISTS consent_allow_selection_label,
      DROP COLUMN IF EXISTS consent_variant;
    DROP TYPE IF EXISTS public.enum_site_settings_consent_variant;
  `)
}
