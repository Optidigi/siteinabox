import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_domain_migrations_dnssec_phase" AS ENUM('source_unsigned', 'source_secure_preserved', 'source_ds_removal', 'source_ds_cache_wait', 'unsigned_cutover_ready', 'target_signing', 'target_ds_publication', 'target_chain_verifying', 'target_secure', 'rollback_target_ds_removal', 'rollback_target_ds_cache_wait', 'rollback_old_authority', 'rollback_source_ds_publication');
  CREATE TYPE "public"."enum_domain_migrations_dnssec_write_state" AS ENUM('not_started', 'prepared', 'indeterminate', 'confirmed');
  ALTER TABLE "domain_migrations" ADD COLUMN "dnssec_phase" "enum_domain_migrations_dnssec_phase" DEFAULT 'source_unsigned' NOT NULL;
  ALTER TABLE "domain_migrations" ADD COLUMN "dnssec_write_state" "enum_domain_migrations_dnssec_write_state" DEFAULT 'not_started' NOT NULL;
  ALTER TABLE "domain_migrations" ADD COLUMN "dnssec_write_requested_at" timestamp(3) with time zone;
  ALTER TABLE "domain_migrations" ADD COLUMN "dnssec_safe_after" timestamp(3) with time zone;
  ALTER TABLE "domain_migrations" ADD COLUMN "target_dnssec_evidence" jsonb;
  ALTER TABLE "domain_migrations" ADD COLUMN "dnssec_verification" jsonb;
  CREATE INDEX "domain_migrations_dnssec_phase_idx" ON "domain_migrations" USING btree ("dnssec_phase");
  CREATE INDEX "domain_migrations_dnssec_write_state_idx" ON "domain_migrations" USING btree ("dnssec_write_state");
  CREATE INDEX "domain_migrations_dnssec_safe_after_idx" ON "domain_migrations" USING btree ("dnssec_safe_after");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "domain_migrations_dnssec_phase_idx";
  DROP INDEX "domain_migrations_dnssec_write_state_idx";
  DROP INDEX "domain_migrations_dnssec_safe_after_idx";
  ALTER TABLE "domain_migrations" DROP COLUMN "dnssec_phase";
  ALTER TABLE "domain_migrations" DROP COLUMN "dnssec_write_state";
  ALTER TABLE "domain_migrations" DROP COLUMN "dnssec_write_requested_at";
  ALTER TABLE "domain_migrations" DROP COLUMN "dnssec_safe_after";
  ALTER TABLE "domain_migrations" DROP COLUMN "target_dnssec_evidence";
  ALTER TABLE "domain_migrations" DROP COLUMN "dnssec_verification";
  DROP TYPE "public"."enum_domain_migrations_dnssec_phase";
  DROP TYPE "public"."enum_domain_migrations_dnssec_write_state";`)
}
