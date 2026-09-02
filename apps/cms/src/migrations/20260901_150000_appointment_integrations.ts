import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

/**
 * Adds the appointment side-effect outboxes and encrypted calendar connection
 * records. The migration is additive so an installation that already applied
 * the scheduling foundation can roll forward without rewriting history.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.appointments
      ADD COLUMN IF NOT EXISTS event_version numeric DEFAULT 1 NOT NULL,
      ADD COLUMN IF NOT EXISTS encrypted_management_token varchar;

    ALTER TABLE public.tenant_notification_subscriptions
      ADD COLUMN IF NOT EXISTS appointment_bookings boolean DEFAULT false NOT NULL;
    UPDATE public.tenant_notification_subscriptions AS subscriptions
    SET appointment_bookings = true
    FROM public.users AS users
    WHERE subscriptions.user_id = users.id
      AND users.role IN ('owner', 'editor');
    CREATE INDEX IF NOT EXISTS tenant_notification_subscriptions_appointment_bookings_idx
      ON public.tenant_notification_subscriptions USING btree (appointment_bookings);

    DO $do$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_appointment_notification_deliveries_recipient_kind') THEN
        CREATE TYPE public.enum_appointment_notification_deliveries_recipient_kind AS ENUM ('visitor', 'tenant');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_appointment_notification_deliveries_kind') THEN
        CREATE TYPE public.enum_appointment_notification_deliveries_kind AS ENUM ('confirmation', 'cancelled', 'rescheduled');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_appointment_notification_deliveries_status') THEN
        CREATE TYPE public.enum_appointment_notification_deliveries_status AS ENUM ('queued', 'processing', 'sent', 'failed', 'cancelled');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_appointment_calendar_oauth_states_provider') THEN
        CREATE TYPE public.enum_appointment_calendar_oauth_states_provider AS ENUM ('google', 'microsoft');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_appointment_calendar_connections_provider') THEN
        CREATE TYPE public.enum_appointment_calendar_connections_provider AS ENUM ('google', 'microsoft');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_appointment_calendar_connections_status') THEN
        CREATE TYPE public.enum_appointment_calendar_connections_status AS ENUM ('connected', 'reauth_required', 'revoked', 'error');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_appointment_calendar_events_status') THEN
        CREATE TYPE public.enum_appointment_calendar_events_status AS ENUM ('queued', 'processing', 'synced', 'failed', 'cancelled');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_appointment_calendar_events_operation') THEN
        CREATE TYPE public.enum_appointment_calendar_events_operation AS ENUM ('upsert', 'delete');
      END IF;
    END $do$;

    CREATE TABLE IF NOT EXISTS public.appointment_notification_deliveries (
      id serial PRIMARY KEY NOT NULL,
      notification_key varchar NOT NULL,
      appointment_id integer NOT NULL,
      tenant_id integer NOT NULL,
      recipient_email varchar,
      recipient_kind public.enum_appointment_notification_deliveries_recipient_kind NOT NULL,
      kind public.enum_appointment_notification_deliveries_kind NOT NULL,
      event_version numeric NOT NULL,
      template_version varchar NOT NULL,
      status public.enum_appointment_notification_deliveries_status DEFAULT 'queued' NOT NULL,
      attempt_count numeric DEFAULT 0 NOT NULL,
      next_attempt_at timestamp(3) with time zone NOT NULL,
      lease_until timestamp(3) with time zone,
      last_attempt_at timestamp(3) with time zone,
      sent_at timestamp(3) with time zone,
      provider varchar,
      provider_message_id varchar,
      retry_state varchar,
      last_error varchar,
      updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT appointment_notification_deliveries_notification_key_unique UNIQUE (notification_key)
    );

    CREATE TABLE IF NOT EXISTS public.appointment_calendar_oauth_states (
      id serial PRIMARY KEY NOT NULL,
      state_digest varchar NOT NULL,
      tenant_id integer NOT NULL,
      user_id integer NOT NULL,
      provider public.enum_appointment_calendar_oauth_states_provider NOT NULL,
      encrypted_code_verifier varchar NOT NULL,
      return_path varchar NOT NULL,
      expires_at timestamp(3) with time zone NOT NULL,
      used_at timestamp(3) with time zone,
      updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT appointment_calendar_oauth_states_state_digest_unique UNIQUE (state_digest)
    );

    CREATE TABLE IF NOT EXISTS public.appointment_calendar_connections (
      id serial PRIMARY KEY NOT NULL,
      connection_key varchar NOT NULL,
      tenant_id integer NOT NULL,
      provider public.enum_appointment_calendar_connections_provider NOT NULL,
      account_email varchar NOT NULL,
      calendar_id varchar NOT NULL,
      calendar_name varchar NOT NULL,
      status public.enum_appointment_calendar_connections_status DEFAULT 'connected' NOT NULL,
      encrypted_access_token varchar,
      encrypted_refresh_token varchar,
      access_token_expires_at timestamp(3) with time zone,
      scopes jsonb NOT NULL,
      connected_by_id integer NOT NULL,
      last_synced_at timestamp(3) with time zone,
      last_error varchar,
      updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT appointment_calendar_connections_connection_key_unique UNIQUE (connection_key)
    );

    CREATE TABLE IF NOT EXISTS public.appointment_calendar_events (
      id serial PRIMARY KEY NOT NULL,
      event_key varchar NOT NULL,
      appointment_id integer NOT NULL,
      connection_id integer NOT NULL,
      event_version numeric DEFAULT 1 NOT NULL,
      provider_event_id varchar,
      status public.enum_appointment_calendar_events_status DEFAULT 'queued' NOT NULL,
      operation public.enum_appointment_calendar_events_operation DEFAULT 'upsert' NOT NULL,
      attempt_count numeric DEFAULT 0 NOT NULL,
      next_attempt_at timestamp(3) with time zone NOT NULL,
      lease_until timestamp(3) with time zone,
      last_attempt_at timestamp(3) with time zone,
      synced_at timestamp(3) with time zone,
      last_error varchar,
      updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT appointment_calendar_events_event_key_unique UNIQUE (event_key)
    );

    ALTER TABLE public.appointment_notification_deliveries
      ADD COLUMN IF NOT EXISTS recipient_email varchar;

    DO $do$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_notification_deliveries_appointment_fk') THEN
        ALTER TABLE public.appointment_notification_deliveries
          ADD CONSTRAINT appointment_notification_deliveries_appointment_fk
          FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_notification_deliveries_tenant_fk') THEN
        ALTER TABLE public.appointment_notification_deliveries
          ADD CONSTRAINT appointment_notification_deliveries_tenant_fk
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_calendar_oauth_states_tenant_fk') THEN
        ALTER TABLE public.appointment_calendar_oauth_states
          ADD CONSTRAINT appointment_calendar_oauth_states_tenant_fk
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_calendar_oauth_states_user_fk') THEN
        ALTER TABLE public.appointment_calendar_oauth_states
          ADD CONSTRAINT appointment_calendar_oauth_states_user_fk
          FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_calendar_connections_tenant_fk') THEN
        ALTER TABLE public.appointment_calendar_connections
          ADD CONSTRAINT appointment_calendar_connections_tenant_fk
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_calendar_connections_connected_by_fk') THEN
        ALTER TABLE public.appointment_calendar_connections
          ADD CONSTRAINT appointment_calendar_connections_connected_by_fk
          FOREIGN KEY (connected_by_id) REFERENCES public.users(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_calendar_events_appointment_fk') THEN
        ALTER TABLE public.appointment_calendar_events
          ADD CONSTRAINT appointment_calendar_events_appointment_fk
          FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_calendar_events_connection_fk') THEN
        ALTER TABLE public.appointment_calendar_events
          ADD CONSTRAINT appointment_calendar_events_connection_fk
          FOREIGN KEY (connection_id) REFERENCES public.appointment_calendar_connections(id) ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
    END $do$;

    CREATE INDEX IF NOT EXISTS appointments_event_version_idx ON public.appointments USING btree (event_version);
    CREATE INDEX IF NOT EXISTS appointment_notification_deliveries_appointment_idx ON public.appointment_notification_deliveries USING btree (appointment_id);
    CREATE INDEX IF NOT EXISTS appointment_notification_deliveries_tenant_idx ON public.appointment_notification_deliveries USING btree (tenant_id);
    CREATE INDEX IF NOT EXISTS appointment_notification_deliveries_status_idx ON public.appointment_notification_deliveries USING btree (status);
    CREATE INDEX IF NOT EXISTS appointment_notification_deliveries_next_attempt_idx ON public.appointment_notification_deliveries USING btree (next_attempt_at);
    CREATE INDEX IF NOT EXISTS appointment_notification_deliveries_lease_idx ON public.appointment_notification_deliveries USING btree (lease_until);
    CREATE INDEX IF NOT EXISTS appointment_calendar_oauth_states_expires_idx ON public.appointment_calendar_oauth_states USING btree (expires_at);
    CREATE INDEX IF NOT EXISTS appointment_calendar_oauth_states_tenant_idx ON public.appointment_calendar_oauth_states USING btree (tenant_id);
    CREATE INDEX IF NOT EXISTS appointment_calendar_connections_tenant_idx ON public.appointment_calendar_connections USING btree (tenant_id);
    CREATE INDEX IF NOT EXISTS appointment_calendar_connections_status_idx ON public.appointment_calendar_connections USING btree (status);
    CREATE INDEX IF NOT EXISTS appointment_calendar_events_appointment_idx ON public.appointment_calendar_events USING btree (appointment_id);
    CREATE INDEX IF NOT EXISTS appointment_calendar_events_connection_idx ON public.appointment_calendar_events USING btree (connection_id);
    CREATE INDEX IF NOT EXISTS appointment_calendar_events_event_version_idx ON public.appointment_calendar_events USING btree (event_version);
    CREATE INDEX IF NOT EXISTS appointment_calendar_events_status_idx ON public.appointment_calendar_events USING btree (status);
    CREATE INDEX IF NOT EXISTS appointment_calendar_events_next_attempt_idx ON public.appointment_calendar_events USING btree (next_attempt_at);
    CREATE INDEX IF NOT EXISTS appointment_calendar_events_lease_idx ON public.appointment_calendar_events USING btree (lease_until);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS public.appointment_calendar_events_lease_idx;
    DROP INDEX IF EXISTS public.appointment_calendar_events_next_attempt_idx;
    DROP INDEX IF EXISTS public.appointment_calendar_events_status_idx;
    DROP INDEX IF EXISTS public.appointment_calendar_events_connection_idx;
    DROP INDEX IF EXISTS public.appointment_calendar_events_appointment_idx;
    DROP INDEX IF EXISTS public.appointment_calendar_events_event_version_idx;
    DROP INDEX IF EXISTS public.appointment_calendar_connections_status_idx;
    DROP INDEX IF EXISTS public.appointment_calendar_connections_tenant_idx;
    DROP INDEX IF EXISTS public.appointment_calendar_oauth_states_tenant_idx;
    DROP INDEX IF EXISTS public.appointment_calendar_oauth_states_expires_idx;
    DROP INDEX IF EXISTS public.appointment_notification_deliveries_lease_idx;
    DROP INDEX IF EXISTS public.appointment_notification_deliveries_next_attempt_idx;
    DROP INDEX IF EXISTS public.appointment_notification_deliveries_status_idx;
    DROP INDEX IF EXISTS public.appointment_notification_deliveries_tenant_idx;
    DROP INDEX IF EXISTS public.appointment_notification_deliveries_appointment_idx;
    DROP INDEX IF EXISTS public.appointments_event_version_idx;
    DROP TABLE IF EXISTS public.appointment_calendar_events CASCADE;
    DROP TABLE IF EXISTS public.appointment_calendar_connections CASCADE;
    DROP TABLE IF EXISTS public.appointment_calendar_oauth_states CASCADE;
    DROP TABLE IF EXISTS public.appointment_notification_deliveries CASCADE;
    DROP TYPE IF EXISTS public.enum_appointment_calendar_events_operation;
    DROP TYPE IF EXISTS public.enum_appointment_calendar_events_status;
    DROP TYPE IF EXISTS public.enum_appointment_calendar_connections_status;
    DROP TYPE IF EXISTS public.enum_appointment_calendar_connections_provider;
    DROP TYPE IF EXISTS public.enum_appointment_calendar_oauth_states_provider;
    DROP TYPE IF EXISTS public.enum_appointment_notification_deliveries_status;
    DROP TYPE IF EXISTS public.enum_appointment_notification_deliveries_kind;
    DROP TYPE IF EXISTS public.enum_appointment_notification_deliveries_recipient_kind;
    ALTER TABLE public.appointments
      DROP COLUMN IF EXISTS encrypted_management_token,
      DROP COLUMN IF EXISTS event_version;
    ALTER TABLE public.tenant_notification_subscriptions DROP COLUMN IF EXISTS appointment_bookings;
  `)
}
