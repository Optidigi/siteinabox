import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(`
    ALTER TYPE "public"."enum_site_settings_chrome_header_variant"
      ADD VALUE IF NOT EXISTS 'tailwindplus.marketing.header.with-stacked-flyout-menu';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(`
    ALTER TABLE "site_settings"
      ALTER COLUMN "chrome_header_variant" TYPE varchar
      USING COALESCE(NULLIF("chrome_header_variant"::text, ''), 'default');

    UPDATE "site_settings"
      SET "chrome_header_variant" = 'default'
      WHERE "chrome_header_variant" = 'tailwindplus.marketing.header.with-stacked-flyout-menu';

    DROP TYPE IF EXISTS "public"."enum_site_settings_chrome_header_variant";
    CREATE TYPE "public"."enum_site_settings_chrome_header_variant" AS ENUM('default', 'amicareZen');

    ALTER TABLE "site_settings"
      ALTER COLUMN "chrome_header_variant" TYPE "public"."enum_site_settings_chrome_header_variant"
      USING COALESCE(NULLIF("chrome_header_variant", ''), 'default')::"public"."enum_site_settings_chrome_header_variant";
  `)
}
