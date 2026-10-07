import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`CREATE TYPE "public"."enum_commerce_notification_deliveries_retry_state" AS ENUM('none', 'retryable', 'permanent');
  ALTER TABLE "commerce_notification_deliveries" ADD COLUMN "retry_state" "enum_commerce_notification_deliveries_retry_state" DEFAULT 'none';
  UPDATE "commerce_notification_deliveries" SET "retry_state" = 'permanent', "last_error" = COALESCE("last_error", 'Mail delivery may have started; a verified provider receipt is required before resend.') WHERE "status" = 'processing';
  UPDATE "legal_notification_deliveries" SET "retry_state" = 'permanent', "last_error" = COALESCE("last_error", 'Mail delivery may have started; a verified provider receipt is required before resend.') WHERE "status" = 'processing';`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`DO $$ BEGIN IF EXISTS (SELECT 1 FROM "commerce_notification_deliveries" WHERE "retry_state" = 'permanent') OR EXISTS (SELECT 1 FROM "legal_notification_deliveries" WHERE "retry_state" = 'permanent') THEN RAISE EXCEPTION 'Resolve uncertain mail writes before removing their durable evidence'; END IF; END $$;
  ALTER TABLE "commerce_notification_deliveries" DROP COLUMN "retry_state";
  DROP TYPE "public"."enum_commerce_notification_deliveries_retry_state";`);
}
