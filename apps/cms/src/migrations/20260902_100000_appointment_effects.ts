import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

/**
 * Adds the optional per-section effect override and supplied media reference
 * for the appointments-01 panel. Empty values inherit the site theme.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_pages_blocks_appointments_background_mode"
      AS ENUM ('image', 'animation', 'grid', 'ambient', 'mesh', 'none');

    ALTER TABLE "pages_blocks_appointments"
      ADD COLUMN "background_mode" "public"."enum_pages_blocks_appointments_background_mode";
    ALTER TABLE "pages_blocks_appointments"
      ADD COLUMN "image_id" integer;
    ALTER TABLE "pages_blocks_appointments"
      ADD CONSTRAINT "pages_blocks_appointments_image_id_media_id_fk"
      FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
      ON DELETE set null ON UPDATE no action;

    CREATE INDEX "pages_blocks_appointments_image_idx"
      ON "pages_blocks_appointments" USING btree ("image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_appointments"
      DROP CONSTRAINT "pages_blocks_appointments_image_id_media_id_fk";
    DROP INDEX "pages_blocks_appointments_image_idx";
    ALTER TABLE "pages_blocks_appointments"
      DROP COLUMN "image_id";
    ALTER TABLE "pages_blocks_appointments"
      DROP COLUMN "background_mode";
    DROP TYPE "public"."enum_pages_blocks_appointments_background_mode";
  `)
}
