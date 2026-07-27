import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'prepare-domain-transfer-out' BEFORE 'renew-domain';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'prepare-domain-transfer-out' BEFORE 'renew-domain';
  ALTER TABLE "managed_domains" ADD COLUMN "transfer_out_customer_confirmed_at" timestamp(3) with time zone;
  CREATE INDEX "managed_domains_transfer_out_customer_confirmed_at_idx" ON "managed_domains" USING btree ("transfer_out_customer_confirmed_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'send-legal-requirement-notifications', 'sync-mollie-payment', 'fulfill-order', 'prepare-domain-migration', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'request-mollie-refund');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'send-legal-requirement-notifications', 'sync-mollie-payment', 'fulfill-order', 'prepare-domain-migration', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'request-mollie-refund');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "managed_domains_transfer_out_customer_confirmed_at_idx";
  ALTER TABLE "managed_domains" DROP COLUMN "transfer_out_customer_confirmed_at";`)
}
