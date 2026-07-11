import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_legal_requirements_resolution_basis" AS ENUM('explicit_acceptance', 'transaction_acceptance', 'qualifying_continued_use', 'notice_window_elapsed', 'objection', 'waiver');
  ALTER TYPE "public"."enum_legal_documents_customer_action" ADD VALUE 'notice_and_continued_use' BEFORE 'reaccept_on_next_transaction';
  ALTER TYPE "public"."enum_legal_requirements_action" ADD VALUE 'notice_and_continued_use' BEFORE 'reaccept_on_next_transaction';
  ALTER TYPE "public"."enum_legal_requirements_status" ADD VALUE 'objected' BEFORE 'failed';
  ALTER TABLE "legal_requirements" ADD COLUMN "objection_deadline_at" timestamp(3) with time zone;
  ALTER TABLE "legal_requirements" ADD COLUMN "notice_delivered_at" timestamp(3) with time zone;
  ALTER TABLE "legal_requirements" ADD COLUMN "objected_at" timestamp(3) with time zone;
  ALTER TABLE "legal_requirements" ADD COLUMN "qualifying_use_at" timestamp(3) with time zone;
  ALTER TABLE "legal_requirements" ADD COLUMN "deemed_accepted_at" timestamp(3) with time zone;
  ALTER TABLE "legal_requirements" ADD COLUMN "resolution_basis" "enum_legal_requirements_resolution_basis";
  ALTER TABLE "legal_requirements" ADD COLUMN "resolution_evidence" jsonb;
  CREATE INDEX "legal_requirements_objection_deadline_at_idx" ON "legal_requirements" USING btree ("objection_deadline_at");
  CREATE INDEX "legal_requirements_notice_delivered_at_idx" ON "legal_requirements" USING btree ("notice_delivered_at");
  CREATE INDEX "legal_requirements_objected_at_idx" ON "legal_requirements" USING btree ("objected_at");
  CREATE INDEX "legal_requirements_qualifying_use_at_idx" ON "legal_requirements" USING btree ("qualifying_use_at");
  CREATE INDEX "legal_requirements_deemed_accepted_at_idx" ON "legal_requirements" USING btree ("deemed_accepted_at");
  CREATE INDEX "legal_requirements_resolution_basis_idx" ON "legal_requirements" USING btree ("resolution_basis");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "legal_documents" ALTER COLUMN "customer_action" SET DATA TYPE text;
  DROP TYPE "public"."enum_legal_documents_customer_action";
  CREATE TYPE "public"."enum_legal_documents_customer_action" AS ENUM('none', 'publish_notice', 'direct_notice', 'reaccept_on_next_transaction', 'mandatory_reaccept');
  ALTER TABLE "legal_documents" ALTER COLUMN "customer_action" SET DATA TYPE "public"."enum_legal_documents_customer_action" USING "customer_action"::"public"."enum_legal_documents_customer_action";
  ALTER TABLE "legal_requirements" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_legal_requirements_action";
  CREATE TYPE "public"."enum_legal_requirements_action" AS ENUM('none', 'publish_notice', 'direct_notice', 'reaccept_on_next_transaction', 'mandatory_reaccept');
  ALTER TABLE "legal_requirements" ALTER COLUMN "action" SET DATA TYPE "public"."enum_legal_requirements_action" USING "action"::"public"."enum_legal_requirements_action";
  ALTER TABLE "legal_requirements" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "legal_requirements" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum_legal_requirements_status";
  CREATE TYPE "public"."enum_legal_requirements_status" AS ENUM('pending', 'notified', 'satisfied', 'waived', 'failed');
  ALTER TABLE "legal_requirements" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."enum_legal_requirements_status";
  ALTER TABLE "legal_requirements" ALTER COLUMN "status" SET DATA TYPE "public"."enum_legal_requirements_status" USING "status"::"public"."enum_legal_requirements_status";
  DROP INDEX "legal_requirements_objection_deadline_at_idx";
  DROP INDEX "legal_requirements_notice_delivered_at_idx";
  DROP INDEX "legal_requirements_objected_at_idx";
  DROP INDEX "legal_requirements_qualifying_use_at_idx";
  DROP INDEX "legal_requirements_deemed_accepted_at_idx";
  DROP INDEX "legal_requirements_resolution_basis_idx";
  ALTER TABLE "legal_requirements" DROP COLUMN "objection_deadline_at";
  ALTER TABLE "legal_requirements" DROP COLUMN "notice_delivered_at";
  ALTER TABLE "legal_requirements" DROP COLUMN "objected_at";
  ALTER TABLE "legal_requirements" DROP COLUMN "qualifying_use_at";
  ALTER TABLE "legal_requirements" DROP COLUMN "deemed_accepted_at";
  ALTER TABLE "legal_requirements" DROP COLUMN "resolution_basis";
  ALTER TABLE "legal_requirements" DROP COLUMN "resolution_evidence";
  DROP TYPE "public"."enum_legal_requirements_resolution_basis";`)
}
