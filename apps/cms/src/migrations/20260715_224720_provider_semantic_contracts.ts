import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pages_blocks_hero_logos" (
	"_order" integer NOT NULL,
	"_parent_id" varchar NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"image_id" integer,
	"href" varchar
  );

  ALTER TABLE "pages_blocks_contact_details_items" DROP CONSTRAINT IF EXISTS "pages_blocks_contact_details_items_image_id_media_id_fk";
  ALTER TABLE "pages_blocks_contact_details_items" RENAME COLUMN "value" TO "legacy_value";
  ALTER TABLE "pages_blocks_contact_details_items" ADD COLUMN "title" varchar;
  ALTER TABLE "pages_blocks_contact_details_items" ADD COLUMN "description" varchar;
  ALTER TABLE "pages_blocks_contact_details_items" ADD COLUMN "value" varchar;
  UPDATE "pages_blocks_contact_details_items" SET
    "title" = COALESCE(NULLIF("label", ''), initcap(COALESCE("kind"::text, 'contact'))),
    "value" = COALESCE(NULLIF(trim(both '"' from "legacy_value"::text), ''), NULLIF("href", ''), 'Contact');
  ALTER TABLE "pages_blocks_contact_details_items" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "pages_blocks_contact_details_items" ALTER COLUMN "value" SET NOT NULL;
  DROP INDEX IF EXISTS "pages_blocks_contact_details_items_image_idx";
  ALTER TABLE "pages_blocks_contact_details_items" DROP COLUMN "kind";
  ALTER TABLE "pages_blocks_contact_details_items" DROP COLUMN "label";
  ALTER TABLE "pages_blocks_contact_details_items" DROP COLUMN "image_id";
  ALTER TABLE "pages_blocks_contact_details_items" DROP COLUMN "legacy_value";

  ALTER TABLE "pages_blocks_contact_details" ADD COLUMN "description" jsonb;
  UPDATE "pages_blocks_contact_details" SET "description" = "intro", "design_variant" = 'shadcnui-blocks.contact-01';
  ALTER TABLE "pages_blocks_contact_details" DROP COLUMN "intro";
  ALTER TABLE "pages_blocks_contact_details" DROP COLUMN "layout";
  ALTER TABLE "pages_blocks_contact_details" DROP COLUMN "legal_kvk_number";
  ALTER TABLE "pages_blocks_contact_details" DROP COLUMN "legal_btw_id";
  ALTER TABLE "pages_blocks_contact_details" DROP COLUMN "legal_iban";
  ALTER TABLE "pages_blocks_contact_details" DROP COLUMN "legal_bic";
  ALTER TABLE "pages_blocks_contact_details" DROP COLUMN IF EXISTS "tokens";
  DROP TYPE IF EXISTS "public"."enum_pages_blocks_contact_details_items_kind";
  DROP TYPE IF EXISTS "public"."enum_pages_blocks_contact_details_layout";

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

  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_block_presets_block_type";
  CREATE TYPE "public"."enum_block_presets_block_type" AS ENUM('hero', 'featureList', 'testimonials', 'faq', 'cta', 'contactSection', 'pricing', 'stats', 'logoCloud', 'gallery', 'team', 'contactDetails', 'timeline', 'blogCards');
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE "public"."enum_block_presets_block_type" USING "block_type"::"public"."enum_block_presets_block_type";
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "trust_label" varchar;
  ALTER TABLE "pages_blocks_feature_list_features" ADD COLUMN "image_id" integer;
  ALTER TABLE "pages_blocks_feature_list_features" ADD COLUMN "cta_label" varchar;
  ALTER TABLE "pages_blocks_feature_list_features" ADD COLUMN "cta_href" varchar;
  ALTER TABLE "pages_blocks_feature_list_features" ADD COLUMN "metric_value" varchar;
  ALTER TABLE "pages_blocks_feature_list_features" ADD COLUMN "metric_label" varchar;
  ALTER TABLE "pages_blocks_testimonials" ADD COLUMN "intro" varchar;
  ALTER TABLE "pages_blocks_faq" ADD COLUMN "intro" jsonb;
  ALTER TABLE "pages_blocks_logo_cloud_logos" ADD COLUMN "description" varchar;
  ALTER TABLE "pages_blocks_logo_cloud" ADD COLUMN "cta_label" varchar;
  ALTER TABLE "pages_blocks_logo_cloud" ADD COLUMN "cta_href" varchar;
  ALTER TABLE "pages_blocks_blog_cards" ADD COLUMN "cta_label" varchar;
  ALTER TABLE "pages_blocks_blog_cards" ADD COLUMN "cta_href" varchar;
  ALTER TABLE "pages_blocks_blog_cards" ADD COLUMN "secondary_label" varchar;
  ALTER TABLE "pages_blocks_blog_cards" ADD COLUMN "secondary_href" varchar;
  ALTER TABLE "pages_blocks_hero_logos" ADD CONSTRAINT "pages_blocks_hero_logos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_logos" ADD CONSTRAINT "pages_blocks_hero_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_timeline_items_tags" ADD CONSTRAINT "pages_blocks_timeline_items_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_timeline_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_timeline_items" ADD CONSTRAINT "pages_blocks_timeline_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_timeline"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_timeline" ADD CONSTRAINT "pages_blocks_timeline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_hero_logos_order_idx" ON "pages_blocks_hero_logos" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_logos_parent_id_idx" ON "pages_blocks_hero_logos" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_logos_image_idx" ON "pages_blocks_hero_logos" USING btree ("image_id");
  CREATE INDEX "pages_blocks_timeline_items_tags_order_idx" ON "pages_blocks_timeline_items_tags" USING btree ("_order");
  CREATE INDEX "pages_blocks_timeline_items_tags_parent_id_idx" ON "pages_blocks_timeline_items_tags" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_timeline_items_order_idx" ON "pages_blocks_timeline_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_timeline_items_parent_id_idx" ON "pages_blocks_timeline_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_timeline_order_idx" ON "pages_blocks_timeline" USING btree ("_order");
  CREATE INDEX "pages_blocks_timeline_parent_id_idx" ON "pages_blocks_timeline" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_timeline_path_idx" ON "pages_blocks_timeline" USING btree ("_path");
  ALTER TABLE "pages_blocks_feature_list_features" ADD CONSTRAINT "pages_blocks_feature_list_features_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pages_blocks_feature_list_features_image_idx" ON "pages_blocks_feature_list_features" USING btree ("image_id");

  CREATE OR REPLACE FUNCTION pg_temp.siab_fix_provider_semantics(input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
  DECLARE page jsonb; block jsonb; pages jsonb := '[]'; blocks jsonb;
  BEGIN
    IF input IS NULL OR jsonb_typeof(input) <> 'array' THEN RETURN input; END IF;
    FOR page IN SELECT value FROM jsonb_array_elements(input) LOOP
      blocks := '[]'::jsonb;
      FOR block IN SELECT value FROM jsonb_array_elements(COALESCE(page->'blocks', '[]'::jsonb)) LOOP
        IF block->>'blockType' = 'contactSection' AND block->>'designVariant' IN ('shadcnui-blocks.contact-01', 'shadcnui-blocks.contact-03') THEN
          block := jsonb_set(block, '{designVariant}', '"shadcnui-blocks.contact-02"', true);
        ELSIF block->>'blockType' = 'contentSection' AND block->>'designVariant' = 'shadcnui-blocks.timeline-01' THEN
          block := (block - 'eyebrow' - 'title' - 'intro' - 'features' - 'bridge' - 'secondaryTitle' - 'secondaryBody' - 'image' - 'cta') || jsonb_build_object('designVariant', 'shadcnui-blocks.legal-content-01');
        END IF;
        blocks := blocks || jsonb_build_array(block);
      END LOOP;
      pages := pages || jsonb_build_array(jsonb_set(page, '{blocks}', blocks, true));
    END LOOP;
    RETURN pages;
  END $$;

  CREATE OR REPLACE FUNCTION pg_temp.siab_fix_provider_spec(input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
  DECLARE out jsonb := input;
  BEGIN
    IF input IS NULL THEN RETURN NULL; END IF;
    IF jsonb_typeof(input) = 'array' THEN RETURN pg_temp.siab_fix_provider_semantics(input); END IF;
    IF input ? 'pages' THEN out := jsonb_set(out, '{pages}', pg_temp.siab_fix_provider_semantics(COALESCE(input->'pages', '[]'::jsonb)), true); END IF;
    RETURN out;
  END $$;

  UPDATE "pages_blocks_contact_section" SET "design_variant" = 'shadcnui-blocks.contact-02' WHERE "design_variant" IN ('shadcnui-blocks.contact-01', 'shadcnui-blocks.contact-03');
  DELETE FROM "pages_blocks_content_section_features" WHERE "_parent_id" IN (SELECT "id" FROM "pages_blocks_content_section" WHERE "design_variant" = 'shadcnui-blocks.timeline-01');
  UPDATE "pages_blocks_content_section" SET "design_variant" = 'shadcnui-blocks.legal-content-01', "eyebrow" = NULL, "title" = NULL, "intro" = NULL, "bridge" = NULL, "secondary_title" = NULL, "secondary_body" = NULL, "image_id" = NULL, "cta_label" = NULL, "cta_href" = NULL WHERE "design_variant" = 'shadcnui-blocks.timeline-01';
  UPDATE "published_site_snapshots" SET "snapshot" = pg_temp.siab_fix_provider_spec("snapshot") WHERE "snapshot" IS NOT NULL;
  UPDATE "site_generation_runs" SET "spec" = pg_temp.siab_fix_provider_spec("spec") WHERE "spec" IS NOT NULL;
  UPDATE "site_generation_runs" SET "parsed_output" = pg_temp.siab_fix_provider_spec("parsed_output") WHERE "parsed_output" IS NOT NULL;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("20260715_224720_provider_semantic_contracts is intentionally irreversible because it normalizes persisted provider contracts.")
}
