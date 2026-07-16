import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "site_generation_runs"
    SET "generation_input" = "generation_input"
      #- '{generationInput,brief,visualPreferences,densitySchemeId}'
      #- '{generationInput,normalizedIntake,intakeBrief,visualPreferences,densitySchemeId}'
    WHERE "generation_input" IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION pg_temp.siab_restore_wrapped_density_hints(doc jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
    BEGIN
      IF jsonb_typeof(doc#>'{generationInput,brief,visualPreferences}') = 'object' THEN
        doc := jsonb_set(
          doc,
          '{generationInput,brief,visualPreferences,densitySchemeId}',
          '"comfortable"'::jsonb,
          true
        );
      END IF;
      IF jsonb_typeof(doc#>'{generationInput,normalizedIntake,intakeBrief,visualPreferences}') = 'object' THEN
        doc := jsonb_set(
          doc,
          '{generationInput,normalizedIntake,intakeBrief,visualPreferences,densitySchemeId}',
          '"comfortable"'::jsonb,
          true
        );
      END IF;
      RETURN doc;
    END $$;

    UPDATE "site_generation_runs"
    SET "generation_input" = pg_temp.siab_restore_wrapped_density_hints("generation_input")
    WHERE "generation_input" IS NOT NULL;
  `)
}
