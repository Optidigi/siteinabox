import crypto from "node:crypto"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

type JsonRecord = Record<string, unknown>
type SettingsRow = {
  id: string | number
  privacy_disclosure_body: unknown
  privacy_disclosure_version: string | null
}
type SnapshotRow = { id: string | number; snapshot: unknown }

export const LEGACY_PRIVACY_MARKER = "tenant-privacy-shadcnui-blocks-2026-07-18.1"
export const CURRENT_PRIVACY_MARKER = "tenant-privacy-owned-2026-08-13.1"

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const rowsFrom = <T,>(value: unknown): T[] =>
  isRecord(value) && Array.isArray(value.rows) ? value.rows as T[] : []

/**
 * Removes the former block-provider identifier from the settings-owned legal
 * document while preserving the structured rich-text shape and every other
 * legal value. Historical generation-run audit payloads are intentionally not
 * rewritten.
 */
export const replaceLegacyPrivacyMarker = (value: unknown): unknown => {
  if (typeof value === "string") return value.replaceAll(LEGACY_PRIVACY_MARKER, CURRENT_PRIVACY_MARKER)
  if (Array.isArray(value)) return value.map(replaceLegacyPrivacyMarker)
  if (!isRecord(value)) return value

  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    replaceLegacyPrivacyMarker(child),
  ]))
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as JsonRecord
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

const jsonText = (value: unknown): string => JSON.stringify(value) ?? "null"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const settingsResult = await db.execute(sql`
    SELECT id, privacy_disclosure_body, privacy_disclosure_version
    FROM public.site_settings
    WHERE privacy_disclosure_body::text LIKE ${`%${LEGACY_PRIVACY_MARKER}%`}
       OR privacy_disclosure_version = ${LEGACY_PRIVACY_MARKER};
  `)

  for (const row of rowsFrom<SettingsRow>(settingsResult)) {
    const body = replaceLegacyPrivacyMarker(row.privacy_disclosure_body)
    const version = row.privacy_disclosure_version === LEGACY_PRIVACY_MARKER
      ? CURRENT_PRIVACY_MARKER
      : row.privacy_disclosure_version
    await db.execute(sql`
      UPDATE public.site_settings
      SET privacy_disclosure_body = ${jsonText(body)}::jsonb,
          privacy_disclosure_version = ${version}
      WHERE id = ${row.id};
    `)
  }

  const snapshotsResult = await db.execute(sql`
    SELECT id, snapshot
    FROM public.published_site_snapshots
    WHERE snapshot::text LIKE ${`%${LEGACY_PRIVACY_MARKER}%`};
  `)

  for (const row of rowsFrom<SnapshotRow>(snapshotsResult)) {
    const snapshot = replaceLegacyPrivacyMarker(row.snapshot)
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
    "This migration removes a legacy provider marker from legal documents; restore the pre-migration database backup to roll it back.",
  )
}
