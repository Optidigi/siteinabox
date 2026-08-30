import crypto from "node:crypto"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"
import { materializeTenantPrivacyDisclosureValue } from "@/lib/legal/tenantPrivacyPage"
import {
  TenantPrivacyDisclosureSchema,
  type TenantPrivacyDisclosure,
} from "@siteinabox/contracts"

type JsonRecord = Record<string, unknown>
type SnapshotRow = { id: string | number; tenant_id: string | number; snapshot: unknown }
export type PrivacySettingsRow = {
  tenant_id: string | number
  privacy_disclosure_enabled: boolean | null
  privacy_disclosure_mode: string | null
  privacy_disclosure_title: string | null
  privacy_disclosure_body: unknown
  privacy_disclosure_version: string | null
  privacy_disclosure_effective_at: string | null
  privacy_disclosure_controller_legal_name: string | null
  privacy_disclosure_controller_trade_name: string | null
  privacy_disclosure_controller_email: string | null
  privacy_disclosure_controller_privacy_email: string | null
  privacy_disclosure_controller_kvk_number: string | null
  privacy_disclosure_controller_address: string | null
  privacy_disclosure_contact_methods: unknown
  privacy_disclosure_marketing_technologies: unknown
  privacy_disclosure_additional_processors: unknown
}

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const rowsFrom = <T,>(value: unknown): T[] =>
  isRecord(value) && Array.isArray(value.rows) ? value.rows as T[] : []

const clean = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null

const jsonValue = (value: unknown): unknown => {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

export const privacyDisclosureFromSettings = (
  row: PrivacySettingsRow,
): TenantPrivacyDisclosure | null => {
  if (row.privacy_disclosure_enabled !== true) return null

  const parsed = TenantPrivacyDisclosureSchema.safeParse({
    enabled: true,
    mode: row.privacy_disclosure_mode === "custom" ? "custom" : "template",
    title: clean(row.privacy_disclosure_title) ?? "Privacy- en cookieverklaring",
    body: jsonValue(row.privacy_disclosure_body) ?? undefined,
    version: clean(row.privacy_disclosure_version) ?? "tenant-privacy-owned-2026-08-13.1",
    effectiveAt: clean(row.privacy_disclosure_effective_at) ?? "2026-07-10T00:00:00.000Z",
    controller: {
      legalName: clean(row.privacy_disclosure_controller_legal_name),
      tradeName: clean(row.privacy_disclosure_controller_trade_name),
      email: clean(row.privacy_disclosure_controller_email),
      privacyEmail: clean(row.privacy_disclosure_controller_privacy_email),
      kvkNumber: clean(row.privacy_disclosure_controller_kvk_number),
      address: clean(row.privacy_disclosure_controller_address),
    },
    contactMethods: jsonValue(row.privacy_disclosure_contact_methods),
    marketingTechnologies: jsonValue(row.privacy_disclosure_marketing_technologies),
    additionalProcessors: jsonValue(row.privacy_disclosure_additional_processors),
  })
  if (!parsed.success) {
    throw new Error(
      `Enabled tenant privacy disclosure ${String(row.tenant_id)} failed contract validation: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    )
  }
  return materializeTenantPrivacyDisclosureValue(parsed.data)
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as JsonRecord
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

const jsonText = (value: unknown): string => JSON.stringify(value) ?? "null"

/**
 * Projects the settings-owned privacy document into active published
 * snapshots. The public legal route reads this value from the snapshot rather
 * than treating the document as a page block.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const privacySettingsResult = await db.execute(sql`
    SELECT tenant_id,
           privacy_disclosure_enabled,
           privacy_disclosure_mode,
           privacy_disclosure_title,
           privacy_disclosure_body,
           privacy_disclosure_version,
           privacy_disclosure_effective_at,
           privacy_disclosure_controller_legal_name,
           privacy_disclosure_controller_trade_name,
           privacy_disclosure_controller_email,
           privacy_disclosure_controller_privacy_email,
           privacy_disclosure_controller_kvk_number,
           privacy_disclosure_controller_address,
           privacy_disclosure_contact_methods,
           privacy_disclosure_marketing_technologies,
           privacy_disclosure_additional_processors
    FROM public.site_settings;
  `)
  const privacyByTenant = new Map(
    rowsFrom<PrivacySettingsRow>(privacySettingsResult).map((row) => [
      String(row.tenant_id),
      privacyDisclosureFromSettings(row),
    ]),
  )

  const result = await db.execute(sql`
    SELECT id, tenant_id, snapshot
    FROM public.published_site_snapshots
    WHERE status = 'active' AND snapshot IS NOT NULL;
  `)

  for (const row of rowsFrom<SnapshotRow>(result)) {
    if (!isRecord(row.snapshot)) {
      throw new Error(`Published snapshot ${String(row.id)} is not a JSON object.`)
    }
    const settings = isRecord(row.snapshot.settings) ? { ...row.snapshot.settings } : {}
    const privacyDisclosure = privacyByTenant.get(String(row.tenant_id)) ?? null
    if (privacyDisclosure) settings.privacyDisclosure = privacyDisclosure
    else delete settings.privacyDisclosure
    const snapshot = { ...row.snapshot, settings }
    if (stableStringify(snapshot) === stableStringify(row.snapshot)) continue
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
    "This migration projects settings-owned privacy documents into published snapshots; restore the pre-migration database backup to roll it back.",
  )
}
