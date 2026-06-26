import type { MigrateUpArgs, MigrateDownArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_published_site_snapshots_status" AS ENUM('drafted', 'active', 'superseded', 'rolled_back');
    CREATE TYPE "public"."enum_tenants_domain_verification_status" AS ENUM('not_checked', 'verified', 'failed');

    CREATE TABLE "published_site_snapshots" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" integer NOT NULL,
      "source_generation_run_id" integer,
      "snapshot_key" varchar NOT NULL,
      "version" numeric NOT NULL,
      "status" "enum_published_site_snapshots_status" DEFAULT 'drafted' NOT NULL,
      "domain" varchar NOT NULL,
      "snapshot_hash" varchar NOT NULL,
      "snapshot" jsonb NOT NULL,
      "published_at" timestamp(3) with time zone NOT NULL,
      "activated_at" timestamp(3) with time zone,
      "rolled_back_at" timestamp(3) with time zone,
      "published_by_id" integer,
      "activation_reason" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "tenants" ADD COLUMN "active_snapshot_id" integer;
    ALTER TABLE "tenants" ADD COLUMN "activated_at" timestamp(3) with time zone;
    ALTER TABLE "tenants" ADD COLUMN "domain_verification_status" "enum_tenants_domain_verification_status" DEFAULT 'not_checked';
    ALTER TABLE "tenants" ADD COLUMN "domain_verification_checked_at" timestamp(3) with time zone;
    ALTER TABLE "tenants" ADD COLUMN "domain_verification_checked_by_id" integer;
    ALTER TABLE "tenants" ADD COLUMN "domain_verification_notes" varchar;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "published_site_snapshots_id" integer;

    ALTER TABLE "published_site_snapshots" ADD CONSTRAINT "published_site_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "published_site_snapshots" ADD CONSTRAINT "published_site_snapshots_source_generation_run_id_site_generation_runs_id_fk" FOREIGN KEY ("source_generation_run_id") REFERENCES "public"."site_generation_runs"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "published_site_snapshots" ADD CONSTRAINT "published_site_snapshots_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "tenants" ADD CONSTRAINT "tenants_active_snapshot_id_published_site_snapshots_id_fk" FOREIGN KEY ("active_snapshot_id") REFERENCES "public"."published_site_snapshots"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "tenants" ADD CONSTRAINT "tenants_domain_verification_checked_by_id_users_id_fk" FOREIGN KEY ("domain_verification_checked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_published_site_snapshots_fk" FOREIGN KEY ("published_site_snapshots_id") REFERENCES "public"."published_site_snapshots"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "published_site_snapshots_tenant_idx" ON "published_site_snapshots" USING btree ("tenant_id");
    CREATE INDEX "published_site_snapshots_source_generation_run_idx" ON "published_site_snapshots" USING btree ("source_generation_run_id");
    CREATE UNIQUE INDEX "published_site_snapshots_snapshot_key_idx" ON "published_site_snapshots" USING btree ("snapshot_key");
    CREATE INDEX "published_site_snapshots_status_idx" ON "published_site_snapshots" USING btree ("status");
    CREATE INDEX "published_site_snapshots_domain_idx" ON "published_site_snapshots" USING btree ("domain");
    CREATE INDEX "published_site_snapshots_published_by_idx" ON "published_site_snapshots" USING btree ("published_by_id");
    CREATE INDEX "published_site_snapshots_updated_at_idx" ON "published_site_snapshots" USING btree ("updated_at");
    CREATE INDEX "published_site_snapshots_created_at_idx" ON "published_site_snapshots" USING btree ("created_at");
    CREATE INDEX "tenants_active_snapshot_idx" ON "tenants" USING btree ("active_snapshot_id");
    CREATE INDEX "tenants_domain_verification_checked_by_idx" ON "tenants" USING btree ("domain_verification_checked_by_id");
    CREATE INDEX "payload_locked_documents_rels_published_site_snapshots_id_idx" ON "payload_locked_documents_rels" USING btree ("published_site_snapshots_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_published_site_snapshots_fk";
    ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "tenants_domain_verification_checked_by_id_users_id_fk";
    ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "tenants_active_snapshot_id_published_site_snapshots_id_fk";
    ALTER TABLE "published_site_snapshots" DROP CONSTRAINT IF EXISTS "published_site_snapshots_published_by_id_users_id_fk";
    ALTER TABLE "published_site_snapshots" DROP CONSTRAINT IF EXISTS "published_site_snapshots_source_generation_run_id_site_generation_runs_id_fk";
    ALTER TABLE "published_site_snapshots" DROP CONSTRAINT IF EXISTS "published_site_snapshots_tenant_id_tenants_id_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_published_site_snapshots_id_idx";
    DROP INDEX IF EXISTS "tenants_domain_verification_checked_by_idx";
    DROP INDEX IF EXISTS "tenants_active_snapshot_idx";
    DROP INDEX IF EXISTS "published_site_snapshots_created_at_idx";
    DROP INDEX IF EXISTS "published_site_snapshots_updated_at_idx";
    DROP INDEX IF EXISTS "published_site_snapshots_published_by_idx";
    DROP INDEX IF EXISTS "published_site_snapshots_domain_idx";
    DROP INDEX IF EXISTS "published_site_snapshots_status_idx";
    DROP INDEX IF EXISTS "published_site_snapshots_snapshot_key_idx";
    DROP INDEX IF EXISTS "published_site_snapshots_source_generation_run_idx";
    DROP INDEX IF EXISTS "published_site_snapshots_tenant_idx";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "published_site_snapshots_id";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "domain_verification_notes";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "domain_verification_checked_by_id";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "domain_verification_checked_at";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "domain_verification_status";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "activated_at";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "active_snapshot_id";
    DROP TABLE IF EXISTS "published_site_snapshots" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_tenants_domain_verification_status";
    DROP TYPE IF EXISTS "public"."enum_published_site_snapshots_status";
  `)
}
