import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

/**
 * Wave 5 — grow `site_settings` to model the business-info fields the
 * SIAB orchestrator ships during tenant seeding (description, language,
 * aliases, NAP, opening hours, service area).
 *
 * Purely additive — no existing column is altered, no row is touched.
 * Production has 0 site-settings rows at apply time, so no backfill is needed.
 *
 * Note: Payload's autogen also wanted to flip the tenant-FK ON DELETE actions
 * on media/pages/site_settings/forms back from CASCADE → SET NULL — that's
 * spurious drift caused by the schema config not declaring ON DELETE explicitly
 * (Wave 2's cascade_tenant_delete migration applied the CASCADE directly via
 * raw SQL). Those FK statements have been removed from this migration; the
 * snapshot JSON has been hand-edited to record `cascade` for those FKs, the
 * same way Wave 2's snapshot does, so the next autogen won't re-introduce
 * the drift.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_hours_day" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
  CREATE TABLE "site_settings_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"host" varchar NOT NULL
  );

  CREATE TABLE "site_settings_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" "enum_site_settings_hours_day" NOT NULL,
  	"open" varchar,
  	"close" varchar,
  	"closed" boolean DEFAULT false
  );

  CREATE TABLE "site_settings_service_area" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL
  );

  ALTER TABLE "site_settings" ADD COLUMN "description" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "language" varchar DEFAULT 'en';
  ALTER TABLE "site_settings" ADD COLUMN "nap_legal_name" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "nap_street_address" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "nap_city" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "nap_region" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "nap_postal_code" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "nap_country" varchar DEFAULT 'NL';
  ALTER TABLE "site_settings_aliases" ADD CONSTRAINT "site_settings_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_hours" ADD CONSTRAINT "site_settings_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_service_area" ADD CONSTRAINT "site_settings_service_area_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "site_settings_aliases_order_idx" ON "site_settings_aliases" USING btree ("_order");
  CREATE INDEX "site_settings_aliases_parent_id_idx" ON "site_settings_aliases" USING btree ("_parent_id");
  CREATE INDEX "site_settings_hours_order_idx" ON "site_settings_hours" USING btree ("_order");
  CREATE INDEX "site_settings_hours_parent_id_idx" ON "site_settings_hours" USING btree ("_parent_id");
  CREATE INDEX "site_settings_service_area_order_idx" ON "site_settings_service_area" USING btree ("_order");
  CREATE INDEX "site_settings_service_area_parent_id_idx" ON "site_settings_service_area" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "site_settings_aliases" CASCADE;
  DROP TABLE "site_settings_hours" CASCADE;
  DROP TABLE "site_settings_service_area" CASCADE;
  ALTER TABLE "site_settings" DROP COLUMN "description";
  ALTER TABLE "site_settings" DROP COLUMN "language";
  ALTER TABLE "site_settings" DROP COLUMN "nap_legal_name";
  ALTER TABLE "site_settings" DROP COLUMN "nap_street_address";
  ALTER TABLE "site_settings" DROP COLUMN "nap_city";
  ALTER TABLE "site_settings" DROP COLUMN "nap_region";
  ALTER TABLE "site_settings" DROP COLUMN "nap_postal_code";
  ALTER TABLE "site_settings" DROP COLUMN "nap_country";
  DROP TYPE "public"."enum_site_settings_hours_day";`)
}
