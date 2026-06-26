import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_generation_runs" ADD COLUMN "client_approval" jsonb;
    ALTER TABLE "site_generation_runs" ADD COLUMN "payment" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_generation_runs" DROP COLUMN "client_approval";
    ALTER TABLE "site_generation_runs" DROP COLUMN "payment";
  `)
}
