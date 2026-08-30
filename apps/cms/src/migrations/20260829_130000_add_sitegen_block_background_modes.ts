import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

/**
 * Adds the optional block-level background override used by effect-capable
 * first-party hero and CTA blocks. A null value inherits the site theme's
 * background mode; the migration never changes existing block content.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_hero_background_mode" AS ENUM('image', 'animation', 'grid', 'ambient', 'mesh', 'none');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_cta_background_mode" AS ENUM('image', 'animation', 'grid', 'ambient', 'mesh', 'none');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "pages_blocks_hero"
      ADD COLUMN IF NOT EXISTS "background_mode" "public"."enum_pages_blocks_hero_background_mode";
    ALTER TABLE "pages_blocks_cta"
      ADD COLUMN IF NOT EXISTS "background_mode" "public"."enum_pages_blocks_cta_background_mode";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_cta" DROP COLUMN IF EXISTS "background_mode";
    ALTER TABLE "pages_blocks_hero" DROP COLUMN IF EXISTS "background_mode";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_cta_background_mode";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_hero_background_mode";
  `)
}
