import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "microsoft_mail_setup_tokens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"provisioning_run_id" integer NOT NULL,
  	"user_principal_name" varchar NOT NULL,
  	"encrypted_password" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"consumed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "microsoft_mail_setup_tokens_id" integer;
  ALTER TABLE "microsoft_mail_setup_tokens" ADD CONSTRAINT "microsoft_mail_setup_tokens_provisioning_run_id_microsoft_mail_provisioning_runs_id_fk" FOREIGN KEY ("provisioning_run_id") REFERENCES "public"."microsoft_mail_provisioning_runs"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "microsoft_mail_setup_tokens_token_hash_idx" ON "microsoft_mail_setup_tokens" USING btree ("token_hash");
  CREATE INDEX "microsoft_mail_setup_tokens_provisioning_run_idx" ON "microsoft_mail_setup_tokens" USING btree ("provisioning_run_id");
  CREATE INDEX "microsoft_mail_setup_tokens_expires_at_idx" ON "microsoft_mail_setup_tokens" USING btree ("expires_at");
  CREATE INDEX "microsoft_mail_setup_tokens_consumed_at_idx" ON "microsoft_mail_setup_tokens" USING btree ("consumed_at");
  CREATE INDEX "microsoft_mail_setup_tokens_updated_at_idx" ON "microsoft_mail_setup_tokens" USING btree ("updated_at");
  CREATE INDEX "microsoft_mail_setup_tokens_created_at_idx" ON "microsoft_mail_setup_tokens" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_microsoft_mail_setup_tokens_fk" FOREIGN KEY ("microsoft_mail_setup_tokens_id") REFERENCES "public"."microsoft_mail_setup_tokens"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_microsoft_mail_setup_token_idx" ON "payload_locked_documents_rels" USING btree ("microsoft_mail_setup_tokens_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "microsoft_mail_setup_tokens" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "microsoft_mail_setup_tokens" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_microsoft_mail_setup_tokens_fk";
  
  DROP INDEX "payload_locked_documents_rels_microsoft_mail_setup_token_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "microsoft_mail_setup_tokens_id";`)
}
