import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Preserve reusable page content before the generated schema DDL removes
  // the retired block tables. The target tables use the same semantic columns
  // and keep each block id/order stable. A collision is unsafe to resolve
  // automatically, so fail before making any change and require an operator
  // backup/data review.
  await db.execute(sql`
    DO $do$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM public.pages_blocks_hero_minimal AS old_block
        INNER JOIN public.pages_blocks_hero AS new_block ON new_block.id = old_block.id
      ) THEN
        RAISE EXCEPTION USING MESSAGE = 'Cannot migrate heroMinimal rows because a hero row already uses the same id';
      END IF;
      INSERT INTO public.pages_blocks_hero (
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, anchor, block_name
      )
      SELECT "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, anchor, block_name
      FROM public.pages_blocks_hero_minimal;

      IF EXISTS (
        SELECT 1 FROM public.pages_blocks_hero_portrait AS old_block
        INNER JOIN public.pages_blocks_hero_split AS new_block ON new_block.id = old_block.id
      ) THEN
        RAISE EXCEPTION USING MESSAGE = 'Cannot migrate heroPortrait rows because a heroSplit row already uses the same id';
      END IF;
      INSERT INTO public.pages_blocks_hero_split (
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      )
      SELECT "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      FROM public.pages_blocks_hero_portrait;

      IF EXISTS (
        SELECT 1 FROM public.pages_blocks_hero_card AS old_block
        INNER JOIN public.pages_blocks_hero_framed AS new_block ON new_block.id = old_block.id
      ) THEN
        RAISE EXCEPTION USING MESSAGE = 'Cannot migrate heroCard rows because a heroFramed row already uses the same id';
      END IF;
      INSERT INTO public.pages_blocks_hero_framed (
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      )
      SELECT "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      FROM public.pages_blocks_hero_card;

      IF EXISTS (
        SELECT 1 FROM public.pages_blocks_hero_edge AS old_block
        INNER JOIN public.pages_blocks_hero_split AS new_block ON new_block.id = old_block.id
      ) THEN
        RAISE EXCEPTION USING MESSAGE = 'Cannot migrate heroEdge rows because a heroSplit row already uses the same id';
      END IF;
      INSERT INTO public.pages_blocks_hero_split (
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      )
      SELECT "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      FROM public.pages_blocks_hero_edge;

      IF EXISTS (
        SELECT 1 FROM public.pages_blocks_hero_cover_panel AS old_block
        INNER JOIN public.pages_blocks_hero_cover_actions AS new_block ON new_block.id = old_block.id
      ) THEN
        RAISE EXCEPTION USING MESSAGE = 'Cannot migrate heroCoverPanel rows because a heroCoverActions row already uses the same id';
      END IF;
      INSERT INTO public.pages_blocks_hero_cover_actions (
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      )
      SELECT "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      FROM public.pages_blocks_hero_cover_panel;

      IF EXISTS (
        SELECT 1 FROM public.pages_blocks_hero_image_first AS old_block
        INNER JOIN public.pages_blocks_hero_showcase AS new_block ON new_block.id = old_block.id
      ) THEN
        RAISE EXCEPTION USING MESSAGE = 'Cannot migrate heroImageFirst rows because a heroShowcase row already uses the same id';
      END IF;
      INSERT INTO public.pages_blocks_hero_showcase (
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      )
      SELECT "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      FROM public.pages_blocks_hero_image_first;

      IF EXISTS (
        SELECT 1 FROM public.pages_blocks_hero_rail AS old_block
        INNER JOIN public.pages_blocks_hero_split AS new_block ON new_block.id = old_block.id
      ) THEN
        RAISE EXCEPTION USING MESSAGE = 'Cannot migrate heroRail rows because a heroSplit row already uses the same id';
      END IF;
      INSERT INTO public.pages_blocks_hero_split (
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      )
      SELECT "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      FROM public.pages_blocks_hero_rail;

      IF EXISTS (
        SELECT 1 FROM public.pages_blocks_hero_grid_split AS old_block
        INNER JOIN public.pages_blocks_hero_split AS new_block ON new_block.id = old_block.id
      ) THEN
        RAISE EXCEPTION USING MESSAGE = 'Cannot migrate heroGridSplit rows because a heroSplit row already uses the same id';
      END IF;
      INSERT INTO public.pages_blocks_hero_split (
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      )
      SELECT "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      FROM public.pages_blocks_hero_grid_split;

      IF EXISTS (
        SELECT 1 FROM public.pages_blocks_hero_aside AS old_block
        INNER JOIN public.pages_blocks_hero_framed AS new_block ON new_block.id = old_block.id
      ) THEN
        RAISE EXCEPTION USING MESSAGE = 'Cannot migrate heroAside rows because a heroFramed row already uses the same id';
      END IF;
      INSERT INTO public.pages_blocks_hero_framed (
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      )
      SELECT "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href, image_id, anchor, block_name
      FROM public.pages_blocks_hero_aside;
    END $do$;
  `)

  // Published snapshots are immutable audit data, but active snapshots are
  // runtime inputs for the public renderer. Do not rewrite them in SQL;
  // require the supported republish flow before applying this cutover. Older
  // generation-run payloads remain historical audit data and are not replayed
  // by the new runtime, so they are intentionally preserved untouched.
  await db.execute(sql`
    DO $do$
    DECLARE
      retired_pattern text := '"blockType"[[:space:]]*:[[:space:]]*"(heroMinimal|heroPortrait|heroCard|heroEdge|heroCoverPanel|heroImageFirst|heroRail|heroGridSplit|heroAside)"';
      row_count bigint;
    BEGIN
      IF to_regclass('public.published_site_snapshots') IS NOT NULL THEN
        EXECUTE format($query$
          SELECT count(*) FROM public.published_site_snapshots
          WHERE status = 'active' AND snapshot::text ~ %L
        $query$, retired_pattern) INTO row_count;
        IF row_count > 0 THEN
          RAISE EXCEPTION USING MESSAGE = 'Cannot remove retired heroes while an active published snapshot still contains them', HINT = 'Regenerate and republish the affected tenant snapshot through the supported publication flow, then retry.';
        END IF;
      END IF;

    END $do$;
  `)

  await db.execute(sql`
   DROP TABLE "pages_blocks_hero_minimal" CASCADE;
  DROP TABLE "pages_blocks_hero_portrait" CASCADE;
  DROP TABLE "pages_blocks_hero_card" CASCADE;
  DROP TABLE "pages_blocks_hero_edge" CASCADE;
  DROP TABLE "pages_blocks_hero_cover_panel" CASCADE;
  DROP TABLE "pages_blocks_hero_image_first" CASCADE;
  DROP TABLE "pages_blocks_hero_rail" CASCADE;
  DROP TABLE "pages_blocks_hero_grid_split" CASCADE;
  DROP TABLE "pages_blocks_hero_aside" CASCADE;
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE text;
  UPDATE "block_presets"
  SET "block_type" = CASE "block_type"
    WHEN 'heroMinimal' THEN 'hero'
    WHEN 'heroPortrait' THEN 'heroSplit'
    WHEN 'heroCard' THEN 'heroFramed'
    WHEN 'heroEdge' THEN 'heroSplit'
    WHEN 'heroCoverPanel' THEN 'heroCoverActions'
    WHEN 'heroImageFirst' THEN 'heroShowcase'
    WHEN 'heroRail' THEN 'heroSplit'
    WHEN 'heroGridSplit' THEN 'heroSplit'
    WHEN 'heroAside' THEN 'heroFramed'
    ELSE "block_type"
  END
  WHERE "block_type" IN ('heroMinimal', 'heroPortrait', 'heroCard', 'heroEdge', 'heroCoverPanel', 'heroImageFirst', 'heroRail', 'heroGridSplit', 'heroAside');
  DROP TYPE "public"."enum_block_presets_block_type";
  CREATE TYPE "public"."enum_block_presets_block_type" AS ENUM('hero', 'heroSplit', 'heroEditorial', 'heroFramed', 'heroAngled', 'heroColorField', 'heroColorImage', 'heroPhotoStage', 'heroPatternSplit', 'heroPatternBand', 'heroShowcase', 'heroCoverActions', 'heroServiceMosaic', 'heroServicePanel', 'services', 'about', 'process', 'work', 'reviews', 'pricing', 'faq', 'cta', 'contact', 'richText');
  ALTER TABLE "block_presets" ALTER COLUMN "block_type" SET DATA TYPE "public"."enum_block_presets_block_type" USING "block_type"::"public"."enum_block_presets_block_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  throw new Error("This migration transforms retired hero rows and block presets; restore a database backup to roll it back.")

  // The generated reverse DDL below is retained as schema-generation history,
  // but is intentionally unreachable because it cannot restore transformed
  // content without the original backup.
  await db.execute(sql`
   ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroMinimal' BEFORE 'heroSplit';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroPortrait' BEFORE 'heroEditorial';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroCard' BEFORE 'heroEditorial';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroEdge' BEFORE 'heroColorField';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroCoverPanel' BEFORE 'heroColorField';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroImageFirst' BEFORE 'heroColorField';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroRail' BEFORE 'heroColorField';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroGridSplit' BEFORE 'heroPhotoStage';
  ALTER TYPE "public"."enum_block_presets_block_type" ADD VALUE 'heroAside' BEFORE 'heroShowcase';
  CREATE TABLE "pages_blocks_hero_minimal" (
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
  
  CREATE TABLE "pages_blocks_hero_portrait" (
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
  
  CREATE TABLE "pages_blocks_hero_card" (
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
  
  CREATE TABLE "pages_blocks_hero_grid_split" (
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
  
  CREATE TABLE "pages_blocks_hero_aside" (
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
  
  ALTER TABLE "pages_blocks_hero_minimal" ADD CONSTRAINT "pages_blocks_hero_minimal_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_portrait" ADD CONSTRAINT "pages_blocks_hero_portrait_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_portrait" ADD CONSTRAINT "pages_blocks_hero_portrait_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_card" ADD CONSTRAINT "pages_blocks_hero_card_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_card" ADD CONSTRAINT "pages_blocks_hero_card_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_edge" ADD CONSTRAINT "pages_blocks_hero_edge_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_edge" ADD CONSTRAINT "pages_blocks_hero_edge_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_cover_panel" ADD CONSTRAINT "pages_blocks_hero_cover_panel_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_cover_panel" ADD CONSTRAINT "pages_blocks_hero_cover_panel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_image_first" ADD CONSTRAINT "pages_blocks_hero_image_first_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_image_first" ADD CONSTRAINT "pages_blocks_hero_image_first_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_rail" ADD CONSTRAINT "pages_blocks_hero_rail_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_rail" ADD CONSTRAINT "pages_blocks_hero_rail_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_grid_split" ADD CONSTRAINT "pages_blocks_hero_grid_split_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_grid_split" ADD CONSTRAINT "pages_blocks_hero_grid_split_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_aside" ADD CONSTRAINT "pages_blocks_hero_aside_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_aside" ADD CONSTRAINT "pages_blocks_hero_aside_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_hero_minimal_order_idx" ON "pages_blocks_hero_minimal" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_minimal_parent_id_idx" ON "pages_blocks_hero_minimal" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_minimal_path_idx" ON "pages_blocks_hero_minimal" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_portrait_order_idx" ON "pages_blocks_hero_portrait" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_portrait_parent_id_idx" ON "pages_blocks_hero_portrait" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_portrait_path_idx" ON "pages_blocks_hero_portrait" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_portrait_image_idx" ON "pages_blocks_hero_portrait" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_card_order_idx" ON "pages_blocks_hero_card" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_card_parent_id_idx" ON "pages_blocks_hero_card" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_card_path_idx" ON "pages_blocks_hero_card" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_card_image_idx" ON "pages_blocks_hero_card" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_edge_order_idx" ON "pages_blocks_hero_edge" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_edge_parent_id_idx" ON "pages_blocks_hero_edge" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_edge_path_idx" ON "pages_blocks_hero_edge" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_edge_image_idx" ON "pages_blocks_hero_edge" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_cover_panel_order_idx" ON "pages_blocks_hero_cover_panel" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_cover_panel_parent_id_idx" ON "pages_blocks_hero_cover_panel" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_cover_panel_path_idx" ON "pages_blocks_hero_cover_panel" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_cover_panel_image_idx" ON "pages_blocks_hero_cover_panel" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_image_first_order_idx" ON "pages_blocks_hero_image_first" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_image_first_parent_id_idx" ON "pages_blocks_hero_image_first" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_image_first_path_idx" ON "pages_blocks_hero_image_first" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_image_first_image_idx" ON "pages_blocks_hero_image_first" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_rail_order_idx" ON "pages_blocks_hero_rail" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_rail_parent_id_idx" ON "pages_blocks_hero_rail" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_rail_path_idx" ON "pages_blocks_hero_rail" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_rail_image_idx" ON "pages_blocks_hero_rail" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_grid_split_order_idx" ON "pages_blocks_hero_grid_split" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_grid_split_parent_id_idx" ON "pages_blocks_hero_grid_split" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_grid_split_path_idx" ON "pages_blocks_hero_grid_split" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_grid_split_image_idx" ON "pages_blocks_hero_grid_split" USING btree ("image_id");
  CREATE INDEX "pages_blocks_hero_aside_order_idx" ON "pages_blocks_hero_aside" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_aside_parent_id_idx" ON "pages_blocks_hero_aside" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_aside_path_idx" ON "pages_blocks_hero_aside" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_aside_image_idx" ON "pages_blocks_hero_aside" USING btree ("image_id");`)
}
