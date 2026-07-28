import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "checkout_profiles" ADD COLUMN "first_name" varchar;
  ALTER TABLE "checkout_profiles" ADD COLUMN "last_name" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "checkout_profiles" DROP COLUMN "first_name";
  ALTER TABLE "checkout_profiles" DROP COLUMN "last_name";`)
}
