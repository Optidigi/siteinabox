import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_hero_service_mosaic_service_highlights" ADD COLUMN "image_id" integer;
  ALTER TABLE "pages_blocks_hero_service_panel_service_highlights" ADD COLUMN "image_id" integer;
  ALTER TABLE "pages_blocks_hero_service_mosaic_service_highlights" ADD CONSTRAINT "pages_blocks_hero_service_mosaic_service_highlights_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_service_panel_service_highlights" ADD CONSTRAINT "pages_blocks_hero_service_panel_service_highlights_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pages_blocks_hero_service_mosaic_service_highlights_imag_idx" ON "pages_blocks_hero_service_mosaic_service_highlights" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_service_panel_service_highlights_image_idx" ON "pages_blocks_hero_service_panel_service_highlights" USING btree ("image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_hero_service_mosaic_service_highlights" DROP CONSTRAINT "pages_blocks_hero_service_mosaic_service_highlights_image_id_media_id_fk";
  
  ALTER TABLE "pages_blocks_hero_service_panel_service_highlights" DROP CONSTRAINT "pages_blocks_hero_service_panel_service_highlights_image_id_media_id_fk";
  
  DROP INDEX "pages_blocks_hero_service_mosaic_service_highlights_imag_idx";
  DROP INDEX "pages_blocks_hero_service_panel_service_highlights_image_idx";
  ALTER TABLE "pages_blocks_hero_service_mosaic_service_highlights" DROP COLUMN "image_id";
  ALTER TABLE "pages_blocks_hero_service_panel_service_highlights" DROP COLUMN "image_id";`)
}
