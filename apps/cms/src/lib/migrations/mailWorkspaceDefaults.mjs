// Owning Payload CLI predefined migration. Backfill only pre-existing rows;
// email-only customers are created explicitly after deployment migrations.
export const upSQL = `await db.execute(sql\`
  INSERT INTO tenants_enabled_services ("order", parent_id, value)
  SELECT 1, t.id, 'website'::enum_tenants_enabled_services
  FROM tenants t
  WHERE NOT EXISTS (SELECT 1 FROM tenants_enabled_services s WHERE s.parent_id = t.id);
\`)`
// These grants preserve legacy behavior. Removing one is an operator decision.
export const downSQL = `// Keep the compatibility grants; a schema rollback owns removal of the field.`
