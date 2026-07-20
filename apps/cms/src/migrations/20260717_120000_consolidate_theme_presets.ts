import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"
import crypto from "node:crypto"

type JsonRecord = Record<string, unknown>
const isRecord = (value: unknown): value is JsonRecord =>
  value != null && typeof value === "object" && !Array.isArray(value)
const asRecord = (value: unknown): JsonRecord | null => (isRecord(value) ? value : null)
const queryRows = <T,>(result: unknown): T[] => {
  const rows = asRecord(result)?.rows
  if (Array.isArray(rows)) return rows as T[]
  if (Array.isArray(result)) return result as T[]
  return []
}

const stableStringify = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION pg_temp.siab_consolidate_theme_presets(doc jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
      SELECT replace(replace(replace(doc::text,
        '"shadcn-neutral"', '"monochrome"'),
        '"shadcn-geist"', '"clear-modern"'),
        '"shadcn-default"', '"soft"')::jsonb
    $$;

    UPDATE "tenants" SET "theme" = pg_temp.siab_consolidate_theme_presets("theme") WHERE "theme" IS NOT NULL;
    UPDATE "published_site_snapshots" SET "snapshot" = pg_temp.siab_consolidate_theme_presets("snapshot") WHERE "snapshot" IS NOT NULL;
    UPDATE "site_generation_runs" SET "generation_input" = pg_temp.siab_consolidate_theme_presets("generation_input") WHERE "generation_input" IS NOT NULL;
    UPDATE "site_generation_runs" SET "spec" = pg_temp.siab_consolidate_theme_presets("spec") WHERE "spec" IS NOT NULL;
    UPDATE "site_generation_runs" SET "parsed_output" = pg_temp.siab_consolidate_theme_presets("parsed_output") WHERE "parsed_output" IS NOT NULL;
  `)

  // Snapshot hashes are part of the publish/activation integrity contract.
  // Recompute them with the same stable serializer as the publisher after the
  // JSON migration; Postgres jsonb::text ordering is not that contract.
  const result = await db.execute(sql`SELECT "id", "snapshot" FROM "published_site_snapshots" WHERE "snapshot" IS NOT NULL`)
  const rows = queryRows<{ id: string | number; snapshot: unknown }>(result)
  for (const row of rows) {
    const hash = crypto.createHash("sha256").update(stableStringify(row.snapshot)).digest("hex")
    await db.execute(sql`UPDATE "published_site_snapshots" SET "snapshot_hash" = ${hash} WHERE "id" = ${row.id}`)
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("20260717_120000_consolidate_theme_presets is intentionally irreversible: legacy preset IDs are not accepted by current contracts.")
}
