import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION pg_temp.siab_shadcnui_pages(input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
    DECLARE page jsonb; block jsonb; pages jsonb := '[]'; blocks jsonb; block_type text; variant text;
    BEGIN
      IF input IS NULL THEN RETURN NULL; END IF;
      IF jsonb_typeof(input) <> 'array' THEN RETURN input; END IF;
      FOR page IN SELECT value FROM jsonb_array_elements(input) LOOP
        blocks := '[]'::jsonb;
        FOR block IN SELECT value FROM jsonb_array_elements(COALESCE(page->'blocks', '[]'::jsonb)) LOOP
          block_type := block->>'blockType'; variant := COALESCE(block->>'designVariant', '');
          IF variant NOT LIKE 'amicare%' THEN
            IF block_type = 'newsletter' THEN
              block := (block - 'emailLabel' - 'emailPlaceholder' - 'submitLabel' - 'consentLabel' - 'benefits' - 'provider') || jsonb_build_object('blockType','cta','headline',COALESCE(block->'title','{"t":"root","variant":"inline","children":[{"t":"text","v":"Nieuwsbrief"}]}'::jsonb),'primary',jsonb_build_object('label',COALESCE(block->>'submitLabel','Aanmelden'),'href',COALESCE(block#>>'{provider,action}','/#contact')));
              block_type := 'cta';
            ELSIF block_type = 'bentoGrid' THEN
              block := (block - 'items') || jsonb_build_object('blockType','featureList','features',COALESCE(block->'items','[]'::jsonb)); block_type := 'featureList';
            ELSIF block_type = 'richText' THEN
              block := block || jsonb_build_object('blockType','contentSection'); block_type := 'contentSection';
            END IF;
            variant := CASE block_type
              WHEN 'hero' THEN CASE WHEN variant LIKE '%with-stats%' THEN 'shadcnui-blocks.hero-02' ELSE 'shadcnui-blocks.hero-01' END
              WHEN 'featureList' THEN 'shadcnui-blocks.features-01' WHEN 'testimonials' THEN 'shadcnui-blocks.testimonials-01'
              WHEN 'faq' THEN 'shadcnui-blocks.faq-01' WHEN 'cta' THEN 'shadcnui-blocks.cta-01' WHEN 'contactSection' THEN 'shadcnui-blocks.contact-01'
              WHEN 'pricing' THEN 'shadcnui-blocks.pricing-01' WHEN 'stats' THEN 'shadcnui-blocks.stats-01' WHEN 'logoCloud' THEN 'shadcnui-blocks.logo-cloud-01'
              WHEN 'gallery' THEN 'shadcnui-blocks.carousel-block-01' WHEN 'team' THEN 'shadcnui-blocks.team-01' WHEN 'blogCards' THEN 'shadcnui-blocks.blog-01'
              WHEN 'contentSection' THEN 'shadcnui-blocks.timeline-01' ELSE variant END;
            block := jsonb_set(block, '{designVariant}', to_jsonb(variant), true);
          END IF;
          blocks := blocks || jsonb_build_array(block);
        END LOOP;
        pages := pages || jsonb_build_array(jsonb_set(page, '{blocks}', blocks, true));
      END LOOP;
      RETURN pages;
    END $$;

    CREATE OR REPLACE FUNCTION pg_temp.siab_shadcnui_spec(input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
    DECLARE out jsonb := input;
    BEGIN
      IF input IS NULL THEN RETURN NULL; END IF;
      IF jsonb_typeof(input) = 'array' THEN RETURN pg_temp.siab_shadcnui_pages(input); END IF;
      IF input ? 'pages' THEN out := jsonb_set(out, '{pages}', pg_temp.siab_shadcnui_pages(COALESCE(input->'pages', '[]'::jsonb)), true); END IF;
      IF out#>'{settings,chrome,header}' IS NOT NULL AND COALESCE(out#>>'{settings,chrome,header,variant}','') NOT LIKE 'amicare%' THEN out := jsonb_set(out, '{settings,chrome,header,variant}', '"shadcnui-blocks.navbar-01"', true); END IF;
      IF out#>'{settings,chrome,footer}' IS NOT NULL AND COALESCE(out#>>'{settings,chrome,footer,variant}','') NOT LIKE 'amicare%' THEN out := jsonb_set(out, '{settings,chrome,footer,variant}', '"shadcnui-blocks.footer-01"', true); END IF;
      IF out#>'{settings,chrome,banner}' IS NOT NULL THEN
        out := jsonb_set(out, '{settings,chrome,banner,variant}', CASE WHEN COALESCE((out#>>'{settings,analyticsConsent,enabled}')::boolean, false) THEN '"shadcnui-blocks.banner-04"'::jsonb ELSE '"shadcnui-blocks.banner-01"'::jsonb END, true);
      END IF;
      RETURN out;
    END $$;

    -- Early development databases used JSON draft/run tables before the
    -- canonical collections below existed. Keep these updates conditional so
    -- the same forward migration is valid for both schema histories.
    DO $$ BEGIN
      IF to_regclass('public.site_drafts') IS NOT NULL THEN
        EXECUTE 'UPDATE "site_drafts" SET "pages" = pg_temp.siab_shadcnui_pages("pages") WHERE "pages" IS NOT NULL';
      END IF;
      IF to_regclass('public.generation_runs') IS NOT NULL THEN
        EXECUTE 'UPDATE "generation_runs" SET "input" = pg_temp.siab_shadcnui_spec("input") WHERE "input" IS NOT NULL';
      END IF;
    END $$;

    UPDATE "published_site_snapshots" SET "snapshot" = pg_temp.siab_shadcnui_spec("snapshot") WHERE "snapshot" IS NOT NULL;
    UPDATE "site_generation_runs" SET "spec" = pg_temp.siab_shadcnui_spec("spec") WHERE "spec" IS NOT NULL;
    UPDATE "site_generation_runs" SET "parsed_output" = pg_temp.siab_shadcnui_spec("parsed_output") WHERE "parsed_output" IS NOT NULL;

    UPDATE "pages_blocks_hero" SET "design_variant" = CASE WHEN "design_variant" LIKE '%with-stats%' THEN 'shadcnui-blocks.hero-02' ELSE 'shadcnui-blocks.hero-01' END WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';
    UPDATE "pages_blocks_feature_list" SET "design_variant" = 'shadcnui-blocks.features-01' WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';
    UPDATE "pages_blocks_testimonials" SET "design_variant" = 'shadcnui-blocks.testimonials-01' WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';
    UPDATE "pages_blocks_faq" SET "design_variant" = 'shadcnui-blocks.faq-01' WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';
    UPDATE "pages_blocks_cta" SET "design_variant" = 'shadcnui-blocks.cta-01' WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';
    UPDATE "pages_blocks_contact_section" SET "design_variant" = 'shadcnui-blocks.contact-01' WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';
    UPDATE "pages_blocks_pricing" SET "design_variant" = 'shadcnui-blocks.pricing-01' WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';
    UPDATE "pages_blocks_stats" SET "design_variant" = 'shadcnui-blocks.stats-01' WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';
    UPDATE "pages_blocks_logo_cloud" SET "design_variant" = 'shadcnui-blocks.logo-cloud-01' WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';
    UPDATE "pages_blocks_gallery" SET "design_variant" = 'shadcnui-blocks.carousel-block-01' WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';
    UPDATE "pages_blocks_team" SET "design_variant" = 'shadcnui-blocks.team-01' WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';
    UPDATE "pages_blocks_blog_cards" SET "design_variant" = 'shadcnui-blocks.blog-01' WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';
    UPDATE "pages_blocks_content_section" SET "design_variant" = 'shadcnui-blocks.timeline-01' WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';

    INSERT INTO "pages_blocks_content_section" ("_order","_parent_id","_path","id","body","design_variant","metadata","anchor","block_name")
      SELECT "_order","_parent_id",replace("_path",'richText','contentSection'),"id","body",'shadcnui-blocks.timeline-01',"metadata","anchor","block_name" FROM "pages_blocks_rich_text" WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%'
      ON CONFLICT ("id") DO NOTHING;
    DELETE FROM "pages_blocks_rich_text" WHERE COALESCE("design_variant", '') NOT LIKE 'amicare%';

    INSERT INTO "pages_blocks_cta" ("_order","_parent_id","_path","id","headline","description","primary_label","primary_href","design_variant","metadata","anchor","block_name")
      SELECT "_order","_parent_id",replace("_path",'newsletter','cta'),"id",COALESCE("title",'{"t":"root","variant":"inline","children":[{"t":"text","v":"Nieuwsbrief"}]}'::jsonb),"description",COALESCE("submit_label",'Aanmelden'),COALESCE("provider_action",'/#contact'),'shadcnui-blocks.cta-01',"metadata","anchor","block_name" FROM "pages_blocks_newsletter";
    DELETE FROM "pages_blocks_newsletter";

    INSERT INTO "pages_blocks_feature_list" ("_order","_parent_id","_path","id","title","intro","design_variant","metadata","anchor","block_name")
      SELECT "_order","_parent_id",replace("_path",'bentoGrid','featureList'),"id","title","intro",'shadcnui-blocks.features-01',"metadata","anchor","block_name" FROM "pages_blocks_bento_grid";
    INSERT INTO "pages_blocks_feature_list_features" ("_order","_parent_id","id","title","description","icon")
      SELECT "_order","_parent_id","id","title","description","icon" FROM "pages_blocks_bento_grid_items";
    DELETE FROM "pages_blocks_bento_grid";

    ALTER TABLE "site_settings" ALTER COLUMN "chrome_header_variant" TYPE varchar USING "chrome_header_variant"::text;
    ALTER TABLE "site_settings" ALTER COLUMN "chrome_footer_variant" TYPE varchar USING "chrome_footer_variant"::text;
    ALTER TABLE "site_settings" ALTER COLUMN "chrome_banner_variant" TYPE varchar USING "chrome_banner_variant"::text;
    UPDATE "site_settings" SET "chrome_header_variant"='shadcnui-blocks.navbar-01' WHERE COALESCE("chrome_header_variant", '') NOT LIKE 'amicare%';
    UPDATE "site_settings" SET "chrome_footer_variant"='shadcnui-blocks.footer-01' WHERE COALESCE("chrome_footer_variant", '') NOT LIKE 'amicare%';
    UPDATE "site_settings" SET "chrome_banner_variant"='shadcnui-blocks.banner-01' WHERE "chrome_banner_variant" IS NOT NULL;
    DROP TYPE IF EXISTS "public"."enum_site_settings_chrome_header_variant";
    DROP TYPE IF EXISTS "public"."enum_site_settings_chrome_footer_variant";
    DROP TYPE IF EXISTS "public"."enum_site_settings_chrome_banner_variant";
    CREATE TYPE "public"."enum_site_settings_chrome_header_variant" AS ENUM('amicareZen','shadcnui-blocks.navbar-01','shadcnui-blocks.navbar-02','shadcnui-blocks.navbar-03','shadcnui-blocks.navbar-04','shadcnui-blocks.navbar-05');
    CREATE TYPE "public"."enum_site_settings_chrome_footer_variant" AS ENUM('amicareZen','shadcnui-blocks.footer-01','shadcnui-blocks.footer-02','shadcnui-blocks.footer-03','shadcnui-blocks.footer-04','shadcnui-blocks.footer-05','shadcnui-blocks.footer-06','shadcnui-blocks.footer-07');
    CREATE TYPE "public"."enum_site_settings_chrome_banner_variant" AS ENUM('shadcnui-blocks.banner-01','shadcnui-blocks.banner-02','shadcnui-blocks.banner-03','shadcnui-blocks.banner-04');
    ALTER TABLE "site_settings" ALTER COLUMN "chrome_header_variant" TYPE "public"."enum_site_settings_chrome_header_variant" USING "chrome_header_variant"::"public"."enum_site_settings_chrome_header_variant";
    ALTER TABLE "site_settings" ALTER COLUMN "chrome_footer_variant" TYPE "public"."enum_site_settings_chrome_footer_variant" USING "chrome_footer_variant"::"public"."enum_site_settings_chrome_footer_variant";
    ALTER TABLE "site_settings" ALTER COLUMN "chrome_banner_variant" TYPE "public"."enum_site_settings_chrome_banner_variant" USING "chrome_banner_variant"::"public"."enum_site_settings_chrome_banner_variant";
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("20260715_120000_migrate_shadcnui_blocks_provider is intentionally irreversible: restored legacy provider data would fail the current contracts.")
}
