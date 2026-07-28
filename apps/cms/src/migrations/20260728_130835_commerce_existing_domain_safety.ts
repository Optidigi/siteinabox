import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_migration_checkout_secrets_state" AS ENUM('pending_order', 'attached', 'consumed', 'expired');
  ALTER TYPE "public"."enum_domain_migrations_operator_work_authorization_state" ADD VALUE 'awaiting_customer_acceptance' BEFORE 'awaiting_payment';
  CREATE TABLE "migration_checkout_secrets" (
    "id" serial PRIMARY KEY NOT NULL,
    "secret_key" varchar NOT NULL,
    "generation_run_id" integer NOT NULL,
    "order_id" integer,
    "domain_name_ascii" varchar NOT NULL,
    "source_zone_hash" varchar NOT NULL,
    "encrypted_input" varchar,
    "state" "enum_migration_checkout_secrets_state" DEFAULT 'pending_order' NOT NULL,
    "expires_at" timestamp(3) with time zone NOT NULL,
    "consumed_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "migration_checkout_secrets" ADD CONSTRAINT "migration_checkout_secrets_generation_run_id_site_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."site_generation_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "migration_checkout_secrets" ADD CONSTRAINT "migration_checkout_secrets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "migration_checkout_secrets_secret_key_idx" ON "migration_checkout_secrets" USING btree ("secret_key");
  CREATE INDEX "migration_checkout_secrets_generation_run_idx" ON "migration_checkout_secrets" USING btree ("generation_run_id");
  CREATE UNIQUE INDEX "migration_checkout_secrets_order_idx" ON "migration_checkout_secrets" USING btree ("order_id");
  CREATE INDEX "migration_checkout_secrets_domain_name_ascii_idx" ON "migration_checkout_secrets" USING btree ("domain_name_ascii");
  CREATE INDEX "migration_checkout_secrets_source_zone_hash_idx" ON "migration_checkout_secrets" USING btree ("source_zone_hash");
  CREATE INDEX "migration_checkout_secrets_state_idx" ON "migration_checkout_secrets" USING btree ("state");
  CREATE INDEX "migration_checkout_secrets_expires_at_idx" ON "migration_checkout_secrets" USING btree ("expires_at");
  CREATE INDEX "migration_checkout_secrets_consumed_at_idx" ON "migration_checkout_secrets" USING btree ("consumed_at");
  CREATE INDEX "migration_checkout_secrets_created_at_idx" ON "migration_checkout_secrets" USING btree ("created_at");
  CREATE INDEX "migration_checkout_secrets_updated_at_idx" ON "migration_checkout_secrets" USING btree ("updated_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DO $migration_guard$
  BEGIN
    IF EXISTS (SELECT 1 FROM "migration_checkout_secrets") THEN
      RAISE EXCEPTION 'Rollback blocked: migration checkout secret audit rows must be retained; use forward recovery.';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM "domain_migrations"
      WHERE "operator_work_authorization_state" = 'awaiting_customer_acceptance'
    ) THEN
      RAISE EXCEPTION 'Rollback blocked: supplemental migration proposals must be resolved; use forward recovery.';
    END IF;
  END
  $migration_guard$;
   DROP TABLE "migration_checkout_secrets" CASCADE;
  ALTER TABLE "domain_migrations" ALTER COLUMN "operator_work_authorization_state" SET DATA TYPE text;
  ALTER TABLE "domain_migrations" ALTER COLUMN "operator_work_authorization_state" SET DEFAULT 'not_required'::text;
  DROP TYPE "public"."enum_domain_migrations_operator_work_authorization_state";
  CREATE TYPE "public"."enum_domain_migrations_operator_work_authorization_state" AS ENUM('not_required', 'awaiting_payment', 'paid_authorized', 'non_billable_incident_authorized', 'custom_quote_required');
  ALTER TABLE "domain_migrations" ALTER COLUMN "operator_work_authorization_state" SET DEFAULT 'not_required'::"public"."enum_domain_migrations_operator_work_authorization_state";
  ALTER TABLE "domain_migrations" ALTER COLUMN "operator_work_authorization_state" SET DATA TYPE "public"."enum_domain_migrations_operator_work_authorization_state" USING "operator_work_authorization_state"::"public"."enum_domain_migrations_operator_work_authorization_state";
  DROP TYPE "public"."enum_migration_checkout_secrets_state";`)
}
