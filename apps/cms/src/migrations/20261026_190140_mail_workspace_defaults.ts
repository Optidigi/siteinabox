import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    INSERT INTO tenants_enabled_services ("order", parent_id, value)
    SELECT 1, t.id, 'website'::enum_tenants_enabled_services
    FROM tenants t
    WHERE NOT EXISTS (SELECT 1 FROM tenants_enabled_services s WHERE s.parent_id = t.id);
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Keep the compatibility grants; a schema rollback owns removal of the field.
}
