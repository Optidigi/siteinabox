import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_checkout_progress_drafts_domain_mode" AS ENUM('new_registration', 'existing_domain');
  CREATE TYPE "public"."enum_checkout_progress_drafts_decision" AS ENUM('domain', 'review');
  CREATE TYPE "public"."enum_checkout_progress_drafts_billing_period" AS ENUM('annual', 'monthly');
  CREATE TYPE "public"."enum_checkout_progress_drafts_migration_source_mechanism" AS ENUM('customer_authorized_provider_export_v1', 'cloudflare_api_v1', 'authorized_axfr_v1', 'validated_provider_export_v1');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'purge-expired-checkout-progress-drafts' BEFORE 'send-legal-requirement-notifications';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'purge-expired-checkout-progress-drafts' BEFORE 'send-legal-requirement-notifications';
  CREATE TABLE "checkout_progress_drafts" (
    "id" serial PRIMARY KEY NOT NULL,
    "preview_access_grant_id" integer NOT NULL,
    "tenant_id" integer NOT NULL,
    "generation_run_id" integer NOT NULL,
    "domain_mode" "enum_checkout_progress_drafts_domain_mode" DEFAULT 'new_registration' NOT NULL,
    "domain_query" varchar DEFAULT '' NOT NULL,
    "selected_domain" varchar,
    "decision" "enum_checkout_progress_drafts_decision" DEFAULT 'domain' NOT NULL,
    "billing_period" "enum_checkout_progress_drafts_billing_period" DEFAULT 'annual' NOT NULL,
    "migration_source_mechanism" "enum_checkout_progress_drafts_migration_source_mechanism",
    "expires_at" timestamp(3) with time zone NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "checkout_progress_drafts" ADD CONSTRAINT "checkout_progress_drafts_preview_access_grant_id_preview_access_grants_id_fk" FOREIGN KEY ("preview_access_grant_id") REFERENCES "public"."preview_access_grants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkout_progress_drafts" ADD CONSTRAINT "checkout_progress_drafts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkout_progress_drafts" ADD CONSTRAINT "checkout_progress_drafts_generation_run_id_site_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."site_generation_runs"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "checkout_progress_drafts_preview_access_grant_idx" ON "checkout_progress_drafts" USING btree ("preview_access_grant_id");
  CREATE INDEX "checkout_progress_drafts_tenant_idx" ON "checkout_progress_drafts" USING btree ("tenant_id");
  CREATE INDEX "checkout_progress_drafts_generation_run_idx" ON "checkout_progress_drafts" USING btree ("generation_run_id");
  CREATE INDEX "checkout_progress_drafts_selected_domain_idx" ON "checkout_progress_drafts" USING btree ("selected_domain");
  CREATE INDEX "checkout_progress_drafts_expires_at_idx" ON "checkout_progress_drafts" USING btree ("expires_at");
  CREATE INDEX "checkout_progress_drafts_updated_at_idx" ON "checkout_progress_drafts" USING btree ("updated_at");
  CREATE INDEX "checkout_progress_drafts_created_at_idx" ON "checkout_progress_drafts" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "checkout_progress_drafts" CASCADE;
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'send-legal-requirement-notifications', 'sync-mollie-payment', 'fulfill-order', 'prepare-domain-migration', 'prepare-domain-transfer-out', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'request-mollie-refund');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'send-legal-requirement-notifications', 'sync-mollie-payment', 'fulfill-order', 'prepare-domain-migration', 'prepare-domain-transfer-out', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'request-mollie-refund');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP TYPE "public"."enum_checkout_progress_drafts_domain_mode";
  DROP TYPE "public"."enum_checkout_progress_drafts_decision";
  DROP TYPE "public"."enum_checkout_progress_drafts_billing_period";
  DROP TYPE "public"."enum_checkout_progress_drafts_migration_source_mechanism";`)
}
