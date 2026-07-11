import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_legal_documents_document_type" AS ENUM('platform-terms', 'platform-privacy');
  CREATE TYPE "public"."enum_legal_documents_change_category" AS ENUM('editorial', 'non_material_clarification', 'administrative', 'service_operational', 'subprocessor_change', 'privacy_transparency', 'privacy_material', 'contract_material', 'customer_adverse', 'consent_scope_change');
  CREATE TYPE "public"."enum_legal_documents_customer_action" AS ENUM('none', 'publish_notice', 'direct_notice', 'reaccept_on_next_transaction', 'mandatory_reaccept');
  CREATE TYPE "public"."enum_legal_documents_consent_action" AS ENUM('none', 'renew_analytics', 'renew_marketing', 'renew_all_optional');
  CREATE TYPE "public"."enum_legal_publication_events_event_type" AS ENUM('registered', 'scheduled', 'activated', 'superseded', 'failed');
  CREATE TYPE "public"."enum_orders_billing_period" AS ENUM('one_time', 'monthly', 'quarterly', 'annual');
  CREATE TYPE "public"."enum_orders_payment_status" AS ENUM('pending', 'open', 'paid', 'failed', 'cancelled', 'expired');
  CREATE TYPE "public"."enum_orders_payment_provider" AS ENUM('mollie', 'manual');
  CREATE TYPE "public"."enum_communication_preference_events_preference_type" AS ENUM('marketing', 'directory', 'suppression');
  CREATE TYPE "public"."enum_communication_preference_events_action" AS ENUM('opt_in', 'opt_out', 'suppress', 'unsuppress');
  CREATE TYPE "public"."enum_legal_requirements_action" AS ENUM('none', 'publish_notice', 'direct_notice', 'reaccept_on_next_transaction', 'mandatory_reaccept');
  CREATE TYPE "public"."enum_legal_requirements_status" AS ENUM('pending', 'notified', 'satisfied', 'waived', 'failed');
  CREATE TABLE "legal_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"release_key" varchar NOT NULL,
  	"document_type" "enum_legal_documents_document_type" NOT NULL,
  	"locale" varchar NOT NULL,
  	"document_version" varchar NOT NULL,
  	"acceptance_version" varchar,
  	"replaces" varchar,
  	"content" varchar NOT NULL,
  	"content_hash" varchar NOT NULL,
  	"source_commit" varchar NOT NULL,
  	"published_at" timestamp(3) with time zone NOT NULL,
  	"effective_at" timestamp(3) with time zone NOT NULL,
  	"change_category" "enum_legal_documents_change_category" NOT NULL,
  	"change_summary" varchar NOT NULL,
  	"change_rationale" varchar NOT NULL,
  	"customer_action" "enum_legal_documents_customer_action" NOT NULL,
  	"consent_action" "enum_legal_documents_consent_action" DEFAULT 'none' NOT NULL,
  	"audience" varchar,
  	"notice_days" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "legal_publication_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_key" varchar NOT NULL,
  	"document_id" integer NOT NULL,
  	"event_type" "enum_legal_publication_events_event_type" NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"superseded_document_id" integer,
  	"message" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_number" varchar NOT NULL,
  	"tenant_id" integer,
  	"generation_run_id" integer,
  	"customer_name" varchar NOT NULL,
  	"customer_email" varchar NOT NULL,
  	"company_name" varchar NOT NULL,
  	"billing_address" jsonb NOT NULL,
  	"package_code" varchar NOT NULL,
  	"billing_period" "enum_orders_billing_period" NOT NULL,
  	"renewal_terms" varchar NOT NULL,
  	"line_items" jsonb NOT NULL,
  	"currency" varchar DEFAULT 'EUR' NOT NULL,
  	"subtotal_net" numeric NOT NULL,
  	"vat_amount" numeric NOT NULL,
  	"total_gross" numeric NOT NULL,
  	"domain" varchar NOT NULL,
  	"domain_registrant" jsonb NOT NULL,
  	"payment_status" "enum_orders_payment_status" DEFAULT 'pending' NOT NULL,
  	"payment_provider" "enum_orders_payment_provider" DEFAULT 'mollie' NOT NULL,
  	"provider_payment_id" varchar,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"paid_at" timestamp(3) with time zone,
  	"cancelled_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "orders_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"legal_documents_id" integer
  );
  CREATE TABLE "agreement_acceptances" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"evidence_key" varchar NOT NULL,
  	"tenant_id" integer,
  	"order_id" integer,
  	"document_id" integer NOT NULL,
  	"document_version" varchar NOT NULL,
  	"acceptance_version" varchar NOT NULL,
  	"content_hash" varchar NOT NULL,
  	"statement_version" varchar NOT NULL,
  	"statement_text" varchar NOT NULL,
  	"actor_user_id" integer,
  	"actor_email" varchar NOT NULL,
  	"accepted_at" timestamp(3) with time zone NOT NULL,
  	"request_id" varchar NOT NULL,
  	"ip_address" varchar,
  	"user_agent" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "site_review_revisions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"revision_key" varchar NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"generation_run_id" integer NOT NULL,
  	"domain" varchar NOT NULL,
  	"snapshot_hash" varchar NOT NULL,
  	"snapshot" jsonb NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "site_approvals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"evidence_key" varchar NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"review_revision_id" integer NOT NULL,
  	"domain" varchar NOT NULL,
  	"snapshot_hash" varchar NOT NULL,
  	"statement_version" varchar NOT NULL,
  	"statement_text" varchar NOT NULL,
  	"actor_user_id" integer,
  	"actor_email" varchar NOT NULL,
  	"approved_at" timestamp(3) with time zone NOT NULL,
  	"request_id" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "communication_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"subject_key" varchar NOT NULL,
  	"tenant_id" integer,
  	"email" varchar NOT NULL,
  	"marketing" boolean DEFAULT false NOT NULL,
  	"directory" boolean DEFAULT false NOT NULL,
  	"suppressed" boolean DEFAULT false NOT NULL,
  	"statement_version" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "communication_preference_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_key" varchar NOT NULL,
  	"preference_id" integer NOT NULL,
  	"preference_type" "enum_communication_preference_events_preference_type" NOT NULL,
  	"action" "enum_communication_preference_events_action" NOT NULL,
  	"statement_version" varchar NOT NULL,
  	"statement_text" varchar NOT NULL,
  	"source" varchar NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"request_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "legal_requirements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"requirement_key" varchar NOT NULL,
  	"tenant_id" integer,
  	"subject_email" varchar NOT NULL,
  	"document_id" integer NOT NULL,
  	"action" "enum_legal_requirements_action" NOT NULL,
  	"status" "enum_legal_requirements_status" DEFAULT 'pending' NOT NULL,
  	"enforce_at" timestamp(3) with time zone,
  	"notified_at" timestamp(3) with time zone,
  	"satisfied_at" timestamp(3) with time zone,
  	"acceptance_id" integer,
  	"last_error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "legal_documents_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "legal_publication_events_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "orders_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "agreement_acceptances_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "site_review_revisions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "site_approvals_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "communication_preferences_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "communication_preference_events_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "legal_requirements_id" integer;
  ALTER TABLE "legal_publication_events" ADD CONSTRAINT "legal_publication_events_document_id_legal_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_publication_events" ADD CONSTRAINT "legal_publication_events_superseded_document_id_legal_documents_id_fk" FOREIGN KEY ("superseded_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_generation_run_id_site_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."site_generation_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_rels" ADD CONSTRAINT "orders_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_rels" ADD CONSTRAINT "orders_rels_legal_documents_fk" FOREIGN KEY ("legal_documents_id") REFERENCES "public"."legal_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_document_id_legal_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_review_revisions" ADD CONSTRAINT "site_review_revisions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_review_revisions" ADD CONSTRAINT "site_review_revisions_generation_run_id_site_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."site_generation_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_approvals" ADD CONSTRAINT "site_approvals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_approvals" ADD CONSTRAINT "site_approvals_review_revision_id_site_review_revisions_id_fk" FOREIGN KEY ("review_revision_id") REFERENCES "public"."site_review_revisions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_approvals" ADD CONSTRAINT "site_approvals_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "communication_preferences" ADD CONSTRAINT "communication_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "communication_preference_events" ADD CONSTRAINT "communication_preference_events_preference_id_communication_preferences_id_fk" FOREIGN KEY ("preference_id") REFERENCES "public"."communication_preferences"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_requirements" ADD CONSTRAINT "legal_requirements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_requirements" ADD CONSTRAINT "legal_requirements_document_id_legal_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_requirements" ADD CONSTRAINT "legal_requirements_acceptance_id_agreement_acceptances_id_fk" FOREIGN KEY ("acceptance_id") REFERENCES "public"."agreement_acceptances"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "legal_documents_release_key_idx" ON "legal_documents" USING btree ("release_key");
  CREATE INDEX "legal_documents_document_type_idx" ON "legal_documents" USING btree ("document_type");
  CREATE INDEX "legal_documents_locale_idx" ON "legal_documents" USING btree ("locale");
  CREATE INDEX "legal_documents_document_version_idx" ON "legal_documents" USING btree ("document_version");
  CREATE INDEX "legal_documents_acceptance_version_idx" ON "legal_documents" USING btree ("acceptance_version");
  CREATE INDEX "legal_documents_content_hash_idx" ON "legal_documents" USING btree ("content_hash");
  CREATE INDEX "legal_documents_published_at_idx" ON "legal_documents" USING btree ("published_at");
  CREATE INDEX "legal_documents_effective_at_idx" ON "legal_documents" USING btree ("effective_at");
  CREATE INDEX "legal_documents_change_category_idx" ON "legal_documents" USING btree ("change_category");
  CREATE INDEX "legal_documents_customer_action_idx" ON "legal_documents" USING btree ("customer_action");
  CREATE INDEX "legal_documents_updated_at_idx" ON "legal_documents" USING btree ("updated_at");
  CREATE INDEX "legal_documents_created_at_idx" ON "legal_documents" USING btree ("created_at");
  CREATE UNIQUE INDEX "legal_publication_events_event_key_idx" ON "legal_publication_events" USING btree ("event_key");
  CREATE INDEX "legal_publication_events_document_idx" ON "legal_publication_events" USING btree ("document_id");
  CREATE INDEX "legal_publication_events_event_type_idx" ON "legal_publication_events" USING btree ("event_type");
  CREATE INDEX "legal_publication_events_occurred_at_idx" ON "legal_publication_events" USING btree ("occurred_at");
  CREATE INDEX "legal_publication_events_superseded_document_idx" ON "legal_publication_events" USING btree ("superseded_document_id");
  CREATE INDEX "legal_publication_events_updated_at_idx" ON "legal_publication_events" USING btree ("updated_at");
  CREATE INDEX "legal_publication_events_created_at_idx" ON "legal_publication_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");
  CREATE INDEX "orders_tenant_idx" ON "orders" USING btree ("tenant_id");
  CREATE INDEX "orders_generation_run_idx" ON "orders" USING btree ("generation_run_id");
  CREATE INDEX "orders_customer_email_idx" ON "orders" USING btree ("customer_email");
  CREATE INDEX "orders_domain_idx" ON "orders" USING btree ("domain");
  CREATE INDEX "orders_payment_status_idx" ON "orders" USING btree ("payment_status");
  CREATE INDEX "orders_provider_payment_id_idx" ON "orders" USING btree ("provider_payment_id");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_rels_order_idx" ON "orders_rels" USING btree ("order");
  CREATE INDEX "orders_rels_parent_idx" ON "orders_rels" USING btree ("parent_id");
  CREATE INDEX "orders_rels_path_idx" ON "orders_rels" USING btree ("path");
  CREATE INDEX "orders_rels_legal_documents_id_idx" ON "orders_rels" USING btree ("legal_documents_id");
  CREATE UNIQUE INDEX "agreement_acceptances_evidence_key_idx" ON "agreement_acceptances" USING btree ("evidence_key");
  CREATE INDEX "agreement_acceptances_tenant_idx" ON "agreement_acceptances" USING btree ("tenant_id");
  CREATE INDEX "agreement_acceptances_order_idx" ON "agreement_acceptances" USING btree ("order_id");
  CREATE INDEX "agreement_acceptances_document_idx" ON "agreement_acceptances" USING btree ("document_id");
  CREATE INDEX "agreement_acceptances_acceptance_version_idx" ON "agreement_acceptances" USING btree ("acceptance_version");
  CREATE INDEX "agreement_acceptances_actor_user_idx" ON "agreement_acceptances" USING btree ("actor_user_id");
  CREATE INDEX "agreement_acceptances_actor_email_idx" ON "agreement_acceptances" USING btree ("actor_email");
  CREATE INDEX "agreement_acceptances_accepted_at_idx" ON "agreement_acceptances" USING btree ("accepted_at");
  CREATE INDEX "agreement_acceptances_request_id_idx" ON "agreement_acceptances" USING btree ("request_id");
  CREATE INDEX "agreement_acceptances_updated_at_idx" ON "agreement_acceptances" USING btree ("updated_at");
  CREATE INDEX "agreement_acceptances_created_at_idx" ON "agreement_acceptances" USING btree ("created_at");
  CREATE UNIQUE INDEX "site_review_revisions_revision_key_idx" ON "site_review_revisions" USING btree ("revision_key");
  CREATE INDEX "site_review_revisions_tenant_idx" ON "site_review_revisions" USING btree ("tenant_id");
  CREATE INDEX "site_review_revisions_generation_run_idx" ON "site_review_revisions" USING btree ("generation_run_id");
  CREATE INDEX "site_review_revisions_domain_idx" ON "site_review_revisions" USING btree ("domain");
  CREATE INDEX "site_review_revisions_snapshot_hash_idx" ON "site_review_revisions" USING btree ("snapshot_hash");
  CREATE INDEX "site_review_revisions_created_at_idx" ON "site_review_revisions" USING btree ("created_at");
  CREATE INDEX "site_review_revisions_updated_at_idx" ON "site_review_revisions" USING btree ("updated_at");
  CREATE UNIQUE INDEX "site_approvals_evidence_key_idx" ON "site_approvals" USING btree ("evidence_key");
  CREATE INDEX "site_approvals_tenant_idx" ON "site_approvals" USING btree ("tenant_id");
  CREATE INDEX "site_approvals_review_revision_idx" ON "site_approvals" USING btree ("review_revision_id");
  CREATE INDEX "site_approvals_snapshot_hash_idx" ON "site_approvals" USING btree ("snapshot_hash");
  CREATE INDEX "site_approvals_actor_user_idx" ON "site_approvals" USING btree ("actor_user_id");
  CREATE INDEX "site_approvals_actor_email_idx" ON "site_approvals" USING btree ("actor_email");
  CREATE INDEX "site_approvals_approved_at_idx" ON "site_approvals" USING btree ("approved_at");
  CREATE INDEX "site_approvals_updated_at_idx" ON "site_approvals" USING btree ("updated_at");
  CREATE INDEX "site_approvals_created_at_idx" ON "site_approvals" USING btree ("created_at");
  CREATE UNIQUE INDEX "communication_preferences_subject_key_idx" ON "communication_preferences" USING btree ("subject_key");
  CREATE INDEX "communication_preferences_tenant_idx" ON "communication_preferences" USING btree ("tenant_id");
  CREATE INDEX "communication_preferences_email_idx" ON "communication_preferences" USING btree ("email");
  CREATE INDEX "communication_preferences_marketing_idx" ON "communication_preferences" USING btree ("marketing");
  CREATE INDEX "communication_preferences_directory_idx" ON "communication_preferences" USING btree ("directory");
  CREATE INDEX "communication_preferences_suppressed_idx" ON "communication_preferences" USING btree ("suppressed");
  CREATE INDEX "communication_preferences_updated_at_idx" ON "communication_preferences" USING btree ("updated_at");
  CREATE INDEX "communication_preferences_created_at_idx" ON "communication_preferences" USING btree ("created_at");
  CREATE UNIQUE INDEX "communication_preference_events_event_key_idx" ON "communication_preference_events" USING btree ("event_key");
  CREATE INDEX "communication_preference_events_preference_idx" ON "communication_preference_events" USING btree ("preference_id");
  CREATE INDEX "communication_preference_events_preference_type_idx" ON "communication_preference_events" USING btree ("preference_type");
  CREATE INDEX "communication_preference_events_action_idx" ON "communication_preference_events" USING btree ("action");
  CREATE INDEX "communication_preference_events_occurred_at_idx" ON "communication_preference_events" USING btree ("occurred_at");
  CREATE INDEX "communication_preference_events_updated_at_idx" ON "communication_preference_events" USING btree ("updated_at");
  CREATE INDEX "communication_preference_events_created_at_idx" ON "communication_preference_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "legal_requirements_requirement_key_idx" ON "legal_requirements" USING btree ("requirement_key");
  CREATE INDEX "legal_requirements_tenant_idx" ON "legal_requirements" USING btree ("tenant_id");
  CREATE INDEX "legal_requirements_subject_email_idx" ON "legal_requirements" USING btree ("subject_email");
  CREATE INDEX "legal_requirements_document_idx" ON "legal_requirements" USING btree ("document_id");
  CREATE INDEX "legal_requirements_action_idx" ON "legal_requirements" USING btree ("action");
  CREATE INDEX "legal_requirements_status_idx" ON "legal_requirements" USING btree ("status");
  CREATE INDEX "legal_requirements_enforce_at_idx" ON "legal_requirements" USING btree ("enforce_at");
  CREATE INDEX "legal_requirements_acceptance_idx" ON "legal_requirements" USING btree ("acceptance_id");
  CREATE INDEX "legal_requirements_updated_at_idx" ON "legal_requirements" USING btree ("updated_at");
  CREATE INDEX "legal_requirements_created_at_idx" ON "legal_requirements" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_documents_fk" FOREIGN KEY ("legal_documents_id") REFERENCES "public"."legal_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_publication_events_fk" FOREIGN KEY ("legal_publication_events_id") REFERENCES "public"."legal_publication_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_agreement_acceptances_fk" FOREIGN KEY ("agreement_acceptances_id") REFERENCES "public"."agreement_acceptances"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_review_revisions_fk" FOREIGN KEY ("site_review_revisions_id") REFERENCES "public"."site_review_revisions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_approvals_fk" FOREIGN KEY ("site_approvals_id") REFERENCES "public"."site_approvals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_communication_preferences_fk" FOREIGN KEY ("communication_preferences_id") REFERENCES "public"."communication_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_communication_preference_ev_fk" FOREIGN KEY ("communication_preference_events_id") REFERENCES "public"."communication_preference_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_requirements_fk" FOREIGN KEY ("legal_requirements_id") REFERENCES "public"."legal_requirements"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_legal_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_documents_id");
  CREATE INDEX "payload_locked_documents_rels_legal_publication_events_i_idx" ON "payload_locked_documents_rels" USING btree ("legal_publication_events_id");
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_agreement_acceptances_id_idx" ON "payload_locked_documents_rels" USING btree ("agreement_acceptances_id");
  CREATE INDEX "payload_locked_documents_rels_site_review_revisions_id_idx" ON "payload_locked_documents_rels" USING btree ("site_review_revisions_id");
  CREATE INDEX "payload_locked_documents_rels_site_approvals_id_idx" ON "payload_locked_documents_rels" USING btree ("site_approvals_id");
  CREATE INDEX "payload_locked_documents_rels_communication_preferences__idx" ON "payload_locked_documents_rels" USING btree ("communication_preferences_id");
  CREATE INDEX "payload_locked_documents_rels_communication_preference_e_idx" ON "payload_locked_documents_rels" USING btree ("communication_preference_events_id");
  CREATE INDEX "payload_locked_documents_rels_legal_requirements_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_requirements_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_legal_documents_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_legal_publication_events_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_orders_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_agreement_acceptances_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_site_review_revisions_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_site_approvals_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_communication_preferences_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_communication_preference_ev_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_legal_requirements_fk";
  DROP INDEX "payload_locked_documents_rels_legal_documents_id_idx";
  DROP INDEX "payload_locked_documents_rels_legal_publication_events_i_idx";
  DROP INDEX "payload_locked_documents_rels_orders_id_idx";
  DROP INDEX "payload_locked_documents_rels_agreement_acceptances_id_idx";
  DROP INDEX "payload_locked_documents_rels_site_review_revisions_id_idx";
  DROP INDEX "payload_locked_documents_rels_site_approvals_id_idx";
  DROP INDEX "payload_locked_documents_rels_communication_preferences__idx";
  DROP INDEX "payload_locked_documents_rels_communication_preference_e_idx";
  DROP INDEX "payload_locked_documents_rels_legal_requirements_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "legal_documents_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "legal_publication_events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "orders_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "agreement_acceptances_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "site_review_revisions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "site_approvals_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "communication_preferences_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "communication_preference_events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "legal_requirements_id";
  DROP TABLE "legal_publication_events" CASCADE;
  DROP TABLE "legal_requirements" CASCADE;
  DROP TABLE "communication_preference_events" CASCADE;
  DROP TABLE "site_approvals" CASCADE;
  DROP TABLE "agreement_acceptances" CASCADE;
  DROP TABLE "orders_rels" CASCADE;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "site_review_revisions" CASCADE;
  DROP TABLE "communication_preferences" CASCADE;
  DROP TABLE "legal_documents" CASCADE;
  DROP TYPE "public"."enum_legal_documents_document_type";
  DROP TYPE "public"."enum_legal_documents_change_category";
  DROP TYPE "public"."enum_legal_documents_customer_action";
  DROP TYPE "public"."enum_legal_documents_consent_action";
  DROP TYPE "public"."enum_legal_publication_events_event_type";
  DROP TYPE "public"."enum_orders_billing_period";
  DROP TYPE "public"."enum_orders_payment_status";
  DROP TYPE "public"."enum_orders_payment_provider";
  DROP TYPE "public"."enum_communication_preference_events_preference_type";
  DROP TYPE "public"."enum_communication_preference_events_action";
  DROP TYPE "public"."enum_legal_requirements_action";
  DROP TYPE "public"."enum_legal_requirements_status";
  `)
}
