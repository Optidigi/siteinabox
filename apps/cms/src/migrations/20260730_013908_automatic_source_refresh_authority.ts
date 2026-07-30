import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "domain_migrations" ADD COLUMN "encrypted_source_refresh_authority" varchar;
  ALTER TABLE "domain_migrations" ADD COLUMN "source_refresh_authority_expires_at" timestamp(3) with time zone;
  ALTER TABLE "domain_migrations" ADD COLUMN "source_refresh_authority_deleted_at" timestamp(3) with time zone;
  ALTER TABLE "domain_migrations" ADD COLUMN "source_authority_last_verified_at" timestamp(3) with time zone;
  CREATE INDEX "domain_migrations_source_refresh_authority_expires_at_idx" ON "domain_migrations" USING btree ("source_refresh_authority_expires_at");
  CREATE INDEX "domain_migrations_source_authority_last_verified_at_idx" ON "domain_migrations" USING btree ("source_authority_last_verified_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM "domain_migrations"
      WHERE "encrypted_source_refresh_authority" IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Cannot roll back while encrypted source refresh authorities remain; drain or clear them and use forward recovery.';
    END IF;
  END
  $$;
  DROP INDEX "domain_migrations_source_refresh_authority_expires_at_idx";
  DROP INDEX "domain_migrations_source_authority_last_verified_at_idx";
  ALTER TABLE "domain_migrations" DROP COLUMN "encrypted_source_refresh_authority";
  ALTER TABLE "domain_migrations" DROP COLUMN "source_refresh_authority_expires_at";
  ALTER TABLE "domain_migrations" DROP COLUMN "source_refresh_authority_deleted_at";
  ALTER TABLE "domain_migrations" DROP COLUMN "source_authority_last_verified_at";`)
}
