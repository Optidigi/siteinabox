import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroMinimal' BEFORE 'services';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroSplit' BEFORE 'services';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroPortrait' BEFORE 'services';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroBand' BEFORE 'services';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroCard' BEFORE 'services';
  CREATE TABLE "pages_blocks_hero_minimal" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_split" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_portrait" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_band" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_card" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"image_id" integer NOT NULL,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "pages_blocks_hero_minimal" ADD CONSTRAINT "pages_blocks_hero_minimal_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_split" ADD CONSTRAINT "pages_blocks_hero_split_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_split" ADD CONSTRAINT "pages_blocks_hero_split_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_portrait" ADD CONSTRAINT "pages_blocks_hero_portrait_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_portrait" ADD CONSTRAINT "pages_blocks_hero_portrait_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_band" ADD CONSTRAINT "pages_blocks_hero_band_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_band" ADD CONSTRAINT "pages_blocks_hero_band_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_card" ADD CONSTRAINT "pages_blocks_hero_card_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_card" ADD CONSTRAINT "pages_blocks_hero_card_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_hero_minimal_order_idx" ON "pages_blocks_hero_minimal" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_minimal_parent_id_idx" ON "pages_blocks_hero_minimal" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_minimal_path_idx" ON "pages_blocks_hero_minimal" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_split_order_idx" ON "pages_blocks_hero_split" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_split_parent_id_idx" ON "pages_blocks_hero_split" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_split_path_idx" ON "pages_blocks_hero_split" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_split_image_idx" ON "pages_blocks_hero_split" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_portrait_order_idx" ON "pages_blocks_hero_portrait" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_portrait_parent_id_idx" ON "pages_blocks_hero_portrait" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_portrait_path_idx" ON "pages_blocks_hero_portrait" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_portrait_image_idx" ON "pages_blocks_hero_portrait" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_band_order_idx" ON "pages_blocks_hero_band" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_band_parent_id_idx" ON "pages_blocks_hero_band" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_band_path_idx" ON "pages_blocks_hero_band" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_band_image_idx" ON "pages_blocks_hero_band" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_card_order_idx" ON "pages_blocks_hero_card" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_card_parent_id_idx" ON "pages_blocks_hero_card" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_card_path_idx" ON "pages_blocks_hero_card" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_card_image_idx" ON "pages_blocks_hero_card" USING btree ("image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "pages_blocks_hero_minimal" CASCADE;
  DROP TABLE "pages_blocks_hero_split" CASCADE;
  DROP TABLE "pages_blocks_hero_portrait" CASCADE;
  DROP TABLE "pages_blocks_hero_band" CASCADE;
  DROP TABLE "pages_blocks_hero_card" CASCADE;
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_block_presets_block_type";
  CREATE TYPE "public"."enum_block_presets_block_type" AS ENUM('hero', 'services', 'about', 'process', 'work', 'reviews', 'pricing', 'faq', 'cta', 'contact', 'richText');
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE "public"."enum_block_presets_block_type" USING "block_type"::"public"."enum_block_presets_block_type";`)
}
