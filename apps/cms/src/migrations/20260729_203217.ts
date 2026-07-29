import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_accounting_documents_document_type" ADD VALUE 'payment_adjustment';
  ALTER TYPE "public"."enum_accounting_documents_reason" ADD VALUE 'overpayment_refund';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "accounting_documents" ALTER COLUMN "document_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_accounting_documents_document_type";
  CREATE TYPE "public"."enum_accounting_documents_document_type" AS ENUM('invoice', 'credit_note');
  ALTER TABLE "accounting_documents" ALTER COLUMN "document_type" SET DATA TYPE "public"."enum_accounting_documents_document_type" USING "document_type"::"public"."enum_accounting_documents_document_type";
  ALTER TABLE "accounting_documents" ALTER COLUMN "reason" SET DATA TYPE text;
  DROP TYPE "public"."enum_accounting_documents_reason";
  CREATE TYPE "public"."enum_accounting_documents_reason" AS ENUM('payment_collected', 'refund', 'chargeback');
  ALTER TABLE "accounting_documents" ALTER COLUMN "reason" SET DATA TYPE "public"."enum_accounting_documents_reason" USING "reason"::"public"."enum_accounting_documents_reason";`)
}
