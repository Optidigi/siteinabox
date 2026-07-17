import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

// OBS-20 — replace the flat `site_settings_navigation` array with the
// discriminated `site_settings_nav_header` / `site_settings_nav_footer`
// arrays (entry types: page | section | custom).
//
// The legacy table's rows are backfilled into nav_header before it is
// dropped: a `#anchor` href becomes a `section` entry (anchor = href minus
// the `#`), anything else becomes a `custom` entry (url = href). All legacy
// nav was the site's primary header nav, so everything lands in nav_header;
// nav_footer starts empty. The backfill is a no-op on a fresh/CI database
// where `site_settings_navigation` is empty.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_nav_header_type" AS ENUM('page', 'section', 'custom');
  CREATE TYPE "public"."enum_site_settings_nav_footer_type" AS ENUM('page', 'section', 'custom');
  CREATE TABLE "site_settings_nav_header" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_site_settings_nav_header_type" DEFAULT 'page' NOT NULL,
  	"page_id" integer,
  	"anchor" varchar,
  	"url" varchar,
  	"label" varchar,
  	"external" boolean DEFAULT false
  );

  CREATE TABLE "site_settings_nav_footer" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_site_settings_nav_footer_type" DEFAULT 'page' NOT NULL,
  	"page_id" integer,
  	"anchor" varchar,
  	"url" varchar,
  	"label" varchar,
  	"external" boolean DEFAULT false
  );

  INSERT INTO "site_settings_nav_header"
    ("_order", "_parent_id", "id", "type", "page_id", "anchor", "url", "label", "external")
  SELECT
    "_order",
    "_parent_id",
    "id",
    (CASE WHEN "href" LIKE '#%' THEN 'section' ELSE 'custom' END)::"enum_site_settings_nav_header_type",
    NULL,
    CASE WHEN "href" LIKE '#%' THEN substring("href" FROM 2) ELSE NULL END,
    CASE WHEN "href" LIKE '#%' THEN NULL ELSE "href" END,
    "label",
    COALESCE("external", false)
  FROM "site_settings_navigation";

  DROP TABLE "site_settings_navigation" CASCADE;
  ALTER TABLE "site_settings_nav_header" ADD CONSTRAINT "site_settings_nav_header_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings_nav_header" ADD CONSTRAINT "site_settings_nav_header_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_nav_footer" ADD CONSTRAINT "site_settings_nav_footer_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings_nav_footer" ADD CONSTRAINT "site_settings_nav_footer_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "site_settings_nav_header_order_idx" ON "site_settings_nav_header" USING btree ("_order");
  CREATE INDEX "site_settings_nav_header_parent_id_idx" ON "site_settings_nav_header" USING btree ("_parent_id");
  CREATE INDEX "site_settings_nav_header_page_idx" ON "site_settings_nav_header" USING btree ("page_id");
  CREATE INDEX "site_settings_nav_footer_order_idx" ON "site_settings_nav_footer" USING btree ("_order");
  CREATE INDEX "site_settings_nav_footer_parent_id_idx" ON "site_settings_nav_footer" USING btree ("_parent_id");
  CREATE INDEX "site_settings_nav_footer_page_idx" ON "site_settings_nav_footer" USING btree ("page_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Migration safety doctrine (docs/runbooks/deployment.md):
  // down() MUST throw, never reverse. This migration is a destructive table
  // restructure — it drops `site_settings_navigation` after backfilling its
  // rows. Restore from a pre-migration database snapshot rather than rolling
  // back.
  throw new Error(
    "down() not implemented — 20260519_220324_nav_restructure is a destructive " +
      "restructure (site_settings_navigation dropped, rows backfilled into " +
      "site_settings_nav_header). Restore from a pre-migration snapshot per " +
      "migration safety doctrine.",
  )
}
