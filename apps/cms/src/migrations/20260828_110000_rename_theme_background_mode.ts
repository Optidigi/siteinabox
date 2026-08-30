import crypto from "node:crypto"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

type JsonRecord = Record<string, unknown>
type Database = MigrateUpArgs["db"]
type JsonRow = { id: string | number; value: unknown }
type SnapshotRow = { id: string | number; snapshot: unknown }

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const rowsFrom = <T,>(value: unknown): T[] => {
  if (!isRecord(value) || !Array.isArray(value.rows)) return []
  return value.rows as T[]
}

export const renameBackgroundModeKey = (value: unknown, reverse = false): unknown => {
  if (Array.isArray(value)) return value.map((child) => renameBackgroundModeKey(child, reverse))
  if (!isRecord(value)) return value

  const legacyKey = reverse ? "backgroundMode" : "heroBackground"
  const canonicalKey = reverse ? "heroBackground" : "backgroundMode"
  const hasCanonicalKey = Object.prototype.hasOwnProperty.call(value, canonicalKey)
  const output: JsonRecord = {}

  for (const [key, child] of Object.entries(value)) {
    if (key === legacyKey && hasCanonicalKey) continue
    output[key === legacyKey ? canonicalKey : key] = renameBackgroundModeKey(child, reverse)
  }

  return output
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as JsonRecord
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

const jsonText = (value: unknown): string => JSON.stringify(value) ?? "null"

const updateTenantThemes = async (db: Database, reverse: boolean) => {
  const result = await db.execute(sql`
    SELECT id, theme AS value
    FROM public.tenants
    WHERE theme IS NOT NULL
  `)
  for (const row of rowsFrom<JsonRow>(result)) {
    const value = renameBackgroundModeKey(row.value, reverse)
    if (stableStringify(value) === stableStringify(row.value)) continue
    await db.execute(sql`
      UPDATE public.tenants
      SET theme = ${jsonText(value)}::jsonb
      WHERE id = ${row.id}
    `)
  }
}

const updateSnapshots = async (db: Database, reverse: boolean) => {
  const result = await db.execute(sql`
    SELECT id, snapshot
    FROM public.published_site_snapshots
    WHERE snapshot IS NOT NULL
  `)
  for (const row of rowsFrom<SnapshotRow>(result)) {
    const snapshot = renameBackgroundModeKey(row.snapshot, reverse)
    if (stableStringify(snapshot) === stableStringify(row.snapshot)) continue
    const snapshotHash = crypto.createHash("sha256").update(stableStringify(snapshot)).digest("hex")
    await db.execute(sql`
      UPDATE public.published_site_snapshots
      SET snapshot = ${jsonText(snapshot)}::jsonb,
          snapshot_hash = ${snapshotHash}
      WHERE id = ${row.id}
    `)
  }
}

const updateGenerationRuns = async (db: Database, reverse: boolean) => {
  const result = await db.execute(sql`
    SELECT id, normalized_intake, generation_input, raw_output, parsed_output,
           spec, validation, apply_result
    FROM public.site_generation_runs
  `)
  for (const row of rowsFrom<{
    id: string | number
    normalized_intake: unknown
    generation_input: unknown
    raw_output: unknown
    parsed_output: unknown
    spec: unknown
    validation: unknown
    apply_result: unknown
  }>(result)) {
    const values = {
      normalized_intake: renameBackgroundModeKey(row.normalized_intake, reverse),
      generation_input: renameBackgroundModeKey(row.generation_input, reverse),
      raw_output: renameBackgroundModeKey(row.raw_output, reverse),
      parsed_output: renameBackgroundModeKey(row.parsed_output, reverse),
      spec: renameBackgroundModeKey(row.spec, reverse),
      validation: renameBackgroundModeKey(row.validation, reverse),
      apply_result: renameBackgroundModeKey(row.apply_result, reverse),
    }
    if (Object.entries(values).every(([key, value]) => stableStringify(value) === stableStringify(row[key as keyof typeof row]))) continue
    await db.execute(sql`
      UPDATE public.site_generation_runs
      SET normalized_intake = ${jsonText(values.normalized_intake)}::jsonb,
          generation_input = ${jsonText(values.generation_input)}::jsonb,
          raw_output = ${jsonText(values.raw_output)}::jsonb,
          parsed_output = ${jsonText(values.parsed_output)}::jsonb,
          spec = ${jsonText(values.spec)}::jsonb,
          validation = ${jsonText(values.validation)}::jsonb,
          apply_result = ${jsonText(values.apply_result)}::jsonb
      WHERE id = ${row.id}
    `)
  }
}

const updateIntakeSubmissions = async (db: Database, reverse: boolean) => {
  const result = await db.execute(sql`
    SELECT id, normalized, reviewed_generation_input
    FROM public.intake_submissions
  `)
  for (const row of rowsFrom<{
    id: string | number
    normalized: unknown
    reviewed_generation_input: unknown
  }>(result)) {
    const normalized = renameBackgroundModeKey(row.normalized, reverse)
    const reviewedGenerationInput = renameBackgroundModeKey(row.reviewed_generation_input, reverse)
    if (stableStringify(normalized) === stableStringify(row.normalized)
      && stableStringify(reviewedGenerationInput) === stableStringify(row.reviewed_generation_input)) continue
    await db.execute(sql`
      UPDATE public.intake_submissions
      SET normalized = ${jsonText(normalized)}::jsonb,
          reviewed_generation_input = ${jsonText(reviewedGenerationInput)}::jsonb
      WHERE id = ${row.id}
    `)
  }
}

const updateLegacyGenerationRuns = async (db: Database, reverse: boolean) => {
  const tableResult = await db.execute(sql`SELECT to_regclass('public.generation_runs') AS table_name`)
  if (!rowsFrom<{ table_name: string | null }>(tableResult)[0]?.table_name) return

  const result = await db.execute(sql`
    SELECT id, input AS value
    FROM public.generation_runs
    WHERE input IS NOT NULL
  `)
  for (const row of rowsFrom<JsonRow>(result)) {
    const value = renameBackgroundModeKey(row.value, reverse)
    if (stableStringify(value) === stableStringify(row.value)) continue
    await db.execute(sql`
      UPDATE public.generation_runs
      SET input = ${jsonText(value)}::jsonb
      WHERE id = ${row.id}
    `)
  }
}

const migrate = async (db: Database, reverse: boolean) => {
  await updateTenantThemes(db, reverse)
  await updateSnapshots(db, reverse)
  await updateGenerationRuns(db, reverse)
  await updateIntakeSubmissions(db, reverse)
  await updateLegacyGenerationRuns(db, reverse)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await migrate(db, false)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await migrate(db, true)
}
