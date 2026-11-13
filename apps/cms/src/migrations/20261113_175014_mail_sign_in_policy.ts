import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'reconcile-microsoft-mail-sign-in' BEFORE 'request-mollie-refund';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'reconcile-microsoft-mail-sign-in' BEFORE 'request-mollie-refund';
  ALTER TABLE "microsoft_mail_services" ADD COLUMN "sign_in_policy" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'purge-expired-checkout-progress-drafts', 'send-legal-requirement-notifications', 'process-appointment-notifications', 'process-appointment-calendar-events', 'purge-stale-appointments', 'sync-mollie-payment', 'fulfill-order', 'prepare-domain-migration', 'prepare-domain-transfer-out', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'account-link-dispatch', 'purge-microsoft-mail-setup-secrets', 'reconcile-microsoft-mail', 'reconcile-microsoft-mail-renewals', 'request-mollie-refund');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'purge-expired-checkout-progress-drafts', 'send-legal-requirement-notifications', 'process-appointment-notifications', 'process-appointment-calendar-events', 'purge-stale-appointments', 'sync-mollie-payment', 'fulfill-order', 'prepare-domain-migration', 'prepare-domain-transfer-out', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'account-link-dispatch', 'purge-microsoft-mail-setup-secrets', 'reconcile-microsoft-mail', 'reconcile-microsoft-mail-renewals', 'request-mollie-refund');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  ALTER TABLE "microsoft_mail_services" DROP COLUMN "sign_in_policy";`)
}
