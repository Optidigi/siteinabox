import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_communication_preferences_suppression_reason" AS ENUM('user_unsubscribe', 'admin_suppression', 'provider_bounce', 'provider_complaint');
  CREATE TYPE "public"."enum_communication_preferences_locale" AS ENUM('nl', 'en');
  CREATE TYPE "public"."enum_communication_preference_events_channel" AS ENUM('email');
  CREATE TYPE "public"."enum_mail_logs_category" AS ENUM('security', 'transactional', 'legal', 'tenant_operational', 'product_notification', 'marketing');
  ALTER TYPE "public"."enum_communication_preference_events_preference_type" ADD VALUE 'product_notification' BEFORE 'directory';
  ALTER TYPE "public"."enum_communication_preference_events_preference_type" ADD VALUE 'tenant_notification' BEFORE 'directory';
  ALTER TYPE "public"."enum_communication_preference_events_preference_type" ADD VALUE 'locale' BEFORE 'directory';
  ALTER TYPE "public"."enum_communication_preference_events_action" ADD VALUE 'subscribe' BEFORE 'suppress';
  ALTER TYPE "public"."enum_communication_preference_events_action" ADD VALUE 'unsubscribe' BEFORE 'suppress';
  ALTER TYPE "public"."enum_communication_preference_events_action" ADD VALUE 'update' BEFORE 'suppress';
  ALTER TYPE "public"."enum_mail_logs_flow" ADD VALUE 'product.notification';
  ALTER TYPE "public"."enum_mail_logs_flow" ADD VALUE 'marketing.campaign';
  ALTER TYPE "public"."enum_mail_logs_status" ADD VALUE 'suppressed';
  ALTER TYPE "public"."enum_mail_logs_status" ADD VALUE 'preference_blocked';
  ALTER TYPE "public"."enum_mail_logs_status" ADD VALUE 'missing_subscription';
  CREATE TABLE "tenant_notification_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"subscription_key" varchar NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"user_id" integer NOT NULL,
  	"email" varchar NOT NULL,
  	"form_submissions" boolean DEFAULT false NOT NULL,
  	"publishing_and_site_status" boolean DEFAULT false NOT NULL,
  	"domain_and_dns" boolean DEFAULT false NOT NULL,
  	"billing_and_payments" boolean DEFAULT false NOT NULL,
  	"team_and_access" boolean DEFAULT false NOT NULL,
  	"operational_digest" boolean DEFAULT false NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "communication_preferences" ADD COLUMN "user_id" integer;
  ALTER TABLE "communication_preferences" ADD COLUMN "marketing_consent_version" varchar;
  ALTER TABLE "communication_preferences" ADD COLUMN "marketing_consent_at" timestamp(3) with time zone;
  ALTER TABLE "communication_preferences" ADD COLUMN "marketing_consent_source" varchar;
  ALTER TABLE "communication_preferences" ADD COLUMN "product_notifications" boolean DEFAULT false NOT NULL;
  ALTER TABLE "communication_preferences" ADD COLUMN "suppression_reason" "enum_communication_preferences_suppression_reason";
  ALTER TABLE "communication_preferences" ADD COLUMN "locale" "enum_communication_preferences_locale" DEFAULT 'nl' NOT NULL;
  ALTER TABLE "communication_preference_events" ADD COLUMN "tenant_id" integer;
  ALTER TABLE "communication_preference_events" ADD COLUMN "user_id" integer;
  ALTER TABLE "communication_preference_events" ADD COLUMN "channel" "enum_communication_preference_events_channel" DEFAULT 'email' NOT NULL;
  ALTER TABLE "communication_preference_events" ADD COLUMN "category" varchar;
  ALTER TABLE "communication_preference_events" ADD COLUMN "asserted_at" timestamp(3) with time zone;
  ALTER TABLE "communication_preference_events" ADD COLUMN "ip_address" varchar;
  ALTER TABLE "communication_preference_events" ADD COLUMN "user_agent" varchar;
  ALTER TABLE "communication_preference_events" ADD COLUMN "metadata" jsonb;
  ALTER TABLE "mail_logs" ADD COLUMN "category" "enum_mail_logs_category" DEFAULT 'tenant_operational' NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tenant_notification_subscriptions_id" integer;
  ALTER TABLE "tenant_notification_subscriptions" ADD CONSTRAINT "tenant_notification_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tenant_notification_subscriptions" ADD CONSTRAINT "tenant_notification_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "tenant_notification_subscriptions_subscription_key_idx" ON "tenant_notification_subscriptions" USING btree ("subscription_key");
  CREATE INDEX "tenant_notification_subscriptions_tenant_idx" ON "tenant_notification_subscriptions" USING btree ("tenant_id");
  CREATE INDEX "tenant_notification_subscriptions_user_idx" ON "tenant_notification_subscriptions" USING btree ("user_id");
  CREATE INDEX "tenant_notification_subscriptions_email_idx" ON "tenant_notification_subscriptions" USING btree ("email");
  CREATE INDEX "tenant_notification_subscriptions_form_submissions_idx" ON "tenant_notification_subscriptions" USING btree ("form_submissions");
  CREATE INDEX "tenant_notification_subscriptions_publishing_and_site_st_idx" ON "tenant_notification_subscriptions" USING btree ("publishing_and_site_status");
  CREATE INDEX "tenant_notification_subscriptions_domain_and_dns_idx" ON "tenant_notification_subscriptions" USING btree ("domain_and_dns");
  CREATE INDEX "tenant_notification_subscriptions_billing_and_payments_idx" ON "tenant_notification_subscriptions" USING btree ("billing_and_payments");
  CREATE INDEX "tenant_notification_subscriptions_team_and_access_idx" ON "tenant_notification_subscriptions" USING btree ("team_and_access");
  CREATE INDEX "tenant_notification_subscriptions_operational_digest_idx" ON "tenant_notification_subscriptions" USING btree ("operational_digest");
  CREATE INDEX "tenant_notification_subscriptions_updated_at_idx" ON "tenant_notification_subscriptions" USING btree ("updated_at");
  CREATE INDEX "tenant_notification_subscriptions_created_at_idx" ON "tenant_notification_subscriptions" USING btree ("created_at");
  ALTER TABLE "communication_preferences" ADD CONSTRAINT "communication_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "communication_preference_events" ADD CONSTRAINT "communication_preference_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "communication_preference_events" ADD CONSTRAINT "communication_preference_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenant_notification_subscri_fk" FOREIGN KEY ("tenant_notification_subscriptions_id") REFERENCES "public"."tenant_notification_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "communication_preferences_user_idx" ON "communication_preferences" USING btree ("user_id");
  CREATE INDEX "communication_preferences_marketing_consent_at_idx" ON "communication_preferences" USING btree ("marketing_consent_at");
  CREATE INDEX "communication_preferences_product_notifications_idx" ON "communication_preferences" USING btree ("product_notifications");
  CREATE INDEX "communication_preferences_suppression_reason_idx" ON "communication_preferences" USING btree ("suppression_reason");
  CREATE INDEX "communication_preferences_locale_idx" ON "communication_preferences" USING btree ("locale");
  CREATE INDEX "communication_preference_events_tenant_idx" ON "communication_preference_events" USING btree ("tenant_id");
  CREATE INDEX "communication_preference_events_user_idx" ON "communication_preference_events" USING btree ("user_id");
  CREATE INDEX "communication_preference_events_channel_idx" ON "communication_preference_events" USING btree ("channel");
  CREATE INDEX "communication_preference_events_category_idx" ON "communication_preference_events" USING btree ("category");
  CREATE INDEX "mail_logs_category_idx" ON "mail_logs" USING btree ("category");
  CREATE INDEX "payload_locked_documents_rels_tenant_notification_subscr_idx" ON "payload_locked_documents_rels" USING btree ("tenant_notification_subscriptions_id");`)

  // Preserve operational delivery for existing tenants while keeping optional
  // product and marketing mail disabled. Owners receive critical tenant mail;
  // editors receive form/publishing mail; viewers start unsubscribed.
  await db.execute(sql`
    INSERT INTO "tenant_notification_subscriptions" (
      "subscription_key", "tenant_id", "user_id", "email",
      "form_submissions", "publishing_and_site_status", "domain_and_dns",
      "billing_and_payments", "team_and_access", "operational_digest",
      "updated_at", "created_at"
    )
    SELECT
      'tenant:' || ut."tenant_id" || ':user:' || u."id",
      ut."tenant_id",
      u."id",
      lower(u."email"),
      u."role" IN ('owner', 'editor'),
      u."role" IN ('owner', 'editor'),
      u."role" = 'owner',
      u."role" = 'owner',
      u."role" = 'owner',
      false,
      now(),
      now()
    FROM "users" u
    JOIN "users_tenants" ut ON ut."_parent_id" = u."id"
    WHERE u."role" IN ('owner', 'editor', 'viewer')
    ON CONFLICT ("subscription_key") DO NOTHING;
  `)
  await db.execute(sql`
    CREATE FUNCTION "enforce_tenant_critical_email_recipients"() RETURNS trigger AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(73001, NEW."tenant_id");
      IF NOT EXISTS (SELECT 1 FROM "tenant_notification_subscriptions" WHERE "tenant_id" = NEW."tenant_id" AND "publishing_and_site_status")
        OR NOT EXISTS (SELECT 1 FROM "tenant_notification_subscriptions" WHERE "tenant_id" = NEW."tenant_id" AND "domain_and_dns")
        OR NOT EXISTS (SELECT 1 FROM "tenant_notification_subscriptions" WHERE "tenant_id" = NEW."tenant_id" AND "billing_and_payments")
        OR NOT EXISTS (SELECT 1 FROM "tenant_notification_subscriptions" WHERE "tenant_id" = NEW."tenant_id" AND "team_and_access")
      THEN
        RAISE EXCEPTION 'At least one recipient is required for every critical tenant email category';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER "tenant_critical_email_recipients"
    AFTER UPDATE OF "publishing_and_site_status", "domain_and_dns", "billing_and_payments", "team_and_access"
    ON "tenant_notification_subscriptions"
    FOR EACH ROW EXECUTE FUNCTION "enforce_tenant_critical_email_recipients"();
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TRIGGER IF EXISTS "tenant_critical_email_recipients" ON "tenant_notification_subscriptions";
  DROP FUNCTION IF EXISTS "enforce_tenant_critical_email_recipients"();
  ALTER TABLE "tenant_notification_subscriptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tenant_notification_subscri_fk";
  DROP TABLE "tenant_notification_subscriptions" CASCADE;
  ALTER TABLE "communication_preferences" DROP CONSTRAINT "communication_preferences_user_id_users_id_fk";
  
  ALTER TABLE "communication_preference_events" DROP CONSTRAINT "communication_preference_events_tenant_id_tenants_id_fk";
  
  ALTER TABLE "communication_preference_events" DROP CONSTRAINT "communication_preference_events_user_id_users_id_fk";
  
  DELETE FROM "communication_preference_events"
  WHERE "preference_type" IN ('product_notification', 'tenant_notification', 'locale')
     OR "action" IN ('subscribe', 'unsubscribe', 'update');
  UPDATE "mail_logs"
  SET "status" = 'failed'
  WHERE "status" IN ('suppressed', 'preference_blocked', 'missing_subscription');
  
  ALTER TABLE "communication_preference_events" ALTER COLUMN "preference_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_communication_preference_events_preference_type";
  CREATE TYPE "public"."enum_communication_preference_events_preference_type" AS ENUM('marketing', 'directory', 'suppression');
  ALTER TABLE "communication_preference_events" ALTER COLUMN "preference_type" SET DATA TYPE "public"."enum_communication_preference_events_preference_type" USING "preference_type"::"public"."enum_communication_preference_events_preference_type";
  ALTER TABLE "communication_preference_events" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_communication_preference_events_action";
  CREATE TYPE "public"."enum_communication_preference_events_action" AS ENUM('opt_in', 'opt_out', 'suppress', 'unsuppress');
  ALTER TABLE "communication_preference_events" ALTER COLUMN "action" SET DATA TYPE "public"."enum_communication_preference_events_action" USING "action"::"public"."enum_communication_preference_events_action";
  ALTER TABLE "mail_logs" ALTER COLUMN "status" SET DATA TYPE text;
  DROP TYPE "public"."enum_mail_logs_status";
  CREATE TYPE "public"."enum_mail_logs_status" AS ENUM('sent', 'failed');
  ALTER TABLE "mail_logs" ALTER COLUMN "status" SET DATA TYPE "public"."enum_mail_logs_status" USING "status"::"public"."enum_mail_logs_status";
  DROP INDEX "communication_preferences_user_idx";
  DROP INDEX "communication_preferences_marketing_consent_at_idx";
  DROP INDEX "communication_preferences_product_notifications_idx";
  DROP INDEX "communication_preferences_suppression_reason_idx";
  DROP INDEX "communication_preferences_locale_idx";
  DROP INDEX "communication_preference_events_tenant_idx";
  DROP INDEX "communication_preference_events_user_idx";
  DROP INDEX "communication_preference_events_channel_idx";
  DROP INDEX "communication_preference_events_category_idx";
  DROP INDEX "mail_logs_category_idx";
  DROP INDEX "payload_locked_documents_rels_tenant_notification_subscr_idx";
  ALTER TABLE "communication_preferences" DROP COLUMN "user_id";
  ALTER TABLE "communication_preferences" DROP COLUMN "marketing_consent_version";
  ALTER TABLE "communication_preferences" DROP COLUMN "marketing_consent_at";
  ALTER TABLE "communication_preferences" DROP COLUMN "marketing_consent_source";
  ALTER TABLE "communication_preferences" DROP COLUMN "product_notifications";
  ALTER TABLE "communication_preferences" DROP COLUMN "suppression_reason";
  ALTER TABLE "communication_preferences" DROP COLUMN "locale";
  ALTER TABLE "communication_preference_events" DROP COLUMN "tenant_id";
  ALTER TABLE "communication_preference_events" DROP COLUMN "user_id";
  ALTER TABLE "communication_preference_events" DROP COLUMN "channel";
  ALTER TABLE "communication_preference_events" DROP COLUMN "category";
  ALTER TABLE "communication_preference_events" DROP COLUMN "asserted_at";
  ALTER TABLE "communication_preference_events" DROP COLUMN "ip_address";
  ALTER TABLE "communication_preference_events" DROP COLUMN "user_agent";
  ALTER TABLE "communication_preference_events" DROP COLUMN "metadata";
  ALTER TABLE "mail_logs" DROP COLUMN "category";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tenant_notification_subscriptions_id";
  DROP TYPE "public"."enum_communication_preferences_suppression_reason";
  DROP TYPE "public"."enum_communication_preferences_locale";
  DROP TYPE "public"."enum_communication_preference_events_channel";
  DROP TYPE "public"."enum_mail_logs_category";`)
}
