import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_managed_domains_custody_status" AS ENUM('managed', 'offboarding_requested', 'transfer_code_ready', 'transfer_pending', 'transferred_out', 'manual_review');
  ALTER TABLE "managed_domains" ADD COLUMN "custody_status" "enum_managed_domains_custody_status" DEFAULT 'managed' NOT NULL;
  ALTER TABLE "managed_domains" ADD COLUMN "offboarding_requested_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "offboarding_requested_by_email" varchar;
  ALTER TABLE "managed_domains" ADD COLUMN "offboarding_request_id" varchar;
  ALTER TABLE "managed_domains" ADD COLUMN "offboarding_reason" varchar;
  ALTER TABLE "managed_domains" ADD COLUMN "offboarding_continuity_evidence" jsonb;
  ALTER TABLE "managed_domains" ADD COLUMN "encrypted_transfer_out_code" varchar;
  ALTER TABLE "managed_domains" ADD COLUMN "transfer_out_code_fetched_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "transfer_out_code_last_revealed_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "transfer_out_code_deleted_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "transfer_out_started_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "transfer_out_provider_missing_count" numeric DEFAULT 0 NOT NULL;
  ALTER TABLE "managed_domains" ADD COLUMN "transfer_out_first_missing_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "transfer_out_last_checked_at" timestamp(3) with time zone;
  ALTER TABLE "managed_domains" ADD COLUMN "transfer_out_confirmed_at" timestamp(3) with time zone;
  CREATE INDEX "managed_domains_custody_status_idx" ON "managed_domains" USING btree ("custody_status");
  CREATE INDEX "managed_domains_offboarding_requested_at_idx" ON "managed_domains" USING btree ("offboarding_requested_at");
  CREATE INDEX "managed_domains_offboarding_requested_by_email_idx" ON "managed_domains" USING btree ("offboarding_requested_by_email");
  CREATE UNIQUE INDEX "managed_domains_offboarding_request_id_idx" ON "managed_domains" USING btree ("offboarding_request_id");
  CREATE INDEX "managed_domains_transfer_out_started_at_idx" ON "managed_domains" USING btree ("transfer_out_started_at");
  CREATE INDEX "managed_domains_transfer_out_confirmed_at_idx" ON "managed_domains" USING btree ("transfer_out_confirmed_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "managed_domains_custody_status_idx";
  DROP INDEX "managed_domains_offboarding_requested_at_idx";
  DROP INDEX "managed_domains_offboarding_requested_by_email_idx";
  DROP INDEX "managed_domains_offboarding_request_id_idx";
  DROP INDEX "managed_domains_transfer_out_started_at_idx";
  DROP INDEX "managed_domains_transfer_out_confirmed_at_idx";
  ALTER TABLE "managed_domains" DROP COLUMN "custody_status";
  ALTER TABLE "managed_domains" DROP COLUMN "offboarding_requested_at";
  ALTER TABLE "managed_domains" DROP COLUMN "offboarding_requested_by_email";
  ALTER TABLE "managed_domains" DROP COLUMN "offboarding_request_id";
  ALTER TABLE "managed_domains" DROP COLUMN "offboarding_reason";
  ALTER TABLE "managed_domains" DROP COLUMN "offboarding_continuity_evidence";
  ALTER TABLE "managed_domains" DROP COLUMN "encrypted_transfer_out_code";
  ALTER TABLE "managed_domains" DROP COLUMN "transfer_out_code_fetched_at";
  ALTER TABLE "managed_domains" DROP COLUMN "transfer_out_code_last_revealed_at";
  ALTER TABLE "managed_domains" DROP COLUMN "transfer_out_code_deleted_at";
  ALTER TABLE "managed_domains" DROP COLUMN "transfer_out_started_at";
  ALTER TABLE "managed_domains" DROP COLUMN "transfer_out_provider_missing_count";
  ALTER TABLE "managed_domains" DROP COLUMN "transfer_out_first_missing_at";
  ALTER TABLE "managed_domains" DROP COLUMN "transfer_out_last_checked_at";
  ALTER TABLE "managed_domains" DROP COLUMN "transfer_out_confirmed_at";
  DROP TYPE "public"."enum_managed_domains_custody_status";`)
}
