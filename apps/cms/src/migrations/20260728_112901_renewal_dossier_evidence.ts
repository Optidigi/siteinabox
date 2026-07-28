import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "domain_renewal_cycles" ADD COLUMN "provider_balance_available_minor" numeric;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "provider_balance_reserved_minor" numeric;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "provider_balance_currency" varchar;
  ALTER TABLE "domain_renewal_cycles" ADD COLUMN "provider_balance_checked_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "domain_renewal_cycles" DROP COLUMN "provider_balance_available_minor";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "provider_balance_reserved_minor";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "provider_balance_currency";
  ALTER TABLE "domain_renewal_cycles" DROP COLUMN "provider_balance_checked_at";`)
}
