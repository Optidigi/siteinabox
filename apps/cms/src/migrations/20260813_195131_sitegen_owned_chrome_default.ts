import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ALTER COLUMN "system_templates_not_found_variant" SET DEFAULT 'default';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // The preceding cutover migration already owns the only valid value for
  // this enum. Keep rollback valid and deterministic; restoring the removed
  // provider-era default would make the current enum invalid.
  await db.execute(sql`
   ALTER TABLE "site_settings" ALTER COLUMN "system_templates_not_found_variant" SET DEFAULT 'default';`)
}
