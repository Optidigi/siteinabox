import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_checkout_profiles_revision_reason" AS ENUM('initial_capture', 'customer_correction');
  ALTER TABLE "checkout_profiles" ADD COLUMN "supersedes_profile_key" varchar;
  ALTER TABLE "checkout_profiles" ADD COLUMN "revision_reason" "enum_checkout_profiles_revision_reason";
  ALTER TABLE "checkout_profiles" ADD COLUMN "actor_email" varchar;
  ALTER TABLE "checkout_profiles" ADD COLUMN "source_request_id" varchar;
  ALTER TABLE "checkout_profiles" ADD COLUMN "source_ip_address" varchar;
  ALTER TABLE "checkout_profiles" ADD COLUMN "source_user_agent" varchar;
  CREATE INDEX "checkout_profiles_supersedes_profile_key_idx" ON "checkout_profiles" USING btree ("supersedes_profile_key");
  CREATE INDEX "checkout_profiles_revision_reason_idx" ON "checkout_profiles" USING btree ("revision_reason");
  CREATE INDEX "checkout_profiles_actor_email_idx" ON "checkout_profiles" USING btree ("actor_email");
  CREATE INDEX "checkout_profiles_source_request_id_idx" ON "checkout_profiles" USING btree ("source_request_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "checkout_profiles_supersedes_profile_key_idx";
  DROP INDEX "checkout_profiles_revision_reason_idx";
  DROP INDEX "checkout_profiles_actor_email_idx";
  DROP INDEX "checkout_profiles_source_request_id_idx";
  ALTER TABLE "checkout_profiles" DROP COLUMN "supersedes_profile_key";
  ALTER TABLE "checkout_profiles" DROP COLUMN "revision_reason";
  ALTER TABLE "checkout_profiles" DROP COLUMN "actor_email";
  ALTER TABLE "checkout_profiles" DROP COLUMN "source_request_id";
  ALTER TABLE "checkout_profiles" DROP COLUMN "source_ip_address";
  ALTER TABLE "checkout_profiles" DROP COLUMN "source_user_agent";
  DROP TYPE "public"."enum_checkout_profiles_revision_reason";`)
}
