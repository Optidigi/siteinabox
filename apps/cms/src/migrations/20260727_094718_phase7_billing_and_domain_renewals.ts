import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_order_kind" AS ENUM('initial_subscription', 'subscription_renewal', 'domain_renewal');
  CREATE TYPE "public"."enum_billing_agreements_service_suspension_status" AS ENUM('none', 'billing_suspended', 'restoration_blocked');
  CREATE TYPE "public"."enum_managed_domains_provider_autorenew" AS ENUM('on', 'off', 'default', 'unknown');
  CREATE TYPE "public"."enum_domain_renewal_cycles_provider_renewal_mode" AS ENUM('autorenew', 'explicit');
  CREATE TYPE "public"."enum_domain_renewal_cycles_provider_autorenew" AS ENUM('on', 'off', 'default', 'unknown');
  CREATE TYPE "public"."enum_domain_renewal_cycles_provider_write_state" AS ENUM('not_required', 'prepared', 'indeterminate', 'confirmed');
  CREATE TYPE "public"."enum_domain_renewal_cycles_financial_coverage_state" AS ENUM('uncovered', 'included_allowance', 'payment_pending', 'payment_secured', 'provider_committed', 'covered');
  CREATE TYPE "public"."enum_commerce_notification_deliveries_kind" AS ENUM('upcoming_charge_7d', 'payment_failed_0d', 'payment_overdue_3d', 'payment_overdue_7d', 'payment_overdue_13d', 'service_suspended_14d', 'service_restored', 'cancellation_scheduled', 'cancellation_effective', 'domain_renewal_60d', 'domain_renewal_30d', 'domain_renewal_14d', 'domain_renewal_7d', 'domain_renewal_1d', 'domain_renewed');
  CREATE TYPE "public"."enum_commerce_notification_deliveries_status" AS ENUM('queued', 'processing', 'sent', 'failed', 'cancelled');
  ALTER TYPE "public"."enum_billing_agreements_state" ADD VALUE 'suspended' BEFORE 'cancellation_scheduled';
  ALTER TYPE "public"."enum_mail_logs_flow" ADD VALUE 'commerce.billing' BEFORE 'product.notification';
  ALTER TYPE "public"."enum_mail_logs_flow" ADD VALUE 'commerce.domain' BEFORE 'product.notification';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'renew-domain' BEFORE 'reconcile-commerce';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'deliver-commerce-notification' BEFORE 'request-mollie-refund';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'renew-domain' BEFORE 'reconcile-commerce';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'deliver-commerce-notification' BEFORE 'request-mollie-refund';
  CREATE TABLE "commerce_notification_deliveries" (
    "id" serial PRIMARY KEY NOT NULL,
    "notification_key" varchar NOT NULL,
    "billing_agreement_id" integer,
    "renewal_cycle_id" integer,
    "tenant_id" integer NOT NULL,
    "recipient" varchar NOT NULL,
    "kind" "enum_commerce_notification_deliveries_kind" NOT NULL,
    "template_version" varchar NOT NULL,
    "event_at" timestamp(3) with time zone NOT NULL,
    "status" "enum_commerce_notification_deliveries_status" DEFAULT 'queued' NOT NULL,
    "attempt_count" numeric DEFAULT 0 NOT NULL,
    "last_attempt_at" timestamp(3) with time zone,
    "next_attempt_at" timestamp(3) with time zone,
    "lease_until" timestamp(3) with time zone,
    "sent_at" timestamp(3) with time zone,
    "failed_at" timestamp(3) with time zone,
    "last_error" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  DROP INDEX "managedDomain_coverageEndsAt_idx";
  DROP INDEX "orders_checkout_profile_key_idx";
  ALTER TABLE "tenants" ADD COLUMN "billing_suspension_agreement_id" integer;
  ALTER TABLE "tenants" ADD COLUMN "billing_suspended_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "billing_cycle_key" varchar;
  ALTER TABLE "orders" ADD COLUMN "billing_agreement_id" integer;
  ALTER TABLE "orders" ADD COLUMN "renewal_cycle_id" integer;
  ALTER TABLE "orders" ADD COLUMN "order_kind" "enum_orders_order_kind";
  ALTER TABLE "orders" ADD COLUMN "service_period_starts_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "service_period_ends_at" timestamp(3) with time zone;
  ALTER TABLE "payment_attempts" ADD COLUMN "attempt_number" numeric DEFAULT 1 NOT NULL;
  ALTER TABLE "billing_agreements" ADD COLUMN "current_period_starts_at" timestamp(3) with time zone;
  ALTER TABLE "billing_agreements" ADD COLUMN "current_period_ends_at" timestamp(3) with time zone;
  ALTER TABLE "billing_agreements" ADD COLUMN "grace_started_at" timestamp(3) with time zone;
  ALTER TABLE "billing_agreements" ADD COLUMN "grace_ends_at" timestamp(3) with time zone;
  ALTER TABLE "billing_agreements" ADD COLUMN "last_payment_attempt_at" timestamp(3) with time zone;
  ALTER TABLE "billing_agreements" ADD COLUMN "suspended_at" timestamp(3) with time zone;
  ALTER TABLE "billing_agreements" ADD COLUMN "restored_at" timestamp(3) with time zone;
  ALTER TABLE "billing_agreements" ADD COLUMN "service_suspension_status" "enum_billing_agreements_service_suspension_status" DEFAULT 'none' NOT NULL;
  ALTER TABLE "billing_agreements" ADD COLUMN "cancellation_evidence" jsonb;
  ALTER TABLE "billing_agreements" ADD COLUMN "admin_exception_code" varchar;
  ALTER TABLE "billing_agreements" ADD COLUMN "admin_exception_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "provider_autorenew" "enum_managed_domains_provider_autorenew" DEFAULT 'unknown' NOT NULL;
  ALTER TABLE "managed_domains" ADD COLUMN "provider_autorenew_checked_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "provider_renewal_price_net_minor" numeric;
  ALTER TABLE "managed_domains" ADD COLUMN "provider_renewal_price_currency" varchar;
  ALTER TABLE "managed_domains" ADD COLUMN "provider_renewal_price_quoted_at" timestamp(3) with time zone;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "provider_renewal_date" timestamp(3) with time zone;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "provider_renewal_mode" "enum_domain_renewal_cycles_provider_renewal_mode" DEFAULT 'autorenew' NOT NULL;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "provider_autorenew" "enum_domain_renewal_cycles_provider_autorenew" DEFAULT 'unknown' NOT NULL;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "provider_write_state" "enum_domain_renewal_cycles_provider_write_state" DEFAULT 'not_required' NOT NULL;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "provider_write_requested_at" timestamp(3) with time zone;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "provider_operation_price_net_minor" numeric;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "included_allowance_net_minor" numeric;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "surcharge_net_minor" numeric;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "financial_coverage_state" "enum_domain_renewal_cycles_financial_coverage_state" DEFAULT 'uncovered' NOT NULL;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "pricing_evidence" jsonb;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "admin_exception_code" varchar;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "admin_exception_at" timestamp(3) with time zone;
  WITH "ranked_attempts" AS (
    SELECT
      "id",
      row_number() OVER (
        PARTITION BY "order_id", "purpose"
        ORDER BY "created_at", "id"
      ) AS "attempt_number"
    FROM "payment_attempts"
  )
  UPDATE "payment_attempts"
  SET "attempt_number" = "ranked_attempts"."attempt_number"
  FROM "ranked_attempts"
  WHERE "payment_attempts"."id" = "ranked_attempts"."id";
  UPDATE "domain_renewal_cycles"
  SET
    "provider_renewal_date" = "coverage_ends_at",
    "provider_operation_price_net_minor" = COALESCE("net_amount_minor", 0) + 1000,
    "included_allowance_net_minor" = 1000,
    "surcharge_net_minor" = COALESCE("net_amount_minor", 0),
    "pricing_evidence" = jsonb_build_object(
      'source', 'legacy_cycle_backfill',
      'requiresProviderReconciliation', true,
      'backfilledAt', now()
    ),
    "reconciliation_required" = true,
    "admin_exception_code" = COALESCE(
      "admin_exception_code",
      'legacy_renewal_pricing_requires_reconciliation'
    ),
    "admin_exception_at" = COALESCE("admin_exception_at", now())
  WHERE "provider_renewal_date" IS NULL;
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_renewal_date" SET NOT NULL;
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_operation_price_net_minor" SET NOT NULL;
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "included_allowance_net_minor" SET NOT NULL;
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "surcharge_net_minor" SET NOT NULL;
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "pricing_evidence" SET NOT NULL;
  ALTER TABLE "commerce_notification_deliveries" ADD CONSTRAINT "commerce_notification_deliveries_billing_agreement_id_billing_agreements_id_fk" FOREIGN KEY ("billing_agreement_id") REFERENCES "public"."billing_agreements"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commerce_notification_deliveries" ADD CONSTRAINT "commerce_notification_deliveries_renewal_cycle_id_domain_renewal_cycles_id_fk" FOREIGN KEY ("renewal_cycle_id") REFERENCES "public"."domain_renewal_cycles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commerce_notification_deliveries" ADD CONSTRAINT "commerce_notification_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "commerce_notification_deliveries_notification_key_idx" ON "commerce_notification_deliveries" USING btree ("notification_key");
  CREATE INDEX "commerce_notification_deliveries_billing_agreement_idx" ON "commerce_notification_deliveries" USING btree ("billing_agreement_id");
  CREATE INDEX "commerce_notification_deliveries_renewal_cycle_idx" ON "commerce_notification_deliveries" USING btree ("renewal_cycle_id");
  CREATE INDEX "commerce_notification_deliveries_tenant_idx" ON "commerce_notification_deliveries" USING btree ("tenant_id");
  CREATE INDEX "commerce_notification_deliveries_recipient_idx" ON "commerce_notification_deliveries" USING btree ("recipient");
  CREATE INDEX "commerce_notification_deliveries_kind_idx" ON "commerce_notification_deliveries" USING btree ("kind");
  CREATE INDEX "commerce_notification_deliveries_event_at_idx" ON "commerce_notification_deliveries" USING btree ("event_at");
  CREATE INDEX "commerce_notification_deliveries_status_idx" ON "commerce_notification_deliveries" USING btree ("status");
  CREATE INDEX "commerce_notification_deliveries_next_attempt_at_idx" ON "commerce_notification_deliveries" USING btree ("next_attempt_at");
  CREATE INDEX "commerce_notification_deliveries_lease_until_idx" ON "commerce_notification_deliveries" USING btree ("lease_until");
  CREATE INDEX "commerce_notification_deliveries_sent_at_idx" ON "commerce_notification_deliveries" USING btree ("sent_at");
  CREATE INDEX "commerce_notification_deliveries_updated_at_idx" ON "commerce_notification_deliveries" USING btree ("updated_at");
  CREATE INDEX "commerce_notification_deliveries_created_at_idx" ON "commerce_notification_deliveries" USING btree ("created_at");
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_billing_suspension_agreement_id_billing_agreements_id_fk" FOREIGN KEY ("billing_suspension_agreement_id") REFERENCES "public"."billing_agreements"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_billing_agreement_id_billing_agreements_id_fk" FOREIGN KEY ("billing_agreement_id") REFERENCES "public"."billing_agreements"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_renewal_cycle_id_domain_renewal_cycles_id_fk" FOREIGN KEY ("renewal_cycle_id") REFERENCES "public"."domain_renewal_cycles"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "tenants_billing_suspension_agreement_idx" ON "tenants" USING btree ("billing_suspension_agreement_id");
  CREATE UNIQUE INDEX "orders_billing_cycle_key_idx" ON "orders" USING btree ("billing_cycle_key");
  CREATE INDEX "orders_billing_agreement_idx" ON "orders" USING btree ("billing_agreement_id");
  CREATE UNIQUE INDEX "orders_renewal_cycle_idx" ON "orders" USING btree ("renewal_cycle_id");
  CREATE INDEX "orders_order_kind_idx" ON "orders" USING btree ("order_kind");
  CREATE INDEX "orders_service_period_starts_at_idx" ON "orders" USING btree ("service_period_starts_at");
  CREATE INDEX "orders_service_period_ends_at_idx" ON "orders" USING btree ("service_period_ends_at");
  CREATE INDEX "payment_attempts_attempt_number_idx" ON "payment_attempts" USING btree ("attempt_number");
  CREATE UNIQUE INDEX "order_purpose_attemptNumber_idx" ON "payment_attempts" USING btree ("order_id","purpose","attempt_number");
  CREATE INDEX "billing_agreements_current_period_starts_at_idx" ON "billing_agreements" USING btree ("current_period_starts_at");
  CREATE INDEX "billing_agreements_current_period_ends_at_idx" ON "billing_agreements" USING btree ("current_period_ends_at");
  CREATE INDEX "billing_agreements_grace_started_at_idx" ON "billing_agreements" USING btree ("grace_started_at");
  CREATE INDEX "billing_agreements_grace_ends_at_idx" ON "billing_agreements" USING btree ("grace_ends_at");
  CREATE INDEX "billing_agreements_suspended_at_idx" ON "billing_agreements" USING btree ("suspended_at");
  CREATE INDEX "billing_agreements_service_suspension_status_idx" ON "billing_agreements" USING btree ("service_suspension_status");
  CREATE INDEX "billing_agreements_admin_exception_code_idx" ON "billing_agreements" USING btree ("admin_exception_code");
  CREATE INDEX "managed_domains_provider_autorenew_idx" ON "managed_domains" USING btree ("provider_autorenew");
  CREATE INDEX "domain_renewal_cycles_provider_renewal_date_idx" ON "domain_renewal_cycles" USING btree ("provider_renewal_date");
  CREATE INDEX "domain_renewal_cycles_provider_renewal_mode_idx" ON "domain_renewal_cycles" USING btree ("provider_renewal_mode");
  CREATE INDEX "domain_renewal_cycles_provider_autorenew_idx" ON "domain_renewal_cycles" USING btree ("provider_autorenew");
  CREATE INDEX "domain_renewal_cycles_provider_write_state_idx" ON "domain_renewal_cycles" USING btree ("provider_write_state");
  CREATE INDEX "domain_renewal_cycles_financial_coverage_state_idx" ON "domain_renewal_cycles" USING btree ("financial_coverage_state");
  CREATE INDEX "domain_renewal_cycles_admin_exception_code_idx" ON "domain_renewal_cycles" USING btree ("admin_exception_code");
  CREATE UNIQUE INDEX "managedDomain_providerRenewalDate_idx" ON "domain_renewal_cycles" USING btree ("managed_domain_id","provider_renewal_date");
  CREATE UNIQUE INDEX "orders_checkout_profile_key_idx"
  ON "orders" USING btree ("checkout_profile_key")
  WHERE "billing_cycle_key" IS NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "commerce_notification_deliveries" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "commerce_notification_deliveries" CASCADE;
  ALTER TABLE "tenants" DROP CONSTRAINT "tenants_billing_suspension_agreement_id_billing_agreements_id_fk";

  ALTER TABLE "orders" DROP CONSTRAINT "orders_billing_agreement_id_billing_agreements_id_fk";

  ALTER TABLE "orders" DROP CONSTRAINT "orders_renewal_cycle_id_domain_renewal_cycles_id_fk";

  ALTER TABLE "billing_agreements" ALTER COLUMN "state" SET DATA TYPE text;
  UPDATE "billing_agreements" SET "state" = 'past_due' WHERE "state" = 'suspended';
  ALTER TABLE "billing_agreements" ALTER COLUMN "state" SET DEFAULT 'pending_first_payment'::text;
  DROP TYPE "public"."enum_billing_agreements_state";
  CREATE TYPE "public"."enum_billing_agreements_state" AS ENUM('pending_first_payment', 'mandate_pending', 'active', 'past_due', 'cancellation_scheduled', 'cancelled');
  ALTER TABLE "billing_agreements" ALTER COLUMN "state" SET DEFAULT 'pending_first_payment'::"public"."enum_billing_agreements_state";
  ALTER TABLE "billing_agreements" ALTER COLUMN "state" SET DATA TYPE "public"."enum_billing_agreements_state" USING "state"::"public"."enum_billing_agreements_state";
  ALTER TABLE "mail_logs" ALTER COLUMN "flow" SET DATA TYPE text;
  UPDATE "mail_logs"
  SET "flow" = 'platform.operational'
  WHERE "flow" IN ('commerce.billing', 'commerce.domain');
  DROP TYPE "public"."enum_mail_logs_flow";
  CREATE TYPE "public"."enum_mail_logs_flow" AS ENUM('platform.operational', 'auth.magic_link', 'auth.password_reset', 'preview.magic_link', 'preview.site_ready', 'privacy.data_export', 'intake.internal_notification', 'forms.tenant_notification', 'site.live_notice', 'legal.reacceptance', 'product.notification', 'marketing.campaign');
  ALTER TABLE "mail_logs" ALTER COLUMN "flow" SET DATA TYPE "public"."enum_mail_logs_flow" USING "flow"::"public"."enum_mail_logs_flow";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DELETE FROM "payload_jobs_log"
  WHERE "task_slug" IN ('renew-domain', 'deliver-commerce-notification');
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'send-legal-requirement-notifications', 'sync-mollie-payment', 'fulfill-order', 'reconcile-commerce', 'request-mollie-refund');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DELETE FROM "payload_jobs"
  WHERE "task_slug" IN ('renew-domain', 'deliver-commerce-notification');
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'send-legal-requirement-notifications', 'sync-mollie-payment', 'fulfill-order', 'reconcile-commerce', 'request-mollie-refund');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "tenants_billing_suspension_agreement_idx";
  DROP INDEX "orders_billing_cycle_key_idx";
  DROP INDEX "orders_billing_agreement_idx";
  DROP INDEX "orders_renewal_cycle_idx";
  DROP INDEX "orders_order_kind_idx";
  DROP INDEX "orders_service_period_starts_at_idx";
  DROP INDEX "orders_service_period_ends_at_idx";
  DROP INDEX "payment_attempts_attempt_number_idx";
  DROP INDEX "order_purpose_attemptNumber_idx";
  DROP INDEX "billing_agreements_current_period_starts_at_idx";
  DROP INDEX "billing_agreements_current_period_ends_at_idx";
  DROP INDEX "billing_agreements_grace_started_at_idx";
  DROP INDEX "billing_agreements_grace_ends_at_idx";
  DROP INDEX "billing_agreements_suspended_at_idx";
  DROP INDEX "billing_agreements_service_suspension_status_idx";
  DROP INDEX "billing_agreements_admin_exception_code_idx";
  DROP INDEX "managed_domains_provider_autorenew_idx";
  DROP INDEX "domain_renewal_cycles_provider_renewal_date_idx";
  DROP INDEX "domain_renewal_cycles_provider_renewal_mode_idx";
  DROP INDEX "domain_renewal_cycles_provider_autorenew_idx";
  DROP INDEX "domain_renewal_cycles_provider_write_state_idx";
  DROP INDEX "domain_renewal_cycles_financial_coverage_state_idx";
  DROP INDEX "domain_renewal_cycles_admin_exception_code_idx";
  DROP INDEX "managedDomain_providerRenewalDate_idx";
  DROP INDEX "orders_checkout_profile_key_idx";
  UPDATE "orders"
  SET "checkout_profile_key" = NULL
  WHERE "billing_cycle_key" IS NOT NULL;
  CREATE UNIQUE INDEX "managedDomain_coverageEndsAt_idx" ON "domain_renewal_cycles" USING btree ("managed_domain_id","coverage_ends_at");
  CREATE UNIQUE INDEX "orders_checkout_profile_key_idx" ON "orders" USING btree ("checkout_profile_key");
  ALTER TABLE "tenants" DROP COLUMN "billing_suspension_agreement_id";
  ALTER TABLE "tenants" DROP COLUMN "billing_suspended_at";
  ALTER TABLE "orders" DROP COLUMN "billing_cycle_key";
  ALTER TABLE "orders" DROP COLUMN "billing_agreement_id";
  ALTER TABLE "orders" DROP COLUMN "renewal_cycle_id";
  ALTER TABLE "orders" DROP COLUMN "order_kind";
  ALTER TABLE "orders" DROP COLUMN "service_period_starts_at";
  ALTER TABLE "orders" DROP COLUMN "service_period_ends_at";
  ALTER TABLE "payment_attempts" DROP COLUMN "attempt_number";
  ALTER TABLE "billing_agreements" DROP COLUMN "current_period_starts_at";
  ALTER TABLE "billing_agreements" DROP COLUMN "current_period_ends_at";
  ALTER TABLE "billing_agreements" DROP COLUMN "grace_started_at";
  ALTER TABLE "billing_agreements" DROP COLUMN "grace_ends_at";
  ALTER TABLE "billing_agreements" DROP COLUMN "last_payment_attempt_at";
  ALTER TABLE "billing_agreements" DROP COLUMN "suspended_at";
  ALTER TABLE "billing_agreements" DROP COLUMN "restored_at";
  ALTER TABLE "billing_agreements" DROP COLUMN "service_suspension_status";
  ALTER TABLE "billing_agreements" DROP COLUMN "cancellation_evidence";
  ALTER TABLE "billing_agreements" DROP COLUMN "admin_exception_code";
  ALTER TABLE "billing_agreements" DROP COLUMN "admin_exception_at";
  ALTER TABLE "managed_domains" DROP COLUMN "provider_autorenew";
  ALTER TABLE "managed_domains" DROP COLUMN "provider_autorenew_checked_at";
  ALTER TABLE "managed_domains" DROP COLUMN "provider_renewal_price_net_minor";
  ALTER TABLE "managed_domains" DROP COLUMN "provider_renewal_price_currency";
  ALTER TABLE "managed_domains" DROP COLUMN "provider_renewal_price_quoted_at";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "provider_renewal_date";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "provider_renewal_mode";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "provider_autorenew";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "provider_write_state";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "provider_write_requested_at";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "provider_operation_price_net_minor";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "included_allowance_net_minor";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "surcharge_net_minor";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "financial_coverage_state";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "pricing_evidence";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "admin_exception_code";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "admin_exception_at";
  DROP TYPE "public"."enum_orders_order_kind";
  DROP TYPE "public"."enum_billing_agreements_service_suspension_status";
  DROP TYPE "public"."enum_managed_domains_provider_autorenew";
  DROP TYPE "public"."enum_domain_renewal_cycles_provider_renewal_mode";
  DROP TYPE "public"."enum_domain_renewal_cycles_provider_autorenew";
  DROP TYPE "public"."enum_domain_renewal_cycles_provider_write_state";
  DROP TYPE "public"."enum_domain_renewal_cycles_financial_coverage_state";
  DROP TYPE "public"."enum_commerce_notification_deliveries_kind";
  DROP TYPE "public"."enum_commerce_notification_deliveries_status";`)
}
