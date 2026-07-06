import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const result = await db.execute(sql`
    SELECT id, theme
    FROM tenants
    WHERE theme IS NOT NULL
  `)
  const tenants: Array<{ id: number | string; theme?: Record<string, unknown> | null }> =
    Array.isArray((result as any)?.rows)
      ? (result as any).rows
      : Array.isArray(result as any)
        ? (result as any)
        : []

  for (const tenant of tenants) {
    const theme = (tenant as { theme?: Record<string, unknown> }).theme
    if (!theme || typeof theme !== "object") continue

    const next: Record<string, unknown> = { ...theme }
    const fonts = (theme.fonts ?? {}) as Record<string, string | undefined>
    let dirty = false

    // Map fonts.{sans,serif,script} → fonts.{title,heading,text} if legacy keys exist.
    if (fonts.sans !== undefined || fonts.serif !== undefined || fonts.script !== undefined) {
      const remapped: Record<string, string | undefined> = {
        text: fonts.sans,
        heading: fonts.serif,
        title: fonts.script ?? fonts.serif,
      }
      // Strip empty / undefined values so the result matches the strict schema.
      next.fonts = Object.fromEntries(
        Object.entries(remapped).filter(([, v]) => v),
      )
      dirty = true
    }

    // Initialise mode to "light" if unset.
    // Legacy migration context: the former V1 dark palette was not auto-derived.
    if (next.mode === undefined) {
      next.mode = "light"
      dirty = true
    }

    if (dirty) {
      await db.execute(sql`
        UPDATE tenants
        SET theme = ${JSON.stringify(next)}::jsonb
        WHERE id = ${tenant.id}
      `)
    }
  }
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // No-op: forward-only migration. Restoring legacy keys would require
  // remembering them in a side table, which we explicitly chose not to do.
}
