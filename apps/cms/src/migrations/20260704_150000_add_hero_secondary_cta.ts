import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_hero" ADD COLUMN "secondary_label" varchar;
    ALTER TABLE "pages_blocks_hero" ADD COLUMN "secondary_href" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_hero" DROP COLUMN "secondary_label";
    ALTER TABLE "pages_blocks_hero" DROP COLUMN "secondary_href";
  `)
}
