import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import { clearLegacyRelationalBlocks, stageLegacyRelationalBlocks } from './sitegenLegacyData'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // The generated DDL below drops legacy block tables and removes columns
  // whose meaning changed. Preserve every old row before running it, then
  // restore the meaningful fields after the final canonical enums exist.
  await stageLegacyRelationalBlocks(db)
  await clearLegacyRelationalBlocks(db)

  // Payload's schema diff cannot infer the semantic meaning of removed
  // provider/chrome variants. Normalize values while the old enums are still
  // present, then the generated DDL can safely replace those enums.
  await db.execute(sql`
    ALTER TABLE "site_settings" ALTER COLUMN "chrome_header_variant" SET DATA TYPE text;
    ALTER TABLE "site_settings" ALTER COLUMN "chrome_footer_variant" SET DATA TYPE text;
    ALTER TABLE "site_settings" ALTER COLUMN "chrome_banner_variant" SET DATA TYPE text;
    ALTER TABLE "site_settings" ALTER COLUMN "system_templates_not_found_variant" SET DATA TYPE text;
    ALTER TABLE "site_settings" ALTER COLUMN "maintenance_variant" SET DATA TYPE text;
    UPDATE "site_settings" SET "chrome_header_variant" = 'header-default' WHERE "chrome_header_variant" IS NULL OR "chrome_header_variant" <> 'header-default';
    UPDATE "site_settings" SET "chrome_footer_variant" = 'footer-default' WHERE "chrome_footer_variant" IS NULL OR "chrome_footer_variant" <> 'footer-default';
    UPDATE "site_settings" SET "chrome_banner_variant" = 'banner-default' WHERE "chrome_banner_variant" IS NULL OR "chrome_banner_variant" <> 'banner-default';
    UPDATE "site_settings" SET "system_templates_not_found_variant" = 'default' WHERE "system_templates_not_found_variant" IS NULL OR "system_templates_not_found_variant" <> 'default';
    UPDATE "site_settings" SET "maintenance_variant" = 'banner-default' WHERE "maintenance_variant" IS NULL OR "maintenance_variant" <> 'banner-default';
    ALTER TABLE "site_settings" ALTER COLUMN "system_templates_not_found_variant" DROP DEFAULT;
  `)

  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_blocks_hero_variant" AS ENUM('centered', 'split', 'portrait', 'showcase', 'compact');
  CREATE TYPE "public"."enum_pages_blocks_services_variant" AS ENUM('cards', 'rows', 'featured', 'numbered', 'split');
  CREATE TYPE "public"."enum_pages_blocks_about_variant" AS ENUM('portrait', 'story', 'highlights', 'profileCard', 'compact');
  CREATE TYPE "public"."enum_pages_blocks_process_variant" AS ENUM('steps', 'timeline', 'cards', 'split', 'checklist');
  CREATE TYPE "public"."enum_pages_blocks_work_variant" AS ENUM('grid', 'featured', 'stacked', 'masonry', 'caseStudies');
  CREATE TYPE "public"."enum_pages_blocks_reviews_variant" AS ENUM('cards', 'featured', 'list', 'wall', 'compact');
  CREATE TYPE "public"."enum_pages_blocks_pricing_variant" AS ENUM('cards', 'singleOffer', 'featured', 'comparison', 'startingAt');
  CREATE TYPE "public"."enum_pages_blocks_faq_variant" AS ENUM('accordion', 'columns', 'split', 'cards', 'compact');
  CREATE TYPE "public"."enum_pages_blocks_cta_variant" AS ENUM('centered', 'split', 'band', 'image', 'card');
  CREATE TYPE "public"."enum_pages_blocks_contact_contact_methods_kind" AS ENUM('email', 'phone', 'whatsapp', 'address', 'other');
  CREATE TYPE "public"."enum_pages_blocks_contact_form_fields_type" AS ENUM('text', 'email', 'tel', 'textarea', 'select', 'checkbox');
  CREATE TYPE "public"."enum_pages_blocks_contact_variant" AS ENUM('formSplit', 'detailsFirst', 'centered', 'serviceArea', 'appointment');
  CREATE TABLE "pages_blocks_services_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"action_label" varchar,
  	"action_href" varchar
  );
  
  CREATE TABLE "pages_blocks_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_services_variant" DEFAULT 'cards' NOT NULL,
  	"heading" varchar NOT NULL,
  	"intro" varchar,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_about_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "pages_blocks_about" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_about_variant" DEFAULT 'compact' NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"portrait_id" integer,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_process_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_process" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_process_variant" DEFAULT 'steps' NOT NULL,
  	"heading" varchar NOT NULL,
  	"intro" varchar,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_work_projects_media" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "pages_blocks_work_projects" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source_id" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"summary" varchar,
  	"action_label" varchar,
  	"action_href" varchar
  );
  
  CREATE TABLE "pages_blocks_work" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_work_variant" DEFAULT 'grid' NOT NULL,
  	"heading" varchar NOT NULL,
  	"intro" varchar,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_reviews_review_source_ids" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_reviews_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source_id" varchar NOT NULL,
  	"quote" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"context" varchar
  );
  
  CREATE TABLE "pages_blocks_reviews" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_reviews_variant" DEFAULT 'cards' NOT NULL,
  	"heading" varchar NOT NULL,
  	"intro" varchar,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_pricing_pricing_source_ids" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_pricing_offers_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_pricing_offers" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source_id" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"price" varchar NOT NULL,
  	"period" varchar,
  	"action_label" varchar,
  	"action_href" varchar,
  	"badge" varchar
  );
  
  CREATE TABLE "pages_blocks_contact_contact_methods" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kind" "enum_pages_blocks_contact_contact_methods_kind" NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL,
  	"href" varchar
  );
  
  CREATE TABLE "pages_blocks_contact_service_area" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_contact_form_fields_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_contact_form_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"type" "enum_pages_blocks_contact_form_fields_type" NOT NULL,
  	"required" boolean DEFAULT false,
  	"placeholder" varchar
  );
  
  CREATE TABLE "pages_blocks_contact" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_contact_variant" DEFAULT 'detailsFirst' NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar,
  	"opening_hours" varchar,
  	"booking_action_label" varchar,
  	"booking_action_href" varchar,
  	"form_form_name" varchar NOT NULL,
  	"form_submit_label" varchar NOT NULL,
  	"image_id" integer,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "pages_blocks_hero_pills" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_hero_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_hero_stats" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_hero_logos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_feature_list_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_feature_list" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_testimonials_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_testimonials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact_section_fields_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact_section_fields" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact_section_provider_hidden_fields" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact_section" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact_details_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact_details" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_pricing_plans_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_pricing_plans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_stats_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_stats" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_logo_cloud_logos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_logo_cloud" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_gallery_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_team_members_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_team_members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_team" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_newsletter_benefits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_newsletter" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_bento_grid_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_bento_grid" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_content_section_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_content_section" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_timeline_items_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_timeline_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_timeline" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_blog_cards_posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_blog_cards" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_hero_pills" CASCADE;
  DROP TABLE "pages_blocks_hero_links" CASCADE;
  DROP TABLE "pages_blocks_hero_stats" CASCADE;
  DROP TABLE "pages_blocks_hero_logos" CASCADE;
  DROP TABLE "pages_blocks_feature_list_features" CASCADE;
  DROP TABLE "pages_blocks_feature_list" CASCADE;
  DROP TABLE "pages_blocks_testimonials_items" CASCADE;
  DROP TABLE "pages_blocks_testimonials" CASCADE;
  DROP TABLE "pages_blocks_contact_section_fields_options" CASCADE;
  DROP TABLE "pages_blocks_contact_section_fields" CASCADE;
  DROP TABLE "pages_blocks_contact_section_provider_hidden_fields" CASCADE;
  DROP TABLE "pages_blocks_contact_section" CASCADE;
  DROP TABLE "pages_blocks_contact_details_items" CASCADE;
  DROP TABLE "pages_blocks_contact_details" CASCADE;
  DROP TABLE "pages_blocks_pricing_plans_features" CASCADE;
  DROP TABLE "pages_blocks_pricing_plans" CASCADE;
  DROP TABLE "pages_blocks_stats_items" CASCADE;
  DROP TABLE "pages_blocks_stats" CASCADE;
  DROP TABLE "pages_blocks_logo_cloud_logos" CASCADE;
  DROP TABLE "pages_blocks_logo_cloud" CASCADE;
  DROP TABLE "pages_blocks_gallery_images" CASCADE;
  DROP TABLE "pages_blocks_gallery" CASCADE;
  DROP TABLE "pages_blocks_team_members_links" CASCADE;
  DROP TABLE "pages_blocks_team_members" CASCADE;
  DROP TABLE "pages_blocks_team" CASCADE;
  DROP TABLE "pages_blocks_newsletter_benefits" CASCADE;
  DROP TABLE "pages_blocks_newsletter" CASCADE;
  DROP TABLE "pages_blocks_bento_grid_items" CASCADE;
  DROP TABLE "pages_blocks_bento_grid" CASCADE;
  DROP TABLE "pages_blocks_content_section_features" CASCADE;
  DROP TABLE "pages_blocks_content_section" CASCADE;
  DROP TABLE "pages_blocks_timeline_items_tags" CASCADE;
  DROP TABLE "pages_blocks_timeline_items" CASCADE;
  DROP TABLE "pages_blocks_timeline" CASCADE;
  DROP TABLE "pages_blocks_blog_cards_posts" CASCADE;
  DROP TABLE "pages_blocks_blog_cards" CASCADE;
  ALTER TABLE "pages_blocks_cta" DROP CONSTRAINT "pages_blocks_cta_background_image_id_media_id_fk";
  
  DROP TYPE "public"."enum_site_settings_chrome_header_variant";
  CREATE TYPE "public"."enum_site_settings_chrome_header_variant" AS ENUM('header-default');
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_header_variant" SET DATA TYPE "public"."enum_site_settings_chrome_header_variant" USING "chrome_header_variant"::"public"."enum_site_settings_chrome_header_variant";
  DROP TYPE "public"."enum_site_settings_chrome_footer_variant";
  CREATE TYPE "public"."enum_site_settings_chrome_footer_variant" AS ENUM('footer-default');
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_footer_variant" SET DATA TYPE "public"."enum_site_settings_chrome_footer_variant" USING "chrome_footer_variant"::"public"."enum_site_settings_chrome_footer_variant";
  DROP TYPE "public"."enum_site_settings_chrome_banner_variant";
  CREATE TYPE "public"."enum_site_settings_chrome_banner_variant" AS ENUM('banner-default');
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_banner_variant" SET DATA TYPE "public"."enum_site_settings_chrome_banner_variant" USING "chrome_banner_variant"::"public"."enum_site_settings_chrome_banner_variant";
  DROP TYPE "public"."enum_site_settings_system_templates_not_found_variant";
  CREATE TYPE "public"."enum_site_settings_system_templates_not_found_variant" AS ENUM('default');
  ALTER TABLE "site_settings" ALTER COLUMN "system_templates_not_found_variant" SET DEFAULT 'default'::"public"."enum_site_settings_system_templates_not_found_variant";
  ALTER TABLE "site_settings" ALTER COLUMN "system_templates_not_found_variant" SET DATA TYPE "public"."enum_site_settings_system_templates_not_found_variant" USING "system_templates_not_found_variant"::"public"."enum_site_settings_system_templates_not_found_variant";
  DROP TYPE "public"."enum_site_settings_maintenance_variant";
  CREATE TYPE "public"."enum_site_settings_maintenance_variant" AS ENUM('banner-default');
  ALTER TABLE "site_settings" ALTER COLUMN "maintenance_variant" SET DATA TYPE "public"."enum_site_settings_maintenance_variant" USING "maintenance_variant"::"public"."enum_site_settings_maintenance_variant";
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_block_presets_block_type";
  CREATE TYPE "public"."enum_block_presets_block_type" AS ENUM('hero', 'services', 'about', 'process', 'work', 'reviews', 'pricing', 'faq', 'cta', 'contact', 'richText');
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE "public"."enum_block_presets_block_type" USING "block_type"::"public"."enum_block_presets_block_type";
  DROP INDEX "pages_blocks_cta_background_image_idx";
  ALTER TABLE "pages_blocks_hero" ALTER COLUMN "eyebrow" SET DATA TYPE varchar;
  ALTER TABLE "pages_blocks_faq_items" ALTER COLUMN "question" SET DATA TYPE varchar;
  ALTER TABLE "pages_blocks_faq_items" ALTER COLUMN "question" SET NOT NULL;
  ALTER TABLE "pages_blocks_faq_items" ALTER COLUMN "answer" SET DATA TYPE varchar;
  ALTER TABLE "pages_blocks_faq_items" ALTER COLUMN "answer" SET NOT NULL;
  ALTER TABLE "pages_blocks_faq" ALTER COLUMN "intro" SET DATA TYPE varchar;
  ALTER TABLE "pages_blocks_pricing" ALTER COLUMN "intro" SET DATA TYPE varchar;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "variant" "enum_pages_blocks_hero_variant" DEFAULT 'centered' NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "heading" varchar NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "body" varchar NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "primary_action_label" varchar NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "primary_action_href" varchar NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "secondary_action_label" varchar;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "secondary_action_href" varchar;
  ALTER TABLE "pages_blocks_faq" ADD COLUMN "variant" "enum_pages_blocks_faq_variant" DEFAULT 'accordion' NOT NULL;
  ALTER TABLE "pages_blocks_faq" ADD COLUMN "heading" varchar NOT NULL;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "variant" "enum_pages_blocks_cta_variant" DEFAULT 'centered' NOT NULL;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "heading" varchar NOT NULL;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "body" varchar;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "primary_action_label" varchar NOT NULL;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "primary_action_href" varchar NOT NULL;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "secondary_action_label" varchar;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "secondary_action_href" varchar;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "image_id" integer;
  ALTER TABLE "pages_blocks_pricing" ADD COLUMN "variant" "enum_pages_blocks_pricing_variant" DEFAULT 'cards' NOT NULL;
  ALTER TABLE "pages_blocks_pricing" ADD COLUMN "heading" varchar NOT NULL;
  ALTER TABLE "pages_blocks_services_items" ADD CONSTRAINT "pages_blocks_services_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_services" ADD CONSTRAINT "pages_blocks_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_about_highlights" ADD CONSTRAINT "pages_blocks_about_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_about" ADD CONSTRAINT "pages_blocks_about_portrait_id_media_id_fk" FOREIGN KEY ("portrait_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_about" ADD CONSTRAINT "pages_blocks_about_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_process_steps" ADD CONSTRAINT "pages_blocks_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_process"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_process" ADD CONSTRAINT "pages_blocks_process_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_work_projects_media" ADD CONSTRAINT "pages_blocks_work_projects_media_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_work_projects_media" ADD CONSTRAINT "pages_blocks_work_projects_media_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_work_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_work_projects" ADD CONSTRAINT "pages_blocks_work_projects_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_work"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_work" ADD CONSTRAINT "pages_blocks_work_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_reviews_review_source_ids" ADD CONSTRAINT "pages_blocks_reviews_review_source_ids_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_reviews_items" ADD CONSTRAINT "pages_blocks_reviews_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_reviews" ADD CONSTRAINT "pages_blocks_reviews_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_pricing_pricing_source_ids" ADD CONSTRAINT "pages_blocks_pricing_pricing_source_ids_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_pricing_offers_features" ADD CONSTRAINT "pages_blocks_pricing_offers_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_pricing_offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_pricing_offers" ADD CONSTRAINT "pages_blocks_pricing_offers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_contact_methods" ADD CONSTRAINT "pages_blocks_contact_contact_methods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_service_area" ADD CONSTRAINT "pages_blocks_contact_service_area_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_form_fields_options" ADD CONSTRAINT "pages_blocks_contact_form_fields_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact_form_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_form_fields" ADD CONSTRAINT "pages_blocks_contact_form_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact" ADD CONSTRAINT "pages_blocks_contact_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact" ADD CONSTRAINT "pages_blocks_contact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_services_items_order_idx" ON "pages_blocks_services_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_services_items_parent_id_idx" ON "pages_blocks_services_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_services_order_idx" ON "pages_blocks_services" USING btree ("_order");
  CREATE INDEX "pages_blocks_services_parent_id_idx" ON "pages_blocks_services" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_services_path_idx" ON "pages_blocks_services" USING btree ("_path");
  CREATE INDEX "pages_blocks_about_highlights_order_idx" ON "pages_blocks_about_highlights" USING btree ("_order");
  CREATE INDEX "pages_blocks_about_highlights_parent_id_idx" ON "pages_blocks_about_highlights" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_about_order_idx" ON "pages_blocks_about" USING btree ("_order");
  CREATE INDEX "pages_blocks_about_parent_id_idx" ON "pages_blocks_about" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_about_path_idx" ON "pages_blocks_about" USING btree ("_path");
  CREATE INDEX "pages_blocks_about_portrait_idx" ON "pages_blocks_about" USING btree ("portrait_id");
  CREATE INDEX "pages_blocks_process_steps_order_idx" ON "pages_blocks_process_steps" USING btree ("_order");
  CREATE INDEX "pages_blocks_process_steps_parent_id_idx" ON "pages_blocks_process_steps" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_process_order_idx" ON "pages_blocks_process" USING btree ("_order");
  CREATE INDEX "pages_blocks_process_parent_id_idx" ON "pages_blocks_process" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_process_path_idx" ON "pages_blocks_process" USING btree ("_path");
  CREATE INDEX "pages_blocks_work_projects_media_order_idx" ON "pages_blocks_work_projects_media" USING btree ("_order");
  CREATE INDEX "pages_blocks_work_projects_media_parent_id_idx" ON "pages_blocks_work_projects_media" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_work_projects_media_image_idx" ON "pages_blocks_work_projects_media" USING btree ("image_id");
  CREATE INDEX "pages_blocks_work_projects_order_idx" ON "pages_blocks_work_projects" USING btree ("_order");
  CREATE INDEX "pages_blocks_work_projects_parent_id_idx" ON "pages_blocks_work_projects" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_work_order_idx" ON "pages_blocks_work" USING btree ("_order");
  CREATE INDEX "pages_blocks_work_parent_id_idx" ON "pages_blocks_work" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_work_path_idx" ON "pages_blocks_work" USING btree ("_path");
  CREATE INDEX "pages_blocks_reviews_review_source_ids_order_idx" ON "pages_blocks_reviews_review_source_ids" USING btree ("_order");
  CREATE INDEX "pages_blocks_reviews_review_source_ids_parent_id_idx" ON "pages_blocks_reviews_review_source_ids" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_reviews_items_order_idx" ON "pages_blocks_reviews_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_reviews_items_parent_id_idx" ON "pages_blocks_reviews_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_reviews_order_idx" ON "pages_blocks_reviews" USING btree ("_order");
  CREATE INDEX "pages_blocks_reviews_parent_id_idx" ON "pages_blocks_reviews" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_reviews_path_idx" ON "pages_blocks_reviews" USING btree ("_path");
  CREATE INDEX "pages_blocks_pricing_pricing_source_ids_order_idx" ON "pages_blocks_pricing_pricing_source_ids" USING btree ("_order");
  CREATE INDEX "pages_blocks_pricing_pricing_source_ids_parent_id_idx" ON "pages_blocks_pricing_pricing_source_ids" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_pricing_offers_features_order_idx" ON "pages_blocks_pricing_offers_features" USING btree ("_order");
  CREATE INDEX "pages_blocks_pricing_offers_features_parent_id_idx" ON "pages_blocks_pricing_offers_features" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_pricing_offers_order_idx" ON "pages_blocks_pricing_offers" USING btree ("_order");
  CREATE INDEX "pages_blocks_pricing_offers_parent_id_idx" ON "pages_blocks_pricing_offers" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_contact_methods_order_idx" ON "pages_blocks_contact_contact_methods" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_contact_methods_parent_id_idx" ON "pages_blocks_contact_contact_methods" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_service_area_order_idx" ON "pages_blocks_contact_service_area" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_service_area_parent_id_idx" ON "pages_blocks_contact_service_area" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_form_fields_options_order_idx" ON "pages_blocks_contact_form_fields_options" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_form_fields_options_parent_id_idx" ON "pages_blocks_contact_form_fields_options" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_form_fields_order_idx" ON "pages_blocks_contact_form_fields" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_form_fields_parent_id_idx" ON "pages_blocks_contact_form_fields" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_order_idx" ON "pages_blocks_contact" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_parent_id_idx" ON "pages_blocks_contact" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_path_idx" ON "pages_blocks_contact" USING btree ("_path");
  CREATE INDEX "pages_blocks_contact_image_idx" ON "pages_blocks_contact" USING btree ("image_id");
  ALTER TABLE "pages_blocks_cta" ADD CONSTRAINT "pages_blocks_cta_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pages_blocks_cta_image_idx" ON "pages_blocks_cta" USING btree ("image_id");
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "headline";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "subheadline";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "cta_label";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "cta_href";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "secondary_label";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "secondary_href";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "trust_label";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "design_variant";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "metadata";
  ALTER TABLE "pages_blocks_faq" DROP COLUMN "title";
  ALTER TABLE "pages_blocks_faq" DROP COLUMN "design_variant";
  ALTER TABLE "pages_blocks_faq" DROP COLUMN "metadata";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "eyebrow";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "headline";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "description";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "primary_label";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "primary_href";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "secondary_label";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "secondary_href";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "background_image_id";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "design_variant";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "metadata";
  ALTER TABLE "pages_blocks_rich_text" DROP COLUMN "design_variant";
  ALTER TABLE "pages_blocks_rich_text" DROP COLUMN "metadata";
  ALTER TABLE "pages_blocks_pricing" DROP COLUMN "eyebrow";
  ALTER TABLE "pages_blocks_pricing" DROP COLUMN "title";
  ALTER TABLE "pages_blocks_pricing" DROP COLUMN "design_variant";
  ALTER TABLE "pages_blocks_pricing" DROP COLUMN "metadata";
  DROP TYPE "public"."enum_pages_blocks_contact_section_fields_type";
  DROP TYPE "public"."enum_pages_blocks_contact_section_provider_provider";
  DROP TYPE "public"."enum_pages_blocks_contact_section_provider_method";
  DROP TYPE "public"."enum_pages_blocks_newsletter_provider_method";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_blocks_contact_section_fields_type" AS ENUM('text', 'email', 'tel', 'textarea', 'select', 'checkbox');
  CREATE TYPE "public"."enum_pages_blocks_contact_section_provider_provider" AS ENUM('siab', 'web3forms', 'custom', 'mailto');
  CREATE TYPE "public"."enum_pages_blocks_contact_section_provider_method" AS ENUM('GET', 'POST');
  CREATE TYPE "public"."enum_pages_blocks_newsletter_provider_method" AS ENUM('POST', 'GET');
  CREATE TABLE "pages_blocks_hero_pills" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_hero_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_hero_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_hero_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"image_id" integer,
  	"href" varchar
  );
  
  CREATE TABLE "pages_blocks_feature_list_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"description" jsonb,
  	"icon" varchar,
  	"image_id" integer,
  	"cta_label" varchar,
  	"cta_href" varchar,
  	"metric_value" varchar,
  	"metric_label" varchar
  );
  
  CREATE TABLE "pages_blocks_feature_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" jsonb,
  	"title" jsonb,
  	"intro" jsonb,
  	"image_id" integer,
  	"design_variant" varchar,
  	"metadata" jsonb,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_testimonials_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"quote" varchar NOT NULL,
  	"author" varchar NOT NULL,
  	"role" varchar,
  	"avatar_id" integer
  );
  
  CREATE TABLE "pages_blocks_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"intro" varchar,
  	"logo_id" integer,
  	"design_variant" varchar,
  	"metadata" jsonb,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_contact_section_fields_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_contact_section_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"type" "enum_pages_blocks_contact_section_fields_type" DEFAULT 'text' NOT NULL,
  	"required" boolean DEFAULT false,
  	"placeholder" varchar,
  	"max_length" numeric
  );
  
  CREATE TABLE "pages_blocks_contact_section_provider_hidden_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"value" varchar
  );
  
  CREATE TABLE "pages_blocks_contact_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"description" jsonb,
  	"form_name" varchar DEFAULT 'Contact form' NOT NULL,
  	"submit_label" varchar DEFAULT 'Send' NOT NULL,
  	"provider_provider" "enum_pages_blocks_contact_section_provider_provider",
  	"provider_action" varchar,
  	"provider_method" "enum_pages_blocks_contact_section_provider_method",
  	"provider_honeypot_field" varchar,
  	"provider_fallback_href" varchar,
  	"provider_success_message" varchar,
  	"provider_error_message" varchar,
  	"provider_requires_consent" boolean DEFAULT false,
  	"provider_analytics_enabled" boolean DEFAULT false,
  	"design_variant" varchar,
  	"metadata" jsonb,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_contact_details_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"value" varchar NOT NULL,
  	"href" varchar,
  	"icon" varchar
  );
  
  CREATE TABLE "pages_blocks_contact_details" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"description" jsonb,
  	"design_variant" varchar,
  	"metadata" jsonb,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_pricing_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" jsonb,
  	"included" boolean DEFAULT true
  );
  
  CREATE TABLE "pages_blocks_pricing_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"description" jsonb,
  	"price" varchar,
  	"period" varchar,
  	"cta_label" varchar,
  	"cta_href" varchar,
  	"badge" varchar,
  	"highlighted" boolean DEFAULT false
  );
  
  CREATE TABLE "pages_blocks_stats_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"description" jsonb
  );
  
  CREATE TABLE "pages_blocks_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"intro" jsonb,
  	"design_variant" varchar,
  	"metadata" jsonb,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_logo_cloud_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"image_id" integer,
  	"href" varchar
  );
  
  CREATE TABLE "pages_blocks_logo_cloud" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"intro" jsonb,
  	"cta_label" varchar,
  	"cta_href" varchar,
  	"design_variant" varchar,
  	"metadata" jsonb,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"caption" jsonb,
  	"link_label" varchar,
  	"link_href" varchar
  );
  
  CREATE TABLE "pages_blocks_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"intro" jsonb,
  	"cta_label" varchar,
  	"cta_href" varchar,
  	"design_variant" varchar,
  	"metadata" jsonb,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_team_members_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar
  );
  
  CREATE TABLE "pages_blocks_team_members" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" varchar,
  	"bio" jsonb,
  	"image_id" integer
  );
  
  CREATE TABLE "pages_blocks_team" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"intro" jsonb,
  	"design_variant" varchar,
  	"metadata" jsonb,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_newsletter_benefits" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"description" jsonb
  );
  
  CREATE TABLE "pages_blocks_newsletter" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"description" jsonb,
  	"email_label" varchar,
  	"email_placeholder" varchar,
  	"submit_label" varchar,
  	"provider_provider" varchar,
  	"provider_action" varchar,
  	"provider_method" "enum_pages_blocks_newsletter_provider_method",
  	"provider_analytics_enabled" boolean DEFAULT true,
  	"design_variant" varchar,
  	"metadata" jsonb,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_bento_grid_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"description" jsonb,
  	"image_id" integer
  );
  
  CREATE TABLE "pages_blocks_bento_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"intro" jsonb,
  	"design_variant" varchar,
  	"metadata" jsonb,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_content_section_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"description" jsonb
  );
  
  CREATE TABLE "pages_blocks_content_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" jsonb,
  	"title" jsonb,
  	"intro" jsonb,
  	"body" jsonb,
  	"bridge" jsonb,
  	"secondary_title" jsonb,
  	"secondary_body" jsonb,
  	"image_id" integer,
  	"design_variant" varchar,
  	"metadata" jsonb,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_timeline_items_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_timeline_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"label" varchar,
  	"date" varchar
  );
  
  CREATE TABLE "pages_blocks_timeline" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"intro" jsonb,
  	"design_variant" varchar,
  	"metadata" jsonb,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_blog_cards_posts" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"excerpt" jsonb,
  	"image_id" integer,
  	"href" varchar,
  	"date" varchar,
  	"author" varchar,
  	"author_role" varchar,
  	"cta_label" varchar,
  	"cta_href" varchar
  );
  
  CREATE TABLE "pages_blocks_blog_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" jsonb,
  	"intro" jsonb,
  	"cta_label" varchar,
  	"cta_href" varchar,
  	"secondary_label" varchar,
  	"secondary_href" varchar,
  	"design_variant" varchar,
  	"metadata" jsonb,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "pages_blocks_services_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_services" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_about_highlights" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_about" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_process_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_process" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_work_projects_media" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_work_projects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_work" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_reviews_review_source_ids" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_reviews_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_reviews" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_pricing_pricing_source_ids" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_pricing_offers_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_pricing_offers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact_contact_methods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact_service_area" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact_form_fields_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact_form_fields" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_services_items" CASCADE;
  DROP TABLE "pages_blocks_services" CASCADE;
  DROP TABLE "pages_blocks_about_highlights" CASCADE;
  DROP TABLE "pages_blocks_about" CASCADE;
  DROP TABLE "pages_blocks_process_steps" CASCADE;
  DROP TABLE "pages_blocks_process" CASCADE;
  DROP TABLE "pages_blocks_work_projects_media" CASCADE;
  DROP TABLE "pages_blocks_work_projects" CASCADE;
  DROP TABLE "pages_blocks_work" CASCADE;
  DROP TABLE "pages_blocks_reviews_review_source_ids" CASCADE;
  DROP TABLE "pages_blocks_reviews_items" CASCADE;
  DROP TABLE "pages_blocks_reviews" CASCADE;
  DROP TABLE "pages_blocks_pricing_pricing_source_ids" CASCADE;
  DROP TABLE "pages_blocks_pricing_offers_features" CASCADE;
  DROP TABLE "pages_blocks_pricing_offers" CASCADE;
  DROP TABLE "pages_blocks_contact_contact_methods" CASCADE;
  DROP TABLE "pages_blocks_contact_service_area" CASCADE;
  DROP TABLE "pages_blocks_contact_form_fields_options" CASCADE;
  DROP TABLE "pages_blocks_contact_form_fields" CASCADE;
  DROP TABLE "pages_blocks_contact" CASCADE;
  ALTER TABLE "pages_blocks_cta" DROP CONSTRAINT "pages_blocks_cta_image_id_media_id_fk";
  
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_header_variant" SET DATA TYPE text;
  DROP TYPE "public"."enum_site_settings_chrome_header_variant";
  CREATE TYPE "public"."enum_site_settings_chrome_header_variant" AS ENUM('shadcnui-blocks.navbar-01', 'shadcnui-blocks.navbar-02', 'shadcnui-blocks.navbar-03', 'shadcnui-blocks.navbar-04', 'shadcnui-blocks.navbar-05');
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_header_variant" SET DATA TYPE "public"."enum_site_settings_chrome_header_variant" USING "chrome_header_variant"::"public"."enum_site_settings_chrome_header_variant";
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_footer_variant" SET DATA TYPE text;
  DROP TYPE "public"."enum_site_settings_chrome_footer_variant";
  CREATE TYPE "public"."enum_site_settings_chrome_footer_variant" AS ENUM('shadcnui-blocks.footer-01', 'shadcnui-blocks.footer-02', 'shadcnui-blocks.footer-03', 'shadcnui-blocks.footer-04', 'shadcnui-blocks.footer-05', 'shadcnui-blocks.footer-06', 'shadcnui-blocks.footer-07');
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_footer_variant" SET DATA TYPE "public"."enum_site_settings_chrome_footer_variant" USING "chrome_footer_variant"::"public"."enum_site_settings_chrome_footer_variant";
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_banner_variant" SET DATA TYPE text;
  DROP TYPE "public"."enum_site_settings_chrome_banner_variant";
  CREATE TYPE "public"."enum_site_settings_chrome_banner_variant" AS ENUM('shadcnui-blocks.banner-01', 'shadcnui-blocks.banner-02', 'shadcnui-blocks.banner-03', 'shadcnui-blocks.banner-04');
  ALTER TABLE "site_settings" ALTER COLUMN "chrome_banner_variant" SET DATA TYPE "public"."enum_site_settings_chrome_banner_variant" USING "chrome_banner_variant"::"public"."enum_site_settings_chrome_banner_variant";
  ALTER TABLE "site_settings" ALTER COLUMN "system_templates_not_found_variant" SET DATA TYPE text;
  ALTER TABLE "site_settings" ALTER COLUMN "system_templates_not_found_variant" SET DEFAULT 'shadcnui-blocks.not-found-01'::text;
  DROP TYPE "public"."enum_site_settings_system_templates_not_found_variant";
  CREATE TYPE "public"."enum_site_settings_system_templates_not_found_variant" AS ENUM('shadcnui-blocks.not-found-01', 'shadcnui-blocks.not-found-02', 'shadcnui-blocks.not-found-03', 'shadcnui-blocks.not-found-04', 'shadcnui-blocks.not-found-05', 'shadcnui-blocks.not-found-06', 'shadcnui-blocks.not-found-07', 'shadcnui-blocks.not-found-08');
  ALTER TABLE "site_settings" ALTER COLUMN "system_templates_not_found_variant" SET DEFAULT 'shadcnui-blocks.not-found-01'::"public"."enum_site_settings_system_templates_not_found_variant";
  ALTER TABLE "site_settings" ALTER COLUMN "system_templates_not_found_variant" SET DATA TYPE "public"."enum_site_settings_system_templates_not_found_variant" USING "system_templates_not_found_variant"::"public"."enum_site_settings_system_templates_not_found_variant";
  ALTER TABLE "site_settings" ALTER COLUMN "maintenance_variant" SET DATA TYPE text;
  DROP TYPE "public"."enum_site_settings_maintenance_variant";
  CREATE TYPE "public"."enum_site_settings_maintenance_variant" AS ENUM('shadcnui-blocks.banner-01', 'shadcnui-blocks.banner-02', 'shadcnui-blocks.banner-03', 'shadcnui-blocks.banner-04');
  ALTER TABLE "site_settings" ALTER COLUMN "maintenance_variant" SET DATA TYPE "public"."enum_site_settings_maintenance_variant" USING "maintenance_variant"::"public"."enum_site_settings_maintenance_variant";
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_block_presets_block_type";
  CREATE TYPE "public"."enum_block_presets_block_type" AS ENUM('hero', 'featureList', 'testimonials', 'faq', 'cta', 'contactSection', 'contactDetails', 'pricing', 'stats', 'logoCloud', 'gallery', 'team', 'timeline', 'blogCards');
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE "public"."enum_block_presets_block_type" USING "block_type"::"public"."enum_block_presets_block_type";
  DROP INDEX "pages_blocks_cta_image_idx";
  ALTER TABLE "pages_blocks_hero" ALTER COLUMN "eyebrow" SET DATA TYPE jsonb;
  ALTER TABLE "pages_blocks_pricing" ALTER COLUMN "intro" SET DATA TYPE jsonb;
  ALTER TABLE "pages_blocks_faq_items" ALTER COLUMN "question" SET DATA TYPE jsonb;
  ALTER TABLE "pages_blocks_faq_items" ALTER COLUMN "question" DROP NOT NULL;
  ALTER TABLE "pages_blocks_faq_items" ALTER COLUMN "answer" SET DATA TYPE jsonb;
  ALTER TABLE "pages_blocks_faq_items" ALTER COLUMN "answer" DROP NOT NULL;
  ALTER TABLE "pages_blocks_faq" ALTER COLUMN "intro" SET DATA TYPE jsonb;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "headline" jsonb;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "subheadline" jsonb;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "cta_label" varchar;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "cta_href" varchar;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "secondary_label" varchar;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "secondary_href" varchar;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "trust_label" varchar;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "design_variant" varchar;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "metadata" jsonb;
  ALTER TABLE "pages_blocks_pricing" ADD COLUMN "eyebrow" jsonb;
  ALTER TABLE "pages_blocks_pricing" ADD COLUMN "title" jsonb;
  ALTER TABLE "pages_blocks_pricing" ADD COLUMN "design_variant" varchar;
  ALTER TABLE "pages_blocks_pricing" ADD COLUMN "metadata" jsonb;
  ALTER TABLE "pages_blocks_faq" ADD COLUMN "title" jsonb;
  ALTER TABLE "pages_blocks_faq" ADD COLUMN "design_variant" varchar;
  ALTER TABLE "pages_blocks_faq" ADD COLUMN "metadata" jsonb;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "eyebrow" jsonb;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "headline" jsonb;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "description" jsonb;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "primary_label" varchar;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "primary_href" varchar;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "secondary_label" varchar;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "secondary_href" varchar;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "background_image_id" integer;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "design_variant" varchar;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "metadata" jsonb;
  ALTER TABLE "pages_blocks_rich_text" ADD COLUMN "design_variant" varchar;
  ALTER TABLE "pages_blocks_rich_text" ADD COLUMN "metadata" jsonb;
  ALTER TABLE "pages_blocks_hero_pills" ADD CONSTRAINT "pages_blocks_hero_pills_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_links" ADD CONSTRAINT "pages_blocks_hero_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_stats" ADD CONSTRAINT "pages_blocks_hero_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_logos" ADD CONSTRAINT "pages_blocks_hero_logos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_logos" ADD CONSTRAINT "pages_blocks_hero_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_list_features" ADD CONSTRAINT "pages_blocks_feature_list_features_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_list_features" ADD CONSTRAINT "pages_blocks_feature_list_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_feature_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_list" ADD CONSTRAINT "pages_blocks_feature_list_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_list" ADD CONSTRAINT "pages_blocks_feature_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_testimonials_items" ADD CONSTRAINT "pages_blocks_testimonials_items_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_testimonials_items" ADD CONSTRAINT "pages_blocks_testimonials_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_testimonials" ADD CONSTRAINT "pages_blocks_testimonials_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_testimonials" ADD CONSTRAINT "pages_blocks_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_section_fields_options" ADD CONSTRAINT "pages_blocks_contact_section_fields_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact_section_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_section_fields" ADD CONSTRAINT "pages_blocks_contact_section_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact_section"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_section_provider_hidden_fields" ADD CONSTRAINT "pages_blocks_contact_section_provider_hidden_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact_section"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_section" ADD CONSTRAINT "pages_blocks_contact_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_details_items" ADD CONSTRAINT "pages_blocks_contact_details_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact_details"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_details" ADD CONSTRAINT "pages_blocks_contact_details_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_pricing_plans_features" ADD CONSTRAINT "pages_blocks_pricing_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_pricing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_pricing_plans" ADD CONSTRAINT "pages_blocks_pricing_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_stats_items" ADD CONSTRAINT "pages_blocks_stats_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_stats"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_stats" ADD CONSTRAINT "pages_blocks_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_logo_cloud_logos" ADD CONSTRAINT "pages_blocks_logo_cloud_logos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_logo_cloud_logos" ADD CONSTRAINT "pages_blocks_logo_cloud_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_logo_cloud"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_logo_cloud" ADD CONSTRAINT "pages_blocks_logo_cloud_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_gallery_images" ADD CONSTRAINT "pages_blocks_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_gallery_images" ADD CONSTRAINT "pages_blocks_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_gallery" ADD CONSTRAINT "pages_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_team_members_links" ADD CONSTRAINT "pages_blocks_team_members_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_team_members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_team_members" ADD CONSTRAINT "pages_blocks_team_members_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_team_members" ADD CONSTRAINT "pages_blocks_team_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_team"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_team" ADD CONSTRAINT "pages_blocks_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_newsletter_benefits" ADD CONSTRAINT "pages_blocks_newsletter_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_newsletter"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_newsletter" ADD CONSTRAINT "pages_blocks_newsletter_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_bento_grid_items" ADD CONSTRAINT "pages_blocks_bento_grid_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_bento_grid_items" ADD CONSTRAINT "pages_blocks_bento_grid_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_bento_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_bento_grid" ADD CONSTRAINT "pages_blocks_bento_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_content_section_features" ADD CONSTRAINT "pages_blocks_content_section_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_content_section"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_content_section" ADD CONSTRAINT "pages_blocks_content_section_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_content_section" ADD CONSTRAINT "pages_blocks_content_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_timeline_items_tags" ADD CONSTRAINT "pages_blocks_timeline_items_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_timeline_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_timeline_items" ADD CONSTRAINT "pages_blocks_timeline_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_timeline"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_timeline" ADD CONSTRAINT "pages_blocks_timeline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_blog_cards_posts" ADD CONSTRAINT "pages_blocks_blog_cards_posts_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_blog_cards_posts" ADD CONSTRAINT "pages_blocks_blog_cards_posts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_blog_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_blog_cards" ADD CONSTRAINT "pages_blocks_blog_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_hero_pills_order_idx" ON "pages_blocks_hero_pills" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_pills_parent_id_idx" ON "pages_blocks_hero_pills" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_links_order_idx" ON "pages_blocks_hero_links" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_links_parent_id_idx" ON "pages_blocks_hero_links" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_stats_order_idx" ON "pages_blocks_hero_stats" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_stats_parent_id_idx" ON "pages_blocks_hero_stats" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_logos_order_idx" ON "pages_blocks_hero_logos" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_logos_parent_id_idx" ON "pages_blocks_hero_logos" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_logos_image_idx" ON "pages_blocks_hero_logos" USING btree ("image_id");
  CREATE INDEX "pages_blocks_feature_list_features_order_idx" ON "pages_blocks_feature_list_features" USING btree ("_order");
  CREATE INDEX "pages_blocks_feature_list_features_parent_id_idx" ON "pages_blocks_feature_list_features" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_feature_list_features_image_idx" ON "pages_blocks_feature_list_features" USING btree ("image_id");
  CREATE INDEX "pages_blocks_feature_list_order_idx" ON "pages_blocks_feature_list" USING btree ("_order");
  CREATE INDEX "pages_blocks_feature_list_parent_id_idx" ON "pages_blocks_feature_list" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_feature_list_path_idx" ON "pages_blocks_feature_list" USING btree ("_path");
  CREATE INDEX "pages_blocks_feature_list_image_idx" ON "pages_blocks_feature_list" USING btree ("image_id");
  CREATE INDEX "pages_blocks_testimonials_items_order_idx" ON "pages_blocks_testimonials_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_testimonials_items_parent_id_idx" ON "pages_blocks_testimonials_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_testimonials_items_avatar_idx" ON "pages_blocks_testimonials_items" USING btree ("avatar_id");
  CREATE INDEX "pages_blocks_testimonials_order_idx" ON "pages_blocks_testimonials" USING btree ("_order");
  CREATE INDEX "pages_blocks_testimonials_parent_id_idx" ON "pages_blocks_testimonials" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_testimonials_path_idx" ON "pages_blocks_testimonials" USING btree ("_path");
  CREATE INDEX "pages_blocks_testimonials_logo_idx" ON "pages_blocks_testimonials" USING btree ("logo_id");
  CREATE INDEX "pages_blocks_contact_section_fields_options_order_idx" ON "pages_blocks_contact_section_fields_options" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_section_fields_options_parent_id_idx" ON "pages_blocks_contact_section_fields_options" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_section_fields_order_idx" ON "pages_blocks_contact_section_fields" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_section_fields_parent_id_idx" ON "pages_blocks_contact_section_fields" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_section_provider_hidden_fields_order_idx" ON "pages_blocks_contact_section_provider_hidden_fields" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_section_provider_hidden_fields_parent_id_idx" ON "pages_blocks_contact_section_provider_hidden_fields" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_section_order_idx" ON "pages_blocks_contact_section" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_section_parent_id_idx" ON "pages_blocks_contact_section" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_section_path_idx" ON "pages_blocks_contact_section" USING btree ("_path");
  CREATE INDEX "pages_blocks_contact_details_items_order_idx" ON "pages_blocks_contact_details_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_details_items_parent_id_idx" ON "pages_blocks_contact_details_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_details_order_idx" ON "pages_blocks_contact_details" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_details_parent_id_idx" ON "pages_blocks_contact_details" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_details_path_idx" ON "pages_blocks_contact_details" USING btree ("_path");
  CREATE INDEX "pages_blocks_pricing_plans_features_order_idx" ON "pages_blocks_pricing_plans_features" USING btree ("_order");
  CREATE INDEX "pages_blocks_pricing_plans_features_parent_id_idx" ON "pages_blocks_pricing_plans_features" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_pricing_plans_order_idx" ON "pages_blocks_pricing_plans" USING btree ("_order");
  CREATE INDEX "pages_blocks_pricing_plans_parent_id_idx" ON "pages_blocks_pricing_plans" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_stats_items_order_idx" ON "pages_blocks_stats_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_stats_items_parent_id_idx" ON "pages_blocks_stats_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_stats_order_idx" ON "pages_blocks_stats" USING btree ("_order");
  CREATE INDEX "pages_blocks_stats_parent_id_idx" ON "pages_blocks_stats" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_stats_path_idx" ON "pages_blocks_stats" USING btree ("_path");
  CREATE INDEX "pages_blocks_logo_cloud_logos_order_idx" ON "pages_blocks_logo_cloud_logos" USING btree ("_order");
  CREATE INDEX "pages_blocks_logo_cloud_logos_parent_id_idx" ON "pages_blocks_logo_cloud_logos" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_logo_cloud_logos_image_idx" ON "pages_blocks_logo_cloud_logos" USING btree ("image_id");
  CREATE INDEX "pages_blocks_logo_cloud_order_idx" ON "pages_blocks_logo_cloud" USING btree ("_order");
  CREATE INDEX "pages_blocks_logo_cloud_parent_id_idx" ON "pages_blocks_logo_cloud" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_logo_cloud_path_idx" ON "pages_blocks_logo_cloud" USING btree ("_path");
  CREATE INDEX "pages_blocks_gallery_images_order_idx" ON "pages_blocks_gallery_images" USING btree ("_order");
  CREATE INDEX "pages_blocks_gallery_images_parent_id_idx" ON "pages_blocks_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_gallery_images_image_idx" ON "pages_blocks_gallery_images" USING btree ("image_id");
  CREATE INDEX "pages_blocks_gallery_order_idx" ON "pages_blocks_gallery" USING btree ("_order");
  CREATE INDEX "pages_blocks_gallery_parent_id_idx" ON "pages_blocks_gallery" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_gallery_path_idx" ON "pages_blocks_gallery" USING btree ("_path");
  CREATE INDEX "pages_blocks_team_members_links_order_idx" ON "pages_blocks_team_members_links" USING btree ("_order");
  CREATE INDEX "pages_blocks_team_members_links_parent_id_idx" ON "pages_blocks_team_members_links" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_team_members_order_idx" ON "pages_blocks_team_members" USING btree ("_order");
  CREATE INDEX "pages_blocks_team_members_parent_id_idx" ON "pages_blocks_team_members" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_team_members_image_idx" ON "pages_blocks_team_members" USING btree ("image_id");
  CREATE INDEX "pages_blocks_team_order_idx" ON "pages_blocks_team" USING btree ("_order");
  CREATE INDEX "pages_blocks_team_parent_id_idx" ON "pages_blocks_team" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_team_path_idx" ON "pages_blocks_team" USING btree ("_path");
  CREATE INDEX "pages_blocks_newsletter_benefits_order_idx" ON "pages_blocks_newsletter_benefits" USING btree ("_order");
  CREATE INDEX "pages_blocks_newsletter_benefits_parent_id_idx" ON "pages_blocks_newsletter_benefits" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_newsletter_order_idx" ON "pages_blocks_newsletter" USING btree ("_order");
  CREATE INDEX "pages_blocks_newsletter_parent_id_idx" ON "pages_blocks_newsletter" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_newsletter_path_idx" ON "pages_blocks_newsletter" USING btree ("_path");
  CREATE INDEX "pages_blocks_bento_grid_items_order_idx" ON "pages_blocks_bento_grid_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_bento_grid_items_parent_id_idx" ON "pages_blocks_bento_grid_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_bento_grid_items_image_idx" ON "pages_blocks_bento_grid_items" USING btree ("image_id");
  CREATE INDEX "pages_blocks_bento_grid_order_idx" ON "pages_blocks_bento_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_bento_grid_parent_id_idx" ON "pages_blocks_bento_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_bento_grid_path_idx" ON "pages_blocks_bento_grid" USING btree ("_path");
  CREATE INDEX "pages_blocks_content_section_features_order_idx" ON "pages_blocks_content_section_features" USING btree ("_order");
  CREATE INDEX "pages_blocks_content_section_features_parent_id_idx" ON "pages_blocks_content_section_features" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_content_section_order_idx" ON "pages_blocks_content_section" USING btree ("_order");
  CREATE INDEX "pages_blocks_content_section_parent_id_idx" ON "pages_blocks_content_section" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_content_section_path_idx" ON "pages_blocks_content_section" USING btree ("_path");
  CREATE INDEX "pages_blocks_content_section_image_idx" ON "pages_blocks_content_section" USING btree ("image_id");
  CREATE INDEX "pages_blocks_timeline_items_tags_order_idx" ON "pages_blocks_timeline_items_tags" USING btree ("_order");
  CREATE INDEX "pages_blocks_timeline_items_tags_parent_id_idx" ON "pages_blocks_timeline_items_tags" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_timeline_items_order_idx" ON "pages_blocks_timeline_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_timeline_items_parent_id_idx" ON "pages_blocks_timeline_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_timeline_order_idx" ON "pages_blocks_timeline" USING btree ("_order");
  CREATE INDEX "pages_blocks_timeline_parent_id_idx" ON "pages_blocks_timeline" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_timeline_path_idx" ON "pages_blocks_timeline" USING btree ("_path");
  CREATE INDEX "pages_blocks_blog_cards_posts_order_idx" ON "pages_blocks_blog_cards_posts" USING btree ("_order");
  CREATE INDEX "pages_blocks_blog_cards_posts_parent_id_idx" ON "pages_blocks_blog_cards_posts" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_blog_cards_posts_image_idx" ON "pages_blocks_blog_cards_posts" USING btree ("image_id");
  CREATE INDEX "pages_blocks_blog_cards_order_idx" ON "pages_blocks_blog_cards" USING btree ("_order");
  CREATE INDEX "pages_blocks_blog_cards_parent_id_idx" ON "pages_blocks_blog_cards" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_blog_cards_path_idx" ON "pages_blocks_blog_cards" USING btree ("_path");
  ALTER TABLE "pages_blocks_cta" ADD CONSTRAINT "pages_blocks_cta_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pages_blocks_cta_background_image_idx" ON "pages_blocks_cta" USING btree ("background_image_id");
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "variant";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "heading";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "body";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "primary_action_label";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "primary_action_href";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "secondary_action_label";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "secondary_action_href";
  ALTER TABLE "pages_blocks_pricing" DROP COLUMN "variant";
  ALTER TABLE "pages_blocks_pricing" DROP COLUMN "heading";
  ALTER TABLE "pages_blocks_faq" DROP COLUMN "variant";
  ALTER TABLE "pages_blocks_faq" DROP COLUMN "heading";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "variant";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "heading";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "body";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "primary_action_label";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "primary_action_href";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "secondary_action_label";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "secondary_action_href";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "image_id";
  DROP TYPE "public"."enum_pages_blocks_hero_variant";
  DROP TYPE "public"."enum_pages_blocks_services_variant";
  DROP TYPE "public"."enum_pages_blocks_about_variant";
  DROP TYPE "public"."enum_pages_blocks_process_variant";
  DROP TYPE "public"."enum_pages_blocks_work_variant";
  DROP TYPE "public"."enum_pages_blocks_reviews_variant";
  DROP TYPE "public"."enum_pages_blocks_pricing_variant";
  DROP TYPE "public"."enum_pages_blocks_faq_variant";
  DROP TYPE "public"."enum_pages_blocks_cta_variant";
  DROP TYPE "public"."enum_pages_blocks_contact_contact_methods_kind";
  DROP TYPE "public"."enum_pages_blocks_contact_form_fields_type";
  DROP TYPE "public"."enum_pages_blocks_contact_variant";`)
}
