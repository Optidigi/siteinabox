import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_legal_notification_deliveries_kind" AS ENUM('initial', 'reminder', 'enforcement');
  CREATE TYPE "public"."enum_legal_notification_deliveries_status" AS ENUM('queued', 'processing', 'sent', 'failed', 'cancelled');
  CREATE TYPE "public"."enum_legal_notification_deliveries_retry_state" AS ENUM('none', 'retryable', 'permanent');
  ALTER TYPE "public"."enum_mail_logs_flow" ADD VALUE 'legal.reacceptance';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'send-legal-requirement-notifications';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'send-legal-requirement-notifications';
  CREATE TABLE "legal_notification_deliveries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"notification_key" varchar NOT NULL,
  	"requirement_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"recipient" varchar NOT NULL,
  	"kind" "enum_legal_notification_deliveries_kind" NOT NULL,
  	"template_version" varchar NOT NULL,
  	"status" "enum_legal_notification_deliveries_status" DEFAULT 'queued' NOT NULL,
  	"attempt_count" numeric DEFAULT 0 NOT NULL,
  	"next_attempt_at" timestamp(3) with time zone NOT NULL,
  	"lease_until" timestamp(3) with time zone,
  	"last_attempt_at" timestamp(3) with time zone,
  	"sent_at" timestamp(3) with time zone,
  	"provider" varchar,
  	"provider_message_id" varchar,
  	"retry_state" "enum_legal_notification_deliveries_retry_state",
  	"last_error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "legal_notification_deliveries_id" integer;
  ALTER TABLE "legal_notification_deliveries" ADD CONSTRAINT "legal_notification_deliveries_requirement_id_legal_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."legal_requirements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_notification_deliveries" ADD CONSTRAINT "legal_notification_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "legal_notification_deliveries_notification_key_idx" ON "legal_notification_deliveries" USING btree ("notification_key");
  CREATE INDEX "legal_notification_deliveries_requirement_idx" ON "legal_notification_deliveries" USING btree ("requirement_id");
  CREATE INDEX "legal_notification_deliveries_tenant_idx" ON "legal_notification_deliveries" USING btree ("tenant_id");
  CREATE INDEX "legal_notification_deliveries_recipient_idx" ON "legal_notification_deliveries" USING btree ("recipient");
  CREATE INDEX "legal_notification_deliveries_kind_idx" ON "legal_notification_deliveries" USING btree ("kind");
  CREATE INDEX "legal_notification_deliveries_status_idx" ON "legal_notification_deliveries" USING btree ("status");
  CREATE INDEX "legal_notification_deliveries_next_attempt_at_idx" ON "legal_notification_deliveries" USING btree ("next_attempt_at");
  CREATE INDEX "legal_notification_deliveries_lease_until_idx" ON "legal_notification_deliveries" USING btree ("lease_until");
  CREATE INDEX "legal_notification_deliveries_sent_at_idx" ON "legal_notification_deliveries" USING btree ("sent_at");
  CREATE INDEX "legal_notification_deliveries_updated_at_idx" ON "legal_notification_deliveries" USING btree ("updated_at");
  CREATE INDEX "legal_notification_deliveries_created_at_idx" ON "legal_notification_deliveries" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_notification_deliveri_fk" FOREIGN KEY ("legal_notification_deliveries_id") REFERENCES "public"."legal_notification_deliveries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_legal_notification_deliver_idx" ON "payload_locked_documents_rels" USING btree ("legal_notification_deliveries_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_legal_notification_deliveri_fk";
  ALTER TABLE "legal_notification_deliveries" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "legal_notification_deliveries" CASCADE;
  DELETE FROM "mail_logs" WHERE "flow" = 'legal.reacceptance';
  DELETE FROM "payload_jobs_log" WHERE "task_slug" = 'send-legal-requirement-notifications';
  DELETE FROM "payload_jobs" WHERE "task_slug" = 'send-legal-requirement-notifications';
  
  ALTER TABLE "mail_logs" ALTER COLUMN "flow" SET DATA TYPE text;
  DROP TYPE "public"."enum_mail_logs_flow";
  CREATE TYPE "public"."enum_mail_logs_flow" AS ENUM('platform.operational', 'auth.magic_link', 'auth.password_reset', 'preview.magic_link', 'preview.site_ready', 'privacy.data_export', 'intake.internal_notification', 'forms.tenant_notification', 'site.live_notice');
  ALTER TABLE "mail_logs" ALTER COLUMN "flow" SET DATA TYPE "public"."enum_mail_logs_flow" USING "flow"::"public"."enum_mail_logs_flow";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'purge-stale-form-submissions');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'purge-stale-form-submissions');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "payload_locked_documents_rels_legal_notification_deliver_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "legal_notification_deliveries_id";
  DROP TYPE "public"."enum_legal_notification_deliveries_kind";
  DROP TYPE "public"."enum_legal_notification_deliveries_status";
  DROP TYPE "public"."enum_legal_notification_deliveries_retry_state";`)
}
