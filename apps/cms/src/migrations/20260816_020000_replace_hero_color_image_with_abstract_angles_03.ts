import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

const blockPresetValues = `('hero', 'heroSplit', 'heroEditorial', 'heroFramed', 'heroAngled', 'heroColorField', 'heroAbstractAngles03', 'heroPhotoStage', 'heroPatternSplit', 'heroPatternBand', 'heroShowcase', 'heroCoverActions', 'heroServiceMosaic', 'heroServicePanel', 'services', 'about', 'process', 'work', 'reviews', 'pricing', 'faq', 'cta', 'contact', 'richText')`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $do$
    BEGIN
      IF to_regclass('public.published_site_snapshots') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.published_site_snapshots
          WHERE status = 'active'
            AND snapshot::text ~ '"blockType"[[:space:]]*:[[:space:]]*"heroColorImage"'
        )
      THEN
        RAISE EXCEPTION USING
          MESSAGE = 'Cannot replace heroColorImage while an active published snapshot still contains it',
          HINT = 'Regenerate and republish the affected tenant snapshot through the supported publication flow, then retry.';
      END IF;

      IF to_regclass('public.pages_blocks_hero_color_image') IS NOT NULL
        AND to_regclass('public.pages_blocks_hero_abstract_angles03') IS NULL
      THEN
        ALTER TABLE public.pages_blocks_hero_color_image RENAME TO pages_blocks_hero_abstract_angles03;
        ALTER INDEX IF EXISTS pages_blocks_hero_color_image_order_idx RENAME TO pages_blocks_hero_abstract_angles03_order_idx;
        ALTER INDEX IF EXISTS pages_blocks_hero_color_image_parent_id_idx RENAME TO pages_blocks_hero_abstract_angles03_parent_id_idx;
        ALTER INDEX IF EXISTS pages_blocks_hero_color_image_path_idx RENAME TO pages_blocks_hero_abstract_angles03_path_idx;
        ALTER INDEX IF EXISTS pages_blocks_hero_color_image_image_idx RENAME TO pages_blocks_hero_abstract_angles03_image_idx;
        ALTER TABLE public.pages_blocks_hero_abstract_angles03 RENAME CONSTRAINT pages_blocks_hero_color_image_image_id_media_id_fk TO pages_blocks_hero_abstract_angles03_image_id_media_id_fk;
        ALTER TABLE public.pages_blocks_hero_abstract_angles03 RENAME CONSTRAINT pages_blocks_hero_color_image_parent_id_fk TO pages_blocks_hero_abstract_angles03_parent_id_fk;
      END IF;
    END $do$;

    ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE text;
    UPDATE "block_presets"
    SET "block_type" = 'heroAbstractAngles03'
    WHERE "block_type" = 'heroColorImage';
    DROP TYPE "public"."enum_block_presets_block_type";
    CREATE TYPE "public"."enum_block_presets_block_type" AS ENUM ${sql.raw(blockPresetValues)};
    ALTER TABLE "block_presets"
      ALTER COLUMN "block_type" SET DATA TYPE "public"."enum_block_presets_block_type"
      USING "block_type"::"public"."enum_block_presets_block_type";
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('This migration renames the Hero 07 data table and block preset value; restore a database backup to roll it back.')
}
