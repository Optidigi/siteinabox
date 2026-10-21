import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
     CREATE TYPE "public"."enum_account_link_dispatches_namespace" AS ENUM('preview', 'cms', 'payload');
    CREATE TYPE "public"."enum_account_link_dispatches_purpose" AS ENUM('free_verification', 'preview_login', 'cms_login', 'invitation', 'site_handoff', 'password_reset', 'legacy_login');
    CREATE TYPE "public"."enum_account_link_dispatches_lane" AS ENUM('acquisition', 'returning', 'protected');
    CREATE TYPE "public"."enum_account_link_dispatches_state" AS ENUM('admitted', 'queued', 'issuing', 'dispatching', 'sent', 'indeterminate', 'failed', 'consumed', 'cancelled', 'legacy');
    CREATE TYPE "public"."enum_account_link_dispatches_retry_state" AS ENUM('none', 'retryable', 'permanent', 'manual_review');
    ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'account-link-dispatch' BEFORE 'request-mollie-refund';
    ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'account-link-dispatch' BEFORE 'request-mollie-refund';
    CREATE TABLE "account_link_dispatches" (
      "id" serial PRIMARY KEY NOT NULL,
      "scope_key" varchar NOT NULL,
      "active_key" varchar,
      "namespace" "enum_account_link_dispatches_namespace" NOT NULL,
      "purpose" "enum_account_link_dispatches_purpose" NOT NULL,
      "lane" "enum_account_link_dispatches_lane" NOT NULL,
      "recipient" varchar NOT NULL,
      "payload_user_id" varchar,
      "preview_user_id" varchar,
      "tenant_id" varchar,
      "role" varchar,
      "actor_user_id" varchar,
      "metadata" jsonb,
      "origin" varchar NOT NULL,
      "callback_path" varchar NOT NULL,
      "error_callback_path" varchar NOT NULL,
      "state" "enum_account_link_dispatches_state" DEFAULT 'admitted' NOT NULL,
      "fence" numeric DEFAULT 1 NOT NULL,
      "lease_token_hash" varchar,
      "lease_until" timestamp(3) with time zone,
      "token_fingerprint" varchar,
      "verification_id" varchar,
      "expires_at" timestamp(3) with time zone,
      "send_attempts" numeric DEFAULT 0 NOT NULL,
      "retry_at" timestamp(3) with time zone,
      "retry_state" "enum_account_link_dispatches_retry_state" DEFAULT 'none' NOT NULL,
      "provider_message_id" varchar,
      "outcome_code" varchar,
      "retention_after" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE "account_link_windows" (
      "id" serial PRIMARY KEY NOT NULL,
      "key" varchar NOT NULL,
      "count" numeric DEFAULT 0 NOT NULL,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE "account_link_policies" (
      "id" serial PRIMARY KEY NOT NULL,
      "key" varchar NOT NULL,
      "activated_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "account_link_dispatches_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "account_link_windows_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "account_link_policies_id" integer;
    CREATE INDEX "account_link_dispatches_scope_key_idx" ON "account_link_dispatches" USING btree ("scope_key");
    CREATE UNIQUE INDEX "account_link_dispatches_active_key_idx" ON "account_link_dispatches" USING btree ("active_key");
    CREATE INDEX "account_link_dispatches_namespace_idx" ON "account_link_dispatches" USING btree ("namespace");
    CREATE INDEX "account_link_dispatches_state_idx" ON "account_link_dispatches" USING btree ("state");
    CREATE INDEX "account_link_dispatches_lease_until_idx" ON "account_link_dispatches" USING btree ("lease_until");
    CREATE UNIQUE INDEX "account_link_dispatches_token_fingerprint_idx" ON "account_link_dispatches" USING btree ("token_fingerprint");
    CREATE INDEX "account_link_dispatches_expires_at_idx" ON "account_link_dispatches" USING btree ("expires_at");
    CREATE INDEX "account_link_dispatches_retry_at_idx" ON "account_link_dispatches" USING btree ("retry_at");
    CREATE INDEX "account_link_dispatches_retention_after_idx" ON "account_link_dispatches" USING btree ("retention_after");
    CREATE INDEX "account_link_dispatches_updated_at_idx" ON "account_link_dispatches" USING btree ("updated_at");
    CREATE INDEX "account_link_dispatches_created_at_idx" ON "account_link_dispatches" USING btree ("created_at");
    CREATE UNIQUE INDEX "account_link_windows_key_idx" ON "account_link_windows" USING btree ("key");
    CREATE INDEX "account_link_windows_expires_at_idx" ON "account_link_windows" USING btree ("expires_at");
    CREATE INDEX "account_link_windows_updated_at_idx" ON "account_link_windows" USING btree ("updated_at");
    CREATE INDEX "account_link_windows_created_at_idx" ON "account_link_windows" USING btree ("created_at");
    CREATE UNIQUE INDEX "account_link_policies_key_idx" ON "account_link_policies" USING btree ("key");
    CREATE INDEX "account_link_policies_updated_at_idx" ON "account_link_policies" USING btree ("updated_at");
    CREATE INDEX "account_link_policies_created_at_idx" ON "account_link_policies" USING btree ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_account_link_dispatches_fk" FOREIGN KEY ("account_link_dispatches_id") REFERENCES "public"."account_link_dispatches"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_account_link_windows_fk" FOREIGN KEY ("account_link_windows_id") REFERENCES "public"."account_link_windows"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_account_link_policies_fk" FOREIGN KEY ("account_link_policies_id") REFERENCES "public"."account_link_policies"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_account_link_dispatches_id_idx" ON "payload_locked_documents_rels" USING btree ("account_link_dispatches_id");
    CREATE INDEX "payload_locked_documents_rels_account_link_windows_id_idx" ON "payload_locked_documents_rels" USING btree ("account_link_windows_id");
    CREATE INDEX "payload_locked_documents_rels_account_link_policies_id_idx" ON "payload_locked_documents_rels" USING btree ("account_link_policies_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN IF EXISTS (SELECT 1 FROM account_link_dispatches) OR EXISTS (SELECT 1 FROM account_link_windows) OR EXISTS (SELECT 1 FROM account_link_policies) THEN RAISE EXCEPTION 'Preserve account-link authority and bounded cutover; use reviewed forward recovery'; END IF; END $$;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_account_link_dispatches_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_account_link_windows_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_account_link_policies_fk";
  ALTER TABLE "account_link_dispatches" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "account_link_windows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "account_link_policies" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "account_link_dispatches" CASCADE;
  DROP TABLE "account_link_windows" CASCADE;
  DROP TABLE "account_link_policies" CASCADE;
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'purge-expired-checkout-progress-drafts', 'send-legal-requirement-notifications', 'process-appointment-notifications', 'process-appointment-calendar-events', 'purge-stale-appointments', 'sync-mollie-payment', 'fulfill-order', 'prepare-domain-migration', 'prepare-domain-transfer-out', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'request-mollie-refund');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'purge-expired-checkout-progress-drafts', 'send-legal-requirement-notifications', 'process-appointment-notifications', 'process-appointment-calendar-events', 'purge-stale-appointments', 'sync-mollie-payment', 'fulfill-order', 'prepare-domain-migration', 'prepare-domain-transfer-out', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'request-mollie-refund');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "payload_locked_documents_rels_account_link_dispatches_id_idx";
  DROP INDEX "payload_locked_documents_rels_account_link_windows_id_idx";
  DROP INDEX "payload_locked_documents_rels_account_link_policies_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "account_link_dispatches_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "account_link_windows_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "account_link_policies_id";
  DROP TYPE "public"."enum_account_link_dispatches_namespace";
  DROP TYPE "public"."enum_account_link_dispatches_purpose";
  DROP TYPE "public"."enum_account_link_dispatches_lane";
  DROP TYPE "public"."enum_account_link_dispatches_state";
  DROP TYPE "public"."enum_account_link_dispatches_retry_state";
  `);
}
