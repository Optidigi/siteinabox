import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_intake_submissions_status_transitions_status" AS ENUM('submitted', 'normalized', 'queued', 'generating', 'generated', 'validating', 'applying', 'draft_ready', 'preview_ready', 'failed');
  CREATE TYPE "public"."enum_intake_submissions_status" AS ENUM('submitted', 'normalized', 'queued', 'generating', 'generated', 'validating', 'applying', 'draft_ready', 'preview_ready', 'failed');
  CREATE TYPE "public"."enum_site_generation_runs_status_transitions_status" AS ENUM('submitted', 'normalized', 'queued', 'generating', 'generated', 'validating', 'applying', 'draft_ready', 'preview_ready', 'failed');
  CREATE TYPE "public"."enum_site_generation_runs_status" AS ENUM('submitted', 'normalized', 'queued', 'generating', 'generated', 'validating', 'applying', 'draft_ready', 'preview_ready', 'failed');
  CREATE TABLE "intake_submissions_status_transitions" (
	"_order" integer NOT NULL,
	"_parent_id" integer NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"status" "enum_intake_submissions_status_transitions_status" NOT NULL,
	"at" timestamp(3) with time zone NOT NULL,
	"message" varchar
  );

  CREATE TABLE "intake_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_name" varchar NOT NULL,
	"contact_name" varchar,
	"contact_email" varchar,
	"source" varchar DEFAULT 'public-intake' NOT NULL,
	"status" "enum_intake_submissions_status" DEFAULT 'submitted' NOT NULL,
	"idempotency_key" varchar NOT NULL,
	"raw" jsonb NOT NULL,
	"normalized" jsonb,
	"normalized_hash" varchar,
	"generation_run_id" integer,
	"tenant_id" integer,
	"error" jsonb,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "site_generation_runs_status_transitions" (
	"_order" integer NOT NULL,
	"_parent_id" integer NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"status" "enum_site_generation_runs_status_transitions_status" NOT NULL,
	"at" timestamp(3) with time zone NOT NULL,
	"message" varchar
  );

  CREATE TABLE "site_generation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"intake_submission_id" integer NOT NULL,
	"status" "enum_site_generation_runs_status" DEFAULT 'queued' NOT NULL,
	"idempotency_key" varchar NOT NULL,
	"normalized_intake" jsonb NOT NULL,
	"normalized_intake_hash" varchar NOT NULL,
	"mock_fixture" varchar DEFAULT 'amblast' NOT NULL,
	"spec_hash" varchar,
	"spec" jsonb,
	"validation" jsonb,
	"apply_result" jsonb,
	"tenant_id" integer,
	"settings_id" integer,
	"started_at" timestamp(3) with time zone,
	"completed_at" timestamp(3) with time zone,
	"errors" jsonb,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "site_generation_runs_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" integer NOT NULL,
	"path" varchar NOT NULL,
	"pages_id" integer
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "intake_submissions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "site_generation_runs_id" integer;
  ALTER TABLE "intake_submissions_status_transitions" ADD CONSTRAINT "intake_submissions_status_transitions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."intake_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_generation_run_id_site_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."site_generation_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_generation_runs_status_transitions" ADD CONSTRAINT "site_generation_runs_status_transitions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_generation_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_generation_runs" ADD CONSTRAINT "site_generation_runs_intake_submission_id_intake_submissions_id_fk" FOREIGN KEY ("intake_submission_id") REFERENCES "public"."intake_submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_generation_runs" ADD CONSTRAINT "site_generation_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_generation_runs" ADD CONSTRAINT "site_generation_runs_settings_id_site_settings_id_fk" FOREIGN KEY ("settings_id") REFERENCES "public"."site_settings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_generation_runs_rels" ADD CONSTRAINT "site_generation_runs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site_generation_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_generation_runs_rels" ADD CONSTRAINT "site_generation_runs_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "intake_submissions_status_transitions_order_idx" ON "intake_submissions_status_transitions" USING btree ("_order");
  CREATE INDEX "intake_submissions_status_transitions_parent_id_idx" ON "intake_submissions_status_transitions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "intake_submissions_idempotency_key_idx" ON "intake_submissions" USING btree ("idempotency_key");
  CREATE INDEX "intake_submissions_generation_run_idx" ON "intake_submissions" USING btree ("generation_run_id");
  CREATE INDEX "intake_submissions_tenant_idx" ON "intake_submissions" USING btree ("tenant_id");
  CREATE INDEX "intake_submissions_updated_at_idx" ON "intake_submissions" USING btree ("updated_at");
  CREATE INDEX "intake_submissions_created_at_idx" ON "intake_submissions" USING btree ("created_at");
  CREATE INDEX "site_generation_runs_status_transitions_order_idx" ON "site_generation_runs_status_transitions" USING btree ("_order");
  CREATE INDEX "site_generation_runs_status_transitions_parent_id_idx" ON "site_generation_runs_status_transitions" USING btree ("_parent_id");
  CREATE INDEX "site_generation_runs_intake_submission_idx" ON "site_generation_runs" USING btree ("intake_submission_id");
  CREATE UNIQUE INDEX "site_generation_runs_idempotency_key_idx" ON "site_generation_runs" USING btree ("idempotency_key");
  CREATE INDEX "site_generation_runs_tenant_idx" ON "site_generation_runs" USING btree ("tenant_id");
  CREATE INDEX "site_generation_runs_settings_idx" ON "site_generation_runs" USING btree ("settings_id");
  CREATE INDEX "site_generation_runs_updated_at_idx" ON "site_generation_runs" USING btree ("updated_at");
  CREATE INDEX "site_generation_runs_created_at_idx" ON "site_generation_runs" USING btree ("created_at");
  CREATE INDEX "site_generation_runs_rels_order_idx" ON "site_generation_runs_rels" USING btree ("order");
  CREATE INDEX "site_generation_runs_rels_parent_idx" ON "site_generation_runs_rels" USING btree ("parent_id");
  CREATE INDEX "site_generation_runs_rels_path_idx" ON "site_generation_runs_rels" USING btree ("path");
  CREATE INDEX "site_generation_runs_rels_pages_id_idx" ON "site_generation_runs_rels" USING btree ("pages_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_intake_submissions_fk" FOREIGN KEY ("intake_submissions_id") REFERENCES "public"."intake_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_generation_runs_fk" FOREIGN KEY ("site_generation_runs_id") REFERENCES "public"."site_generation_runs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_intake_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("intake_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_site_generation_runs_id_idx" ON "payload_locked_documents_rels" USING btree ("site_generation_runs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "intake_submissions_status_transitions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "intake_submissions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_generation_runs_status_transitions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_generation_runs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_generation_runs_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "intake_submissions_status_transitions" CASCADE;
  DROP TABLE "intake_submissions" CASCADE;
  DROP TABLE "site_generation_runs_status_transitions" CASCADE;
  DROP TABLE "site_generation_runs" CASCADE;
  DROP TABLE "site_generation_runs_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_intake_submissions_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_site_generation_runs_fk";

  DROP INDEX "payload_locked_documents_rels_intake_submissions_id_idx";
  DROP INDEX "payload_locked_documents_rels_site_generation_runs_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "intake_submissions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "site_generation_runs_id";
  DROP TYPE "public"."enum_intake_submissions_status_transitions_status";
  DROP TYPE "public"."enum_intake_submissions_status";
  DROP TYPE "public"."enum_site_generation_runs_status_transitions_status";
  DROP TYPE "public"."enum_site_generation_runs_status";`)
}
