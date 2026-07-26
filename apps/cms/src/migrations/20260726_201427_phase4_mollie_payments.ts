import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_payment_attempts_sequence_type" AS ENUM('first', 'recurring', 'oneoff');
  CREATE TYPE "public"."enum_accounting_documents_document_type" AS ENUM('invoice', 'credit_note');
  CREATE TYPE "public"."enum_accounting_documents_state" AS ENUM('pending_provider', 'issued', 'failed');
  CREATE TYPE "public"."enum_accounting_documents_reason" AS ENUM('payment_collected', 'refund', 'chargeback');
  CREATE TYPE "public"."enum_accounting_documents_refund_scenario" AS ENUM('payment_not_collected', 'failed_payment_customer_domain_exists', 'duplicate_payment', 'unfulfillable_before_provider_commit', 'siteinabox_failure_after_provider_commit', 'customer_cancellation_before_provider_commit', 'customer_cancellation_after_provider_commit', 'incident_recovery_migration_fee_charged', 'automatic_migration_scope_increase', 'complex_migration');
  ALTER TYPE "public"."enum_orders_payment_status" ADD VALUE 'partially_refunded';
  ALTER TYPE "public"."enum_orders_payment_status" ADD VALUE 'refunded';
  ALTER TYPE "public"."enum_orders_payment_status" ADD VALUE 'chargeback';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'sync-mollie-payment';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'fulfill-order';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'reconcile-commerce';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'request-mollie-refund';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'sync-mollie-payment';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'fulfill-order';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'reconcile-commerce';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'request-mollie-refund';
  CREATE TABLE "accounting_documents" (
    "id" serial PRIMARY KEY NOT NULL,
    "evidence_key" varchar NOT NULL,
    "document_number" varchar NOT NULL,
    "document_type" "enum_accounting_documents_document_type" NOT NULL,
    "state" "enum_accounting_documents_state" NOT NULL,
    "order_id" integer NOT NULL,
    "payment_attempt_id" integer NOT NULL,
    "tenant_id" integer,
    "reverses_document_id" integer,
    "reason" "enum_accounting_documents_reason" NOT NULL,
    "refund_scenario" "enum_accounting_documents_refund_scenario",
    "provider_operation_id" varchar,
    "provider_status" varchar,
    "currency" varchar DEFAULT 'EUR' NOT NULL,
    "net_amount_minor" numeric NOT NULL,
    "vat_amount_minor" numeric NOT NULL,
    "gross_amount_minor" numeric NOT NULL,
    "line_items" jsonb NOT NULL,
    "customer_snapshot" jsonb NOT NULL,
    "issued_at" timestamp(3) with time zone,
    "failed_at" timestamp(3) with time zone,
    "failure_message" varchar,
    "reconciliation_required" boolean DEFAULT false NOT NULL,
    "last_synced_at" timestamp(3) with time zone,
    "state_history" jsonb,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  DROP INDEX "billing_agreements_provider_customer_id_idx";
  ALTER TABLE "payment_attempts" ADD COLUMN "billing_agreement_id" integer;
  ALTER TABLE "payment_attempts" ADD COLUMN "sequence_type" "enum_payment_attempts_sequence_type";
  ALTER TABLE "payment_attempts" ADD COLUMN "checkout_url" varchar;
  ALTER TABLE "payment_attempts" ADD COLUMN "provider_refund_ids" jsonb;
  ALTER TABLE "payment_attempts" ADD COLUMN "chargeback_amount_minor" numeric;
  ALTER TABLE "payment_attempts" ADD COLUMN "chargeback_at" timestamp(3) with time zone;
  ALTER TABLE "payment_attempts" ADD COLUMN "provider_chargeback_ids" jsonb;
  ALTER TABLE "payload_jobs" ADD COLUMN "concurrency_key" varchar;
  ALTER TABLE "accounting_documents" ADD CONSTRAINT "accounting_documents_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "accounting_documents" ADD CONSTRAINT "accounting_documents_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "accounting_documents" ADD CONSTRAINT "accounting_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "accounting_documents" ADD CONSTRAINT "accounting_documents_reverses_document_id_accounting_documents_id_fk" FOREIGN KEY ("reverses_document_id") REFERENCES "public"."accounting_documents"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "accounting_documents_evidence_key_idx" ON "accounting_documents" USING btree ("evidence_key");
  CREATE UNIQUE INDEX "accounting_documents_document_number_idx" ON "accounting_documents" USING btree ("document_number");
  CREATE INDEX "accounting_documents_document_type_idx" ON "accounting_documents" USING btree ("document_type");
  CREATE INDEX "accounting_documents_state_idx" ON "accounting_documents" USING btree ("state");
  CREATE INDEX "accounting_documents_order_idx" ON "accounting_documents" USING btree ("order_id");
  CREATE INDEX "accounting_documents_payment_attempt_idx" ON "accounting_documents" USING btree ("payment_attempt_id");
  CREATE INDEX "accounting_documents_tenant_idx" ON "accounting_documents" USING btree ("tenant_id");
  CREATE INDEX "accounting_documents_reverses_document_idx" ON "accounting_documents" USING btree ("reverses_document_id");
  CREATE INDEX "accounting_documents_reason_idx" ON "accounting_documents" USING btree ("reason");
  CREATE INDEX "accounting_documents_refund_scenario_idx" ON "accounting_documents" USING btree ("refund_scenario");
  CREATE UNIQUE INDEX "accounting_documents_provider_operation_id_idx" ON "accounting_documents" USING btree ("provider_operation_id");
  CREATE INDEX "accounting_documents_provider_status_idx" ON "accounting_documents" USING btree ("provider_status");
  CREATE INDEX "accounting_documents_issued_at_idx" ON "accounting_documents" USING btree ("issued_at");
  CREATE INDEX "accounting_documents_reconciliation_required_idx" ON "accounting_documents" USING btree ("reconciliation_required");
  CREATE INDEX "accounting_documents_last_synced_at_idx" ON "accounting_documents" USING btree ("last_synced_at");
  CREATE INDEX "accounting_documents_created_at_idx" ON "accounting_documents" USING btree ("created_at");
  CREATE INDEX "accounting_documents_updated_at_idx" ON "accounting_documents" USING btree ("updated_at");
  ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_billing_agreement_id_billing_agreements_id_fk" FOREIGN KEY ("billing_agreement_id") REFERENCES "public"."billing_agreements"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "payment_attempts_billing_agreement_idx" ON "payment_attempts" USING btree ("billing_agreement_id");
  CREATE INDEX "payment_attempts_sequence_type_idx" ON "payment_attempts" USING btree ("sequence_type");
  CREATE INDEX "payload_jobs_concurrency_key_idx" ON "payload_jobs" USING btree ("concurrency_key");
  CREATE UNIQUE INDEX "billing_agreements_provider_customer_id_idx" ON "billing_agreements" USING btree ("provider_customer_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "accounting_documents" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "accounting_documents" CASCADE;
  ALTER TABLE "payment_attempts" DROP CONSTRAINT "payment_attempts_billing_agreement_id_billing_agreements_id_fk";

  ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DATA TYPE text;
  ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum_orders_payment_status";
  CREATE TYPE "public"."enum_orders_payment_status" AS ENUM('pending', 'open', 'paid', 'failed', 'cancelled', 'expired');
  ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DEFAULT 'pending'::"public"."enum_orders_payment_status";
  ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DATA TYPE "public"."enum_orders_payment_status" USING "payment_status"::"public"."enum_orders_payment_status";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'send-legal-requirement-notifications');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'send-legal-requirement-notifications');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "payment_attempts_billing_agreement_idx";
  DROP INDEX "payment_attempts_sequence_type_idx";
  DROP INDEX "payload_jobs_concurrency_key_idx";
  DROP INDEX "billing_agreements_provider_customer_id_idx";
  CREATE INDEX "billing_agreements_provider_customer_id_idx" ON "billing_agreements" USING btree ("provider_customer_id");
  ALTER TABLE "payment_attempts" DROP COLUMN "billing_agreement_id";
  ALTER TABLE "payment_attempts" DROP COLUMN "sequence_type";
  ALTER TABLE "payment_attempts" DROP COLUMN "checkout_url";
  ALTER TABLE "payment_attempts" DROP COLUMN "provider_refund_ids";
  ALTER TABLE "payment_attempts" DROP COLUMN "chargeback_amount_minor";
  ALTER TABLE "payment_attempts" DROP COLUMN "chargeback_at";
  ALTER TABLE "payment_attempts" DROP COLUMN "provider_chargeback_ids";
  ALTER TABLE "payload_jobs" DROP COLUMN "concurrency_key";
  DROP TYPE "public"."enum_payment_attempts_sequence_type";
  DROP TYPE "public"."enum_accounting_documents_document_type";
  DROP TYPE "public"."enum_accounting_documents_state";
  DROP TYPE "public"."enum_accounting_documents_reason";
  DROP TYPE "public"."enum_accounting_documents_refund_scenario";`)
}
