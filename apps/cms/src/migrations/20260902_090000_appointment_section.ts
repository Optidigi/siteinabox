import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

/**
 * Adds the canonical page block for the appointment runtime. Scheduling
 * windows remain tenant settings; this table stores only the editable section
 * copy and its presentation choice.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_pages_blocks_appointments_variant"
      AS ENUM ('appointments-01');
    CREATE TYPE "public"."enum_pages_blocks_appointments_presentation"
      AS ENUM ('inline', 'dialog');

    CREATE TABLE "pages_blocks_appointments" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "variant" "public"."enum_pages_blocks_appointments_variant" DEFAULT 'appointments-01' NOT NULL,
      "presentation" "public"."enum_pages_blocks_appointments_presentation" DEFAULT 'dialog' NOT NULL,
      "heading" varchar NOT NULL,
      "body" varchar,
      "availability_label" varchar DEFAULT 'Beschikbaarheid' NOT NULL,
      "booking_label" varchar DEFAULT 'Afspraak aanvragen' NOT NULL,
      "confirmation_heading" varchar DEFAULT 'Afspraak bevestigd' NOT NULL,
      "confirmation_body" varchar,
      "privacy_note" varchar,
      "anchor" varchar,
      "block_name" varchar
    );

    ALTER TABLE "pages_blocks_appointments"
      ADD CONSTRAINT "pages_blocks_appointments_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "pages_blocks_appointments_order_idx"
      ON "pages_blocks_appointments" USING btree ("_order");
    CREATE INDEX "pages_blocks_appointments_parent_id_idx"
      ON "pages_blocks_appointments" USING btree ("_parent_id");
    CREATE INDEX "pages_blocks_appointments_path_idx"
      ON "pages_blocks_appointments" USING btree ("_path");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "pages_blocks_appointments";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_appointments_presentation";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_appointments_variant";
  `)
}
