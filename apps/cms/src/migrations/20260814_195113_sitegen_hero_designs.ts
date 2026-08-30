import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroEditorial' BEFORE 'services';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroFramed' BEFORE 'services';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroAngled' BEFORE 'services';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroEdge' BEFORE 'services';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroCoverPanel' BEFORE 'services';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroImageBelow' BEFORE 'services';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroImageFirst' BEFORE 'services';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroRail' BEFORE 'services';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroColorField' BEFORE 'services';
  CREATE TABLE "pages_blocks_hero_editorial" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"primary_action_label" varchar NOT NULL,
  	"primary_action_href" varchar NOT NULL,
  	"secondary_action_label" varchar,
  	"secondary_action_href" varchar,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_framed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
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
  
  CREATE TABLE "pages_blocks_hero_angled" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
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
  
  CREATE TABLE "pages_blocks_hero_edge" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
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
  
  CREATE TABLE "pages_blocks_hero_cover_panel" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
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
  
  CREATE TABLE "pages_blocks_hero_image_below" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
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
  
  CREATE TABLE "pages_blocks_hero_image_first" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
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
  
  CREATE TABLE "pages_blocks_hero_rail" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
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
  
  CREATE TABLE "pages_blocks_hero_color_field" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
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
  
  ALTER TABLE "pages_blocks_hero_editorial" ADD CONSTRAINT "pages_blocks_hero_editorial_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_framed" ADD CONSTRAINT "pages_blocks_hero_framed_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_framed" ADD CONSTRAINT "pages_blocks_hero_framed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_angled" ADD CONSTRAINT "pages_blocks_hero_angled_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_angled" ADD CONSTRAINT "pages_blocks_hero_angled_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_edge" ADD CONSTRAINT "pages_blocks_hero_edge_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_edge" ADD CONSTRAINT "pages_blocks_hero_edge_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_cover_panel" ADD CONSTRAINT "pages_blocks_hero_cover_panel_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_cover_panel" ADD CONSTRAINT "pages_blocks_hero_cover_panel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_image_below" ADD CONSTRAINT "pages_blocks_hero_image_below_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_image_below" ADD CONSTRAINT "pages_blocks_hero_image_below_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_image_first" ADD CONSTRAINT "pages_blocks_hero_image_first_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_image_first" ADD CONSTRAINT "pages_blocks_hero_image_first_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_rail" ADD CONSTRAINT "pages_blocks_hero_rail_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_rail" ADD CONSTRAINT "pages_blocks_hero_rail_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_color_field" ADD CONSTRAINT "pages_blocks_hero_color_field_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_color_field" ADD CONSTRAINT "pages_blocks_hero_color_field_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_hero_editorial_order_idx" ON "pages_blocks_hero_editorial" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_editorial_parent_id_idx" ON "pages_blocks_hero_editorial" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_editorial_path_idx" ON "pages_blocks_hero_editorial" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_framed_order_idx" ON "pages_blocks_hero_framed" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_framed_parent_id_idx" ON "pages_blocks_hero_framed" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_framed_path_idx" ON "pages_blocks_hero_framed" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_framed_image_idx" ON "pages_blocks_hero_framed" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_angled_order_idx" ON "pages_blocks_hero_angled" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_angled_parent_id_idx" ON "pages_blocks_hero_angled" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_angled_path_idx" ON "pages_blocks_hero_angled" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_angled_image_idx" ON "pages_blocks_hero_angled" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_edge_order_idx" ON "pages_blocks_hero_edge" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_edge_parent_id_idx" ON "pages_blocks_hero_edge" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_edge_path_idx" ON "pages_blocks_hero_edge" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_edge_image_idx" ON "pages_blocks_hero_edge" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_cover_panel_order_idx" ON "pages_blocks_hero_cover_panel" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_cover_panel_parent_id_idx" ON "pages_blocks_hero_cover_panel" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_cover_panel_path_idx" ON "pages_blocks_hero_cover_panel" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_cover_panel_image_idx" ON "pages_blocks_hero_cover_panel" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_image_below_order_idx" ON "pages_blocks_hero_image_below" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_image_below_parent_id_idx" ON "pages_blocks_hero_image_below" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_image_below_path_idx" ON "pages_blocks_hero_image_below" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_image_below_image_idx" ON "pages_blocks_hero_image_below" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_image_first_order_idx" ON "pages_blocks_hero_image_first" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_image_first_parent_id_idx" ON "pages_blocks_hero_image_first" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_image_first_path_idx" ON "pages_blocks_hero_image_first" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_image_first_image_idx" ON "pages_blocks_hero_image_first" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_rail_order_idx" ON "pages_blocks_hero_rail" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_rail_parent_id_idx" ON "pages_blocks_hero_rail" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_rail_path_idx" ON "pages_blocks_hero_rail" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_rail_image_idx" ON "pages_blocks_hero_rail" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_color_field_order_idx" ON "pages_blocks_hero_color_field" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_color_field_parent_id_idx" ON "pages_blocks_hero_color_field" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_color_field_path_idx" ON "pages_blocks_hero_color_field" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_color_field_image_idx" ON "pages_blocks_hero_color_field" USING btree ("image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "pages_blocks_hero_editorial" CASCADE;
  DROP TABLE "pages_blocks_hero_framed" CASCADE;
  DROP TABLE "pages_blocks_hero_angled" CASCADE;
  DROP TABLE "pages_blocks_hero_edge" CASCADE;
  DROP TABLE "pages_blocks_hero_cover_panel" CASCADE;
  DROP TABLE "pages_blocks_hero_image_below" CASCADE;
  DROP TABLE "pages_blocks_hero_image_first" CASCADE;
  DROP TABLE "pages_blocks_hero_rail" CASCADE;
  DROP TABLE "pages_blocks_hero_color_field" CASCADE;
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_block_presets_block_type";
  CREATE TYPE "public"."enum_block_presets_block_type" AS ENUM('hero', 'heroMinimal', 'heroSplit', 'heroPortrait', 'heroBand', 'heroCard', 'services', 'about', 'process', 'work', 'reviews', 'pricing', 'faq', 'cta', 'contact', 'richText');
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE "public"."enum_block_presets_block_type" USING "block_type"::"public"."enum_block_presets_block_type";`)
}
