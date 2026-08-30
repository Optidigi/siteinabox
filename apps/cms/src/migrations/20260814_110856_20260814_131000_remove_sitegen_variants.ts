import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_hero" DROP COLUMN "variant";
  ALTER TABLE "pages_blocks_services" DROP COLUMN "variant";
  ALTER TABLE "pages_blocks_about" DROP COLUMN "variant";
  ALTER TABLE "pages_blocks_process" DROP COLUMN "variant";
  ALTER TABLE "pages_blocks_work" DROP COLUMN "variant";
  ALTER TABLE "pages_blocks_reviews" DROP COLUMN "variant";
  ALTER TABLE "pages_blocks_pricing" DROP COLUMN "variant";
  ALTER TABLE "pages_blocks_faq" DROP COLUMN "variant";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "variant";
  ALTER TABLE "pages_blocks_contact" DROP COLUMN "variant";
  DROP TYPE "public"."enum_pages_blocks_hero_variant";
  DROP TYPE "public"."enum_pages_blocks_services_variant";
  DROP TYPE "public"."enum_pages_blocks_about_variant";
  DROP TYPE "public"."enum_pages_blocks_process_variant";
  DROP TYPE "public"."enum_pages_blocks_work_variant";
  DROP TYPE "public"."enum_pages_blocks_reviews_variant";
  DROP TYPE "public"."enum_pages_blocks_pricing_variant";
  DROP TYPE "public"."enum_pages_blocks_faq_variant";
  DROP TYPE "public"."enum_pages_blocks_cta_variant";
  DROP TYPE "public"."enum_pages_blocks_contact_variant";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
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
  CREATE TYPE "public"."enum_pages_blocks_contact_variant" AS ENUM('formSplit', 'detailsFirst', 'centered', 'serviceArea', 'appointment');
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "variant" "enum_pages_blocks_hero_variant" DEFAULT 'centered' NOT NULL;
  ALTER TABLE "pages_blocks_services" ADD COLUMN "variant" "enum_pages_blocks_services_variant" DEFAULT 'cards' NOT NULL;
  ALTER TABLE "pages_blocks_about" ADD COLUMN "variant" "enum_pages_blocks_about_variant" DEFAULT 'compact' NOT NULL;
  ALTER TABLE "pages_blocks_process" ADD COLUMN "variant" "enum_pages_blocks_process_variant" DEFAULT 'steps' NOT NULL;
  ALTER TABLE "pages_blocks_work" ADD COLUMN "variant" "enum_pages_blocks_work_variant" DEFAULT 'grid' NOT NULL;
  ALTER TABLE "pages_blocks_reviews" ADD COLUMN "variant" "enum_pages_blocks_reviews_variant" DEFAULT 'cards' NOT NULL;
  ALTER TABLE "pages_blocks_pricing" ADD COLUMN "variant" "enum_pages_blocks_pricing_variant" DEFAULT 'cards' NOT NULL;
  ALTER TABLE "pages_blocks_faq" ADD COLUMN "variant" "enum_pages_blocks_faq_variant" DEFAULT 'accordion' NOT NULL;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "variant" "enum_pages_blocks_cta_variant" DEFAULT 'centered' NOT NULL;
  ALTER TABLE "pages_blocks_contact" ADD COLUMN "variant" "enum_pages_blocks_contact_variant" DEFAULT 'detailsFirst' NOT NULL;`)
}
