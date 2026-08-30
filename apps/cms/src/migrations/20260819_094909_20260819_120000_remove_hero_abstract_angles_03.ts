import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

const blockPresetValues = `('hero', 'heroSplit', 'heroServicePanel', 'heroCoverActions', 'heroAngled', 'heroEditorial', 'heroFramed', 'heroPhotoStage', 'heroPatternSplit', 'heroPatternBand', 'services', 'about', 'process', 'work', 'reviews', 'pricing', 'faq', 'cta', 'contact', 'richText')`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $do$
    DECLARE
      row_count bigint;
    BEGIN
      IF to_regclass('public.pages_blocks_hero_abstract_angles03') IS NOT NULL THEN
        EXECUTE 'SELECT count(*) FROM public.pages_blocks_hero_abstract_angles03' INTO row_count;
        IF row_count > 0 THEN
          RAISE EXCEPTION USING
            MESSAGE = 'Cannot remove heroAbstractAngles03 while persisted page blocks still contain it',
            HINT = 'Transform or remove those page blocks through the supported CMS migration/regeneration flow, then retry.';
        END IF;
      END IF;

      IF to_regclass('public.published_site_snapshots') IS NOT NULL THEN
        EXECUTE $query$
          SELECT count(*) FROM public.published_site_snapshots
          WHERE status = 'active'
            AND snapshot::text ~ '"heroAbstractAngles03"|"blockType"[[:space:]]*:[[:space:]]*"heroAbstractAngles03"'
        $query$ INTO row_count;
        IF row_count > 0 THEN
          RAISE EXCEPTION USING
            MESSAGE = 'Cannot remove heroAbstractAngles03 while an active published snapshot still contains it',
            HINT = 'Regenerate and republish the affected tenant snapshot through the supported publication flow, then retry.';
        END IF;
      END IF;
    END $do$;

    DELETE FROM public.block_presets
    WHERE block_type = 'heroAbstractAngles03';

    DROP TABLE IF EXISTS public.pages_blocks_hero_abstract_angles03 CASCADE;

    ALTER TABLE public.block_presets ALTER COLUMN block_type SET DATA TYPE text;
    DROP TYPE IF EXISTS public.enum_block_presets_block_type;
    CREATE TYPE public.enum_block_presets_block_type AS ENUM ${sql.raw(blockPresetValues)};
    ALTER TABLE public.block_presets
      ALTER COLUMN block_type SET DATA TYPE public.enum_block_presets_block_type
      USING block_type::public.enum_block_presets_block_type;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('This migration removes heroAbstractAngles03; restore a database backup or run an explicit operator migration to roll it back.')
}
