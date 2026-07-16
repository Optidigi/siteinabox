import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_system_templates_not_found_variant" AS ENUM('shadcnui-blocks.not-found-01', 'shadcnui-blocks.not-found-02', 'shadcnui-blocks.not-found-03', 'shadcnui-blocks.not-found-04', 'shadcnui-blocks.not-found-05', 'shadcnui-blocks.not-found-06', 'shadcnui-blocks.not-found-07', 'shadcnui-blocks.not-found-08');
  CREATE TYPE "public"."enum_site_settings_maintenance_variant" AS ENUM('shadcnui-blocks.banner-01', 'shadcnui-blocks.banner-02', 'shadcnui-blocks.banner-03', 'shadcnui-blocks.banner-04');
  ALTER TABLE "site_settings" ADD COLUMN "system_templates_not_found_variant" "enum_site_settings_system_templates_not_found_variant" DEFAULT 'shadcnui-blocks.not-found-01' NOT NULL;
  ALTER TABLE "site_settings" ADD COLUMN "maintenance_variant" "enum_site_settings_maintenance_variant";
  UPDATE "site_settings" SET "maintenance_variant" = 'shadcnui-blocks.banner-01' WHERE "maintenance_enabled" IS TRUE;

  CREATE OR REPLACE FUNCTION pg_temp.siab_provider_system_settings(doc jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
  BEGIN
    IF doc#>>'{settings,maintenance,enabled}' = 'true' AND COALESCE(doc#>>'{settings,maintenance,variant}', '') = '' THEN
      doc := jsonb_set(doc, '{settings,maintenance,variant}', '"shadcnui-blocks.banner-01"'::jsonb, true);
    END IF;
    RETURN doc;
  END $$;
  UPDATE "published_site_snapshots" SET "snapshot" = pg_temp.siab_provider_system_settings("snapshot") WHERE "snapshot" IS NOT NULL;
  UPDATE "site_generation_runs" SET "spec" = pg_temp.siab_provider_system_settings("spec") WHERE "spec" IS NOT NULL;
  UPDATE "site_generation_runs" SET "parsed_output" = pg_temp.siab_provider_system_settings("parsed_output") WHERE "parsed_output" IS NOT NULL;
  DO $$ BEGIN
    IF to_regclass('public.generation_runs') IS NOT NULL THEN
      EXECUTE 'UPDATE "generation_runs" SET "input" = pg_temp.siab_provider_system_settings("input") WHERE "input" IS NOT NULL';
    END IF;
  END $$;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "system_templates_not_found_variant";
  ALTER TABLE "site_settings" DROP COLUMN "maintenance_variant";
  DROP TYPE "public"."enum_site_settings_system_templates_not_found_variant";
  DROP TYPE "public"."enum_site_settings_maintenance_variant";`)
}
