import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_managed_domains_registrant_verification_status" ADD VALUE 'overdue' BEFORE 'failed';
  ALTER TYPE "public"."enum_managed_domains_registrant_verification_status" ADD VALUE 'suspended' BEFORE 'failed';
  ALTER TYPE "public"."enum_managed_domains_registrant_verification_status" ADD VALUE 'recovered' BEFORE 'failed';
  ALTER TYPE "public"."enum_commerce_notification_deliveries_kind" ADD VALUE 'domain_renewal_90d' BEFORE 'domain_renewal_60d';
  ALTER TYPE "public"."enum_commerce_notification_deliveries_kind" ADD VALUE 'domain_renewal_admin_7d' BEFORE 'domain_renewal_1d';
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_renewal_mode" SET DATA TYPE text;
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_renewal_mode" SET DEFAULT 'provider_autorenew'::text;
  UPDATE "domain_renewal_cycles"
    SET "provider_renewal_mode" = CASE "provider_renewal_mode"
      WHEN 'autorenew' THEN 'provider_autorenew'
      WHEN 'explicit' THEN 'explicit_renew'
      ELSE "provider_renewal_mode"
    END;
  DROP TYPE "public"."enum_domain_renewal_cycles_provider_renewal_mode";
  CREATE TYPE "public"."enum_domain_renewal_cycles_provider_renewal_mode" AS ENUM('provider_autorenew', 'explicit_renew');
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_renewal_mode" SET DEFAULT 'provider_autorenew'::"public"."enum_domain_renewal_cycles_provider_renewal_mode";
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_renewal_mode" SET DATA TYPE "public"."enum_domain_renewal_cycles_provider_renewal_mode" USING "provider_renewal_mode"::"public"."enum_domain_renewal_cycles_provider_renewal_mode";
  ALTER TABLE "managed_domains" ADD COLUMN "registrant_verification_due_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "registrant_verification_recovered_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "provider_renewal_date" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "registry_expiry_date" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "earliest_explicit_renewal_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "registrar_safe_cutoff_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "payment_charge_at" timestamp(3) with time zone;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "registry_expiry_date" timestamp(3) with time zone;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "earliest_explicit_renewal_at" timestamp(3) with time zone;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "registrar_safe_cutoff_at" timestamp(3) with time zone;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "payment_charge_at" timestamp(3) with time zone;
  UPDATE "managed_domains"
    SET "provider_renewal_date" = "expires_at",
        "registrar_safe_cutoff_at" = "provider_safe_renewal_cutoff_at",
        "payment_charge_at" = LEAST(
          "expires_at" - interval '60 days',
          "provider_safe_renewal_cutoff_at"
        )
    WHERE "expires_at" IS NOT NULL;
  UPDATE "domain_renewal_cycles"
    SET "registrar_safe_cutoff_at" = "provider_safe_cutoff_at",
        "payment_charge_at" = LEAST(
          "provider_renewal_date" - interval '60 days',
          "provider_safe_cutoff_at"
        );
  CREATE INDEX "managed_domains_registrant_verification_due_at_idx" ON "managed_domains" USING btree ("registrant_verification_due_at");
  CREATE INDEX "managed_domains_provider_renewal_date_idx" ON "managed_domains" USING btree ("provider_renewal_date");
  CREATE INDEX "managed_domains_registry_expiry_date_idx" ON "managed_domains" USING btree ("registry_expiry_date");
  CREATE INDEX "managed_domains_earliest_explicit_renewal_at_idx" ON "managed_domains" USING btree ("earliest_explicit_renewal_at");
  CREATE INDEX "managed_domains_registrar_safe_cutoff_at_idx" ON "managed_domains" USING btree ("registrar_safe_cutoff_at");
  CREATE INDEX "managed_domains_payment_charge_at_idx" ON "managed_domains" USING btree ("payment_charge_at");
  CREATE INDEX "domain_renewal_cycles_registry_expiry_date_idx" ON "domain_renewal_cycles" USING btree ("registry_expiry_date");
  CREATE INDEX "domain_renewal_cycles_earliest_explicit_renewal_at_idx" ON "domain_renewal_cycles" USING btree ("earliest_explicit_renewal_at");
  CREATE INDEX "domain_renewal_cycles_registrar_safe_cutoff_at_idx" ON "domain_renewal_cycles" USING btree ("registrar_safe_cutoff_at");
  CREATE INDEX "domain_renewal_cycles_payment_charge_at_idx" ON "domain_renewal_cycles" USING btree ("payment_charge_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "managed_domains" ALTER COLUMN "registrant_verification_status" SET DATA TYPE text;
  ALTER TABLE "managed_domains" ALTER COLUMN "registrant_verification_status" SET DEFAULT 'not_checked'::text;
  UPDATE "managed_domains"
    SET "registrant_verification_status" = CASE "registrant_verification_status"
      WHEN 'recovered' THEN 'verified'
      WHEN 'overdue' THEN 'failed'
      WHEN 'suspended' THEN 'failed'
      ELSE "registrant_verification_status"
    END;
  DROP TYPE "public"."enum_managed_domains_registrant_verification_status";
  CREATE TYPE "public"."enum_managed_domains_registrant_verification_status" AS ENUM('not_checked', 'not_required', 'pending', 'verified', 'failed');
  ALTER TABLE "managed_domains" ALTER COLUMN "registrant_verification_status" SET DEFAULT 'not_checked'::"public"."enum_managed_domains_registrant_verification_status";
  ALTER TABLE "managed_domains" ALTER COLUMN "registrant_verification_status" SET DATA TYPE "public"."enum_managed_domains_registrant_verification_status" USING "registrant_verification_status"::"public"."enum_managed_domains_registrant_verification_status";
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_renewal_mode" SET DATA TYPE text;
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_renewal_mode" SET DEFAULT 'autorenew'::text;
  UPDATE "domain_renewal_cycles"
    SET "provider_renewal_mode" = CASE "provider_renewal_mode"
      WHEN 'provider_autorenew' THEN 'autorenew'
      WHEN 'explicit_renew' THEN 'explicit'
      ELSE "provider_renewal_mode"
    END;
  DROP TYPE "public"."enum_domain_renewal_cycles_provider_renewal_mode";
  CREATE TYPE "public"."enum_domain_renewal_cycles_provider_renewal_mode" AS ENUM('autorenew', 'explicit');
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_renewal_mode" SET DEFAULT 'autorenew'::"public"."enum_domain_renewal_cycles_provider_renewal_mode";
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_renewal_mode" SET DATA TYPE "public"."enum_domain_renewal_cycles_provider_renewal_mode" USING "provider_renewal_mode"::"public"."enum_domain_renewal_cycles_provider_renewal_mode";
  ALTER TABLE "commerce_notification_deliveries" ALTER COLUMN "kind" SET DATA TYPE text;
  UPDATE "commerce_notification_deliveries"
    SET "kind" = CASE "kind"
      WHEN 'domain_renewal_90d' THEN 'domain_renewal_60d'
      WHEN 'domain_renewal_admin_7d' THEN 'domain_renewal_7d'
      ELSE "kind"
    END;
  DROP TYPE "public"."enum_commerce_notification_deliveries_kind";
  CREATE TYPE "public"."enum_commerce_notification_deliveries_kind" AS ENUM('upcoming_charge_7d', 'payment_failed_0d', 'payment_overdue_3d', 'payment_overdue_7d', 'payment_overdue_13d', 'service_suspended_14d', 'service_restored', 'cancellation_scheduled', 'cancellation_effective', 'domain_renewal_60d', 'domain_renewal_30d', 'domain_renewal_14d', 'domain_renewal_7d', 'domain_renewal_1d', 'domain_renewed');
  ALTER TABLE "commerce_notification_deliveries" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_commerce_notification_deliveries_kind" USING "kind"::"public"."enum_commerce_notification_deliveries_kind";
  DROP INDEX "managed_domains_registrant_verification_due_at_idx";
  DROP INDEX "managed_domains_provider_renewal_date_idx";
  DROP INDEX "managed_domains_registry_expiry_date_idx";
  DROP INDEX "managed_domains_earliest_explicit_renewal_at_idx";
  DROP INDEX "managed_domains_registrar_safe_cutoff_at_idx";
  DROP INDEX "managed_domains_payment_charge_at_idx";
  DROP INDEX "domain_renewal_cycles_registry_expiry_date_idx";
  DROP INDEX "domain_renewal_cycles_earliest_explicit_renewal_at_idx";
  DROP INDEX "domain_renewal_cycles_registrar_safe_cutoff_at_idx";
  DROP INDEX "domain_renewal_cycles_payment_charge_at_idx";
  ALTER TABLE "managed_domains" DROP COLUMN "registrant_verification_due_at";
  ALTER TABLE "managed_domains" DROP COLUMN "registrant_verification_recovered_at";
  ALTER TABLE "managed_domains" DROP COLUMN "provider_renewal_date";
  ALTER TABLE "managed_domains" DROP COLUMN "registry_expiry_date";
  ALTER TABLE "managed_domains" DROP COLUMN "earliest_explicit_renewal_at";
  ALTER TABLE "managed_domains" DROP COLUMN "registrar_safe_cutoff_at";
  ALTER TABLE "managed_domains" DROP COLUMN "payment_charge_at";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "registry_expiry_date";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "earliest_explicit_renewal_at";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "registrar_safe_cutoff_at";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "payment_charge_at";`)
}
