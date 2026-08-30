import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_hero" DROP COLUMN "eyebrow";
  ALTER TABLE "pages_blocks_hero_minimal" DROP COLUMN "eyebrow";
  ALTER TABLE "pages_blocks_hero_split" DROP COLUMN "eyebrow";
  ALTER TABLE "pages_blocks_hero_portrait" DROP COLUMN "eyebrow";
  ALTER TABLE "pages_blocks_hero_band" DROP COLUMN "eyebrow";
  ALTER TABLE "pages_blocks_hero_card" DROP COLUMN "eyebrow";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_hero" ADD COLUMN "eyebrow" varchar;
  ALTER TABLE "pages_blocks_hero_minimal" ADD COLUMN "eyebrow" varchar;
  ALTER TABLE "pages_blocks_hero_split" ADD COLUMN "eyebrow" varchar;
  ALTER TABLE "pages_blocks_hero_portrait" ADD COLUMN "eyebrow" varchar;
  ALTER TABLE "pages_blocks_hero_band" ADD COLUMN "eyebrow" varchar;
  ALTER TABLE "pages_blocks_hero_card" ADD COLUMN "eyebrow" varchar;`)
}
