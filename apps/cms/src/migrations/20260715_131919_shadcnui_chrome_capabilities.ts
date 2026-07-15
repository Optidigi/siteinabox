import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_nav_header_children_icon" AS ENUM('backpack', 'cake-slice', 'coffee', 'grape', 'hotel', 'ice-cream', 'map-pin', 'package', 'pizza', 'plane', 'sandwich', 'smile');
  CREATE TYPE "public"."enum_site_settings_nav_footer_children_icon" AS ENUM('backpack', 'cake-slice', 'coffee', 'grape', 'hotel', 'ice-cream', 'map-pin', 'package', 'pizza', 'plane', 'sandwich', 'smile');
  CREATE TYPE "public"."enum_site_settings_chrome_footer_newsletter_method" AS ENUM('GET', 'POST');
  ALTER TYPE "public"."enum_site_settings_nav_header_type" ADD VALUE 'group';
  ALTER TYPE "public"."enum_site_settings_nav_footer_type" ADD VALUE 'group';
  CREATE TABLE "site_settings_nav_header_children" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"description" varchar,
  	"icon" "enum_site_settings_nav_header_children_icon",
  	"external" boolean DEFAULT false
  );
  
  CREATE TABLE "site_settings_nav_footer_children" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"description" varchar,
  	"icon" "enum_site_settings_nav_footer_children_icon",
  	"external" boolean DEFAULT false
  );
  
  ALTER TABLE "tenants" DROP CONSTRAINT "tenants_active_snapshot_id_published_site_snapshots_id_fk";
  
  ALTER TABLE "tenants" DROP CONSTRAINT "tenants_domain_verification_checked_by_id_users_id_fk";
  
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_header_variant" SET DATA TYPE text;
  DROP TYPE "public"."enum_site_settings_chrome_header_variant";
  CREATE TYPE "public"."enum_site_settings_chrome_header_variant" AS ENUM('shadcnui-blocks.navbar-01', 'shadcnui-blocks.navbar-02', 'shadcnui-blocks.navbar-03', 'shadcnui-blocks.navbar-04', 'shadcnui-blocks.navbar-05', 'amicareZen');
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_header_variant" SET DATA TYPE "public"."enum_site_settings_chrome_header_variant" USING "chrome_header_variant"::"public"."enum_site_settings_chrome_header_variant";
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_footer_variant" SET DATA TYPE text;
  DROP TYPE "public"."enum_site_settings_chrome_footer_variant";
  CREATE TYPE "public"."enum_site_settings_chrome_footer_variant" AS ENUM('shadcnui-blocks.footer-01', 'shadcnui-blocks.footer-02', 'shadcnui-blocks.footer-03', 'shadcnui-blocks.footer-04', 'shadcnui-blocks.footer-05', 'shadcnui-blocks.footer-06', 'shadcnui-blocks.footer-07', 'amicareZen');
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_footer_variant" SET DATA TYPE "public"."enum_site_settings_chrome_footer_variant" USING "chrome_footer_variant"::"public"."enum_site_settings_chrome_footer_variant";
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_banner_variant" SET DATA TYPE text;
  DROP TYPE "public"."enum_site_settings_chrome_banner_variant";
  CREATE TYPE "public"."enum_site_settings_chrome_banner_variant" AS ENUM('shadcnui-blocks.banner-01', 'shadcnui-blocks.banner-02', 'shadcnui-blocks.banner-03', 'shadcnui-blocks.banner-04');
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_banner_variant" SET DATA TYPE "public"."enum_site_settings_chrome_banner_variant" USING "chrome_banner_variant"::"public"."enum_site_settings_chrome_banner_variant";
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_block_presets_block_type";
  CREATE TYPE "public"."enum_block_presets_block_type" AS ENUM('hero', 'featureList', 'testimonials', 'faq', 'cta', 'contactSection', 'pricing', 'stats', 'logoCloud', 'gallery', 'team', 'contentSection', 'blogCards');
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE "public"."enum_block_presets_block_type" USING "block_type"::"public"."enum_block_presets_block_type";
  ALTER TABLE "site_settings_chrome_footer_legal_links" ADD COLUMN "external" boolean DEFAULT false;
  ALTER TABLE "site_settings_nav_header" ADD COLUMN "description" varchar;
  ALTER TABLE "site_settings_nav_footer" ADD COLUMN "description" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "chrome_header_cta_external" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "chrome_header_secondary_action_label" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "chrome_header_secondary_action_href" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "chrome_header_secondary_action_external" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "chrome_header_search_enabled" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "chrome_header_search_action" varchar DEFAULT '/search';
  ALTER TABLE "site_settings" ADD COLUMN "chrome_header_search_placeholder" varchar DEFAULT 'Search';
  ALTER TABLE "site_settings" ADD COLUMN "chrome_footer_newsletter_title" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "chrome_footer_newsletter_placeholder" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "chrome_footer_newsletter_submit_label" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "chrome_footer_newsletter_action" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "chrome_footer_newsletter_method" "enum_site_settings_chrome_footer_newsletter_method";
  ALTER TABLE "site_settings" ADD COLUMN "chrome_banner_link_external" boolean DEFAULT false;
  ALTER TABLE "site_settings_nav_header_children" ADD CONSTRAINT "site_settings_nav_header_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings_nav_header"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_nav_footer_children" ADD CONSTRAINT "site_settings_nav_footer_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings_nav_footer"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "site_settings_nav_header_children_order_idx" ON "site_settings_nav_header_children" USING btree ("_order");
  CREATE INDEX "site_settings_nav_header_children_parent_id_idx" ON "site_settings_nav_header_children" USING btree ("_parent_id");
  CREATE INDEX "site_settings_nav_footer_children_order_idx" ON "site_settings_nav_footer_children" USING btree ("_order");
  CREATE INDEX "site_settings_nav_footer_children_parent_id_idx" ON "site_settings_nav_footer_children" USING btree ("_parent_id");
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_active_snapshot_id_published_site_snapshots_id_fk" FOREIGN KEY ("active_snapshot_id") REFERENCES "public"."published_site_snapshots"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_domain_verification_checked_by_id_users_id_fk" FOREIGN KEY ("domain_verification_checked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings_nav_header_children" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_nav_footer_children" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "site_settings_nav_header_children" CASCADE;
  DROP TABLE "site_settings_nav_footer_children" CASCADE;
  ALTER TABLE "tenants" DROP CONSTRAINT "tenants_active_snapshot_id_published_site_snapshots_id_fk";
  
  ALTER TABLE "tenants" DROP CONSTRAINT "tenants_domain_verification_checked_by_id_users_id_fk";
  
  ALTER TABLE "site_settings_nav_header" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "site_settings_nav_header" ALTER COLUMN "type" SET DEFAULT 'page'::text;
  DROP TYPE "public"."enum_site_settings_nav_header_type";
  CREATE TYPE "public"."enum_site_settings_nav_header_type" AS ENUM('page', 'section', 'custom');
  ALTER TABLE "site_settings_nav_header" ALTER COLUMN "type" SET DEFAULT 'page'::"public"."enum_site_settings_nav_header_type";
  ALTER TABLE "site_settings_nav_header" ALTER COLUMN "type" SET DATA TYPE "public"."enum_site_settings_nav_header_type" USING "type"::"public"."enum_site_settings_nav_header_type";
  ALTER TABLE "site_settings_nav_footer" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "site_settings_nav_footer" ALTER COLUMN "type" SET DEFAULT 'page'::text;
  DROP TYPE "public"."enum_site_settings_nav_footer_type";
  CREATE TYPE "public"."enum_site_settings_nav_footer_type" AS ENUM('page', 'section', 'custom');
  ALTER TABLE "site_settings_nav_footer" ALTER COLUMN "type" SET DEFAULT 'page'::"public"."enum_site_settings_nav_footer_type";
  ALTER TABLE "site_settings_nav_footer" ALTER COLUMN "type" SET DATA TYPE "public"."enum_site_settings_nav_footer_type" USING "type"::"public"."enum_site_settings_nav_footer_type";
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_header_variant" SET DATA TYPE text;
  DROP TYPE "public"."enum_site_settings_chrome_header_variant";
  CREATE TYPE "public"."enum_site_settings_chrome_header_variant" AS ENUM('default', 'amicareZen', 'tailwindplus.marketing.header.with-stacked-flyout-menu');
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_header_variant" SET DATA TYPE "public"."enum_site_settings_chrome_header_variant" USING "chrome_header_variant"::"public"."enum_site_settings_chrome_header_variant";
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_footer_variant" SET DATA TYPE text;
  DROP TYPE "public"."enum_site_settings_chrome_footer_variant";
  CREATE TYPE "public"."enum_site_settings_chrome_footer_variant" AS ENUM('default', 'amicareZen');
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_footer_variant" SET DATA TYPE "public"."enum_site_settings_chrome_footer_variant" USING "chrome_footer_variant"::"public"."enum_site_settings_chrome_footer_variant";
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_banner_variant" SET DATA TYPE text;
  DROP TYPE "public"."enum_site_settings_chrome_banner_variant";
  CREATE TYPE "public"."enum_site_settings_chrome_banner_variant" AS ENUM('default', 'tailwindplus.marketing.banner.with-button');
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_banner_variant" SET DATA TYPE "public"."enum_site_settings_chrome_banner_variant" USING "chrome_banner_variant"::"public"."enum_site_settings_chrome_banner_variant";
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_block_presets_block_type";
  CREATE TYPE "public"."enum_block_presets_block_type" AS ENUM('hero', 'featureList', 'testimonials', 'cta', 'contactSection', 'pricing', 'stats', 'logoCloud', 'team', 'newsletter', 'bentoGrid', 'contentSection', 'blogCards');
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE "public"."enum_block_presets_block_type" USING "block_type"::"public"."enum_block_presets_block_type";
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_active_snapshot_id_published_site_snapshots_id_fk" FOREIGN KEY ("active_snapshot_id") REFERENCES "public"."published_site_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_domain_verification_checked_by_id_users_id_fk" FOREIGN KEY ("domain_verification_checked_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_chrome_footer_legal_links" DROP COLUMN "external";
  ALTER TABLE "site_settings_nav_header" DROP COLUMN "description";
  ALTER TABLE "site_settings_nav_footer" DROP COLUMN "description";
  ALTER TABLE "site_settings" DROP COLUMN "chrome_header_cta_external";
  ALTER TABLE "site_settings" DROP COLUMN "chrome_header_secondary_action_label";
  ALTER TABLE "site_settings" DROP COLUMN "chrome_header_secondary_action_href";
  ALTER TABLE "site_settings" DROP COLUMN "chrome_header_secondary_action_external";
  ALTER TABLE "site_settings" DROP COLUMN "chrome_header_search_enabled";
  ALTER TABLE "site_settings" DROP COLUMN "chrome_header_search_action";
  ALTER TABLE "site_settings" DROP COLUMN "chrome_header_search_placeholder";
  ALTER TABLE "site_settings" DROP COLUMN "chrome_footer_newsletter_title";
  ALTER TABLE "site_settings" DROP COLUMN "chrome_footer_newsletter_placeholder";
  ALTER TABLE "site_settings" DROP COLUMN "chrome_footer_newsletter_submit_label";
  ALTER TABLE "site_settings" DROP COLUMN "chrome_footer_newsletter_action";
  ALTER TABLE "site_settings" DROP COLUMN "chrome_footer_newsletter_method";
  ALTER TABLE "site_settings" DROP COLUMN "chrome_banner_link_external";
  DROP TYPE "public"."enum_site_settings_nav_header_children_icon";
  DROP TYPE "public"."enum_site_settings_nav_footer_children_icon";
  DROP TYPE "public"."enum_site_settings_chrome_footer_newsletter_method";`)
}
