import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_appointment_notification_deliveries_retry_state" AS ENUM('none', 'retryable', 'permanent', 'manual_review');
  ALTER TYPE "public"."enum_legal_notification_deliveries_retry_state" ADD VALUE 'manual_review';
  ALTER TYPE "public"."enum_mail_logs_status" ADD VALUE 'indeterminate' BEFORE 'suppressed';
  ALTER TYPE "public"."enum_mail_logs_retry_state" ADD VALUE 'manual_review';
  ALTER TABLE "appointment_notification_deliveries" ALTER COLUMN "retry_state" SET DATA TYPE "public"."enum_appointment_notification_deliveries_retry_state" USING "retry_state"::"public"."enum_appointment_notification_deliveries_retry_state";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "legal_notification_deliveries" ALTER COLUMN "retry_state" SET DATA TYPE text;
  DROP TYPE "public"."enum_legal_notification_deliveries_retry_state";
  CREATE TYPE "public"."enum_legal_notification_deliveries_retry_state" AS ENUM('none', 'retryable', 'permanent');
  ALTER TABLE "legal_notification_deliveries" ALTER COLUMN "retry_state" SET DATA TYPE "public"."enum_legal_notification_deliveries_retry_state" USING "retry_state"::"public"."enum_legal_notification_deliveries_retry_state";
  ALTER TABLE "mail_logs" ALTER COLUMN "status" SET DATA TYPE text;
  DROP TYPE "public"."enum_mail_logs_status";
  CREATE TYPE "public"."enum_mail_logs_status" AS ENUM('sent', 'failed', 'suppressed', 'preference_blocked', 'missing_subscription');
  ALTER TABLE "mail_logs" ALTER COLUMN "status" SET DATA TYPE "public"."enum_mail_logs_status" USING "status"::"public"."enum_mail_logs_status";
  ALTER TABLE "mail_logs" ALTER COLUMN "retry_state" SET DATA TYPE text;
  ALTER TABLE "mail_logs" ALTER COLUMN "retry_state" SET DEFAULT 'none'::text;
  DROP TYPE "public"."enum_mail_logs_retry_state";
  CREATE TYPE "public"."enum_mail_logs_retry_state" AS ENUM('none', 'retryable', 'permanent');
  ALTER TABLE "mail_logs" ALTER COLUMN "retry_state" SET DEFAULT 'none'::"public"."enum_mail_logs_retry_state";
  ALTER TABLE "mail_logs" ALTER COLUMN "retry_state" SET DATA TYPE "public"."enum_mail_logs_retry_state" USING "retry_state"::"public"."enum_mail_logs_retry_state";
  ALTER TABLE "appointment_notification_deliveries" ALTER COLUMN "retry_state" SET DATA TYPE varchar;
  DROP TYPE "public"."enum_appointment_notification_deliveries_retry_state";`)
}
