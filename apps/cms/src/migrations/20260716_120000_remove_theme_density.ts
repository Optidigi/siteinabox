import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION pg_temp.siab_theme_v3(theme jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
    BEGIN
      IF jsonb_typeof(theme) = 'object'
        AND (theme->>'version' = '2' OR theme ? 'density') THEN
        RETURN (theme - 'density') || jsonb_build_object('version', 3);
      END IF;
      RETURN theme;
    END $$;

    CREATE OR REPLACE FUNCTION pg_temp.siab_document_theme_v3(doc jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
    BEGIN
      IF jsonb_typeof(doc->'theme') = 'object' THEN
        doc := jsonb_set(doc, '{theme}', pg_temp.siab_theme_v3(doc->'theme'), false);
      END IF;

      -- Intake used densitySchemeId only as a theme hint. It never affected content.
      RETURN doc
        #- '{intakeBrief,visualPreferences,densitySchemeId}'
        #- '{intake,intakeBrief,visualPreferences,densitySchemeId}'
        #- '{brief,visualPreferences,densitySchemeId}'
        #- '{normalizedIntake,intakeBrief,visualPreferences,densitySchemeId}';
    END $$;

    UPDATE "tenants"
      SET "theme" = pg_temp.siab_theme_v3("theme")
      WHERE "theme" IS NOT NULL;
    UPDATE "published_site_snapshots"
      SET "snapshot" = pg_temp.siab_document_theme_v3("snapshot")
      WHERE "snapshot" IS NOT NULL;
    UPDATE "site_generation_runs"
      SET "normalized_intake" = pg_temp.siab_document_theme_v3("normalized_intake")
      WHERE "normalized_intake" IS NOT NULL;
    UPDATE "site_generation_runs"
      SET "generation_input" = pg_temp.siab_document_theme_v3("generation_input")
      WHERE "generation_input" IS NOT NULL;
    UPDATE "site_generation_runs"
      SET "spec" = pg_temp.siab_document_theme_v3("spec")
      WHERE "spec" IS NOT NULL;
    UPDATE "site_generation_runs"
      SET "parsed_output" = pg_temp.siab_document_theme_v3("parsed_output")
      WHERE "parsed_output" IS NOT NULL;
    UPDATE "intake_submissions"
      SET "normalized" = pg_temp.siab_document_theme_v3("normalized")
      WHERE "normalized" IS NOT NULL;
    UPDATE "intake_submissions"
      SET "reviewed_generation_input" = pg_temp.siab_document_theme_v3("reviewed_generation_input")
      WHERE "reviewed_generation_input" IS NOT NULL;

    DO $$ BEGIN
      IF to_regclass('public.generation_runs') IS NOT NULL THEN
        EXECUTE 'UPDATE "generation_runs" SET "input" = pg_temp.siab_document_theme_v3("input") WHERE "input" IS NOT NULL';
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION pg_temp.siab_theme_v2(theme jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
    BEGIN
      IF jsonb_typeof(theme) = 'object' AND theme->>'version' = '3' THEN
        RETURN theme || jsonb_build_object(
          'version', 2,
          'density', jsonb_build_object('schemeId', 'comfortable')
        );
      END IF;
      RETURN theme;
    END $$;

    CREATE OR REPLACE FUNCTION pg_temp.siab_restore_density_hint(doc jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
    BEGIN
      IF jsonb_typeof(doc->'theme') = 'object' THEN
        doc := jsonb_set(doc, '{theme}', pg_temp.siab_theme_v2(doc->'theme'), false);
      END IF;
      IF jsonb_typeof(doc#>'{intakeBrief,visualPreferences}') = 'object' THEN
        doc := jsonb_set(doc, '{intakeBrief,visualPreferences,densitySchemeId}', '"comfortable"'::jsonb, true);
      END IF;
      IF jsonb_typeof(doc#>'{intake,intakeBrief,visualPreferences}') = 'object' THEN
        doc := jsonb_set(doc, '{intake,intakeBrief,visualPreferences,densitySchemeId}', '"comfortable"'::jsonb, true);
      END IF;
      IF jsonb_typeof(doc#>'{brief,visualPreferences}') = 'object' THEN
        doc := jsonb_set(doc, '{brief,visualPreferences,densitySchemeId}', '"comfortable"'::jsonb, true);
      END IF;
      IF jsonb_typeof(doc#>'{normalizedIntake,intakeBrief,visualPreferences}') = 'object' THEN
        doc := jsonb_set(doc, '{normalizedIntake,intakeBrief,visualPreferences,densitySchemeId}', '"comfortable"'::jsonb, true);
      END IF;
      RETURN doc;
    END $$;

    UPDATE "tenants"
      SET "theme" = pg_temp.siab_theme_v2("theme")
      WHERE "theme" IS NOT NULL;
    UPDATE "published_site_snapshots"
      SET "snapshot" = pg_temp.siab_restore_density_hint("snapshot")
      WHERE "snapshot" IS NOT NULL;
    UPDATE "site_generation_runs"
      SET "normalized_intake" = pg_temp.siab_restore_density_hint("normalized_intake")
      WHERE "normalized_intake" IS NOT NULL;
    UPDATE "site_generation_runs"
      SET "generation_input" = pg_temp.siab_restore_density_hint("generation_input")
      WHERE "generation_input" IS NOT NULL;
    UPDATE "site_generation_runs"
      SET "spec" = pg_temp.siab_restore_density_hint("spec")
      WHERE "spec" IS NOT NULL;
    UPDATE "site_generation_runs"
      SET "parsed_output" = pg_temp.siab_restore_density_hint("parsed_output")
      WHERE "parsed_output" IS NOT NULL;
    UPDATE "intake_submissions"
      SET "normalized" = pg_temp.siab_restore_density_hint("normalized")
      WHERE "normalized" IS NOT NULL;
    UPDATE "intake_submissions"
      SET "reviewed_generation_input" = pg_temp.siab_restore_density_hint("reviewed_generation_input")
      WHERE "reviewed_generation_input" IS NOT NULL;

    DO $$ BEGIN
      IF to_regclass('public.generation_runs') IS NOT NULL THEN
        EXECUTE 'UPDATE "generation_runs" SET "input" = pg_temp.siab_restore_density_hint("input") WHERE "input" IS NOT NULL';
      END IF;
    END $$;
  `)
}
