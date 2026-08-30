import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

/**
 * The canonical system-template contract already exposed editable 404 copy
 * and a recovery action. Keep that content in the settings document rather
 * than hard-coding it in the renderer.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.site_settings
      ADD COLUMN IF NOT EXISTS system_templates_not_found_heading varchar,
      ADD COLUMN IF NOT EXISTS system_templates_not_found_body varchar,
      ADD COLUMN IF NOT EXISTS system_templates_not_found_primary_action_label varchar,
      ADD COLUMN IF NOT EXISTS system_templates_not_found_primary_action_href varchar,
      ADD COLUMN IF NOT EXISTS system_templates_not_found_primary_action_external boolean DEFAULT false;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("This migration adds canonical editable 404 content; restore a database backup to roll it back.")
}
