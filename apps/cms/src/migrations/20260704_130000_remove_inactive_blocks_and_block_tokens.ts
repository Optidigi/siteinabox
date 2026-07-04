import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      block_table record;
    BEGIN
      FOR block_table IN
        SELECT table_schema, table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name LIKE 'pages_blocks_%'
          AND column_name = 'tokens'
      LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP COLUMN IF EXISTS "tokens"', block_table.table_schema, block_table.table_name);
      END LOOP;
    END $$;

    DROP TABLE IF EXISTS "pages_blocks_comparison_rows" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_comparison_columns" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_comparison" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_process_steps_steps" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_process_steps" CASCADE;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      block_table record;
    BEGIN
      FOR block_table IN
        SELECT table_schema, table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name LIKE 'pages_blocks_%'
          AND column_name = '_path'
      LOOP
        EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS "tokens" jsonb', block_table.table_schema, block_table.table_name);
      END LOOP;
    END $$;

    CREATE TABLE IF NOT EXISTS "pages_blocks_process_steps" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" jsonb,
      "intro" jsonb,
      "design_variant" varchar,
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
      "design_variant" varchar,
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

    DO $$ BEGIN ALTER TABLE "pages_blocks_process_steps" ADD CONSTRAINT "pages_blocks_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_process_steps_steps" ADD CONSTRAINT "pages_blocks_process_steps_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_process_steps"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_process_steps_steps" ADD CONSTRAINT "pages_blocks_process_steps_steps_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_comparison" ADD CONSTRAINT "pages_blocks_comparison_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_comparison_columns" ADD CONSTRAINT "pages_blocks_comparison_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_comparison"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_comparison_rows" ADD CONSTRAINT "pages_blocks_comparison_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_comparison"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;

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
  `)
}
