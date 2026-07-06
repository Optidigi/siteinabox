import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_hero_links" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "href" varchar NOT NULL
    );

    DO $$ BEGIN ALTER TABLE "pages_blocks_hero_links" ADD CONSTRAINT "pages_blocks_hero_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_links_order_idx" ON "pages_blocks_hero_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_links_parent_id_idx" ON "pages_blocks_hero_links" USING btree ("_parent_id");

    ALTER TABLE "pages_blocks_pricing" ADD COLUMN IF NOT EXISTS "eyebrow" jsonb;
    ALTER TABLE "pages_blocks_content_section" ADD COLUMN IF NOT EXISTS "bridge" jsonb;
    ALTER TABLE "pages_blocks_blog_cards_posts" ADD COLUMN IF NOT EXISTS "author_role" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "pages_blocks_hero_links" CASCADE;
    ALTER TABLE "pages_blocks_pricing" DROP COLUMN IF EXISTS "eyebrow";
    ALTER TABLE "pages_blocks_content_section" DROP COLUMN IF EXISTS "bridge";
    ALTER TABLE "pages_blocks_blog_cards_posts" DROP COLUMN IF EXISTS "author_role";
  `)
}
