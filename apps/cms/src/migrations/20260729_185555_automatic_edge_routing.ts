import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_managed_domains_edge_routing_status" AS ENUM('pending', 'configured', 'active', 'failed');
  CREATE TYPE "public"."enum_managed_domains_admin_https_status" AS ENUM('pending', 'verified', 'failed');
  ALTER TABLE "managed_domains" ADD COLUMN "edge_routing_status" "enum_managed_domains_edge_routing_status" DEFAULT 'pending' NOT NULL;
  ALTER TABLE "managed_domains" ADD COLUMN "edge_routing_checked_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "edge_routing_evidence" jsonb;
  ALTER TABLE "managed_domains" ADD COLUMN "admin_https_status" "enum_managed_domains_admin_https_status" DEFAULT 'pending' NOT NULL;
  ALTER TABLE "managed_domains" ADD COLUMN "admin_https_checked_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "admin_https_evidence" jsonb;
  CREATE INDEX "managed_domains_edge_routing_status_idx" ON "managed_domains" USING btree ("edge_routing_status");
  CREATE INDEX "managed_domains_edge_routing_checked_at_idx" ON "managed_domains" USING btree ("edge_routing_checked_at");
  CREATE INDEX "managed_domains_admin_https_status_idx" ON "managed_domains" USING btree ("admin_https_status");
  CREATE INDEX "managed_domains_admin_https_checked_at_idx" ON "managed_domains" USING btree ("admin_https_checked_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "managed_domains_edge_routing_status_idx";
  DROP INDEX "managed_domains_edge_routing_checked_at_idx";
  DROP INDEX "managed_domains_admin_https_status_idx";
  DROP INDEX "managed_domains_admin_https_checked_at_idx";
  ALTER TABLE "managed_domains" DROP COLUMN "edge_routing_status";
  ALTER TABLE "managed_domains" DROP COLUMN "edge_routing_checked_at";
  ALTER TABLE "managed_domains" DROP COLUMN "edge_routing_evidence";
  ALTER TABLE "managed_domains" DROP COLUMN "admin_https_status";
  ALTER TABLE "managed_domains" DROP COLUMN "admin_https_checked_at";
  ALTER TABLE "managed_domains" DROP COLUMN "admin_https_evidence";
  DROP TYPE "public"."enum_managed_domains_edge_routing_status";
  DROP TYPE "public"."enum_managed_domains_admin_https_status";`)
}
