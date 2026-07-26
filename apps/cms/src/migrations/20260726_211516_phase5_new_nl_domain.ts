import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_managed_domains_provider_registration_state" AS ENUM('not_started', 'prepared', 'indeterminate', 'confirmed');
  CREATE TYPE "public"."enum_managed_domains_registrant_verification_status" AS ENUM('not_checked', 'not_required', 'pending', 'verified', 'failed');
  CREATE TYPE "public"."enum_managed_domains_authoritative_dns_status" AS ENUM('pending', 'verified', 'failed');
  CREATE TYPE "public"."enum_managed_domains_https_status" AS ENUM('pending', 'verified', 'failed');
  CREATE TYPE "public"."enum_managed_domains_entitlement_status" AS ENUM('pending', 'active', 'blocked');
  CREATE TYPE "public"."enum_managed_domains_customer_status" AS ENUM('provisioning', 'verification_required', 'active', 'manual_review');
  ALTER TABLE "managed_domains" ADD COLUMN "provider_customer_handle" varchar;
  ALTER TABLE "managed_domains" ADD COLUMN "provider_registration_state" "enum_managed_domains_provider_registration_state" DEFAULT 'not_started' NOT NULL;
  ALTER TABLE "managed_domains" ADD COLUMN "registration_requested_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "cloudflare_zone_id" varchar;
  ALTER TABLE "managed_domains" ADD COLUMN "cloudflare_nameservers" jsonb;
  ALTER TABLE "managed_domains" ADD COLUMN "cloudflare_dns_record_ids" jsonb;
  ALTER TABLE "managed_domains" ADD COLUMN "cloudflare_zone_status" varchar;
  ALTER TABLE "managed_domains" ADD COLUMN "registrant_verification_status" "enum_managed_domains_registrant_verification_status" DEFAULT 'not_checked' NOT NULL;
  ALTER TABLE "managed_domains" ADD COLUMN "registrant_verification_checked_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "registrant_verification_description" varchar;
  ALTER TABLE "managed_domains" ADD COLUMN "authoritative_dns_status" "enum_managed_domains_authoritative_dns_status" DEFAULT 'pending' NOT NULL;
  ALTER TABLE "managed_domains" ADD COLUMN "authoritative_dns_checked_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "authoritative_dns_evidence" jsonb;
  ALTER TABLE "managed_domains" ADD COLUMN "https_status" "enum_managed_domains_https_status" DEFAULT 'pending' NOT NULL;
  ALTER TABLE "managed_domains" ADD COLUMN "https_checked_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "https_evidence" jsonb;
  ALTER TABLE "managed_domains" ADD COLUMN "entitlement_status" "enum_managed_domains_entitlement_status" DEFAULT 'pending' NOT NULL;
  ALTER TABLE "managed_domains" ADD COLUMN "entitlement_activated_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "customer_status" "enum_managed_domains_customer_status" DEFAULT 'provisioning' NOT NULL;
  CREATE INDEX "managed_domains_provider_customer_handle_idx" ON "managed_domains" USING btree ("provider_customer_handle");
  CREATE INDEX "managed_domains_provider_registration_state_idx" ON "managed_domains" USING btree ("provider_registration_state");
  CREATE INDEX "managed_domains_registration_requested_at_idx" ON "managed_domains" USING btree ("registration_requested_at");
  CREATE UNIQUE INDEX "managed_domains_cloudflare_zone_id_idx" ON "managed_domains" USING btree ("cloudflare_zone_id");
  CREATE INDEX "managed_domains_cloudflare_zone_status_idx" ON "managed_domains" USING btree ("cloudflare_zone_status");
  CREATE INDEX "managed_domains_registrant_verification_status_idx" ON "managed_domains" USING btree ("registrant_verification_status");
  CREATE INDEX "managed_domains_authoritative_dns_status_idx" ON "managed_domains" USING btree ("authoritative_dns_status");
  CREATE INDEX "managed_domains_https_status_idx" ON "managed_domains" USING btree ("https_status");
  CREATE INDEX "managed_domains_entitlement_status_idx" ON "managed_domains" USING btree ("entitlement_status");
  CREATE INDEX "managed_domains_customer_status_idx" ON "managed_domains" USING btree ("customer_status");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "managed_domains_provider_customer_handle_idx";
  DROP INDEX "managed_domains_provider_registration_state_idx";
  DROP INDEX "managed_domains_registration_requested_at_idx";
  DROP INDEX "managed_domains_cloudflare_zone_id_idx";
  DROP INDEX "managed_domains_cloudflare_zone_status_idx";
  DROP INDEX "managed_domains_registrant_verification_status_idx";
  DROP INDEX "managed_domains_authoritative_dns_status_idx";
  DROP INDEX "managed_domains_https_status_idx";
  DROP INDEX "managed_domains_entitlement_status_idx";
  DROP INDEX "managed_domains_customer_status_idx";
  ALTER TABLE "managed_domains" DROP COLUMN "provider_customer_handle";
  ALTER TABLE "managed_domains" DROP COLUMN "provider_registration_state";
  ALTER TABLE "managed_domains" DROP COLUMN "registration_requested_at";
  ALTER TABLE "managed_domains" DROP COLUMN "cloudflare_zone_id";
  ALTER TABLE "managed_domains" DROP COLUMN "cloudflare_nameservers";
  ALTER TABLE "managed_domains" DROP COLUMN "cloudflare_dns_record_ids";
  ALTER TABLE "managed_domains" DROP COLUMN "cloudflare_zone_status";
  ALTER TABLE "managed_domains" DROP COLUMN "registrant_verification_status";
  ALTER TABLE "managed_domains" DROP COLUMN "registrant_verification_checked_at";
  ALTER TABLE "managed_domains" DROP COLUMN "registrant_verification_description";
  ALTER TABLE "managed_domains" DROP COLUMN "authoritative_dns_status";
  ALTER TABLE "managed_domains" DROP COLUMN "authoritative_dns_checked_at";
  ALTER TABLE "managed_domains" DROP COLUMN "authoritative_dns_evidence";
  ALTER TABLE "managed_domains" DROP COLUMN "https_status";
  ALTER TABLE "managed_domains" DROP COLUMN "https_checked_at";
  ALTER TABLE "managed_domains" DROP COLUMN "https_evidence";
  ALTER TABLE "managed_domains" DROP COLUMN "entitlement_status";
  ALTER TABLE "managed_domains" DROP COLUMN "entitlement_activated_at";
  ALTER TABLE "managed_domains" DROP COLUMN "customer_status";
  DROP TYPE "public"."enum_managed_domains_provider_registration_state";
  DROP TYPE "public"."enum_managed_domains_registrant_verification_status";
  DROP TYPE "public"."enum_managed_domains_authoritative_dns_status";
  DROP TYPE "public"."enum_managed_domains_https_status";
  DROP TYPE "public"."enum_managed_domains_entitlement_status";
  DROP TYPE "public"."enum_managed_domains_customer_status";`)
}
