import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_generation_runs" ALTER COLUMN "model" SET DEFAULT 'fixture:generic';
    ALTER TABLE "site_generation_runs" ALTER COLUMN "mock_fixture" SET DEFAULT 'generic';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_generation_runs" ALTER COLUMN "model" SET DEFAULT 'fixture:amblast';
    ALTER TABLE "site_generation_runs" ALTER COLUMN "mock_fixture" SET DEFAULT 'amblast';
  `)
}
