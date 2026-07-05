import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE IF NOT EXISTS 'newsletter';
    ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE IF NOT EXISTS 'bentoGrid';
    ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE IF NOT EXISTS 'contentSection';
    ALTER TYPE "public"."enum_site_settings_chrome_banner_variant" ADD VALUE IF NOT EXISTS 'tailwindplus.marketing.banner.with-button';

    DO $$ BEGIN CREATE TYPE "public"."enum_pages_blocks_newsletter_provider_method" AS ENUM('POST', 'GET'); EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "pages_blocks_newsletter" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "description" jsonb,
      "email_label" varchar,
      "email_placeholder" varchar,
      "submit_label" varchar,
      "consent_label" varchar,
      "provider_provider" varchar,
      "provider_action" varchar,
      "provider_method" "enum_pages_blocks_newsletter_provider_method",
      "provider_requires_consent" boolean DEFAULT true,
      "provider_analytics_enabled" boolean DEFAULT true,
      "design_variant" varchar,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_newsletter_benefits" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "description" jsonb,
      "icon" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_bento_grid" (
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

    CREATE TABLE IF NOT EXISTS "pages_blocks_bento_grid_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "description" jsonb,
      "image_id" integer,
      "icon" varchar,
      "cta_label" varchar,
      "cta_href" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_content_section" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "eyebrow" jsonb,
      "title" jsonb,
      "intro" jsonb,
      "body" jsonb,
      "secondary_title" jsonb,
      "secondary_body" jsonb,
      "image_id" integer,
      "cta_label" varchar,
      "cta_href" varchar,
      "design_variant" varchar,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_content_section_features" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "description" jsonb,
      "icon" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_hero_stats" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "value" varchar NOT NULL,
      "label" varchar NOT NULL
    );

    DO $$ BEGIN ALTER TABLE "pages_blocks_newsletter" ADD CONSTRAINT "pages_blocks_newsletter_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_newsletter_benefits" ADD CONSTRAINT "pages_blocks_newsletter_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_newsletter"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_bento_grid" ADD CONSTRAINT "pages_blocks_bento_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_bento_grid_items" ADD CONSTRAINT "pages_blocks_bento_grid_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_bento_grid"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_bento_grid_items" ADD CONSTRAINT "pages_blocks_bento_grid_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_content_section" ADD CONSTRAINT "pages_blocks_content_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_content_section" ADD CONSTRAINT "pages_blocks_content_section_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_content_section_features" ADD CONSTRAINT "pages_blocks_content_section_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_content_section"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_hero_stats" ADD CONSTRAINT "pages_blocks_hero_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "pages_blocks_newsletter_order_idx" ON "pages_blocks_newsletter" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_newsletter_parent_id_idx" ON "pages_blocks_newsletter" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_newsletter_path_idx" ON "pages_blocks_newsletter" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_newsletter_benefits_order_idx" ON "pages_blocks_newsletter_benefits" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_newsletter_benefits_parent_id_idx" ON "pages_blocks_newsletter_benefits" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bento_grid_order_idx" ON "pages_blocks_bento_grid" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bento_grid_parent_id_idx" ON "pages_blocks_bento_grid" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bento_grid_path_idx" ON "pages_blocks_bento_grid" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bento_grid_items_order_idx" ON "pages_blocks_bento_grid_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bento_grid_items_parent_id_idx" ON "pages_blocks_bento_grid_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bento_grid_items_image_idx" ON "pages_blocks_bento_grid_items" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_content_section_order_idx" ON "pages_blocks_content_section" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_content_section_parent_id_idx" ON "pages_blocks_content_section" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_content_section_path_idx" ON "pages_blocks_content_section" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_content_section_image_idx" ON "pages_blocks_content_section" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_content_section_features_order_idx" ON "pages_blocks_content_section_features" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_content_section_features_parent_id_idx" ON "pages_blocks_content_section_features" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_stats_order_idx" ON "pages_blocks_hero_stats" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_stats_parent_id_idx" ON "pages_blocks_hero_stats" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "pages_blocks_hero_stats" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_content_section_features" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_content_section" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_bento_grid_items" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_bento_grid" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_newsletter_benefits" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_newsletter" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_newsletter_provider_method";
  `)
}
