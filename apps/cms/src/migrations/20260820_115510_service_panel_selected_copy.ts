import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_hero_service_panel_service_highlights"
      ADD COLUMN IF NOT EXISTS "hero_heading" varchar,
      ADD COLUMN IF NOT EXISTS "hero_body" varchar,
      ADD COLUMN IF NOT EXISTS "primary_action_label" varchar,
      ADD COLUMN IF NOT EXISTS "primary_action_href" varchar,
      ADD COLUMN IF NOT EXISTS "secondary_action_label" varchar,
      ADD COLUMN IF NOT EXISTS "secondary_action_href" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_hero_service_panel_service_highlights"
      DROP COLUMN IF EXISTS "hero_heading",
      DROP COLUMN IF EXISTS "hero_body",
      DROP COLUMN IF EXISTS "primary_action_label",
      DROP COLUMN IF EXISTS "primary_action_href",
      DROP COLUMN IF EXISTS "secondary_action_label",
      DROP COLUMN IF EXISTS "secondary_action_href";
  `)
}
