import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_managed_domains_transfer_out_code_delivery_status" AS ENUM('not_requested', 'provider_returned', 'registrant_email');
  ALTER TABLE "managed_domains" ADD COLUMN "transfer_out_code_delivery_status" "enum_managed_domains_transfer_out_code_delivery_status" DEFAULT 'not_requested' NOT NULL;
  CREATE INDEX "managed_domains_transfer_out_code_delivery_status_idx" ON "managed_domains" USING btree ("transfer_out_code_delivery_status");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "managed_domains_transfer_out_code_delivery_status_idx";
  ALTER TABLE "managed_domains" DROP COLUMN "transfer_out_code_delivery_status";
  DROP TYPE "public"."enum_managed_domains_transfer_out_code_delivery_status";`)
}
