import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      block_table record;
    BEGIN
      FOR block_table IN
        SELECT table_schema, table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name LIKE 'pages_blocks_%'
          AND column_name = 'variant'
      LOOP
        EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS "design_variant" varchar', block_table.table_schema, block_table.table_name);
        EXECUTE format('UPDATE %I.%I SET "design_variant" = "variant" WHERE "design_variant" IS NULL AND "variant" IS NOT NULL', block_table.table_schema, block_table.table_name);
        EXECUTE format('ALTER TABLE %I.%I DROP COLUMN IF EXISTS "variant"', block_table.table_schema, block_table.table_name);
      END LOOP;
    END $$;

    UPDATE "site_settings"
      SET "chrome_header_variant" = 'default'
      WHERE "chrome_header_variant"::text = ('hyper' || 'UiSimple');
    UPDATE "site_settings"
      SET "chrome_footer_variant" = 'default'
      WHERE "chrome_footer_variant"::text = ('hyper' || 'UiSimple');
    UPDATE "site_settings"
      SET "chrome_banner_variant" = 'default'
      WHERE "chrome_banner_variant"::text = ('hyper' || 'UiSimple');

    ALTER TABLE "site_settings"
      ALTER COLUMN "chrome_header_variant" TYPE varchar USING COALESCE(NULLIF("chrome_header_variant"::text, ''), 'default');
    ALTER TABLE "site_settings"
      ALTER COLUMN "chrome_footer_variant" TYPE varchar USING COALESCE(NULLIF("chrome_footer_variant"::text, ''), 'default');
    ALTER TABLE "site_settings"
      ALTER COLUMN "chrome_banner_variant" TYPE varchar USING COALESCE(NULLIF("chrome_banner_variant"::text, ''), 'default');

    DROP TYPE IF EXISTS "public"."enum_site_settings_chrome_header_variant";
    DROP TYPE IF EXISTS "public"."enum_site_settings_chrome_footer_variant";
    DROP TYPE IF EXISTS "public"."enum_site_settings_chrome_banner_variant";

    CREATE TYPE "public"."enum_site_settings_chrome_header_variant" AS ENUM('default', 'amicareZen');
    CREATE TYPE "public"."enum_site_settings_chrome_footer_variant" AS ENUM('default', 'amicareZen');
    CREATE TYPE "public"."enum_site_settings_chrome_banner_variant" AS ENUM('default');

    ALTER TABLE "site_settings"
      ALTER COLUMN "chrome_header_variant" TYPE "public"."enum_site_settings_chrome_header_variant"
      USING COALESCE(NULLIF("chrome_header_variant", ''), 'default')::"public"."enum_site_settings_chrome_header_variant";
    ALTER TABLE "site_settings"
      ALTER COLUMN "chrome_footer_variant" TYPE "public"."enum_site_settings_chrome_footer_variant"
      USING COALESCE(NULLIF("chrome_footer_variant", ''), 'default')::"public"."enum_site_settings_chrome_footer_variant";
    ALTER TABLE "site_settings"
      ALTER COLUMN "chrome_banner_variant" TYPE "public"."enum_site_settings_chrome_banner_variant"
      USING 'default'::"public"."enum_site_settings_chrome_banner_variant";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      block_table record;
    BEGIN
      FOR block_table IN
        SELECT table_schema, table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name LIKE 'pages_blocks_%'
          AND column_name = 'design_variant'
      LOOP
        EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS "variant" varchar', block_table.table_schema, block_table.table_name);
        EXECUTE format('UPDATE %I.%I SET "variant" = "design_variant" WHERE "variant" IS NULL AND "design_variant" IS NOT NULL', block_table.table_schema, block_table.table_name);
        EXECUTE format('ALTER TABLE %I.%I DROP COLUMN IF EXISTS "design_variant"', block_table.table_schema, block_table.table_name);
      END LOOP;
    END $$;

    DO $$
    DECLARE
      retired_chrome_variant text := 'hyper' || 'UiSimple';
    BEGIN
      EXECUTE format('ALTER TYPE "public"."enum_site_settings_chrome_header_variant" ADD VALUE IF NOT EXISTS %L', retired_chrome_variant);
      EXECUTE format('ALTER TYPE "public"."enum_site_settings_chrome_footer_variant" ADD VALUE IF NOT EXISTS %L', retired_chrome_variant);
      EXECUTE format('ALTER TYPE "public"."enum_site_settings_chrome_banner_variant" ADD VALUE IF NOT EXISTS %L', retired_chrome_variant);
    END $$;
  `)
}
