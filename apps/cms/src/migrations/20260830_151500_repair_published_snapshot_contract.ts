import crypto from "node:crypto"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"
import { normalizeLegacySnapshot } from "./sitegenLegacyData"

type JsonRecord = Record<string, unknown>
type SnapshotRow = { id: string | number; snapshot: unknown }

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const rowsFrom = <T,>(value: unknown): T[] =>
  isRecord(value) && Array.isArray(value.rows) ? value.rows as T[] : []

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as JsonRecord
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

const jsonText = (value: unknown): string => JSON.stringify(value) ?? "null"

/**
 * Re-run the first-party snapshot projection after the final contract cutover.
 * Earlier migrations normalized page blocks but left legacy manifest/settings
 * keys and numeric relationship IDs inside already-published JSON snapshots.
 * Rewriting the immutable payload is safe here because the snapshot contract,
 * not the old provider shape, is the serving boundary going forward.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const result = await db.execute(sql`
    SELECT id, snapshot
    FROM public.published_site_snapshots
    WHERE snapshot IS NOT NULL;
  `)

  for (const row of rowsFrom<SnapshotRow>(result)) {
    const snapshot = normalizeLegacySnapshot(row.snapshot)
    if (!isRecord(snapshot)) {
      throw new Error(`Published snapshot ${String(row.id)} is not a JSON object.`)
    }
    const snapshotHash = crypto.createHash("sha256").update(stableStringify(snapshot)).digest("hex")
    await db.execute(sql`
      UPDATE public.published_site_snapshots
      SET snapshot = ${jsonText(snapshot)}::jsonb,
          snapshot_hash = ${snapshotHash}
      WHERE id = ${row.id};
    `)
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    "This migration repairs published snapshots to the first-party contract; restore the pre-migration database backup to roll it back.",
  )
}
