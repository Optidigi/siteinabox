import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_operational_alerts_severity" AS ENUM('info', 'warning', 'error', 'critical');
    CREATE TYPE "public"."enum_operational_alerts_status" AS ENUM('open', 'acknowledged', 'resolved');
    CREATE TYPE "public"."enum_operational_alerts_source" AS ENUM('mail', 'forms', 'domains', 'payments', 'intake', 'system');

    CREATE TABLE "operational_alerts" (
      "id" serial PRIMARY KEY NOT NULL,
      "severity" "enum_operational_alerts_severity" DEFAULT 'warning' NOT NULL,
      "status" "enum_operational_alerts_status" DEFAULT 'open' NOT NULL,
      "source" "enum_operational_alerts_source" NOT NULL,
      "dedupe_key" varchar NOT NULL,
      "message" varchar NOT NULL,
      "tenant_id" integer,
      "metadata" jsonb,
      "occurrence_count" numeric DEFAULT 1 NOT NULL,
      "first_seen_at" timestamp(3) with time zone NOT NULL,
      "last_seen_at" timestamp(3) with time zone NOT NULL,
      "acknowledged_at" timestamp(3) with time zone,
      "acknowledged_by_id" integer,
      "resolved_at" timestamp(3) with time zone,
      "resolved_by_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "operational_alerts_dedupe_key_unique" UNIQUE("dedupe_key")
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "operational_alerts_id" integer;
    ALTER TABLE "operational_alerts" ADD CONSTRAINT "operational_alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "operational_alerts" ADD CONSTRAINT "operational_alerts_acknowledged_by_id_users_id_fk" FOREIGN KEY ("acknowledged_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "operational_alerts" ADD CONSTRAINT "operational_alerts_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_operational_alerts_fk" FOREIGN KEY ("operational_alerts_id") REFERENCES "public"."operational_alerts"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "operational_alerts_severity_idx" ON "operational_alerts" USING btree ("severity");
    CREATE INDEX "operational_alerts_status_idx" ON "operational_alerts" USING btree ("status");
    CREATE INDEX "operational_alerts_source_idx" ON "operational_alerts" USING btree ("source");
    CREATE INDEX "operational_alerts_dedupe_key_idx" ON "operational_alerts" USING btree ("dedupe_key");
    CREATE INDEX "operational_alerts_tenant_idx" ON "operational_alerts" USING btree ("tenant_id");
    CREATE INDEX "operational_alerts_first_seen_at_idx" ON "operational_alerts" USING btree ("first_seen_at");
    CREATE INDEX "operational_alerts_last_seen_at_idx" ON "operational_alerts" USING btree ("last_seen_at");
    CREATE INDEX "operational_alerts_acknowledged_by_idx" ON "operational_alerts" USING btree ("acknowledged_by_id");
    CREATE INDEX "operational_alerts_resolved_by_idx" ON "operational_alerts" USING btree ("resolved_by_id");
    CREATE INDEX "operational_alerts_updated_at_idx" ON "operational_alerts" USING btree ("updated_at");
    CREATE INDEX "operational_alerts_created_at_idx" ON "operational_alerts" USING btree ("created_at");
    CREATE INDEX "payload_locked_documents_rels_operational_alerts_id_idx" ON "payload_locked_documents_rels" USING btree ("operational_alerts_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_operational_alerts_fk";
    ALTER TABLE "operational_alerts" DROP CONSTRAINT IF EXISTS "operational_alerts_resolved_by_id_users_id_fk";
    ALTER TABLE "operational_alerts" DROP CONSTRAINT IF EXISTS "operational_alerts_acknowledged_by_id_users_id_fk";
    ALTER TABLE "operational_alerts" DROP CONSTRAINT IF EXISTS "operational_alerts_tenant_id_tenants_id_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_operational_alerts_id_idx";
    DROP INDEX IF EXISTS "operational_alerts_created_at_idx";
    DROP INDEX IF EXISTS "operational_alerts_updated_at_idx";
    DROP INDEX IF EXISTS "operational_alerts_resolved_by_idx";
    DROP INDEX IF EXISTS "operational_alerts_acknowledged_by_idx";
    DROP INDEX IF EXISTS "operational_alerts_last_seen_at_idx";
    DROP INDEX IF EXISTS "operational_alerts_first_seen_at_idx";
    DROP INDEX IF EXISTS "operational_alerts_tenant_idx";
    DROP INDEX IF EXISTS "operational_alerts_dedupe_key_idx";
    DROP INDEX IF EXISTS "operational_alerts_source_idx";
    DROP INDEX IF EXISTS "operational_alerts_status_idx";
    DROP INDEX IF EXISTS "operational_alerts_severity_idx";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "operational_alerts_id";
    DROP TABLE IF EXISTS "operational_alerts" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_operational_alerts_source";
    DROP TYPE IF EXISTS "public"."enum_operational_alerts_status";
    DROP TYPE IF EXISTS "public"."enum_operational_alerts_severity";
  `)
}
