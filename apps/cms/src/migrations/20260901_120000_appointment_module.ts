import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

/**
 * Adds the tenant-owned appointment schedule and its booking ledger.
 *
 * The public renderer never writes to PostgreSQL directly. It resolves the
 * published tenant first and forwards a validated booking through the
 * authenticated CMS route. The exclusion constraint is the final
 * concurrency guard for confirmed appointments; the service also rechecks
 * availability inside a transaction so normal conflicts receive a useful
 * application response.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.site_settings
      ADD COLUMN IF NOT EXISTS appointments_enabled boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS appointments_timezone varchar DEFAULT 'Europe/Amsterdam' NOT NULL,
      ADD COLUMN IF NOT EXISTS appointments_duration_minutes numeric DEFAULT 30 NOT NULL,
      ADD COLUMN IF NOT EXISTS appointments_slot_interval_minutes numeric DEFAULT 30 NOT NULL,
      ADD COLUMN IF NOT EXISTS appointments_buffer_before_minutes numeric DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS appointments_buffer_after_minutes numeric DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS appointments_minimum_notice_minutes numeric DEFAULT 120 NOT NULL,
      ADD COLUMN IF NOT EXISTS appointments_minimum_cancellation_notice_minutes numeric DEFAULT 120 NOT NULL,
      ADD COLUMN IF NOT EXISTS appointments_booking_window_days numeric DEFAULT 60 NOT NULL,
      ADD COLUMN IF NOT EXISTS appointments_retention_days numeric DEFAULT 90 NOT NULL,
      ADD COLUMN IF NOT EXISTS appointments_weekly_availability jsonb DEFAULT '[]'::jsonb NOT NULL,
      ADD COLUMN IF NOT EXISTS appointments_date_overrides jsonb DEFAULT '[]'::jsonb NOT NULL;

    DO $do$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_appointments_status') THEN
        CREATE TYPE public.enum_appointments_status AS ENUM ('confirmed', 'cancelled', 'completed', 'no_show');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_appointments_source') THEN
        CREATE TYPE public.enum_appointments_source AS ENUM ('website', 'manual');
      END IF;
    END $do$;

    CREATE TABLE IF NOT EXISTS public.appointments (
      id serial PRIMARY KEY NOT NULL,
      tenant_id integer,
      status public.enum_appointments_status DEFAULT 'confirmed' NOT NULL,
      start_at timestamp(3) with time zone NOT NULL,
      end_at timestamp(3) with time zone NOT NULL,
      timezone varchar NOT NULL,
      duration_minutes numeric NOT NULL,
      visitor_name varchar NOT NULL,
      visitor_email varchar NOT NULL,
      visitor_phone varchar,
      visitor_note varchar,
      page_url varchar,
      source public.enum_appointments_source DEFAULT 'website' NOT NULL,
      management_token_digest varchar,
      management_token_expires_at timestamp(3) with time zone,
      updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT appointments_end_after_start_check CHECK (end_at > start_at)
    );

    ALTER TABLE public.payload_locked_documents_rels
      ADD COLUMN IF NOT EXISTS appointments_id integer;

    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'appointments_tenant_id_tenants_id_fk'
      ) THEN
        ALTER TABLE public.appointments
          ADD CONSTRAINT appointments_tenant_id_tenants_id_fk
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_appointments_fk'
      ) THEN
        ALTER TABLE public.payload_locked_documents_rels
          ADD CONSTRAINT payload_locked_documents_rels_appointments_fk
          FOREIGN KEY (appointments_id) REFERENCES public.appointments(id) ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
    END $do$;

    CREATE INDEX IF NOT EXISTS appointments_tenant_idx ON public.appointments USING btree (tenant_id);
    CREATE INDEX IF NOT EXISTS appointments_status_idx ON public.appointments USING btree (status);
    CREATE INDEX IF NOT EXISTS appointments_start_at_idx ON public.appointments USING btree (start_at);
    CREATE INDEX IF NOT EXISTS appointments_end_at_idx ON public.appointments USING btree (end_at);
    CREATE INDEX IF NOT EXISTS appointments_source_idx ON public.appointments USING btree (source);
    CREATE INDEX IF NOT EXISTS appointments_updated_at_idx ON public.appointments USING btree (updated_at);
    CREATE INDEX IF NOT EXISTS appointments_created_at_idx ON public.appointments USING btree (created_at);
    CREATE INDEX IF NOT EXISTS appointments_management_token_digest_idx ON public.appointments USING btree (management_token_digest);
    CREATE INDEX IF NOT EXISTS appointments_management_token_expires_at_idx ON public.appointments USING btree (management_token_expires_at);
    CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_appointments_id_idx
      ON public.payload_locked_documents_rels USING btree (appointments_id);

    CREATE EXTENSION IF NOT EXISTS btree_gist;
    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'appointments_confirmed_no_overlap'
      ) THEN
        ALTER TABLE public.appointments
          ADD CONSTRAINT appointments_confirmed_no_overlap
          EXCLUDE USING gist (
            tenant_id WITH =,
            tstzrange(start_at, end_at, '[)') WITH &&
          ) WHERE (status = 'confirmed'::public.enum_appointments_status);
      END IF;
    END $do$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.appointments
      DROP CONSTRAINT IF EXISTS appointments_confirmed_no_overlap,
      DROP CONSTRAINT IF EXISTS appointments_end_after_start_check,
      DROP CONSTRAINT IF EXISTS appointments_tenant_id_tenants_id_fk;
    ALTER TABLE public.payload_locked_documents_rels
      DROP CONSTRAINT IF EXISTS payload_locked_documents_rels_appointments_fk;

    DROP INDEX IF EXISTS public.payload_locked_documents_rels_appointments_id_idx;
    DROP INDEX IF EXISTS public.appointments_updated_at_idx;
    DROP INDEX IF EXISTS public.appointments_management_token_expires_at_idx;
    DROP INDEX IF EXISTS public.appointments_management_token_digest_idx;
    DROP INDEX IF EXISTS public.appointments_created_at_idx;
    DROP INDEX IF EXISTS public.appointments_source_idx;
    DROP INDEX IF EXISTS public.appointments_end_at_idx;
    DROP INDEX IF EXISTS public.appointments_start_at_idx;
    DROP INDEX IF EXISTS public.appointments_status_idx;
    DROP INDEX IF EXISTS public.appointments_tenant_idx;

    ALTER TABLE public.payload_locked_documents_rels
      DROP COLUMN IF EXISTS appointments_id;
    DROP TABLE IF EXISTS public.appointments CASCADE;
    DROP TYPE IF EXISTS public.enum_appointments_source;
    DROP TYPE IF EXISTS public.enum_appointments_status;

    ALTER TABLE public.site_settings
      DROP COLUMN IF EXISTS appointments_date_overrides,
      DROP COLUMN IF EXISTS appointments_weekly_availability,
      DROP COLUMN IF EXISTS appointments_retention_days,
      DROP COLUMN IF EXISTS appointments_booking_window_days,
      DROP COLUMN IF EXISTS appointments_minimum_cancellation_notice_minutes,
      DROP COLUMN IF EXISTS appointments_minimum_notice_minutes,
      DROP COLUMN IF EXISTS appointments_buffer_after_minutes,
      DROP COLUMN IF EXISTS appointments_buffer_before_minutes,
      DROP COLUMN IF EXISTS appointments_slot_interval_minutes,
      DROP COLUMN IF EXISTS appointments_duration_minutes,
      DROP COLUMN IF EXISTS appointments_timezone,
      DROP COLUMN IF EXISTS appointments_enabled;
  `)
}
