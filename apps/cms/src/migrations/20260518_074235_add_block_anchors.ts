import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_hero" ADD COLUMN "anchor" varchar;
  ALTER TABLE "pages_blocks_feature_list" ADD COLUMN "anchor" varchar;
  ALTER TABLE "pages_blocks_testimonials" ADD COLUMN "anchor" varchar;
  ALTER TABLE "pages_blocks_faq" ADD COLUMN "anchor" varchar;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "anchor" varchar;
  ALTER TABLE "pages_blocks_rich_text" ADD COLUMN "anchor" varchar;
  ALTER TABLE "pages_blocks_contact_section" ADD COLUMN "anchor" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  throw new Error("down() not implemented — restore from snapshot per migration safety doctrine (see docs/runbooks/deployment.md)")
}
