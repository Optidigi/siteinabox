import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_tenants_email_sending_provider" AS ENUM('cloudflare');
    CREATE TYPE "public"."enum_tenants_email_sending_mode" AS ENUM('subdomain', 'apex');
    CREATE TYPE "public"."enum_tenants_email_sending_status" AS ENUM('not_configured', 'pending', 'verified', 'failed');

    ALTER TABLE "tenants" ADD COLUMN "email_sending_provider" "enum_tenants_email_sending_provider" DEFAULT 'cloudflare';
    ALTER TABLE "tenants" ADD COLUMN "email_sending_mode" "enum_tenants_email_sending_mode" DEFAULT 'subdomain';
    ALTER TABLE "tenants" ADD COLUMN "email_sending_status" "enum_tenants_email_sending_status" DEFAULT 'not_configured';
    ALTER TABLE "tenants" ADD COLUMN "email_sending_sending_domain" varchar;
    ALTER TABLE "tenants" ADD COLUMN "email_sending_sender_email" varchar;
    ALTER TABLE "tenants" ADD COLUMN "email_sending_verified_at" timestamp(3) with time zone;
    ALTER TABLE "tenants" ADD COLUMN "email_sending_last_checked_at" timestamp(3) with time zone;
    ALTER TABLE "tenants" ADD COLUMN "email_sending_last_error" varchar;
    ALTER TABLE "tenants" ADD COLUMN "email_sending_cloudflare_zone_id" varchar;
    ALTER TABLE "tenants" ADD COLUMN "email_sending_cloudflare_subdomain_id" varchar;
    ALTER TABLE "tenants" ADD COLUMN "email_sending_return_path_domain" varchar;
    ALTER TABLE "tenants" ADD COLUMN "email_sending_dkim_selector" varchar;
    ALTER TABLE "tenants" ADD COLUMN "email_sending_test_message_id" varchar;

    CREATE INDEX "tenants_email_sending_status_idx" ON "tenants" USING btree ("email_sending_status");
    CREATE INDEX "tenants_email_sending_mode_idx" ON "tenants" USING btree ("email_sending_mode");
    CREATE INDEX "tenants_email_sending_sending_domain_idx" ON "tenants" USING btree ("email_sending_sending_domain");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "tenants_email_sending_status_idx";
    DROP INDEX IF EXISTS "tenants_email_sending_mode_idx";
    DROP INDEX IF EXISTS "tenants_email_sending_sending_domain_idx";

    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_sending_test_message_id";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_sending_dkim_selector";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_sending_return_path_domain";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_sending_cloudflare_subdomain_id";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_sending_cloudflare_zone_id";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_sending_last_error";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_sending_last_checked_at";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_sending_verified_at";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_sending_sender_email";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_sending_sending_domain";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_sending_status";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_sending_mode";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_sending_provider";

    DROP TYPE IF EXISTS "public"."enum_tenants_email_sending_status";
    DROP TYPE IF EXISTS "public"."enum_tenants_email_sending_mode";
    DROP TYPE IF EXISTS "public"."enum_tenants_email_sending_provider";
  `)
}
