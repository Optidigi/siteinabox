import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`ALTER TABLE "appointment_calendar_events" ADD COLUMN "provider_create_uncertain" boolean DEFAULT false;
  UPDATE "appointment_calendar_events" SET "provider_create_uncertain" = true WHERE "provider_event_id" IS NULL OR "provider_event_id" = '';
  UPDATE "appointment_notification_deliveries" SET "retry_state" = 'permanent', "last_error" = COALESCE("last_error", 'Mail delivery may have started; a verified provider receipt is required before resend.') WHERE "status" = 'processing';`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`DO $$ BEGIN IF EXISTS (SELECT 1 FROM "appointment_calendar_events" WHERE "provider_create_uncertain" = true) OR EXISTS (SELECT 1 FROM "appointment_notification_deliveries" WHERE "status" = 'processing' AND "retry_state" = 'permanent') THEN RAISE EXCEPTION 'Resolve uncertain provider writes before removing their durable evidence'; END IF; END $$;
  ALTER TABLE "appointment_calendar_events" DROP COLUMN "provider_create_uncertain";`);
}
