import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

const blockPresetValues = `('hero', 'heroSplit', 'heroEditorial', 'heroFramed', 'heroAngled', 'heroAbstractAngles03', 'heroPhotoStage', 'heroPatternSplit', 'heroPatternBand', 'heroCoverActions', 'heroServicePanel', 'services', 'about', 'process', 'work', 'reviews', 'pricing', 'faq', 'cta', 'contact', 'richText')`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $do$
    DECLARE
      row_count bigint;
    BEGIN
      IF to_regclass('public.published_site_snapshots') IS NOT NULL THEN
        EXECUTE $query$
          SELECT count(*) FROM public.published_site_snapshots
          WHERE status = 'active'
            AND snapshot::text ~ '"blockType"[[:space:]]*:[[:space:]]*"(heroServiceMosaic|heroColorField|heroShowcase)"'
        $query$ INTO row_count;
        IF row_count > 0 THEN
          RAISE EXCEPTION USING
            MESSAGE = 'Cannot remove retired heroes while an active published snapshot still contains them',
            HINT = 'Regenerate and republish the affected tenant snapshot through the supported publication flow, then retry.';
        END IF;
      END IF;
    END $do$;

    DELETE FROM public.block_presets
    WHERE block_type IN ('heroServiceMosaic', 'heroColorField', 'heroShowcase');

    DROP TABLE IF EXISTS public.pages_blocks_hero_service_mosaic_service_highlights CASCADE;
    DROP TABLE IF EXISTS public.pages_blocks_hero_service_mosaic CASCADE;
    DROP TABLE IF EXISTS public.pages_blocks_hero_color_field CASCADE;
    DROP TABLE IF EXISTS public.pages_blocks_hero_showcase CASCADE;

    ALTER TABLE public.block_presets ALTER COLUMN block_type SET DATA TYPE text;
    DROP TYPE IF EXISTS public.enum_block_presets_block_type;
    CREATE TYPE public.enum_block_presets_block_type AS ENUM ${sql.raw(blockPresetValues)};
    ALTER TABLE public.block_presets
      ALTER COLUMN block_type SET DATA TYPE public.enum_block_presets_block_type
      USING block_type::public.enum_block_presets_block_type;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('This migration removes heroServiceMosaic, heroColorField, and heroShowcase; restore a database backup to roll it back.')
}
