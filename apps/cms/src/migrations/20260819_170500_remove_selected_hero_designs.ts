import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

const blockPresetValues = `('hero', 'heroServicePanel', 'heroCoverActions', 'heroAngled', 'heroFramed', 'heroPatternSplit', 'services', 'about', 'process', 'work', 'reviews', 'pricing', 'faq', 'cta', 'contact', 'richText')`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $do$
    DECLARE
      row_count bigint;
    BEGIN
      IF to_regclass('public.pages_blocks_hero_split') IS NOT NULL THEN
        EXECUTE 'SELECT count(*) FROM public.pages_blocks_hero_split' INTO row_count;
        IF row_count > 0 THEN
          RAISE EXCEPTION USING
            MESSAGE = 'Cannot remove heroSplit while persisted page blocks still contain it',
            HINT = 'Transform those blocks into a retained hero design through the supported CMS migration/regeneration flow, then retry.';
        END IF;
      END IF;

      IF to_regclass('public.pages_blocks_hero_editorial') IS NOT NULL THEN
        EXECUTE 'SELECT count(*) FROM public.pages_blocks_hero_editorial' INTO row_count;
        IF row_count > 0 THEN
          RAISE EXCEPTION USING
            MESSAGE = 'Cannot remove heroEditorial while persisted page blocks still contain it',
            HINT = 'Transform those blocks into a retained hero design through the supported CMS migration/regeneration flow, then retry.';
        END IF;
      END IF;

      IF to_regclass('public.pages_blocks_hero_photo_stage') IS NOT NULL THEN
        EXECUTE 'SELECT count(*) FROM public.pages_blocks_hero_photo_stage' INTO row_count;
        IF row_count > 0 THEN
          RAISE EXCEPTION USING
            MESSAGE = 'Cannot remove heroPhotoStage while persisted page blocks still contain it',
            HINT = 'Transform those blocks into a retained hero design through the supported CMS migration/regeneration flow, then retry.';
        END IF;
      END IF;

      IF to_regclass('public.pages_blocks_hero_pattern_band') IS NOT NULL THEN
        EXECUTE 'SELECT count(*) FROM public.pages_blocks_hero_pattern_band' INTO row_count;
        IF row_count > 0 THEN
          RAISE EXCEPTION USING
            MESSAGE = 'Cannot remove heroPatternBand while persisted page blocks still contain it',
            HINT = 'Transform those blocks into a retained hero design through the supported CMS migration/regeneration flow, then retry.';
        END IF;
      END IF;

      IF to_regclass('public.published_site_snapshots') IS NOT NULL THEN
        EXECUTE $query$
          SELECT count(*) FROM public.published_site_snapshots
          WHERE status = 'active'
            AND snapshot::text ~ '"blockType"[[:space:]]*:[[:space:]]*"(heroSplit|heroEditorial|heroPhotoStage|heroPatternBand)"'
        $query$ INTO row_count;
        IF row_count > 0 THEN
          RAISE EXCEPTION USING
            MESSAGE = 'Cannot remove selected hero designs while an active published snapshot still contains one',
            HINT = 'Regenerate and republish the affected tenant snapshot through the supported publication flow, then retry.';
        END IF;
      END IF;
    END $do$;

    DELETE FROM public.block_presets
    WHERE block_type IN ('heroSplit', 'heroEditorial', 'heroPhotoStage', 'heroPatternBand');

    DROP TABLE IF EXISTS public.pages_blocks_hero_split_highlights CASCADE;
    DROP TABLE IF EXISTS public.pages_blocks_hero_split CASCADE;
    DROP TABLE IF EXISTS public.pages_blocks_hero_editorial CASCADE;
    DROP TABLE IF EXISTS public.pages_blocks_hero_photo_stage CASCADE;
    DROP TABLE IF EXISTS public.pages_blocks_hero_pattern_band CASCADE;

    ALTER TABLE public.block_presets ALTER COLUMN block_type SET DATA TYPE text;
    DROP TYPE IF EXISTS public.enum_block_presets_block_type;
    CREATE TYPE public.enum_block_presets_block_type AS ENUM ${sql.raw(blockPresetValues)};
    ALTER TABLE public.block_presets
      ALTER COLUMN block_type SET DATA TYPE public.enum_block_presets_block_type
      USING block_type::public.enum_block_presets_block_type;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('This migration removes selected hero designs; restore a database backup or run an explicit operator migration to roll it back.')
}
