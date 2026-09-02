import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

/**
 * Hardens the first appointment migrations for installations that may already
 * have applied them. Appointment rows contain tenant-owned visitor data, so a
 * tenant deletion must cascade the ledger and its integration outboxes rather
 * than orphaning personal data. Calendar event versions make stale provider
 * work distinguishable from the latest appointment lifecycle state.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.appointments
      DROP CONSTRAINT IF EXISTS appointments_tenant_id_tenants_id_fk;
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_tenant_id_tenants_id_fk
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE ON UPDATE NO ACTION;

    ALTER TABLE public.appointment_calendar_events
      ADD COLUMN IF NOT EXISTS event_version numeric DEFAULT 1 NOT NULL;
    CREATE INDEX IF NOT EXISTS appointment_calendar_events_event_version_idx
      ON public.appointment_calendar_events USING btree (event_version);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS public.appointment_calendar_events_event_version_idx;
    ALTER TABLE public.appointment_calendar_events
      DROP COLUMN IF EXISTS event_version;

    ALTER TABLE public.appointments
      DROP CONSTRAINT IF EXISTS appointments_tenant_id_tenants_id_fk;
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_tenant_id_tenants_id_fk
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL ON UPDATE NO ACTION;
  `)
}
