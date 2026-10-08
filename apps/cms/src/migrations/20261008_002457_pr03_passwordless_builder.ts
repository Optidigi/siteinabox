import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`CREATE TYPE "public"."enum_preview_access_grants_inactive_notice_state" AS ENUM('sending', 'sent', 'unknown');
  CREATE TYPE "public"."enum_builder_operations_state" AS ENUM('reserved', 'running', 'succeeded', 'failed', 'interrupted');
  CREATE TYPE "public"."enum_customer_session_bindings_state" AS ENUM('issuing', 'active', 'revoked');
  ALTER TYPE "public"."enum_mail_logs_flow" ADD VALUE 'preview.expiry_notice' BEFORE 'privacy.data_export';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'inactive-previews' BEFORE 'send-legal-requirement-notifications';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'reconcile-builder-operations' BEFORE 'send-legal-requirement-notifications';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'inactive-previews' BEFORE 'send-legal-requirement-notifications';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'reconcile-builder-operations' BEFORE 'send-legal-requirement-notifications';
  CREATE TABLE "builder_quota_accounts" (
    "id" serial PRIMARY KEY NOT NULL,
    "customer_email" varchar NOT NULL,
    "visible_used" numeric DEFAULT 0 NOT NULL,
    "visible_reserved" numeric DEFAULT 0 NOT NULL,
    "charged_cost_units" numeric DEFAULT 0 NOT NULL,
    "attempts" numeric DEFAULT 0 NOT NULL,
    "revision" numeric DEFAULT 0 NOT NULL,
    "ingress_requests" numeric DEFAULT 0 NOT NULL,
    "ingress_day" varchar DEFAULT '1970-01-01' NOT NULL,
    "active_operation_key" varchar,
    "ingress_token" varchar,
    "last_activity_at" timestamp(3) with time zone NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "builder_quota_global" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "active_operations" numeric DEFAULT 0 NOT NULL,
    "charged_cost_units" numeric DEFAULT 0 NOT NULL,
    "attempts" numeric DEFAULT 0 NOT NULL,
    "revision" numeric DEFAULT 0 NOT NULL,
    "ingress_requests" numeric DEFAULT 0 NOT NULL,
    "ingress_day" varchar DEFAULT '1970-01-01' NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "builder_operations" (
    "id" serial PRIMARY KEY NOT NULL,
    "operation_key" varchar NOT NULL,
    "operation_id" varchar NOT NULL,
    "customer_email" varchar NOT NULL,
    "message_hash" varchar NOT NULL,
    "state" "enum_builder_operations_state" NOT NULL,
    "reservation_token" varchar NOT NULL,
    "revision" numeric DEFAULT 0 NOT NULL,
    "reserved_cost_units" numeric DEFAULT 0 NOT NULL,
    "settled_cost_units" numeric DEFAULT 0 NOT NULL,
    "dispatched_cost_units" numeric DEFAULT 0 NOT NULL,
    "known_cost_units" numeric DEFAULT 0 NOT NULL,
    "model_calls" numeric DEFAULT 0 NOT NULL,
    "weighted_steps" numeric DEFAULT 0 NOT NULL,
    "unknown_calls" numeric DEFAULT 0 NOT NULL,
    "outstanding_calls" numeric DEFAULT 0 NOT NULL,
    "cost_known" boolean DEFAULT true NOT NULL,
    "slot_held" boolean DEFAULT true NOT NULL,
    "started_at" timestamp(3) with time zone NOT NULL,
    "deadline_at" timestamp(3) with time zone NOT NULL,
    "settled_at" timestamp(3) with time zone,
    "error_code" varchar,
    "result" jsonb,
    "intake_submission_id" numeric,
    "generation_run_id" numeric,
    "configuration_revision" varchar NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "customer_auth_accounts" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "auth_epoch" timestamp(3) with time zone NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "customer_session_bindings" (
    "id" serial PRIMARY KEY NOT NULL,
    "better_auth_session_id" varchar NOT NULL,
    "user_id" integer NOT NULL,
    "payload_session_id" varchar,
    "state" "enum_customer_session_bindings_state" DEFAULT 'issuing' NOT NULL,
    "revoked_at" timestamp(3) with time zone,
    "handoff_key" varchar,
    "paid_order_id" integer,
    "paid_attempt_id" integer,
    "preview_session_id" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "costly_search_budgets" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "day" varchar NOT NULL,
    "attempts" numeric DEFAULT 0 NOT NULL,
    "active_claims" jsonb NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "magic_mail_budgets" (
    "id" serial PRIMARY KEY NOT NULL,
    "budget_key" varchar NOT NULL,
    "day" varchar NOT NULL,
    "attempts" numeric NOT NULL,
    "last_claim_token" varchar,
    "last_claim_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "preview_session_revocations" (
    "id" serial PRIMARY KEY NOT NULL,
    "better_auth_session_id" varchar NOT NULL,
    "email" varchar NOT NULL,
    "revoked_at" timestamp(3) with time zone NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "preview_access_grants" ADD COLUMN "inactive_notice_state" "enum_preview_access_grants_inactive_notice_state";
  ALTER TABLE "preview_access_grants" ADD COLUMN "inactive_notice_claimed_at" timestamp(3) with time zone;
  ALTER TABLE "preview_access_grants" ADD COLUMN "inactive_notice_sent_at" timestamp(3) with time zone;
  ALTER TABLE "preview_access_grants" ADD COLUMN "inactive_notice_activity_at" timestamp(3) with time zone;
  ALTER TABLE "preview_access_grants" ADD COLUMN "inactive_expires_at" timestamp(3) with time zone;
  ALTER TABLE "preview_access_grants" ADD COLUMN "inactive_expired_at" timestamp(3) with time zone;
  ALTER TABLE "customer_auth_accounts" ADD CONSTRAINT "customer_auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_session_bindings" ADD CONSTRAINT "customer_session_bindings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_session_bindings" ADD CONSTRAINT "customer_session_bindings_paid_order_id_orders_id_fk" FOREIGN KEY ("paid_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_session_bindings" ADD CONSTRAINT "customer_session_bindings_paid_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("paid_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "builder_quota_accounts_customer_email_idx" ON "builder_quota_accounts" USING btree ("customer_email");
  CREATE INDEX "builder_quota_accounts_last_activity_at_idx" ON "builder_quota_accounts" USING btree ("last_activity_at");
  CREATE INDEX "builder_quota_accounts_updated_at_idx" ON "builder_quota_accounts" USING btree ("updated_at");
  CREATE INDEX "builder_quota_accounts_created_at_idx" ON "builder_quota_accounts" USING btree ("created_at");
  CREATE UNIQUE INDEX "builder_quota_global_key_idx" ON "builder_quota_global" USING btree ("key");
  CREATE INDEX "builder_quota_global_updated_at_idx" ON "builder_quota_global" USING btree ("updated_at");
  CREATE INDEX "builder_quota_global_created_at_idx" ON "builder_quota_global" USING btree ("created_at");
  CREATE UNIQUE INDEX "builder_operations_operation_key_idx" ON "builder_operations" USING btree ("operation_key");
  CREATE INDEX "builder_operations_customer_email_idx" ON "builder_operations" USING btree ("customer_email");
  CREATE INDEX "builder_operations_state_idx" ON "builder_operations" USING btree ("state");
  CREATE INDEX "builder_operations_deadline_at_idx" ON "builder_operations" USING btree ("deadline_at");
  CREATE INDEX "builder_operations_updated_at_idx" ON "builder_operations" USING btree ("updated_at");
  CREATE INDEX "builder_operations_created_at_idx" ON "builder_operations" USING btree ("created_at");
  CREATE UNIQUE INDEX "customer_auth_accounts_user_idx" ON "customer_auth_accounts" USING btree ("user_id");
  CREATE INDEX "customer_auth_accounts_updated_at_idx" ON "customer_auth_accounts" USING btree ("updated_at");
  CREATE INDEX "customer_auth_accounts_created_at_idx" ON "customer_auth_accounts" USING btree ("created_at");
  CREATE UNIQUE INDEX "customer_session_bindings_better_auth_session_id_idx" ON "customer_session_bindings" USING btree ("better_auth_session_id");
  CREATE INDEX "customer_session_bindings_user_idx" ON "customer_session_bindings" USING btree ("user_id");
  CREATE UNIQUE INDEX "customer_session_bindings_payload_session_id_idx" ON "customer_session_bindings" USING btree ("payload_session_id");
  CREATE UNIQUE INDEX "customer_session_bindings_handoff_key_idx" ON "customer_session_bindings" USING btree ("handoff_key");
  CREATE INDEX "customer_session_bindings_paid_order_idx" ON "customer_session_bindings" USING btree ("paid_order_id");
  CREATE INDEX "customer_session_bindings_paid_attempt_idx" ON "customer_session_bindings" USING btree ("paid_attempt_id");
  CREATE INDEX "customer_session_bindings_updated_at_idx" ON "customer_session_bindings" USING btree ("updated_at");
  CREATE INDEX "customer_session_bindings_created_at_idx" ON "customer_session_bindings" USING btree ("created_at");
  CREATE UNIQUE INDEX "costly_search_budgets_key_idx" ON "costly_search_budgets" USING btree ("key");
  CREATE INDEX "costly_search_budgets_updated_at_idx" ON "costly_search_budgets" USING btree ("updated_at");
  CREATE INDEX "costly_search_budgets_created_at_idx" ON "costly_search_budgets" USING btree ("created_at");
  CREATE UNIQUE INDEX "magic_mail_budgets_budget_key_idx" ON "magic_mail_budgets" USING btree ("budget_key");
  CREATE INDEX "magic_mail_budgets_updated_at_idx" ON "magic_mail_budgets" USING btree ("updated_at");
  CREATE INDEX "magic_mail_budgets_created_at_idx" ON "magic_mail_budgets" USING btree ("created_at");
  CREATE UNIQUE INDEX "preview_session_revocations_better_auth_session_id_idx" ON "preview_session_revocations" USING btree ("better_auth_session_id");
  CREATE INDEX "preview_session_revocations_email_idx" ON "preview_session_revocations" USING btree ("email");
  CREATE INDEX "preview_session_revocations_updated_at_idx" ON "preview_session_revocations" USING btree ("updated_at");
  CREATE INDEX "preview_session_revocations_created_at_idx" ON "preview_session_revocations" USING btree ("created_at");
  CREATE INDEX "preview_access_grants_inactive_expires_at_idx" ON "preview_access_grants" USING btree ("inactive_expires_at");
  CREATE INDEX "preview_access_grants_inactive_expired_at_idx" ON "preview_access_grants" USING btree ("inactive_expired_at");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`DO $$ BEGIN IF EXISTS (SELECT 1 FROM "builder_quota_accounts") OR EXISTS (SELECT 1 FROM "builder_operations") OR EXISTS (SELECT 1 FROM "customer_auth_accounts") OR EXISTS (SELECT 1 FROM "customer_session_bindings") OR EXISTS (SELECT 1 FROM "costly_search_budgets") OR EXISTS (SELECT 1 FROM "magic_mail_budgets") OR EXISTS (SELECT 1 FROM "preview_session_revocations") OR EXISTS (SELECT 1 FROM "builder_quota_global" WHERE "attempts" > 0 OR "ingress_requests" > 0 OR "active_operations" > 0 OR "charged_cost_units" > 0) OR EXISTS (SELECT 1 FROM "preview_access_grants" WHERE "inactive_notice_claimed_at" IS NOT NULL OR "inactive_expired_at" IS NOT NULL) OR EXISTS (SELECT 1 FROM "payload_jobs" WHERE "task_slug" IN ('inactive-previews', 'reconcile-builder-operations')) OR EXISTS (SELECT 1 FROM "payload_jobs_log" WHERE "task_slug" IN ('inactive-previews', 'reconcile-builder-operations')) OR EXISTS (SELECT 1 FROM "mail_logs" WHERE "flow" = 'preview.expiry_notice') THEN RAISE EXCEPTION 'Preserve customer identity, accounting and notice evidence; use a forward fix'; END IF; END $$;
  ALTER TABLE "builder_quota_accounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "builder_quota_global" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "builder_operations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customer_auth_accounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customer_session_bindings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "costly_search_budgets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "magic_mail_budgets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "preview_session_revocations" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "builder_quota_accounts" CASCADE;
  DROP TABLE "builder_quota_global" CASCADE;
  DROP TABLE "builder_operations" CASCADE;
  DROP TABLE "customer_auth_accounts" CASCADE;
  DROP TABLE "customer_session_bindings" CASCADE;
  DROP TABLE "costly_search_budgets" CASCADE;
  DROP TABLE "magic_mail_budgets" CASCADE;
  DROP TABLE "preview_session_revocations" CASCADE;
  ALTER TABLE "mail_logs" ALTER COLUMN "flow" SET DATA TYPE text;
  DROP TYPE "public"."enum_mail_logs_flow";
  CREATE TYPE "public"."enum_mail_logs_flow" AS ENUM('platform.operational', 'auth.magic_link', 'auth.password_reset', 'preview.magic_link', 'preview.site_ready', 'privacy.data_export', 'intake.internal_notification', 'forms.tenant_notification', 'appointments.visitor_notification', 'appointments.tenant_notification', 'site.live_notice', 'legal.reacceptance', 'commerce.billing', 'commerce.domain', 'product.notification', 'marketing.campaign');
  ALTER TABLE "mail_logs" ALTER COLUMN "flow" SET DATA TYPE "public"."enum_mail_logs_flow" USING "flow"::"public"."enum_mail_logs_flow";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'purge-expired-checkout-progress-drafts', 'send-legal-requirement-notifications', 'process-appointment-notifications', 'process-appointment-calendar-events', 'purge-stale-appointments', 'sync-mollie-payment', 'fulfill-order', 'prepare-domain-migration', 'prepare-domain-transfer-out', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'request-mollie-refund');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'purge-expired-checkout-progress-drafts', 'send-legal-requirement-notifications', 'process-appointment-notifications', 'process-appointment-calendar-events', 'purge-stale-appointments', 'sync-mollie-payment', 'fulfill-order', 'prepare-domain-migration', 'prepare-domain-transfer-out', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'request-mollie-refund');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "preview_access_grants_inactive_expires_at_idx";
  DROP INDEX "preview_access_grants_inactive_expired_at_idx";
  ALTER TABLE "preview_access_grants" DROP COLUMN "inactive_notice_state";
  ALTER TABLE "preview_access_grants" DROP COLUMN "inactive_notice_claimed_at";
  ALTER TABLE "preview_access_grants" DROP COLUMN "inactive_notice_sent_at";
  ALTER TABLE "preview_access_grants" DROP COLUMN "inactive_notice_activity_at";
  ALTER TABLE "preview_access_grants" DROP COLUMN "inactive_expires_at";
  ALTER TABLE "preview_access_grants" DROP COLUMN "inactive_expired_at";
  DROP TYPE "public"."enum_preview_access_grants_inactive_notice_state";
  DROP TYPE "public"."enum_builder_operations_state";
  DROP TYPE "public"."enum_customer_session_bindings_state";`);
}
