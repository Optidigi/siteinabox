import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_mail_logs_flow" AS ENUM(
      'platform.operational',
      'auth.magic_link',
      'auth.password_reset',
      'preview.magic_link',
      'preview.site_ready',
      'privacy.data_export',
      'intake.internal_notification',
      'forms.tenant_notification',
      'site.live_notice'
    );
    CREATE TYPE "public"."enum_mail_logs_status" AS ENUM('sent', 'failed');
    CREATE TYPE "public"."enum_mail_logs_retry_state" AS ENUM('none', 'retryable', 'permanent');

    CREATE TABLE "mail_logs" (
      "id" serial PRIMARY KEY NOT NULL,
      "flow" "enum_mail_logs_flow" NOT NULL,
      "tenant_id" integer,
      "sender" varchar NOT NULL,
      "reply_to" varchar,
      "recipient" varchar NOT NULL,
      "status" "enum_mail_logs_status" NOT NULL,
      "provider" varchar DEFAULT 'cloudflare-smtp' NOT NULL,
      "provider_message_id" varchar,
      "provider_error_code" varchar,
      "provider_error_message" varchar,
      "retry_state" "enum_mail_logs_retry_state" DEFAULT 'none' NOT NULL,
      "sent_at" timestamp(3) with time zone,
      "failed_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mail_logs_id" integer;
    ALTER TABLE "mail_logs" ADD CONSTRAINT "mail_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mail_logs_fk" FOREIGN KEY ("mail_logs_id") REFERENCES "public"."mail_logs"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "mail_logs_tenant_idx" ON "mail_logs" USING btree ("tenant_id");
    CREATE INDEX "mail_logs_flow_idx" ON "mail_logs" USING btree ("flow");
    CREATE INDEX "mail_logs_sender_idx" ON "mail_logs" USING btree ("sender");
    CREATE INDEX "mail_logs_recipient_idx" ON "mail_logs" USING btree ("recipient");
    CREATE INDEX "mail_logs_status_idx" ON "mail_logs" USING btree ("status");
    CREATE INDEX "mail_logs_provider_idx" ON "mail_logs" USING btree ("provider");
    CREATE INDEX "mail_logs_retry_state_idx" ON "mail_logs" USING btree ("retry_state");
    CREATE INDEX "mail_logs_updated_at_idx" ON "mail_logs" USING btree ("updated_at");
    CREATE INDEX "mail_logs_created_at_idx" ON "mail_logs" USING btree ("created_at");
    CREATE INDEX "payload_locked_documents_rels_mail_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("mail_logs_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_mail_logs_fk";
    ALTER TABLE "mail_logs" DROP CONSTRAINT IF EXISTS "mail_logs_tenant_id_tenants_id_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_mail_logs_id_idx";
    DROP INDEX IF EXISTS "mail_logs_created_at_idx";
    DROP INDEX IF EXISTS "mail_logs_updated_at_idx";
    DROP INDEX IF EXISTS "mail_logs_retry_state_idx";
    DROP INDEX IF EXISTS "mail_logs_provider_idx";
    DROP INDEX IF EXISTS "mail_logs_status_idx";
    DROP INDEX IF EXISTS "mail_logs_recipient_idx";
    DROP INDEX IF EXISTS "mail_logs_sender_idx";
    DROP INDEX IF EXISTS "mail_logs_flow_idx";
    DROP INDEX IF EXISTS "mail_logs_tenant_idx";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "mail_logs_id";
    DROP TABLE IF EXISTS "mail_logs" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_mail_logs_retry_state";
    DROP TYPE IF EXISTS "public"."enum_mail_logs_status";
    DROP TYPE IF EXISTS "public"."enum_mail_logs_flow";
  `)
}
