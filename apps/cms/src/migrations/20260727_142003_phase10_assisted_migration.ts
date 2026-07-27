import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_domain_migrations_operator_work_classification" AS ENUM('assisted_standard', 'complex');
  CREATE TYPE "public"."enum_domain_migrations_operator_work_cause" AS ENUM('customer_migration', 'siteinabox_incident_recovery');
  CREATE TYPE "public"."enum_domain_migrations_operator_work_authorization_state" AS ENUM('not_required', 'awaiting_payment', 'paid_authorized', 'non_billable_incident_authorized', 'custom_quote_required');
  ALTER TYPE "public"."enum_orders_order_kind" ADD VALUE 'migration_supplemental';
  ALTER TABLE "orders" ADD COLUMN "parent_order_id" integer;
  ALTER TABLE "orders" ADD COLUMN "supplemental_for_migration_id" integer;
  ALTER TABLE "domain_migrations" ADD COLUMN "supplemental_order_id" integer;
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_classification" "enum_domain_migrations_operator_work_classification";
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_cause" "enum_domain_migrations_operator_work_cause";
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_scope" varchar;
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_authorization_state" "enum_domain_migrations_operator_work_authorization_state" DEFAULT 'not_required' NOT NULL;
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_authorization_order_id" integer;
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_authorization_payment_attempt_id" integer;
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_authorized_at" timestamp(3) with time zone;
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_started_at" timestamp(3) with time zone;
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_started_by_id" integer;
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_started_by_email" varchar;
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_completed_at" timestamp(3) with time zone;
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_completed_by_id" integer;
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_completed_by_email" varchar;
  ALTER TABLE "domain_migrations" ADD COLUMN "operator_work_completion_notes" varchar;
  ALTER TABLE "domain_migrations" ADD COLUMN "automation_resumed_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_parent_order_id_orders_id_fk" FOREIGN KEY ("parent_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_supplemental_for_migration_id_domain_migrations_id_fk" FOREIGN KEY ("supplemental_for_migration_id") REFERENCES "public"."domain_migrations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domain_migrations" ADD CONSTRAINT "domain_migrations_supplemental_order_id_orders_id_fk" FOREIGN KEY ("supplemental_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domain_migrations" ADD CONSTRAINT "domain_migrations_operator_work_authorization_order_id_orders_id_fk" FOREIGN KEY ("operator_work_authorization_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domain_migrations" ADD CONSTRAINT "domain_migrations_operator_work_authorization_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("operator_work_authorization_payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domain_migrations" ADD CONSTRAINT "domain_migrations_operator_work_started_by_id_users_id_fk" FOREIGN KEY ("operator_work_started_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domain_migrations" ADD CONSTRAINT "domain_migrations_operator_work_completed_by_id_users_id_fk" FOREIGN KEY ("operator_work_completed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "orders_parent_order_idx" ON "orders" USING btree ("parent_order_id");
  CREATE UNIQUE INDEX "orders_supplemental_for_migration_idx" ON "orders" USING btree ("supplemental_for_migration_id");
  CREATE UNIQUE INDEX "domain_migrations_supplemental_order_idx" ON "domain_migrations" USING btree ("supplemental_order_id");
  CREATE INDEX "domain_migrations_operator_work_classification_idx" ON "domain_migrations" USING btree ("operator_work_classification");
  CREATE INDEX "domain_migrations_operator_work_cause_idx" ON "domain_migrations" USING btree ("operator_work_cause");
  CREATE INDEX "domain_migrations_operator_work_authorization_state_idx" ON "domain_migrations" USING btree ("operator_work_authorization_state");
  CREATE INDEX "domain_migrations_operator_work_authorization_order_idx" ON "domain_migrations" USING btree ("operator_work_authorization_order_id");
  CREATE UNIQUE INDEX "domain_migrations_operator_work_authorization_payment_at_idx" ON "domain_migrations" USING btree ("operator_work_authorization_payment_attempt_id");
  CREATE INDEX "domain_migrations_operator_work_authorized_at_idx" ON "domain_migrations" USING btree ("operator_work_authorized_at");
  CREATE INDEX "domain_migrations_operator_work_started_at_idx" ON "domain_migrations" USING btree ("operator_work_started_at");
  CREATE INDEX "domain_migrations_operator_work_started_by_idx" ON "domain_migrations" USING btree ("operator_work_started_by_id");
  CREATE INDEX "domain_migrations_operator_work_completed_at_idx" ON "domain_migrations" USING btree ("operator_work_completed_at");
  CREATE INDEX "domain_migrations_operator_work_completed_by_idx" ON "domain_migrations" USING btree ("operator_work_completed_by_id");
  CREATE INDEX "domain_migrations_automation_resumed_at_idx" ON "domain_migrations" USING btree ("automation_resumed_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DROP CONSTRAINT "orders_parent_order_id_orders_id_fk";

  ALTER TABLE "orders" DROP CONSTRAINT "orders_supplemental_for_migration_id_domain_migrations_id_fk";

  ALTER TABLE "domain_migrations" DROP CONSTRAINT "domain_migrations_supplemental_order_id_orders_id_fk";

  ALTER TABLE "domain_migrations" DROP CONSTRAINT "domain_migrations_operator_work_authorization_order_id_orders_id_fk";

  ALTER TABLE "domain_migrations" DROP CONSTRAINT "domain_migrations_operator_work_authorization_payment_attempt_id_payment_attempts_id_fk";

  ALTER TABLE "domain_migrations" DROP CONSTRAINT "domain_migrations_operator_work_started_by_id_users_id_fk";

  ALTER TABLE "domain_migrations" DROP CONSTRAINT "domain_migrations_operator_work_completed_by_id_users_id_fk";

  ALTER TABLE "orders" ALTER COLUMN "order_kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_orders_order_kind";
  CREATE TYPE "public"."enum_orders_order_kind" AS ENUM('initial_subscription', 'subscription_renewal', 'domain_renewal');
  ALTER TABLE "orders" ALTER COLUMN "order_kind" SET DATA TYPE "public"."enum_orders_order_kind" USING "order_kind"::"public"."enum_orders_order_kind";
  DROP INDEX "orders_parent_order_idx";
  DROP INDEX "orders_supplemental_for_migration_idx";
  DROP INDEX "domain_migrations_supplemental_order_idx";
  DROP INDEX "domain_migrations_operator_work_classification_idx";
  DROP INDEX "domain_migrations_operator_work_cause_idx";
  DROP INDEX "domain_migrations_operator_work_authorization_state_idx";
  DROP INDEX "domain_migrations_operator_work_authorization_order_idx";
  DROP INDEX "domain_migrations_operator_work_authorization_payment_at_idx";
  DROP INDEX "domain_migrations_operator_work_authorized_at_idx";
  DROP INDEX "domain_migrations_operator_work_started_at_idx";
  DROP INDEX "domain_migrations_operator_work_started_by_idx";
  DROP INDEX "domain_migrations_operator_work_completed_at_idx";
  DROP INDEX "domain_migrations_operator_work_completed_by_idx";
  DROP INDEX "domain_migrations_automation_resumed_at_idx";
  ALTER TABLE "orders" DROP COLUMN "parent_order_id";
  ALTER TABLE "orders" DROP COLUMN "supplemental_for_migration_id";
  ALTER TABLE "domain_migrations" DROP COLUMN "supplemental_order_id";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_classification";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_cause";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_scope";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_authorization_state";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_authorization_order_id";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_authorization_payment_attempt_id";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_authorized_at";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_started_at";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_started_by_id";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_started_by_email";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_completed_at";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_completed_by_id";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_completed_by_email";
  ALTER TABLE "domain_migrations" DROP COLUMN "operator_work_completion_notes";
  ALTER TABLE "domain_migrations" DROP COLUMN "automation_resumed_at";
  DROP TYPE "public"."enum_domain_migrations_operator_work_classification";
  DROP TYPE "public"."enum_domain_migrations_operator_work_cause";
  DROP TYPE "public"."enum_domain_migrations_operator_work_authorization_state";`)
}
