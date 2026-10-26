import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_microsoft_mail_provisioning_runs_mode" AS ENUM('mock', 'live');
  CREATE TYPE "public"."enum_microsoft_mail_provisioning_runs_state" AS ENUM('prepared', 'tenant_pending', 'consent_pending', 'subscription_pending', 'domain_pending', 'dns_pending', 'mailboxes_pending', 'exchange_pending', 'setup_mail_pending', 'ready', 'manual_review', 'failed', 'cancelled');
  CREATE TABLE "microsoft_mail_provisioning_runs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"mode" "enum_microsoft_mail_provisioning_runs_mode" NOT NULL,
  	"tenant_id" numeric NOT NULL,
  	"domain" varchar NOT NULL,
  	"tenant_prefix" varchar NOT NULL,
  	"request" jsonb NOT NULL,
  	"state" "enum_microsoft_mail_provisioning_runs_state" NOT NULL,
  	"current_step" varchar,
  	"completed_steps" jsonb NOT NULL,
  	"data" jsonb NOT NULL,
  	"action_url" varchar,
  	"issue_code" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "microsoft_mail_provisioning_runs_id" integer;
  CREATE UNIQUE INDEX "microsoft_mail_provisioning_runs_idempotency_key_idx" ON "microsoft_mail_provisioning_runs" USING btree ("idempotency_key");
  CREATE INDEX "microsoft_mail_provisioning_runs_tenant_id_idx" ON "microsoft_mail_provisioning_runs" USING btree ("tenant_id");
  CREATE INDEX "microsoft_mail_provisioning_runs_domain_idx" ON "microsoft_mail_provisioning_runs" USING btree ("domain");
  CREATE INDEX "microsoft_mail_provisioning_runs_state_idx" ON "microsoft_mail_provisioning_runs" USING btree ("state");
  CREATE INDEX "microsoft_mail_provisioning_runs_updated_at_idx" ON "microsoft_mail_provisioning_runs" USING btree ("updated_at");
  CREATE INDEX "microsoft_mail_provisioning_runs_created_at_idx" ON "microsoft_mail_provisioning_runs" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_microsoft_mail_provisioning_fk" FOREIGN KEY ("microsoft_mail_provisioning_runs_id") REFERENCES "public"."microsoft_mail_provisioning_runs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_microsoft_mail_provisionin_idx" ON "payload_locked_documents_rels" USING btree ("microsoft_mail_provisioning_runs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "microsoft_mail_provisioning_runs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "microsoft_mail_provisioning_runs" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_microsoft_mail_provisioning_fk";
  
  DROP INDEX "payload_locked_documents_rels_microsoft_mail_provisionin_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "microsoft_mail_provisioning_runs_id";
  DROP TYPE "public"."enum_microsoft_mail_provisioning_runs_mode";
  DROP TYPE "public"."enum_microsoft_mail_provisioning_runs_state";`)
}
