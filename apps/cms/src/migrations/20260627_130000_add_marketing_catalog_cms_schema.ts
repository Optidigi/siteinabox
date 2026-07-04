import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN CREATE TYPE "public"."enum_site_settings_chrome_header_variant" AS ENUM('default'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_site_settings_chrome_header_behavior" AS ENUM('static', 'sticky'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_site_settings_chrome_header_active_mode" AS ENUM('path', 'anchor', 'none'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_site_settings_chrome_header_mobile_menu" AS ENUM('dropdown', 'drawer'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_site_settings_chrome_footer_variant" AS ENUM('default'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_site_settings_chrome_banner_variant" AS ENUM('default'); EXCEPTION WHEN duplicate_object THEN null; END $$;

    ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE IF NOT EXISTS 'pricing';
    ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE IF NOT EXISTS 'stats';
    ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE IF NOT EXISTS 'logoCloud';
    ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE IF NOT EXISTS 'gallery';
    ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE IF NOT EXISTS 'team';
    ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE IF NOT EXISTS 'blogCards';
    ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE IF NOT EXISTS 'processSteps';
    ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE IF NOT EXISTS 'comparison';

    CREATE TABLE IF NOT EXISTS "pages_blocks_pricing" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "intro" jsonb,
      "variant" varchar,
      "tokens" jsonb,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_pricing_plans" (
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
    CREATE TABLE IF NOT EXISTS "pages_blocks_pricing_plans_features" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" jsonb,
      "included" boolean DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_stats" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "intro" jsonb,
      "variant" varchar,
      "tokens" jsonb,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_stats_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "value" varchar NOT NULL,
      "label" varchar NOT NULL,
      "description" jsonb
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_logo_cloud" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "intro" jsonb,
      "variant" varchar,
      "tokens" jsonb,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_logo_cloud_logos" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "image_id" integer NOT NULL,
      "href" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_gallery" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "intro" jsonb,
      "cta_label" varchar,
      "cta_href" varchar,
      "variant" varchar,
      "tokens" jsonb,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_gallery_images" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "image_id" integer NOT NULL,
      "caption" jsonb,
      "link_label" varchar,
      "link_href" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_team" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "intro" jsonb,
      "variant" varchar,
      "tokens" jsonb,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_team_members" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "role" varchar,
      "bio" jsonb,
      "image_id" integer
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_team_members_links" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar,
      "href" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_blog_cards" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "intro" jsonb,
      "variant" varchar,
      "tokens" jsonb,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_blog_cards_posts" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "excerpt" jsonb,
      "image_id" integer,
      "href" varchar,
      "date" varchar,
      "author" varchar,
      "cta_label" varchar,
      "cta_href" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_process_steps" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "intro" jsonb,
      "variant" varchar,
      "tokens" jsonb,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_process_steps_steps" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "description" jsonb,
      "icon" varchar,
      "image_id" integer,
      "cta_label" varchar,
      "cta_href" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_comparison" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "intro" jsonb,
      "variant" varchar,
      "tokens" jsonb,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_comparison_columns" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "description" jsonb,
      "cta_label" varchar,
      "cta_href" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_comparison_rows" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "values" jsonb
    );

    CREATE TABLE IF NOT EXISTS "site_settings_chrome_footer_legal_links" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar,
      "href" varchar
    );

    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_header_variant" "enum_site_settings_chrome_header_variant";
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_header_behavior" "enum_site_settings_chrome_header_behavior";
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_header_active_mode" "enum_site_settings_chrome_header_active_mode";
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_header_mobile_menu" "enum_site_settings_chrome_header_mobile_menu";
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_header_cta_label" varchar;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_header_cta_href" varchar;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_footer_variant" "enum_site_settings_chrome_footer_variant";
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_banner_variant" "enum_site_settings_chrome_banner_variant";
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_banner_visible" boolean DEFAULT false;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_banner_title" varchar;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_banner_message" varchar;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_banner_link_label" varchar;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_banner_link_href" varchar;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "chrome_banner_dismissible" boolean DEFAULT true;

    DO $$ BEGIN ALTER TABLE "pages_blocks_pricing" ADD CONSTRAINT "pages_blocks_pricing_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_pricing_plans" ADD CONSTRAINT "pages_blocks_pricing_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_pricing"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_pricing_plans_features" ADD CONSTRAINT "pages_blocks_pricing_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_pricing_plans"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_stats" ADD CONSTRAINT "pages_blocks_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_stats_items" ADD CONSTRAINT "pages_blocks_stats_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_stats"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_logo_cloud" ADD CONSTRAINT "pages_blocks_logo_cloud_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_logo_cloud_logos" ADD CONSTRAINT "pages_blocks_logo_cloud_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_logo_cloud"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_logo_cloud_logos" ADD CONSTRAINT "pages_blocks_logo_cloud_logos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_gallery" ADD CONSTRAINT "pages_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_gallery_images" ADD CONSTRAINT "pages_blocks_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_gallery_images" ADD CONSTRAINT "pages_blocks_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_team" ADD CONSTRAINT "pages_blocks_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_team_members" ADD CONSTRAINT "pages_blocks_team_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_team"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_team_members" ADD CONSTRAINT "pages_blocks_team_members_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_team_members_links" ADD CONSTRAINT "pages_blocks_team_members_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_team_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_blog_cards" ADD CONSTRAINT "pages_blocks_blog_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_blog_cards_posts" ADD CONSTRAINT "pages_blocks_blog_cards_posts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_blog_cards"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_blog_cards_posts" ADD CONSTRAINT "pages_blocks_blog_cards_posts_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_process_steps" ADD CONSTRAINT "pages_blocks_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_process_steps_steps" ADD CONSTRAINT "pages_blocks_process_steps_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_process_steps"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_process_steps_steps" ADD CONSTRAINT "pages_blocks_process_steps_steps_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_comparison" ADD CONSTRAINT "pages_blocks_comparison_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_comparison_columns" ADD CONSTRAINT "pages_blocks_comparison_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_comparison"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_comparison_rows" ADD CONSTRAINT "pages_blocks_comparison_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_comparison"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "site_settings_chrome_footer_legal_links" ADD CONSTRAINT "site_settings_chrome_footer_legal_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_order_idx" ON "pages_blocks_pricing" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_parent_id_idx" ON "pages_blocks_pricing" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_path_idx" ON "pages_blocks_pricing" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_plans_order_idx" ON "pages_blocks_pricing_plans" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_plans_parent_id_idx" ON "pages_blocks_pricing_plans" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_plans_features_order_idx" ON "pages_blocks_pricing_plans_features" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_plans_features_parent_id_idx" ON "pages_blocks_pricing_plans_features" USING btree ("_parent_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_stats_order_idx" ON "pages_blocks_stats" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_stats_parent_id_idx" ON "pages_blocks_stats" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_stats_path_idx" ON "pages_blocks_stats" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_stats_items_order_idx" ON "pages_blocks_stats_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_stats_items_parent_id_idx" ON "pages_blocks_stats_items" USING btree ("_parent_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_logo_cloud_order_idx" ON "pages_blocks_logo_cloud" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_logo_cloud_parent_id_idx" ON "pages_blocks_logo_cloud" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_logo_cloud_path_idx" ON "pages_blocks_logo_cloud" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_logo_cloud_logos_order_idx" ON "pages_blocks_logo_cloud_logos" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_logo_cloud_logos_parent_id_idx" ON "pages_blocks_logo_cloud_logos" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_logo_cloud_logos_image_idx" ON "pages_blocks_logo_cloud_logos" USING btree ("image_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_gallery_order_idx" ON "pages_blocks_gallery" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_gallery_parent_id_idx" ON "pages_blocks_gallery" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_gallery_path_idx" ON "pages_blocks_gallery" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_gallery_images_order_idx" ON "pages_blocks_gallery_images" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_gallery_images_parent_id_idx" ON "pages_blocks_gallery_images" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_gallery_images_image_idx" ON "pages_blocks_gallery_images" USING btree ("image_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_team_order_idx" ON "pages_blocks_team" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_team_parent_id_idx" ON "pages_blocks_team" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_team_path_idx" ON "pages_blocks_team" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_team_members_order_idx" ON "pages_blocks_team_members" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_team_members_parent_id_idx" ON "pages_blocks_team_members" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_team_members_image_idx" ON "pages_blocks_team_members" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_team_members_links_order_idx" ON "pages_blocks_team_members_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_team_members_links_parent_id_idx" ON "pages_blocks_team_members_links" USING btree ("_parent_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_blog_cards_order_idx" ON "pages_blocks_blog_cards" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_blog_cards_parent_id_idx" ON "pages_blocks_blog_cards" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_blog_cards_path_idx" ON "pages_blocks_blog_cards" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_blog_cards_posts_order_idx" ON "pages_blocks_blog_cards_posts" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_blog_cards_posts_parent_id_idx" ON "pages_blocks_blog_cards_posts" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_blog_cards_posts_image_idx" ON "pages_blocks_blog_cards_posts" USING btree ("image_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_process_steps_order_idx" ON "pages_blocks_process_steps" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_process_steps_parent_id_idx" ON "pages_blocks_process_steps" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_process_steps_path_idx" ON "pages_blocks_process_steps" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_process_steps_steps_order_idx" ON "pages_blocks_process_steps_steps" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_process_steps_steps_parent_id_idx" ON "pages_blocks_process_steps_steps" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_process_steps_steps_image_idx" ON "pages_blocks_process_steps_steps" USING btree ("image_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_comparison_order_idx" ON "pages_blocks_comparison" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_comparison_parent_id_idx" ON "pages_blocks_comparison" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_comparison_path_idx" ON "pages_blocks_comparison" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_comparison_columns_order_idx" ON "pages_blocks_comparison_columns" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_comparison_columns_parent_id_idx" ON "pages_blocks_comparison_columns" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_comparison_rows_order_idx" ON "pages_blocks_comparison_rows" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_comparison_rows_parent_id_idx" ON "pages_blocks_comparison_rows" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "site_settings_chrome_footer_legal_links_order_idx" ON "site_settings_chrome_footer_legal_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_settings_chrome_footer_legal_links_parent_id_idx" ON "site_settings_chrome_footer_legal_links" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "site_settings_chrome_footer_legal_links" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_comparison_rows" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_comparison_columns" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_comparison" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_process_steps_steps" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_process_steps" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_blog_cards_posts" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_blog_cards" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_team_members_links" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_team_members" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_team" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_gallery_images" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_gallery" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_logo_cloud_logos" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_logo_cloud" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_stats_items" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_stats" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_pricing_plans_features" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_pricing_plans" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_pricing" CASCADE;

    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_header_variant";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_header_behavior";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_header_active_mode";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_header_mobile_menu";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_header_cta_label";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_header_cta_href";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_footer_variant";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_banner_variant";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_banner_visible";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_banner_title";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_banner_message";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_banner_link_label";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_banner_link_href";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "chrome_banner_dismissible";

    DROP TYPE IF EXISTS "public"."enum_site_settings_chrome_header_variant";
    DROP TYPE IF EXISTS "public"."enum_site_settings_chrome_header_behavior";
    DROP TYPE IF EXISTS "public"."enum_site_settings_chrome_header_active_mode";
    DROP TYPE IF EXISTS "public"."enum_site_settings_chrome_header_mobile_menu";
    DROP TYPE IF EXISTS "public"."enum_site_settings_chrome_footer_variant";
    DROP TYPE IF EXISTS "public"."enum_site_settings_chrome_banner_variant";
  `)
}
