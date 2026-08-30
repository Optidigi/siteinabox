import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-postgres"

/**
 * The centered `hero` contract is now intentionally media-free. Move any
 * existing image-backed rows into the explicit image-led `heroSplit` table
 * before the generated schema migration removes hero.image_id.
 *
 * Published snapshots are republished from the migrated page data through the
 * supported publication flow; this migration never edits snapshot JSON.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $do$
    BEGIN
      IF to_regclass('public.pages_blocks_hero') IS NULL
         OR to_regclass('public.pages_blocks_hero_split') IS NULL THEN
        RETURN;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_hero'
          AND column_name = 'image_id'
      ) THEN
        IF EXISTS (
          SELECT 1
          FROM public.pages_blocks_hero AS old_hero
          INNER JOIN public.pages_blocks_hero_split AS split_hero ON split_hero.id = old_hero.id
          WHERE old_hero.image_id IS NOT NULL
        ) THEN
          RAISE EXCEPTION USING
            MESSAGE = 'Cannot migrate image-backed hero rows because a heroSplit row already uses the same id',
            HINT = 'Restore from backup and resolve the duplicate block id before retrying the migration.';
        END IF;

        INSERT INTO public.pages_blocks_hero_split (
          "_order",
          "_parent_id",
          "_path",
          id,
          heading,
          body,
          primary_action_label,
          primary_action_href,
          secondary_action_label,
          secondary_action_href,
          image_id,
          anchor,
          block_name
        )
        SELECT
          "_order",
          "_parent_id",
          "_path",
          id,
          heading,
          body,
          primary_action_label,
          primary_action_href,
          secondary_action_label,
          secondary_action_href,
          image_id,
          anchor,
          block_name
        FROM public.pages_blocks_hero
        WHERE image_id IS NOT NULL;

        DELETE FROM public.pages_blocks_hero
        WHERE image_id IS NOT NULL;
      END IF;
    END $do$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("The baseline hero media cutover is data-transforming; restore a database backup to roll it back.")
}
