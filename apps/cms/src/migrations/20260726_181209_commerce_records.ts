import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_state" AS ENUM('draft', 'accepted', 'fulfillment_pending', 'fulfilled', 'exception', 'cancelled');
  CREATE TYPE "public"."enum_checkout_profiles_party_type" AS ENUM('registered_business', 'business_in_formation');
  CREATE TYPE "public"."enum_checkout_profiles_contracting_party_kind" AS ENUM('natural_person');
  CREATE TYPE "public"."enum_checkout_profiles_domain_registrant_source" AS ENUM('contracting_party');
  CREATE TYPE "public"."enum_payment_attempts_state" AS ENUM('created', 'pending_provider', 'authorized', 'paid', 'failed', 'cancelled', 'expired', 'refund_pending', 'partially_refunded', 'refunded', 'refund_failed', 'chargeback');
  CREATE TYPE "public"."enum_payment_attempts_purpose" AS ENUM('first_payment', 'recurring', 'domain_renewal', 'supplemental');
  CREATE TYPE "public"."enum_payment_attempts_provider" AS ENUM('mollie', 'manual');
  CREATE TYPE "public"."enum_billing_agreements_state" AS ENUM('pending_first_payment', 'mandate_pending', 'active', 'past_due', 'cancellation_scheduled', 'cancelled');
  CREATE TYPE "public"."enum_billing_agreements_provider" AS ENUM('mollie');
  CREATE TYPE "public"."enum_billing_agreements_billing_period" AS ENUM('monthly', 'annual');
  CREATE TYPE "public"."enum_managed_domains_state" AS ENUM('pending', 'registration_pending', 'transfer_pending', 'active', 'renewal_pending', 'provider_hold', 'expired', 'manual_review');
  CREATE TYPE "public"."enum_managed_domains_initial_operation" AS ENUM('registration', 'transfer');
  CREATE TYPE "public"."enum_managed_domains_registrant_ownership" AS ENUM('customer');
  CREATE TYPE "public"."enum_managed_domains_provider" AS ENUM('openprovider', 'manual');
  CREATE TYPE "public"."enum_domain_renewal_cycles_state" AS ENUM('scheduled', 'payment_required', 'payment_committed', 'provider_requested', 'renewed', 'cancelled', 'failed', 'manual_review');
  CREATE TABLE "checkout_profiles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"profile_key" varchar NOT NULL,
  	"profile_version" numeric NOT NULL,
  	"generation_run_id" integer NOT NULL,
  	"tenant_id" integer,
  	"customer_name" varchar NOT NULL,
  	"customer_email" varchar NOT NULL,
  	"customer_phone" varchar,
  	"party_type" "enum_checkout_profiles_party_type" NOT NULL,
  	"contracting_party_name" varchar NOT NULL,
  	"kvk_number" varchar,
  	"contracting_party_kind" "enum_checkout_profiles_contracting_party_kind",
  	"domain_registrant_source" "enum_checkout_profiles_domain_registrant_source" DEFAULT 'contracting_party' NOT NULL,
  	"intended_company_name" varchar,
  	"billing_address" jsonb NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payment_attempts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"order_id" integer NOT NULL,
  	"tenant_id" integer,
  	"state" "enum_payment_attempts_state" DEFAULT 'created' NOT NULL,
  	"purpose" "enum_payment_attempts_purpose" NOT NULL,
  	"provider" "enum_payment_attempts_provider" DEFAULT 'mollie' NOT NULL,
  	"provider_payment_id" varchar,
  	"provider_status" varchar,
  	"currency" varchar DEFAULT 'EUR' NOT NULL,
  	"net_amount_minor" numeric NOT NULL,
  	"vat_amount_minor" numeric NOT NULL,
  	"gross_amount_minor" numeric NOT NULL,
  	"reconciliation_required" boolean DEFAULT false NOT NULL,
  	"last_synced_at" timestamp(3) with time zone,
  	"authorized_at" timestamp(3) with time zone,
  	"paid_at" timestamp(3) with time zone,
  	"failed_at" timestamp(3) with time zone,
  	"cancelled_at" timestamp(3) with time zone,
  	"expired_at" timestamp(3) with time zone,
  	"refund_pending_at" timestamp(3) with time zone,
  	"refunded_amount_minor" numeric,
  	"refunded_at" timestamp(3) with time zone,
  	"failure_code" varchar,
  	"failure_message" varchar,
  	"state_history" jsonb,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "billing_agreements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"originating_order_id" integer NOT NULL,
  	"checkout_profile_id" integer NOT NULL,
  	"tenant_id" integer,
  	"state" "enum_billing_agreements_state" DEFAULT 'pending_first_payment' NOT NULL,
  	"provider" "enum_billing_agreements_provider" DEFAULT 'mollie' NOT NULL,
  	"provider_customer_id" varchar,
  	"provider_mandate_id" varchar,
  	"catalog_version" varchar NOT NULL,
  	"package_code" varchar NOT NULL,
  	"billing_period" "enum_billing_agreements_billing_period" NOT NULL,
  	"currency" varchar DEFAULT 'EUR' NOT NULL,
  	"recurring_net_amount_minor" numeric NOT NULL,
  	"renewal_intent" boolean DEFAULT true NOT NULL,
  	"next_charge_at" timestamp(3) with time zone,
  	"cancel_at" timestamp(3) with time zone,
  	"cancelled_at" timestamp(3) with time zone,
  	"ended_at" timestamp(3) with time zone,
  	"reconciliation_required" boolean DEFAULT false NOT NULL,
  	"last_synced_at" timestamp(3) with time zone,
  	"failure_reason" varchar,
  	"state_history" jsonb,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "managed_domains" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"domain_name_ascii" varchar NOT NULL,
  	"tld" varchar NOT NULL,
  	"provisioning_idempotency_key" varchar NOT NULL,
  	"originating_order_id" integer NOT NULL,
  	"registrant_profile_id" integer NOT NULL,
  	"tenant_id" integer,
  	"state" "enum_managed_domains_state" DEFAULT 'pending' NOT NULL,
  	"initial_operation" "enum_managed_domains_initial_operation" NOT NULL,
  	"registrant_ownership" "enum_managed_domains_registrant_ownership" DEFAULT 'customer' NOT NULL,
  	"provider" "enum_managed_domains_provider" DEFAULT 'openprovider' NOT NULL,
  	"provider_domain_id" varchar,
  	"renewal_intent" boolean DEFAULT true NOT NULL,
  	"registered_at" timestamp(3) with time zone,
  	"transferred_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"provider_safe_renewal_cutoff_at" timestamp(3) with time zone,
  	"reconciliation_required" boolean DEFAULT false NOT NULL,
  	"last_synced_at" timestamp(3) with time zone,
  	"failure_reason" varchar,
  	"state_history" jsonb,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "domain_renewal_cycles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"managed_domain_id" integer NOT NULL,
  	"billing_agreement_id" integer,
  	"order_id" integer,
  	"payment_attempt_id" integer,
  	"tenant_id" integer,
  	"state" "enum_domain_renewal_cycles_state" DEFAULT 'scheduled' NOT NULL,
  	"coverage_starts_at" timestamp(3) with time zone NOT NULL,
  	"coverage_ends_at" timestamp(3) with time zone NOT NULL,
  	"provider_safe_cutoff_at" timestamp(3) with time zone NOT NULL,
  	"renewal_intent_snapshot" boolean DEFAULT true NOT NULL,
  	"currency" varchar DEFAULT 'EUR' NOT NULL,
  	"net_amount_minor" numeric,
  	"vat_amount_minor" numeric,
  	"gross_amount_minor" numeric,
  	"provider_operation_id" varchar,
  	"provider_status" varchar,
  	"payment_secured_at" timestamp(3) with time zone,
  	"provider_committed_at" timestamp(3) with time zone,
  	"renewed_at" timestamp(3) with time zone,
  	"cancelled_at" timestamp(3) with time zone,
  	"failed_at" timestamp(3) with time zone,
  	"failure_reason" varchar,
  	"reconciliation_required" boolean DEFAULT false NOT NULL,
  	"last_synced_at" timestamp(3) with time zone,
  	"state_history" jsonb,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "orders" ADD COLUMN "state" "enum_orders_state";
  ALTER TABLE "orders" ADD COLUMN "checkout_profile_key" varchar;
  ALTER TABLE "orders" ADD COLUMN "catalog_version" varchar;
  ALTER TABLE "orders" ADD COLUMN "quote_evidence" jsonb;
  ALTER TABLE "orders" ADD COLUMN "net_line_items" jsonb;
  ALTER TABLE "orders" ADD COLUMN "vat_rate_basis_points" numeric;
  ALTER TABLE "orders" ADD COLUMN "subtotal_net_minor" numeric;
  ALTER TABLE "orders" ADD COLUMN "vat_amount_minor" numeric;
  ALTER TABLE "orders" ADD COLUMN "total_gross_minor" numeric;
  ALTER TABLE "orders" ADD COLUMN "contracting_party_profile_version" numeric;
  ALTER TABLE "orders" ADD COLUMN "terms_version" varchar;
  ALTER TABLE "orders" ADD COLUMN "privacy_version" varchar;
  ALTER TABLE "orders" ADD COLUMN "business_use_declaration_version" varchar;
  ALTER TABLE "orders" ADD COLUMN "accepted_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "acceptance_ip_address" varchar;
  ALTER TABLE "orders" ADD COLUMN "acceptance_user_agent" varchar;
  ALTER TABLE "checkout_profiles" ADD CONSTRAINT "checkout_profiles_generation_run_id_site_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."site_generation_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkout_profiles" ADD CONSTRAINT "checkout_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_agreements" ADD CONSTRAINT "billing_agreements_originating_order_id_orders_id_fk" FOREIGN KEY ("originating_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_agreements" ADD CONSTRAINT "billing_agreements_checkout_profile_id_checkout_profiles_id_fk" FOREIGN KEY ("checkout_profile_id") REFERENCES "public"."checkout_profiles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_agreements" ADD CONSTRAINT "billing_agreements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "managed_domains" ADD CONSTRAINT "managed_domains_originating_order_id_orders_id_fk" FOREIGN KEY ("originating_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "managed_domains" ADD CONSTRAINT "managed_domains_registrant_profile_id_checkout_profiles_id_fk" FOREIGN KEY ("registrant_profile_id") REFERENCES "public"."checkout_profiles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "managed_domains" ADD CONSTRAINT "managed_domains_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domain_renewal_cycles" ADD CONSTRAINT "domain_renewal_cycles_managed_domain_id_managed_domains_id_fk" FOREIGN KEY ("managed_domain_id") REFERENCES "public"."managed_domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domain_renewal_cycles" ADD CONSTRAINT "domain_renewal_cycles_billing_agreement_id_billing_agreements_id_fk" FOREIGN KEY ("billing_agreement_id") REFERENCES "public"."billing_agreements"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domain_renewal_cycles" ADD CONSTRAINT "domain_renewal_cycles_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domain_renewal_cycles" ADD CONSTRAINT "domain_renewal_cycles_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domain_renewal_cycles" ADD CONSTRAINT "domain_renewal_cycles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "checkout_profiles_profile_key_idx" ON "checkout_profiles" USING btree ("profile_key");
  CREATE INDEX "checkout_profiles_profile_version_idx" ON "checkout_profiles" USING btree ("profile_version");
  CREATE INDEX "checkout_profiles_generation_run_idx" ON "checkout_profiles" USING btree ("generation_run_id");
  CREATE INDEX "checkout_profiles_tenant_idx" ON "checkout_profiles" USING btree ("tenant_id");
  CREATE INDEX "checkout_profiles_customer_email_idx" ON "checkout_profiles" USING btree ("customer_email");
  CREATE INDEX "checkout_profiles_party_type_idx" ON "checkout_profiles" USING btree ("party_type");
  CREATE INDEX "checkout_profiles_kvk_number_idx" ON "checkout_profiles" USING btree ("kvk_number");
  CREATE INDEX "checkout_profiles_created_at_idx" ON "checkout_profiles" USING btree ("created_at");
  CREATE INDEX "checkout_profiles_updated_at_idx" ON "checkout_profiles" USING btree ("updated_at");
  CREATE UNIQUE INDEX "generationRun_profileVersion_idx" ON "checkout_profiles" USING btree ("generation_run_id","profile_version");
  CREATE UNIQUE INDEX "payment_attempts_idempotency_key_idx" ON "payment_attempts" USING btree ("idempotency_key");
  CREATE INDEX "payment_attempts_order_idx" ON "payment_attempts" USING btree ("order_id");
  CREATE INDEX "payment_attempts_tenant_idx" ON "payment_attempts" USING btree ("tenant_id");
  CREATE INDEX "payment_attempts_state_idx" ON "payment_attempts" USING btree ("state");
  CREATE INDEX "payment_attempts_purpose_idx" ON "payment_attempts" USING btree ("purpose");
  CREATE INDEX "payment_attempts_provider_idx" ON "payment_attempts" USING btree ("provider");
  CREATE UNIQUE INDEX "payment_attempts_provider_payment_id_idx" ON "payment_attempts" USING btree ("provider_payment_id");
  CREATE INDEX "payment_attempts_provider_status_idx" ON "payment_attempts" USING btree ("provider_status");
  CREATE INDEX "payment_attempts_reconciliation_required_idx" ON "payment_attempts" USING btree ("reconciliation_required");
  CREATE INDEX "payment_attempts_last_synced_at_idx" ON "payment_attempts" USING btree ("last_synced_at");
  CREATE INDEX "payment_attempts_paid_at_idx" ON "payment_attempts" USING btree ("paid_at");
  CREATE INDEX "payment_attempts_created_at_idx" ON "payment_attempts" USING btree ("created_at");
  CREATE INDEX "payment_attempts_updated_at_idx" ON "payment_attempts" USING btree ("updated_at");
  CREATE UNIQUE INDEX "billing_agreements_idempotency_key_idx" ON "billing_agreements" USING btree ("idempotency_key");
  CREATE INDEX "billing_agreements_originating_order_idx" ON "billing_agreements" USING btree ("originating_order_id");
  CREATE INDEX "billing_agreements_checkout_profile_idx" ON "billing_agreements" USING btree ("checkout_profile_id");
  CREATE INDEX "billing_agreements_tenant_idx" ON "billing_agreements" USING btree ("tenant_id");
  CREATE INDEX "billing_agreements_state_idx" ON "billing_agreements" USING btree ("state");
  CREATE INDEX "billing_agreements_provider_customer_id_idx" ON "billing_agreements" USING btree ("provider_customer_id");
  CREATE UNIQUE INDEX "billing_agreements_provider_mandate_id_idx" ON "billing_agreements" USING btree ("provider_mandate_id");
  CREATE INDEX "billing_agreements_catalog_version_idx" ON "billing_agreements" USING btree ("catalog_version");
  CREATE INDEX "billing_agreements_billing_period_idx" ON "billing_agreements" USING btree ("billing_period");
  CREATE INDEX "billing_agreements_renewal_intent_idx" ON "billing_agreements" USING btree ("renewal_intent");
  CREATE INDEX "billing_agreements_next_charge_at_idx" ON "billing_agreements" USING btree ("next_charge_at");
  CREATE INDEX "billing_agreements_cancel_at_idx" ON "billing_agreements" USING btree ("cancel_at");
  CREATE INDEX "billing_agreements_reconciliation_required_idx" ON "billing_agreements" USING btree ("reconciliation_required");
  CREATE INDEX "billing_agreements_created_at_idx" ON "billing_agreements" USING btree ("created_at");
  CREATE INDEX "billing_agreements_updated_at_idx" ON "billing_agreements" USING btree ("updated_at");
  CREATE UNIQUE INDEX "managed_domains_domain_name_ascii_idx" ON "managed_domains" USING btree ("domain_name_ascii");
  CREATE INDEX "managed_domains_tld_idx" ON "managed_domains" USING btree ("tld");
  CREATE UNIQUE INDEX "managed_domains_provisioning_idempotency_key_idx" ON "managed_domains" USING btree ("provisioning_idempotency_key");
  CREATE INDEX "managed_domains_originating_order_idx" ON "managed_domains" USING btree ("originating_order_id");
  CREATE INDEX "managed_domains_registrant_profile_idx" ON "managed_domains" USING btree ("registrant_profile_id");
  CREATE INDEX "managed_domains_tenant_idx" ON "managed_domains" USING btree ("tenant_id");
  CREATE INDEX "managed_domains_state_idx" ON "managed_domains" USING btree ("state");
  CREATE INDEX "managed_domains_initial_operation_idx" ON "managed_domains" USING btree ("initial_operation");
  CREATE INDEX "managed_domains_provider_idx" ON "managed_domains" USING btree ("provider");
  CREATE UNIQUE INDEX "managed_domains_provider_domain_id_idx" ON "managed_domains" USING btree ("provider_domain_id");
  CREATE INDEX "managed_domains_renewal_intent_idx" ON "managed_domains" USING btree ("renewal_intent");
  CREATE INDEX "managed_domains_expires_at_idx" ON "managed_domains" USING btree ("expires_at");
  CREATE INDEX "managed_domains_provider_safe_renewal_cutoff_at_idx" ON "managed_domains" USING btree ("provider_safe_renewal_cutoff_at");
  CREATE INDEX "managed_domains_reconciliation_required_idx" ON "managed_domains" USING btree ("reconciliation_required");
  CREATE INDEX "managed_domains_created_at_idx" ON "managed_domains" USING btree ("created_at");
  CREATE INDEX "managed_domains_updated_at_idx" ON "managed_domains" USING btree ("updated_at");
  CREATE UNIQUE INDEX "domain_renewal_cycles_idempotency_key_idx" ON "domain_renewal_cycles" USING btree ("idempotency_key");
  CREATE INDEX "domain_renewal_cycles_managed_domain_idx" ON "domain_renewal_cycles" USING btree ("managed_domain_id");
  CREATE INDEX "domain_renewal_cycles_billing_agreement_idx" ON "domain_renewal_cycles" USING btree ("billing_agreement_id");
  CREATE INDEX "domain_renewal_cycles_order_idx" ON "domain_renewal_cycles" USING btree ("order_id");
  CREATE INDEX "domain_renewal_cycles_payment_attempt_idx" ON "domain_renewal_cycles" USING btree ("payment_attempt_id");
  CREATE INDEX "domain_renewal_cycles_tenant_idx" ON "domain_renewal_cycles" USING btree ("tenant_id");
  CREATE INDEX "domain_renewal_cycles_state_idx" ON "domain_renewal_cycles" USING btree ("state");
  CREATE INDEX "domain_renewal_cycles_coverage_starts_at_idx" ON "domain_renewal_cycles" USING btree ("coverage_starts_at");
  CREATE INDEX "domain_renewal_cycles_coverage_ends_at_idx" ON "domain_renewal_cycles" USING btree ("coverage_ends_at");
  CREATE INDEX "domain_renewal_cycles_provider_safe_cutoff_at_idx" ON "domain_renewal_cycles" USING btree ("provider_safe_cutoff_at");
  CREATE UNIQUE INDEX "domain_renewal_cycles_provider_operation_id_idx" ON "domain_renewal_cycles" USING btree ("provider_operation_id");
  CREATE INDEX "domain_renewal_cycles_payment_secured_at_idx" ON "domain_renewal_cycles" USING btree ("payment_secured_at");
  CREATE INDEX "domain_renewal_cycles_provider_committed_at_idx" ON "domain_renewal_cycles" USING btree ("provider_committed_at");
  CREATE INDEX "domain_renewal_cycles_reconciliation_required_idx" ON "domain_renewal_cycles" USING btree ("reconciliation_required");
  CREATE INDEX "domain_renewal_cycles_created_at_idx" ON "domain_renewal_cycles" USING btree ("created_at");
  CREATE INDEX "domain_renewal_cycles_updated_at_idx" ON "domain_renewal_cycles" USING btree ("updated_at");
  CREATE UNIQUE INDEX "managedDomain_coverageEndsAt_idx" ON "domain_renewal_cycles" USING btree ("managed_domain_id","coverage_ends_at");
  CREATE INDEX "orders_state_idx" ON "orders" USING btree ("state");
  CREATE UNIQUE INDEX "orders_checkout_profile_key_idx" ON "orders" USING btree ("checkout_profile_key");
  CREATE INDEX "orders_catalog_version_idx" ON "orders" USING btree ("catalog_version");
  CREATE INDEX "orders_terms_version_idx" ON "orders" USING btree ("terms_version");
  CREATE INDEX "orders_privacy_version_idx" ON "orders" USING btree ("privacy_version");
  CREATE INDEX "orders_business_use_declaration_version_idx" ON "orders" USING btree ("business_use_declaration_version");
  CREATE INDEX "orders_accepted_at_idx" ON "orders" USING btree ("accepted_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "checkout_profiles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payment_attempts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "billing_agreements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "managed_domains" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "domain_renewal_cycles" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "checkout_profiles" CASCADE;
  DROP TABLE "payment_attempts" CASCADE;
  DROP TABLE "billing_agreements" CASCADE;
  DROP TABLE "managed_domains" CASCADE;
  DROP TABLE "domain_renewal_cycles" CASCADE;
  DROP INDEX "orders_state_idx";
  DROP INDEX "orders_checkout_profile_key_idx";
  DROP INDEX "orders_catalog_version_idx";
  DROP INDEX "orders_terms_version_idx";
  DROP INDEX "orders_privacy_version_idx";
  DROP INDEX "orders_business_use_declaration_version_idx";
  DROP INDEX "orders_accepted_at_idx";
  ALTER TABLE "orders" DROP COLUMN "state";
  ALTER TABLE "orders" DROP COLUMN "checkout_profile_key";
  ALTER TABLE "orders" DROP COLUMN "catalog_version";
  ALTER TABLE "orders" DROP COLUMN "quote_evidence";
  ALTER TABLE "orders" DROP COLUMN "net_line_items";
  ALTER TABLE "orders" DROP COLUMN "vat_rate_basis_points";
  ALTER TABLE "orders" DROP COLUMN "subtotal_net_minor";
  ALTER TABLE "orders" DROP COLUMN "vat_amount_minor";
  ALTER TABLE "orders" DROP COLUMN "total_gross_minor";
  ALTER TABLE "orders" DROP COLUMN "contracting_party_profile_version";
  ALTER TABLE "orders" DROP COLUMN "terms_version";
  ALTER TABLE "orders" DROP COLUMN "privacy_version";
  ALTER TABLE "orders" DROP COLUMN "business_use_declaration_version";
  ALTER TABLE "orders" DROP COLUMN "accepted_at";
  ALTER TABLE "orders" DROP COLUMN "acceptance_ip_address";
  ALTER TABLE "orders" DROP COLUMN "acceptance_user_agent";
  DROP TYPE "public"."enum_orders_state";
  DROP TYPE "public"."enum_checkout_profiles_party_type";
  DROP TYPE "public"."enum_checkout_profiles_contracting_party_kind";
  DROP TYPE "public"."enum_checkout_profiles_domain_registrant_source";
  DROP TYPE "public"."enum_payment_attempts_state";
  DROP TYPE "public"."enum_payment_attempts_purpose";
  DROP TYPE "public"."enum_payment_attempts_provider";
  DROP TYPE "public"."enum_billing_agreements_state";
  DROP TYPE "public"."enum_billing_agreements_provider";
  DROP TYPE "public"."enum_billing_agreements_billing_period";
  DROP TYPE "public"."enum_managed_domains_state";
  DROP TYPE "public"."enum_managed_domains_initial_operation";
  DROP TYPE "public"."enum_managed_domains_registrant_ownership";
  DROP TYPE "public"."enum_managed_domains_provider";
  DROP TYPE "public"."enum_domain_renewal_cycles_state";`)
}
