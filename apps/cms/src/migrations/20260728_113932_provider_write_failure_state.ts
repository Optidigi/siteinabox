import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_domain_renewal_cycles_provider_write_state" ADD VALUE 'failed';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_write_state" SET DATA TYPE text;
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_write_state" SET DEFAULT 'not_required'::text;
  UPDATE "domain_renewal_cycles"
    SET "provider_write_state" = 'not_required'
    WHERE "provider_write_state" = 'failed';
  DROP TYPE "public"."enum_domain_renewal_cycles_provider_write_state";
  CREATE TYPE "public"."enum_domain_renewal_cycles_provider_write_state" AS ENUM('not_required', 'prepared', 'indeterminate', 'confirmed');
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_write_state" SET DEFAULT 'not_required'::"public"."enum_domain_renewal_cycles_provider_write_state";
  ALTER TABLE "domain_renewal_cycles" ALTER COLUMN "provider_write_state" SET DATA TYPE "public"."enum_domain_renewal_cycles_provider_write_state" USING "provider_write_state"::"public"."enum_domain_renewal_cycles_provider_write_state";`)
}
