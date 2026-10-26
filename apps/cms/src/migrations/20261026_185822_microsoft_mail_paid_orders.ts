import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tenants_enabled_services" AS ENUM('website', 'email');
  CREATE TYPE "public"."enum_tenants_platform_pricing_mode" AS ENUM('standard', 'exempt');
  CREATE TYPE "public"."enum_tenants_email_payment_method" AS ENUM('mollie', 'manual');
  CREATE TYPE "public"."enum_payment_attempts_provider_mode" AS ENUM('test', 'live', 'manual');
  CREATE TYPE "public"."enum_microsoft_mail_services_status" AS ENUM('draft', 'provisioning', 'active', 'attention', 'cancelled');
  CREATE TYPE "public"."enum_microsoft_mail_services_renewal_mode" AS ENUM('manual_invoice', 'mollie');
  CREATE TYPE "public"."enum_microsoft_partner_connections_status" AS ENUM('connected', 'reauthorization_required');
  ALTER TYPE "public"."enum_orders_order_kind" ADD VALUE 'microsoft_mail_initial' BEFORE 'subscription_renewal';
  ALTER TYPE "public"."enum_orders_order_kind" ADD VALUE 'microsoft_mail_seats' BEFORE 'subscription_renewal';
  ALTER TYPE "public"."enum_orders_order_kind" ADD VALUE 'microsoft_mail_renewal' BEFORE 'subscription_renewal';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'purge-microsoft-mail-setup-secrets' BEFORE 'request-mollie-refund';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'reconcile-microsoft-mail' BEFORE 'request-mollie-refund';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'reconcile-microsoft-mail-renewals' BEFORE 'request-mollie-refund';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'purge-microsoft-mail-setup-secrets' BEFORE 'request-mollie-refund';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'reconcile-microsoft-mail' BEFORE 'request-mollie-refund';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'reconcile-microsoft-mail-renewals' BEFORE 'request-mollie-refund';
  CREATE TABLE "tenants_enabled_services" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_tenants_enabled_services",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "microsoft_mail_services" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"domain" varchar NOT NULL,
  	"domain_authorized_at" timestamp(3) with time zone NOT NULL,
  	"domain_authorized_by_id" integer NOT NULL,
  	"status" "enum_microsoft_mail_services_status" DEFAULT 'draft' NOT NULL,
  	"pax8_company_id" varchar,
  	"pax8_subscription_id" varchar,
  	"microsoft_tenant_id" varchar,
  	"microsoft_initial_domain" varchar,
  	"quantity" numeric DEFAULT 0,
  	"mailboxes" jsonb,
  	"info_alias_target" varchar,
  	"info_forward_to" varchar,
  	"billing_email" varchar,
  	"latest_run_id" integer,
  	"current_period_ends_at" timestamp(3) with time zone,
  	"renewal_mode" "enum_microsoft_mail_services_renewal_mode" DEFAULT 'manual_invoice',
  	"renewal_data" jsonb,
  	"issue_code" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "microsoft_partner_connections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"partner_tenant_id" varchar NOT NULL,
  	"client_id" varchar NOT NULL,
  	"user_principal_name" varchar NOT NULL,
  	"user_object_id" varchar NOT NULL,
  	"encrypted_refresh_token" varchar NOT NULL,
  	"status" "enum_microsoft_partner_connections_status" NOT NULL,
  	"connected_at" timestamp(3) with time zone NOT NULL,
  	"refreshed_at" timestamp(3) with time zone NOT NULL,
  	"connected_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "tenants" ADD COLUMN "platform_pricing_mode" "enum_tenants_platform_pricing_mode" DEFAULT 'standard';
  ALTER TABLE "tenants" ADD COLUMN "platform_pricing_reason" varchar;
  ALTER TABLE "tenants" ADD COLUMN "platform_pricing_expires_at" timestamp(3) with time zone;
  ALTER TABLE "tenants" ADD COLUMN "commercial_policy_history" jsonb;
  ALTER TABLE "tenants" ADD COLUMN "email_payment_method" "enum_tenants_email_payment_method" DEFAULT 'mollie';
  ALTER TABLE "payment_attempts" ADD COLUMN "provider_mode" "enum_payment_attempts_provider_mode";
  ALTER TABLE "microsoft_mail_provisioning_runs" ADD COLUMN "commerce_order_id" integer;
  ALTER TABLE "microsoft_mail_provisioning_runs" ADD COLUMN "mail_service_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "microsoft_mail_services_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "microsoft_partner_connections_id" integer;
  ALTER TABLE "tenants_enabled_services" ADD CONSTRAINT "tenants_enabled_services_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "microsoft_mail_services" ADD CONSTRAINT "microsoft_mail_services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "microsoft_mail_services" ADD CONSTRAINT "microsoft_mail_services_domain_authorized_by_id_users_id_fk" FOREIGN KEY ("domain_authorized_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "microsoft_mail_services" ADD CONSTRAINT "microsoft_mail_services_latest_run_id_microsoft_mail_provisioning_runs_id_fk" FOREIGN KEY ("latest_run_id") REFERENCES "public"."microsoft_mail_provisioning_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "microsoft_partner_connections" ADD CONSTRAINT "microsoft_partner_connections_connected_by_id_users_id_fk" FOREIGN KEY ("connected_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "tenants_enabled_services_order_idx" ON "tenants_enabled_services" USING btree ("order");
  CREATE INDEX "tenants_enabled_services_parent_idx" ON "tenants_enabled_services" USING btree ("parent_id");
  CREATE UNIQUE INDEX "microsoft_mail_services_tenant_idx" ON "microsoft_mail_services" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "microsoft_mail_services_domain_idx" ON "microsoft_mail_services" USING btree ("domain");
  CREATE INDEX "microsoft_mail_services_domain_authorized_by_idx" ON "microsoft_mail_services" USING btree ("domain_authorized_by_id");
  CREATE UNIQUE INDEX "microsoft_mail_services_pax8_subscription_id_idx" ON "microsoft_mail_services" USING btree ("pax8_subscription_id");
  CREATE UNIQUE INDEX "microsoft_mail_services_microsoft_tenant_id_idx" ON "microsoft_mail_services" USING btree ("microsoft_tenant_id");
  CREATE INDEX "microsoft_mail_services_latest_run_idx" ON "microsoft_mail_services" USING btree ("latest_run_id");
  CREATE INDEX "microsoft_mail_services_updated_at_idx" ON "microsoft_mail_services" USING btree ("updated_at");
  CREATE INDEX "microsoft_mail_services_created_at_idx" ON "microsoft_mail_services" USING btree ("created_at");
  CREATE UNIQUE INDEX "microsoft_partner_connections_partner_tenant_id_idx" ON "microsoft_partner_connections" USING btree ("partner_tenant_id");
  CREATE INDEX "microsoft_partner_connections_connected_by_idx" ON "microsoft_partner_connections" USING btree ("connected_by_id");
  CREATE INDEX "microsoft_partner_connections_updated_at_idx" ON "microsoft_partner_connections" USING btree ("updated_at");
  CREATE INDEX "microsoft_partner_connections_created_at_idx" ON "microsoft_partner_connections" USING btree ("created_at");
  ALTER TABLE "microsoft_mail_provisioning_runs" ADD CONSTRAINT "microsoft_mail_provisioning_runs_commerce_order_id_orders_id_fk" FOREIGN KEY ("commerce_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "microsoft_mail_provisioning_runs" ADD CONSTRAINT "microsoft_mail_provisioning_runs_mail_service_id_microsoft_mail_services_id_fk" FOREIGN KEY ("mail_service_id") REFERENCES "public"."microsoft_mail_services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_microsoft_mail_services_fk" FOREIGN KEY ("microsoft_mail_services_id") REFERENCES "public"."microsoft_mail_services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_microsoft_partner_connectio_fk" FOREIGN KEY ("microsoft_partner_connections_id") REFERENCES "public"."microsoft_partner_connections"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "microsoft_mail_provisioning_runs_commerce_order_idx" ON "microsoft_mail_provisioning_runs" USING btree ("commerce_order_id");
  CREATE INDEX "microsoft_mail_provisioning_runs_mail_service_idx" ON "microsoft_mail_provisioning_runs" USING btree ("mail_service_id");
  CREATE INDEX "payload_locked_documents_rels_microsoft_mail_services_id_idx" ON "payload_locked_documents_rels" USING btree ("microsoft_mail_services_id");
  CREATE INDEX "payload_locked_documents_rels_microsoft_partner_connecti_idx" ON "payload_locked_documents_rels" USING btree ("microsoft_partner_connections_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants_enabled_services" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "microsoft_mail_services" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "microsoft_partner_connections" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "tenants_enabled_services" CASCADE;
  DROP TABLE "microsoft_mail_services" CASCADE;
  DROP TABLE "microsoft_partner_connections" CASCADE;
  ALTER TABLE "microsoft_mail_provisioning_runs" DROP CONSTRAINT "microsoft_mail_provisioning_runs_commerce_order_id_orders_id_fk";
  
  ALTER TABLE "microsoft_mail_provisioning_runs" DROP CONSTRAINT "microsoft_mail_provisioning_runs_mail_service_id_microsoft_mail_services_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_microsoft_mail_services_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_microsoft_partner_connectio_fk";
  
  ALTER TABLE "orders" ALTER COLUMN "order_kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_orders_order_kind";
  CREATE TYPE "public"."enum_orders_order_kind" AS ENUM('initial_subscription', 'subscription_renewal', 'domain_renewal', 'migration_supplemental');
  ALTER TABLE "orders" ALTER COLUMN "order_kind" SET DATA TYPE "public"."enum_orders_order_kind" USING "order_kind"::"public"."enum_orders_order_kind";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'purge-expired-checkout-progress-drafts', 'send-legal-requirement-notifications', 'process-appointment-notifications', 'process-appointment-calendar-events', 'purge-stale-appointments', 'sync-mollie-payment', 'fulfill-order', 'prepare-domain-migration', 'prepare-domain-transfer-out', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'account-link-dispatch', 'request-mollie-refund');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'purge-stale-form-submissions', 'purge-expired-checkout-progress-drafts', 'send-legal-requirement-notifications', 'process-appointment-notifications', 'process-appointment-calendar-events', 'purge-stale-appointments', 'sync-mollie-payment', 'fulfill-order', 'prepare-domain-migration', 'prepare-domain-transfer-out', 'renew-domain', 'reconcile-commerce', 'deliver-commerce-notification', 'account-link-dispatch', 'request-mollie-refund');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "microsoft_mail_provisioning_runs_commerce_order_idx";
  DROP INDEX "microsoft_mail_provisioning_runs_mail_service_idx";
  DROP INDEX "payload_locked_documents_rels_microsoft_mail_services_id_idx";
  DROP INDEX "payload_locked_documents_rels_microsoft_partner_connecti_idx";
  ALTER TABLE "tenants" DROP COLUMN "platform_pricing_mode";
  ALTER TABLE "tenants" DROP COLUMN "platform_pricing_reason";
  ALTER TABLE "tenants" DROP COLUMN "platform_pricing_expires_at";
  ALTER TABLE "tenants" DROP COLUMN "commercial_policy_history";
  ALTER TABLE "tenants" DROP COLUMN "email_payment_method";
  ALTER TABLE "payment_attempts" DROP COLUMN "provider_mode";
  ALTER TABLE "microsoft_mail_provisioning_runs" DROP COLUMN "commerce_order_id";
  ALTER TABLE "microsoft_mail_provisioning_runs" DROP COLUMN "mail_service_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "microsoft_mail_services_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "microsoft_partner_connections_id";
  DROP TYPE "public"."enum_tenants_enabled_services";
  DROP TYPE "public"."enum_tenants_platform_pricing_mode";
  DROP TYPE "public"."enum_tenants_email_payment_method";
  DROP TYPE "public"."enum_payment_attempts_provider_mode";
  DROP TYPE "public"."enum_microsoft_mail_services_status";
  DROP TYPE "public"."enum_microsoft_mail_services_renewal_mode";
  DROP TYPE "public"."enum_microsoft_partner_connections_status";`)
}
