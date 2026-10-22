import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" ALTER COLUMN "domain" DROP NOT NULL;
  ALTER TABLE "site_settings" ALTER COLUMN "site_url" DROP NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" ALTER COLUMN "domain" SET NOT NULL;
  ALTER TABLE "site_settings" ALTER COLUMN "site_url" SET NOT NULL;`)
}
