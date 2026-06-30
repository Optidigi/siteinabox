import { sql } from "@payloadcms/db-postgres"
import type { MigrateUpArgs, MigrateDownArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ALTER COLUMN "language" SET DEFAULT 'nl';
    ALTER TABLE "site_settings" ALTER COLUMN "language" SET DEFAULT 'nl';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ALTER COLUMN "language" SET DEFAULT 'en';
    ALTER TABLE "site_settings" ALTER COLUMN "language" SET DEFAULT 'en';
  `)
}
