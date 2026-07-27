import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_domain_migrations_accepted_classification" AS ENUM('automatic', 'assisted_standard', 'complex');
  CREATE TYPE "public"."enum_domain_migrations_state" AS ENUM('assessment', 'awaiting_customer', 'ready_to_prepare', 'preparing', 'awaiting_provider', 'ready_for_cutover', 'cutover_in_progress', 'verifying', 'completed', 'paused_supplemental_order', 'custom_quote_required', 'failed', 'rolled_back');
  CREATE TYPE "public"."enum_domain_migrations_source_mechanism" AS ENUM('customer_authorized_provider_export_v1');
  CREATE TYPE "public"."enum_domain_migrations_provider_transfer_state" AS ENUM('not_started', 'prepared', 'indeterminate', 'confirmed');
  CREATE TYPE "public"."enum_domain_migrations_cloudflare_zone_state" AS ENUM('not_started', 'prepared', 'indeterminate', 'confirmed');
  CREATE TYPE "public"."enum_domain_migrations_cutover_write_state" AS ENUM('not_started', 'prepared', 'indeterminate', 'confirmed');
  CREATE TYPE "public"."enum_domain_migrations_rollback_write_state" AS ENUM('not_started', 'prepared', 'indeterminate', 'confirmed');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'prepare-domain-migration' BEFORE 'renew-domain';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'prepare-domain-migration' BEFORE 'renew-domain';
  CREATE TABLE "domain_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"originating_order_id" integer NOT NULL,
  	"checkout_profile_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"managed_domain_id" integer,
  	"domain_name_ascii" varchar NOT NULL,
  	"tld" varchar NOT NULL,
  	"accepted_classification" "enum_domain_migrations_accepted_classification" NOT NULL,
  	"state" "enum_domain_migrations_state" DEFAULT 'assessment' NOT NULL,
  	"source_mechanism" "enum_domain_migrations_source_mechanism" DEFAULT 'customer_authorized_provider_export_v1' NOT NULL,
  	"source_zone_hash" varchar,
  	"source_zone_snapshot" jsonb,
  	"target_zone_hash" varchar,
  	"target_zone_snapshot" jsonb,
  	"rollback_evidence" jsonb,
  	"semantic_comparison" jsonb,
  	"dnssec_preparation" jsonb,
  	"customer_actions" jsonb,
  	"encrypted_transfer_code" varchar,
  	"transfer_code_received_at" timestamp(3) with time zone,
  	"transfer_code_expires_at" timestamp(3) with time zone,
  	"transfer_code_deleted_at" timestamp(3) with time zone,
  	"provider_customer_handle" varchar,
  	"provider_transfer_state" "enum_domain_migrations_provider_transfer_state" DEFAULT 'not_started' NOT NULL,
  	"provider_transfer_id" varchar,
  	"provider_domain_id" varchar,
  	"transfer_requested_at" timestamp(3) with time zone,
  	"transfer_confirmed_at" timestamp(3) with time zone,
  	"cloudflare_zone_id" varchar,
  	"cloudflare_nameservers" jsonb,
  	"cloudflare_zone_state" "enum_domain_migrations_cloudflare_zone_state" DEFAULT 'not_started' NOT NULL,
  	"cloudflare_record_ids" jsonb,
  	"zone_prepared_at" timestamp(3) with time zone,
  	"cutover_write_state" "enum_domain_migrations_cutover_write_state" DEFAULT 'not_started' NOT NULL,
  	"cutover_requested_at" timestamp(3) with time zone,
  	"cutover_confirmed_at" timestamp(3) with time zone,
  	"verification_deadline_at" timestamp(3) with time zone,
  	"post_cutover_verification" jsonb,
  	"rollback_write_state" "enum_domain_migrations_rollback_write_state" DEFAULT 'not_started' NOT NULL,
  	"rollback_requested_at" timestamp(3) with time zone,
  	"rollback_confirmed_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"rolled_back_at" timestamp(3) with time zone,
  	"reconciliation_required" boolean DEFAULT false NOT NULL,
  	"failure_reason" varchar,
  	"state_history" jsonb,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "domain_migrations" ADD CONSTRAINT "domain_migrations_originating_order_id_orders_id_fk" FOREIGN KEY ("originating_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domain_migrations" ADD CONSTRAINT "domain_migrations_checkout_profile_id_checkout_profiles_id_fk" FOREIGN KEY ("checkout_profile_id") REFERENCES "public"."checkout_profiles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domain_migrations" ADD CONSTRAINT "domain_migrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domain_migrations" ADD CONSTRAINT "domain_migrations_managed_domain_id_managed_domains_id_fk" FOREIGN KEY ("managed_domain_id") REFERENCES "public"."managed_domains"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "domain_migrations_idempotency_key_idx" ON "domain_migrations" USING btree ("idempotency_key");
  CREATE UNIQUE INDEX "domain_migrations_originating_order_idx" ON "domain_migrations" USING btree ("originating_order_id");
  CREATE INDEX "domain_migrations_checkout_profile_idx" ON "domain_migrations" USING btree ("checkout_profile_id");
  CREATE INDEX "domain_migrations_tenant_idx" ON "domain_migrations" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "domain_migrations_managed_domain_idx" ON "domain_migrations" USING btree ("managed_domain_id");
  CREATE UNIQUE INDEX "domain_migrations_domain_name_ascii_idx" ON "domain_migrations" USING btree ("domain_name_ascii");
  CREATE INDEX "domain_migrations_tld_idx" ON "domain_migrations" USING btree ("tld");
  CREATE INDEX "domain_migrations_accepted_classification_idx" ON "domain_migrations" USING btree ("accepted_classification");
  CREATE INDEX "domain_migrations_state_idx" ON "domain_migrations" USING btree ("state");
  CREATE UNIQUE INDEX "domain_migrations_source_zone_hash_idx" ON "domain_migrations" USING btree ("source_zone_hash");
  CREATE UNIQUE INDEX "domain_migrations_target_zone_hash_idx" ON "domain_migrations" USING btree ("target_zone_hash");
  CREATE INDEX "domain_migrations_transfer_code_expires_at_idx" ON "domain_migrations" USING btree ("transfer_code_expires_at");
  CREATE INDEX "domain_migrations_provider_customer_handle_idx" ON "domain_migrations" USING btree ("provider_customer_handle");
  CREATE INDEX "domain_migrations_provider_transfer_state_idx" ON "domain_migrations" USING btree ("provider_transfer_state");
  CREATE UNIQUE INDEX "domain_migrations_provider_transfer_id_idx" ON "domain_migrations" USING btree ("provider_transfer_id");
  CREATE UNIQUE INDEX "domain_migrations_provider_domain_id_idx" ON "domain_migrations" USING btree ("provider_domain_id");
  CREATE INDEX "domain_migrations_transfer_requested_at_idx" ON "domain_migrations" USING btree ("transfer_requested_at");
  CREATE UNIQUE INDEX "domain_migrations_cloudflare_zone_id_idx" ON "domain_migrations" USING btree ("cloudflare_zone_id");
  CREATE INDEX "domain_migrations_cloudflare_zone_state_idx" ON "domain_migrations" USING btree ("cloudflare_zone_state");
  CREATE INDEX "domain_migrations_cutover_write_state_idx" ON "domain_migrations" USING btree ("cutover_write_state");
  CREATE INDEX "domain_migrations_verification_deadline_at_idx" ON "domain_migrations" USING btree ("verification_deadline_at");
  CREATE INDEX "domain_migrations_rollback_write_state_idx" ON "domain_migrations" USING btree ("rollback_write_state");
  CREATE INDEX "domain_migrations_completed_at_idx" ON "domain_migrations" USING btree ("completed_at");
  CREATE INDEX "domain_migrations_rolled_back_at_idx" ON "domain_migrations" USING btree ("rolled_back_at");
  CREATE INDEX "domain_migrations_reconciliation_required_idx" ON "domain_migrations" USING btree ("reconciliation_required");
  CREATE INDEX "domain_migrations_created_at_idx" ON "domain_migrations" USING btree ("created_at");
  CREATE INDEX "domain_migrations_updated_at_idx" ON "domain_migrations" USING btree ("updated_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "domain_migrations" CASCADE;
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'send-legal-requirement-notifications', 'sync-mollie-payment', 'fulfill-order', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'request-mollie-refund');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'send-legal-requirement-notifications', 'sync-mollie-payment', 'fulfill-order', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'request-mollie-refund');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP TYPE "public"."enum_domain_migrations_accepted_classification";
  DROP TYPE "public"."enum_domain_migrations_state";
  DROP TYPE "public"."enum_domain_migrations_source_mechanism";
  DROP TYPE "public"."enum_domain_migrations_provider_transfer_state";
  DROP TYPE "public"."enum_domain_migrations_cloudflare_zone_state";
  DROP TYPE "public"."enum_domain_migrations_cutover_write_state";
  DROP TYPE "public"."enum_domain_migrations_rollback_write_state";`)
}
