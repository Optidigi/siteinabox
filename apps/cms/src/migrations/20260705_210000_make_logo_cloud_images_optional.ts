import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_logo_cloud_logos" ALTER COLUMN "image_id" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "pages_blocks_logo_cloud_logos"
    SET "image_id" = (SELECT "id" FROM "media" ORDER BY "id" LIMIT 1)
    WHERE "image_id" IS NULL
      AND EXISTS (SELECT 1 FROM "media");

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM "pages_blocks_logo_cloud_logos" WHERE "image_id" IS NULL) THEN
        ALTER TABLE "pages_blocks_logo_cloud_logos" ALTER COLUMN "image_id" SET NOT NULL;
      END IF;
    END $$;
  `)
}
