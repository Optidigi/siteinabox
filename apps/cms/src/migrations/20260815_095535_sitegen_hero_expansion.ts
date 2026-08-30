import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pages_blocks_hero_color_image" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_grid_split" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_photo_stage" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_pattern_split" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_pattern_band" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_aside" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_showcase" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_cover_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_service_mosaic_service_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_hero_service_mosaic" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_service_panel_service_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_hero_service_panel" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  -- Preserve existing content while retiring the two duplicate hero shapes.
  -- heroBand becomes the new full-bleed action cover and heroImageBelow
  -- becomes the new editorial image showcase. Keep the original row id/order
  -- so page block ordering and references remain stable.
  DO $do$
  BEGIN
    IF to_regclass('public.pages_blocks_hero_band') IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM public.pages_blocks_hero_band AS old_block
        INNER JOIN public.pages_blocks_hero_cover_actions AS new_block ON new_block.id = old_block.id
      ) THEN
        RAISE EXCEPTION USING
          MESSAGE = 'Cannot migrate heroBand rows because a heroCoverActions row already uses the same id',
          HINT = 'Restore from backup and resolve the duplicate block id before retrying the migration.';
      END IF;

      INSERT INTO public.pages_blocks_hero_cover_actions (
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      )
      SELECT
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      FROM public.pages_blocks_hero_band;

      DELETE FROM public.pages_blocks_hero_band;
    END IF;

    IF to_regclass('public.pages_blocks_hero_image_below') IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM public.pages_blocks_hero_image_below AS old_block
        INNER JOIN public.pages_blocks_hero_showcase AS new_block ON new_block.id = old_block.id
      ) THEN
        RAISE EXCEPTION USING
          MESSAGE = 'Cannot migrate heroImageBelow rows because a heroShowcase row already uses the same id',
          HINT = 'Restore from backup and resolve the duplicate block id before retrying the migration.';
      END IF;

      INSERT INTO public.pages_blocks_hero_showcase (
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      )
      SELECT
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      FROM public.pages_blocks_hero_image_below;

      DELETE FROM public.pages_blocks_hero_image_below;
    END IF;
  END $do$;

  DROP TABLE "pages_blocks_hero_band" CASCADE;
  DROP TABLE "pages_blocks_hero_image_below" CASCADE;
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE text;
  UPDATE "block_presets"
  SET "block_type" = CASE "block_type"
    WHEN 'heroBand' THEN 'heroCoverActions'
    WHEN 'heroImageBelow' THEN 'heroShowcase'
    ELSE "block_type"
  END;
  DROP TYPE "public"."enum_block_presets_block_type";
  CREATE TYPE "public"."enum_block_presets_block_type" AS ENUM('hero', 'heroMinimal', 'heroSplit', 'heroPortrait', 'heroCard', 'heroEditorial', 'heroFramed', 'heroAngled', 'heroEdge', 'heroCoverPanel', 'heroImageFirst', 'heroRail', 'heroColorField', 'heroColorImage', 'heroGridSplit', 'heroPhotoStage', 'heroPatternSplit', 'heroPatternBand', 'heroAside', 'heroShowcase', 'heroCoverActions', 'heroServiceMosaic', 'heroServicePanel', 'services', 'about', 'process', 'work', 'reviews', 'pricing', 'faq', 'cta', 'contact', 'richText');
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE "public"."enum_block_presets_block_type" USING "block_type"::"public"."enum_block_presets_block_type";
  ALTER TABLE "pages_blocks_hero_color_image" ADD CONSTRAINT "pages_blocks_hero_color_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_color_image" ADD CONSTRAINT "pages_blocks_hero_color_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_grid_split" ADD CONSTRAINT "pages_blocks_hero_grid_split_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_grid_split" ADD CONSTRAINT "pages_blocks_hero_grid_split_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_photo_stage" ADD CONSTRAINT "pages_blocks_hero_photo_stage_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_photo_stage" ADD CONSTRAINT "pages_blocks_hero_photo_stage_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_pattern_split" ADD CONSTRAINT "pages_blocks_hero_pattern_split_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_pattern_band" ADD CONSTRAINT "pages_blocks_hero_pattern_band_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_aside" ADD CONSTRAINT "pages_blocks_hero_aside_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_aside" ADD CONSTRAINT "pages_blocks_hero_aside_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_showcase" ADD CONSTRAINT "pages_blocks_hero_showcase_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_showcase" ADD CONSTRAINT "pages_blocks_hero_showcase_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_cover_actions" ADD CONSTRAINT "pages_blocks_hero_cover_actions_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_cover_actions" ADD CONSTRAINT "pages_blocks_hero_cover_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_service_mosaic_service_highlights" ADD CONSTRAINT "pages_blocks_hero_service_mosaic_service_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero_service_mosaic"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_service_mosaic" ADD CONSTRAINT "pages_blocks_hero_service_mosaic_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_service_mosaic" ADD CONSTRAINT "pages_blocks_hero_service_mosaic_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_service_panel_service_highlights" ADD CONSTRAINT "pages_blocks_hero_service_panel_service_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero_service_panel"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_service_panel" ADD CONSTRAINT "pages_blocks_hero_service_panel_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_service_panel" ADD CONSTRAINT "pages_blocks_hero_service_panel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_hero_color_image_order_idx" ON "pages_blocks_hero_color_image" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_color_image_parent_id_idx" ON "pages_blocks_hero_color_image" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_color_image_path_idx" ON "pages_blocks_hero_color_image" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_color_image_image_idx" ON "pages_blocks_hero_color_image" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_grid_split_order_idx" ON "pages_blocks_hero_grid_split" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_grid_split_parent_id_idx" ON "pages_blocks_hero_grid_split" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_grid_split_path_idx" ON "pages_blocks_hero_grid_split" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_grid_split_image_idx" ON "pages_blocks_hero_grid_split" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_photo_stage_order_idx" ON "pages_blocks_hero_photo_stage" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_photo_stage_parent_id_idx" ON "pages_blocks_hero_photo_stage" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_photo_stage_path_idx" ON "pages_blocks_hero_photo_stage" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_photo_stage_image_idx" ON "pages_blocks_hero_photo_stage" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_pattern_split_order_idx" ON "pages_blocks_hero_pattern_split" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_pattern_split_parent_id_idx" ON "pages_blocks_hero_pattern_split" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_pattern_split_path_idx" ON "pages_blocks_hero_pattern_split" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_pattern_band_order_idx" ON "pages_blocks_hero_pattern_band" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_pattern_band_parent_id_idx" ON "pages_blocks_hero_pattern_band" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_pattern_band_path_idx" ON "pages_blocks_hero_pattern_band" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_aside_order_idx" ON "pages_blocks_hero_aside" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_aside_parent_id_idx" ON "pages_blocks_hero_aside" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_aside_path_idx" ON "pages_blocks_hero_aside" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_aside_image_idx" ON "pages_blocks_hero_aside" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_showcase_order_idx" ON "pages_blocks_hero_showcase" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_showcase_parent_id_idx" ON "pages_blocks_hero_showcase" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_showcase_path_idx" ON "pages_blocks_hero_showcase" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_showcase_image_idx" ON "pages_blocks_hero_showcase" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_cover_actions_order_idx" ON "pages_blocks_hero_cover_actions" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_cover_actions_parent_id_idx" ON "pages_blocks_hero_cover_actions" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_cover_actions_path_idx" ON "pages_blocks_hero_cover_actions" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_cover_actions_image_idx" ON "pages_blocks_hero_cover_actions" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_service_mosaic_service_highlights_order_idx" ON "pages_blocks_hero_service_mosaic_service_highlights" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_service_mosaic_service_highlights_parent_id_idx" ON "pages_blocks_hero_service_mosaic_service_highlights" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_service_mosaic_order_idx" ON "pages_blocks_hero_service_mosaic" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_service_mosaic_parent_id_idx" ON "pages_blocks_hero_service_mosaic" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_service_mosaic_path_idx" ON "pages_blocks_hero_service_mosaic" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_service_mosaic_image_idx" ON "pages_blocks_hero_service_mosaic" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_service_panel_service_highlights_order_idx" ON "pages_blocks_hero_service_panel_service_highlights" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_service_panel_service_highlights_parent_id_idx" ON "pages_blocks_hero_service_panel_service_highlights" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_service_panel_order_idx" ON "pages_blocks_hero_service_panel" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_service_panel_parent_id_idx" ON "pages_blocks_hero_service_panel" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_service_panel_path_idx" ON "pages_blocks_hero_service_panel" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_service_panel_image_idx" ON "pages_blocks_hero_service_panel" USING btree ("image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pages_blocks_hero_band" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_image_below" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  DROP TABLE "pages_blocks_hero_color_image" CASCADE;
  DROP TABLE "pages_blocks_hero_grid_split" CASCADE;
  DROP TABLE "pages_blocks_hero_photo_stage" CASCADE;
  DROP TABLE "pages_blocks_hero_pattern_split" CASCADE;
  DROP TABLE "pages_blocks_hero_pattern_band" CASCADE;
  DROP TABLE "pages_blocks_hero_aside" CASCADE;
  DROP TABLE "pages_blocks_hero_showcase" CASCADE;
  DROP TABLE "pages_blocks_hero_cover_actions" CASCADE;
  DROP TABLE "pages_blocks_hero_service_mosaic_service_highlights" CASCADE;
  DROP TABLE "pages_blocks_hero_service_mosaic" CASCADE;
  DROP TABLE "pages_blocks_hero_service_panel_service_highlights" CASCADE;
  DROP TABLE "pages_blocks_hero_service_panel" CASCADE;
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_block_presets_block_type";
  CREATE TYPE "public"."enum_block_presets_block_type" AS ENUM('hero', 'heroMinimal', 'heroSplit', 'heroPortrait', 'heroBand', 'heroCard', 'heroEditorial', 'heroFramed', 'heroAngled', 'heroEdge', 'heroCoverPanel', 'heroImageBelow', 'heroImageFirst', 'heroRail', 'heroColorField', 'services', 'about', 'process', 'work', 'reviews', 'pricing', 'faq', 'cta', 'contact', 'richText');
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE "public"."enum_block_presets_block_type" USING "block_type"::"public"."enum_block_presets_block_type";
  ALTER TABLE "pages_blocks_hero_band" ADD CONSTRAINT "pages_blocks_hero_band_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_band" ADD CONSTRAINT "pages_blocks_hero_band_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_image_below" ADD CONSTRAINT "pages_blocks_hero_image_below_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_image_below" ADD CONSTRAINT "pages_blocks_hero_image_below_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_hero_band_order_idx" ON "pages_blocks_hero_band" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_band_parent_id_idx" ON "pages_blocks_hero_band" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_band_path_idx" ON "pages_blocks_hero_band" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_band_image_idx" ON "pages_blocks_hero_band" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_image_below_order_idx" ON "pages_blocks_hero_image_below" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_image_below_parent_id_idx" ON "pages_blocks_hero_image_below" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_image_below_path_idx" ON "pages_blocks_hero_image_below" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_image_below_image_idx" ON "pages_blocks_hero_image_below" USING btree ("image_id");`)
}
