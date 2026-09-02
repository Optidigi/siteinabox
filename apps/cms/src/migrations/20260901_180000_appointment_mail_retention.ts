import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

/**
 * Completes the appointment mail boundary. Appointment mail intents must exist
 * in the persisted mail-log enum, and the metadata row must follow appointment
 * retention so visitor addresses are not retained after the booking is purged.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_mail_logs_flow"
      ADD VALUE IF NOT EXISTS 'appointments.visitor_notification';
    ALTER TYPE "public"."enum_mail_logs_flow"
      ADD VALUE IF NOT EXISTS 'appointments.tenant_notification';

    ALTER TABLE public.mail_logs
      ADD COLUMN IF NOT EXISTS appointment_id integer;

    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'mail_logs_appointment_fk'
      ) THEN
        ALTER TABLE public.mail_logs
          ADD CONSTRAINT mail_logs_appointment_fk
          FOREIGN KEY (appointment_id) REFERENCES public.appointments(id)
          ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
    END $do$;

    CREATE INDEX IF NOT EXISTS mail_logs_appointment_idx
      ON public.mail_logs USING btree (appointment_id);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.mail_logs
      DROP CONSTRAINT IF EXISTS mail_logs_appointment_fk;
    DROP INDEX IF EXISTS public.mail_logs_appointment_idx;
    ALTER TABLE public.mail_logs
      DROP COLUMN IF EXISTS appointment_id;
  `)
  // PostgreSQL enum values cannot be removed safely when a deployed instance
  // may already contain appointment mail rows. The additive values are harmless
  // to older application code and are intentionally retained on rollback.
}
