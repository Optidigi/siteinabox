import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_pages_blocks_contact_section_fields_type" ADD VALUE IF NOT EXISTS 'select';
    ALTER TYPE "public"."enum_pages_blocks_contact_section_fields_type" ADD VALUE IF NOT EXISTS 'checkbox';

    ALTER TABLE "pages_blocks_feature_list" ADD COLUMN "eyebrow" jsonb;
    ALTER TABLE "pages_blocks_feature_list" ADD COLUMN "image_id" integer;
    ALTER TABLE "pages_blocks_testimonials" ADD COLUMN "logo_id" integer;

    DO $$ BEGIN ALTER TABLE "pages_blocks_feature_list" ADD CONSTRAINT "pages_blocks_feature_list_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_testimonials" ADD CONSTRAINT "pages_blocks_testimonials_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "pages_blocks_feature_list_image_idx" ON "pages_blocks_feature_list" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_testimonials_logo_idx" ON "pages_blocks_testimonials" USING btree ("logo_id");

    CREATE TABLE IF NOT EXISTS "pages_blocks_contact_section_fields_options" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "value" varchar NOT NULL
    );

    DO $$ BEGIN ALTER TABLE "pages_blocks_contact_section_fields_options" ADD CONSTRAINT "pages_blocks_contact_section_fields_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact_section_fields"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "pages_blocks_contact_section_fields_options_order_idx" ON "pages_blocks_contact_section_fields_options" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_contact_section_fields_options_parent_id_idx" ON "pages_blocks_contact_section_fields_options" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "pages_blocks_contact_section_fields_options" CASCADE;
    DROP INDEX IF EXISTS "pages_blocks_feature_list_image_idx";
    DROP INDEX IF EXISTS "pages_blocks_testimonials_logo_idx";
    ALTER TABLE "pages_blocks_feature_list" DROP CONSTRAINT IF EXISTS "pages_blocks_feature_list_image_id_media_id_fk";
    ALTER TABLE "pages_blocks_testimonials" DROP CONSTRAINT IF EXISTS "pages_blocks_testimonials_logo_id_media_id_fk";
    ALTER TABLE "pages_blocks_feature_list" DROP COLUMN IF EXISTS "image_id";
    ALTER TABLE "pages_blocks_feature_list" DROP COLUMN IF EXISTS "eyebrow";
    ALTER TABLE "pages_blocks_testimonials" DROP COLUMN IF EXISTS "logo_id";
  `)
}
