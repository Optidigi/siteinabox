import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_contact_section_provider_provider" AS ENUM('siab', 'web3forms', 'custom', 'mailto');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_contact_section_provider_method" AS ENUM('GET', 'POST');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_media_hero_min_height" AS ENUM('compact', 'standard', 'tall', 'viewport');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_media_hero_content_align" AS ENUM('left', 'center', 'right');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_media_hero_content_width" AS ENUM('narrow', 'wide');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_media_hero_shape_dividers_top" AS ENUM('none', 'mountains', 'wave-brush');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_media_hero_shape_dividers_bottom" AS ENUM('none', 'mountains', 'wave-brush');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_info_card_list_layout" AS ENUM('row', 'grid', 'stack');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_info_card_list_icon_position" AS ENUM('top', 'left');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_info_card_list_items_animation" AS ENUM('none', 'fadeInUp', 'fadeInDown', 'float', 'grow');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_service_carousel_layout" AS ENUM('carousel', 'grid');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_service_carousel_carousel_pagination" AS ENUM('none', 'bullets', 'fraction');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_before_after_gallery_pairs_orientation" AS ENUM('horizontal', 'vertical');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_contact_details_layout" AS ENUM('cards', 'split', 'list');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_contact_details_items_kind" AS ENUM('phone', 'email', 'address', 'hours', 'legal', 'custom');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "pages_blocks_hero" ADD COLUMN IF NOT EXISTS "variant" varchar;
    ALTER TABLE "pages_blocks_hero" ADD COLUMN IF NOT EXISTS "tokens" jsonb;
    ALTER TABLE "pages_blocks_hero" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
    ALTER TABLE "pages_blocks_hero" ADD COLUMN IF NOT EXISTS "anchor" varchar;
    ALTER TABLE "pages_blocks_feature_list" ADD COLUMN IF NOT EXISTS "variant" varchar;
    ALTER TABLE "pages_blocks_feature_list" ADD COLUMN IF NOT EXISTS "tokens" jsonb;
    ALTER TABLE "pages_blocks_feature_list" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
    ALTER TABLE "pages_blocks_feature_list" ADD COLUMN IF NOT EXISTS "anchor" varchar;
    ALTER TABLE "pages_blocks_testimonials" ADD COLUMN IF NOT EXISTS "variant" varchar;
    ALTER TABLE "pages_blocks_testimonials" ADD COLUMN IF NOT EXISTS "tokens" jsonb;
    ALTER TABLE "pages_blocks_testimonials" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
    ALTER TABLE "pages_blocks_testimonials" ADD COLUMN IF NOT EXISTS "anchor" varchar;
    ALTER TABLE "pages_blocks_faq" ADD COLUMN IF NOT EXISTS "variant" varchar;
    ALTER TABLE "pages_blocks_faq" ADD COLUMN IF NOT EXISTS "tokens" jsonb;
    ALTER TABLE "pages_blocks_faq" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
    ALTER TABLE "pages_blocks_faq" ADD COLUMN IF NOT EXISTS "anchor" varchar;
    ALTER TABLE "pages_blocks_cta" ADD COLUMN IF NOT EXISTS "variant" varchar;
    ALTER TABLE "pages_blocks_cta" ADD COLUMN IF NOT EXISTS "tokens" jsonb;
    ALTER TABLE "pages_blocks_cta" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
    ALTER TABLE "pages_blocks_cta" ADD COLUMN IF NOT EXISTS "anchor" varchar;
    ALTER TABLE "pages_blocks_rich_text" ADD COLUMN IF NOT EXISTS "variant" varchar;
    ALTER TABLE "pages_blocks_rich_text" ADD COLUMN IF NOT EXISTS "tokens" jsonb;
    ALTER TABLE "pages_blocks_rich_text" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
    ALTER TABLE "pages_blocks_rich_text" ADD COLUMN IF NOT EXISTS "anchor" varchar;
    ALTER TABLE "pages_blocks_contact_section" ADD COLUMN IF NOT EXISTS "provider_provider" "enum_pages_blocks_contact_section_provider_provider";
    ALTER TABLE "pages_blocks_contact_section" ADD COLUMN IF NOT EXISTS "provider_action" varchar;
    ALTER TABLE "pages_blocks_contact_section" ADD COLUMN IF NOT EXISTS "provider_method" "enum_pages_blocks_contact_section_provider_method";
    ALTER TABLE "pages_blocks_contact_section" ADD COLUMN IF NOT EXISTS "provider_honeypot_field" varchar;
    ALTER TABLE "pages_blocks_contact_section" ADD COLUMN IF NOT EXISTS "provider_fallback_href" varchar;
    ALTER TABLE "pages_blocks_contact_section" ADD COLUMN IF NOT EXISTS "provider_success_message" varchar;
    ALTER TABLE "pages_blocks_contact_section" ADD COLUMN IF NOT EXISTS "provider_error_message" varchar;
    ALTER TABLE "pages_blocks_contact_section" ADD COLUMN IF NOT EXISTS "provider_requires_consent" boolean DEFAULT false;
    ALTER TABLE "pages_blocks_contact_section" ADD COLUMN IF NOT EXISTS "provider_analytics_enabled" boolean DEFAULT false;
    ALTER TABLE "pages_blocks_contact_section" ADD COLUMN IF NOT EXISTS "variant" varchar;
    ALTER TABLE "pages_blocks_contact_section" ADD COLUMN IF NOT EXISTS "tokens" jsonb;
    ALTER TABLE "pages_blocks_contact_section" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
    ALTER TABLE "pages_blocks_contact_section" ADD COLUMN IF NOT EXISTS "anchor" varchar;
    ALTER TABLE "pages_blocks_contact_section_fields" ADD COLUMN IF NOT EXISTS "placeholder" varchar;
    ALTER TABLE "pages_blocks_contact_section_fields" ADD COLUMN IF NOT EXISTS "max_length" numeric;

    CREATE TABLE IF NOT EXISTS "pages_blocks_contact_section_provider_hidden_fields" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "value" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_media_hero" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "eyebrow" jsonb,
      "headline" jsonb,
      "subheadline" jsonb,
      "cta_label" varchar,
      "cta_href" varchar,
      "secondary_label" varchar,
      "secondary_href" varchar,
      "background_image_id" integer,
      "foreground_image_id" integer,
      "overlay_color" varchar,
      "overlay_opacity" numeric,
      "min_height" "enum_pages_blocks_media_hero_min_height",
      "content_align" "enum_pages_blocks_media_hero_content_align",
      "content_width" "enum_pages_blocks_media_hero_content_width",
      "shape_dividers_top" "enum_pages_blocks_media_hero_shape_dividers_top",
      "shape_dividers_bottom" "enum_pages_blocks_media_hero_shape_dividers_bottom",
      "priority" boolean DEFAULT false,
      "variant" varchar,
      "tokens" jsonb,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_info_card_list_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "description" jsonb,
      "icon" varchar,
      "image_id" integer,
      "link_label" varchar,
      "link_href" varchar,
      "animation" "enum_pages_blocks_info_card_list_items_animation"
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_info_card_list" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "intro" jsonb,
      "layout" "enum_pages_blocks_info_card_list_layout",
      "icon_position" "enum_pages_blocks_info_card_list_icon_position",
      "variant" varchar,
      "tokens" jsonb,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_service_carousel_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "description" jsonb,
      "image_id" integer,
      "cta_label" varchar,
      "cta_href" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_service_carousel" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "intro" jsonb,
      "layout" "enum_pages_blocks_service_carousel_layout",
      "carousel_slides_per_view" numeric,
      "carousel_slides_per_view_tablet" numeric,
      "carousel_slides_per_view_mobile" numeric,
      "carousel_space_between" numeric,
      "carousel_autoplay" boolean DEFAULT false,
      "carousel_autoplay_delay_ms" numeric,
      "carousel_loop" boolean DEFAULT false,
      "carousel_pagination" "enum_pages_blocks_service_carousel_carousel_pagination",
      "carousel_pause_on_interaction" boolean DEFAULT false,
      "variant" varchar,
      "tokens" jsonb,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_before_after_gallery_pairs" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "before_id" integer,
      "after_id" integer,
      "before_label" varchar,
      "after_label" varchar,
      "caption" jsonb,
      "initial_ratio" numeric,
      "orientation" "enum_pages_blocks_before_after_gallery_pairs_orientation"
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_before_after_gallery" (
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

    CREATE TABLE IF NOT EXISTS "pages_blocks_contact_details_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "kind" "enum_pages_blocks_contact_details_items_kind",
      "label" varchar,
      "value" jsonb,
      "href" varchar,
      "icon" varchar,
      "image_id" integer
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_contact_details" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "intro" jsonb,
      "layout" "enum_pages_blocks_contact_details_layout",
      "legal_kvk_number" varchar,
      "legal_btw_id" varchar,
      "legal_iban" varchar,
      "legal_bic" varchar,
      "variant" varchar,
      "tokens" jsonb,
      "metadata" jsonb,
      "anchor" varchar,
      "block_name" varchar
    );

    ALTER TABLE "pages_blocks_contact_section_provider_hidden_fields" ADD CONSTRAINT "pages_blocks_contact_section_provider_hidden_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact_section"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pages_blocks_media_hero" ADD CONSTRAINT "pages_blocks_media_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pages_blocks_media_hero" ADD CONSTRAINT "pages_blocks_media_hero_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "pages_blocks_media_hero" ADD CONSTRAINT "pages_blocks_media_hero_foreground_image_id_media_id_fk" FOREIGN KEY ("foreground_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "pages_blocks_info_card_list_items" ADD CONSTRAINT "pages_blocks_info_card_list_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_info_card_list"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pages_blocks_info_card_list_items" ADD CONSTRAINT "pages_blocks_info_card_list_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "pages_blocks_info_card_list" ADD CONSTRAINT "pages_blocks_info_card_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pages_blocks_service_carousel_items" ADD CONSTRAINT "pages_blocks_service_carousel_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_service_carousel"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pages_blocks_service_carousel_items" ADD CONSTRAINT "pages_blocks_service_carousel_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "pages_blocks_service_carousel" ADD CONSTRAINT "pages_blocks_service_carousel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pages_blocks_before_after_gallery_pairs" ADD CONSTRAINT "pages_blocks_before_after_gallery_pairs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_before_after_gallery"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pages_blocks_before_after_gallery_pairs" ADD CONSTRAINT "pages_blocks_before_after_gallery_pairs_before_id_media_id_fk" FOREIGN KEY ("before_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "pages_blocks_before_after_gallery_pairs" ADD CONSTRAINT "pages_blocks_before_after_gallery_pairs_after_id_media_id_fk" FOREIGN KEY ("after_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "pages_blocks_before_after_gallery" ADD CONSTRAINT "pages_blocks_before_after_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pages_blocks_contact_details_items" ADD CONSTRAINT "pages_blocks_contact_details_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact_details"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pages_blocks_contact_details_items" ADD CONSTRAINT "pages_blocks_contact_details_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "pages_blocks_contact_details" ADD CONSTRAINT "pages_blocks_contact_details_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "pages_blocks_contact_section_provider_hidden_fields_order_idx" ON "pages_blocks_contact_section_provider_hidden_fields" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_contact_section_provider_hidden_fields_parent_idx" ON "pages_blocks_contact_section_provider_hidden_fields" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_media_hero_order_idx" ON "pages_blocks_media_hero" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_media_hero_parent_id_idx" ON "pages_blocks_media_hero" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_media_hero_path_idx" ON "pages_blocks_media_hero" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_media_hero_background_image_idx" ON "pages_blocks_media_hero" USING btree ("background_image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_media_hero_foreground_image_idx" ON "pages_blocks_media_hero" USING btree ("foreground_image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_info_card_list_items_order_idx" ON "pages_blocks_info_card_list_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_info_card_list_items_parent_id_idx" ON "pages_blocks_info_card_list_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_info_card_list_items_image_idx" ON "pages_blocks_info_card_list_items" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_info_card_list_order_idx" ON "pages_blocks_info_card_list" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_info_card_list_parent_id_idx" ON "pages_blocks_info_card_list" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_info_card_list_path_idx" ON "pages_blocks_info_card_list" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_service_carousel_items_order_idx" ON "pages_blocks_service_carousel_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_service_carousel_items_parent_id_idx" ON "pages_blocks_service_carousel_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_service_carousel_items_image_idx" ON "pages_blocks_service_carousel_items" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_service_carousel_order_idx" ON "pages_blocks_service_carousel" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_service_carousel_parent_id_idx" ON "pages_blocks_service_carousel" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_service_carousel_path_idx" ON "pages_blocks_service_carousel" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_before_after_gallery_pairs_order_idx" ON "pages_blocks_before_after_gallery_pairs" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_before_after_gallery_pairs_parent_id_idx" ON "pages_blocks_before_after_gallery_pairs" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_before_after_gallery_pairs_before_idx" ON "pages_blocks_before_after_gallery_pairs" USING btree ("before_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_before_after_gallery_pairs_after_idx" ON "pages_blocks_before_after_gallery_pairs" USING btree ("after_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_before_after_gallery_order_idx" ON "pages_blocks_before_after_gallery" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_before_after_gallery_parent_id_idx" ON "pages_blocks_before_after_gallery" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_before_after_gallery_path_idx" ON "pages_blocks_before_after_gallery" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_contact_details_items_order_idx" ON "pages_blocks_contact_details_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_contact_details_items_parent_id_idx" ON "pages_blocks_contact_details_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_contact_details_items_image_idx" ON "pages_blocks_contact_details_items" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_contact_details_order_idx" ON "pages_blocks_contact_details" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_contact_details_parent_id_idx" ON "pages_blocks_contact_details" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_contact_details_path_idx" ON "pages_blocks_contact_details" USING btree ("_path");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "pages_blocks_contact_details_items" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_contact_details" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_before_after_gallery_pairs" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_before_after_gallery" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_service_carousel_items" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_service_carousel" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_info_card_list_items" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_info_card_list" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_media_hero" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_contact_section_provider_hidden_fields" CASCADE;

    ALTER TABLE "pages_blocks_contact_section" DROP COLUMN IF EXISTS "provider_provider";
    ALTER TABLE "pages_blocks_contact_section" DROP COLUMN IF EXISTS "provider_action";
    ALTER TABLE "pages_blocks_contact_section" DROP COLUMN IF EXISTS "provider_method";
    ALTER TABLE "pages_blocks_contact_section" DROP COLUMN IF EXISTS "provider_honeypot_field";
    ALTER TABLE "pages_blocks_contact_section" DROP COLUMN IF EXISTS "provider_fallback_href";
    ALTER TABLE "pages_blocks_contact_section" DROP COLUMN IF EXISTS "provider_success_message";
    ALTER TABLE "pages_blocks_contact_section" DROP COLUMN IF EXISTS "provider_error_message";
    ALTER TABLE "pages_blocks_contact_section" DROP COLUMN IF EXISTS "provider_requires_consent";
    ALTER TABLE "pages_blocks_contact_section" DROP COLUMN IF EXISTS "provider_analytics_enabled";
    ALTER TABLE "pages_blocks_contact_section_fields" DROP COLUMN IF EXISTS "placeholder";
    ALTER TABLE "pages_blocks_contact_section_fields" DROP COLUMN IF EXISTS "max_length";

    ALTER TABLE "pages_blocks_hero" DROP COLUMN IF EXISTS "variant";
    ALTER TABLE "pages_blocks_hero" DROP COLUMN IF EXISTS "tokens";
    ALTER TABLE "pages_blocks_hero" DROP COLUMN IF EXISTS "metadata";
    ALTER TABLE "pages_blocks_feature_list" DROP COLUMN IF EXISTS "variant";
    ALTER TABLE "pages_blocks_feature_list" DROP COLUMN IF EXISTS "tokens";
    ALTER TABLE "pages_blocks_feature_list" DROP COLUMN IF EXISTS "metadata";
    ALTER TABLE "pages_blocks_testimonials" DROP COLUMN IF EXISTS "variant";
    ALTER TABLE "pages_blocks_testimonials" DROP COLUMN IF EXISTS "tokens";
    ALTER TABLE "pages_blocks_testimonials" DROP COLUMN IF EXISTS "metadata";
    ALTER TABLE "pages_blocks_faq" DROP COLUMN IF EXISTS "variant";
    ALTER TABLE "pages_blocks_faq" DROP COLUMN IF EXISTS "tokens";
    ALTER TABLE "pages_blocks_faq" DROP COLUMN IF EXISTS "metadata";
    ALTER TABLE "pages_blocks_cta" DROP COLUMN IF EXISTS "variant";
    ALTER TABLE "pages_blocks_cta" DROP COLUMN IF EXISTS "tokens";
    ALTER TABLE "pages_blocks_cta" DROP COLUMN IF EXISTS "metadata";
    ALTER TABLE "pages_blocks_rich_text" DROP COLUMN IF EXISTS "variant";
    ALTER TABLE "pages_blocks_rich_text" DROP COLUMN IF EXISTS "tokens";
    ALTER TABLE "pages_blocks_rich_text" DROP COLUMN IF EXISTS "metadata";
    ALTER TABLE "pages_blocks_contact_section" DROP COLUMN IF EXISTS "variant";
    ALTER TABLE "pages_blocks_contact_section" DROP COLUMN IF EXISTS "tokens";
    ALTER TABLE "pages_blocks_contact_section" DROP COLUMN IF EXISTS "metadata";

    DROP TYPE IF EXISTS "public"."enum_pages_blocks_contact_details_items_kind";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_contact_details_layout";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_before_after_gallery_pairs_orientation";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_service_carousel_carousel_pagination";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_service_carousel_layout";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_info_card_list_items_animation";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_info_card_list_icon_position";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_info_card_list_layout";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_media_hero_shape_dividers_bottom";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_media_hero_shape_dividers_top";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_media_hero_content_width";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_media_hero_content_align";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_media_hero_min_height";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_contact_section_provider_method";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_contact_section_provider_provider";
  `)
}
