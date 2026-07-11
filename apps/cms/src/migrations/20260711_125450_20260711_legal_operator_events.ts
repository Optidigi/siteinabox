import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_legal_operator_events_action" AS ENUM('delivery_retry_requested');
  CREATE TABLE "legal_operator_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_key" varchar NOT NULL,
  	"action" "enum_legal_operator_events_action" NOT NULL,
  	"target_collection" varchar NOT NULL,
  	"target_id" varchar NOT NULL,
	"actor_user_id" integer,
  	"actor_email" varchar NOT NULL,
  	"reason" varchar NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"request_id" varchar NOT NULL,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "legal_operator_events_id" integer;
  ALTER TABLE "legal_operator_events" ADD CONSTRAINT "legal_operator_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "legal_operator_events_event_key_idx" ON "legal_operator_events" USING btree ("event_key");
  CREATE INDEX "legal_operator_events_action_idx" ON "legal_operator_events" USING btree ("action");
  CREATE INDEX "legal_operator_events_target_collection_idx" ON "legal_operator_events" USING btree ("target_collection");
  CREATE INDEX "legal_operator_events_target_id_idx" ON "legal_operator_events" USING btree ("target_id");
  CREATE INDEX "legal_operator_events_actor_user_idx" ON "legal_operator_events" USING btree ("actor_user_id");
  CREATE INDEX "legal_operator_events_actor_email_idx" ON "legal_operator_events" USING btree ("actor_email");
  CREATE INDEX "legal_operator_events_occurred_at_idx" ON "legal_operator_events" USING btree ("occurred_at");
  CREATE INDEX "legal_operator_events_request_id_idx" ON "legal_operator_events" USING btree ("request_id");
  CREATE INDEX "legal_operator_events_updated_at_idx" ON "legal_operator_events" USING btree ("updated_at");
  CREATE INDEX "legal_operator_events_created_at_idx" ON "legal_operator_events" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_operator_events_fk" FOREIGN KEY ("legal_operator_events_id") REFERENCES "public"."legal_operator_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_legal_operator_events_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_operator_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_legal_operator_events_fk";
  DROP INDEX "payload_locked_documents_rels_legal_operator_events_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "legal_operator_events_id";
  ALTER TABLE "legal_operator_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "legal_operator_events" CASCADE;
  DROP TYPE "public"."enum_legal_operator_events_action";`)
}
