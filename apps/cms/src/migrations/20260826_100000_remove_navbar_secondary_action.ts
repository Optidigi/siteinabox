import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const rowsFrom = <T,>(value: unknown): T[] =>
  isRecord(value) && Array.isArray(value.rows) ? value.rows as T[] : []

const hasUsableLink = (value: unknown): value is JsonRecord => {
  if (!isRecord(value)) return false
  const label = value.label
  const href = value.href
  return typeof label === "string" && label.trim() !== ""
    && typeof href === "string" && href.trim() !== ""
}

/**
 * Keep the single navbar CTA deterministic when an older snapshot still has
 * the provisional two-action shape. Other secondaryAction fields, such as
 * hero or CTA content, are deliberately left untouched.
 */
export const normalizeNavbarActionsInStoredJson = (
  value: unknown,
  insideChrome = false,
): unknown => {
  if (Array.isArray(value)) return value.map((entry) => normalizeNavbarActionsInStoredJson(entry, insideChrome))
  if (!isRecord(value)) return value

  const output: JsonRecord = {}
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeNavbarActionsInStoredJson(child, key === "chrome")
    if (insideChrome && key === "navbar" && isRecord(normalized)) {
      const currentCta = normalized.cta
      const previousSecondary = normalized.secondaryAction
      const cta = hasUsableLink(currentCta)
        ? currentCta
        : hasUsableLink(previousSecondary)
          ? previousSecondary
          : null

      output[key] = { ...normalized, cta }
      delete (output[key] as JsonRecord).secondaryAction
      continue
    }
    output[key] = normalized
  }
  return output
}

const normalizePublishedJson = async (db: MigrateUpArgs["db"]) => {
  const snapshots = await db.execute(sql`
    SELECT id, snapshot
    FROM public.published_site_snapshots;
  `)
  for (const row of rowsFrom<{ id: string | number; snapshot: unknown }>(snapshots)) {
    await db.execute(sql`
      UPDATE public.published_site_snapshots
      SET snapshot = ${JSON.stringify(normalizeNavbarActionsInStoredJson(row.snapshot))}::jsonb
      WHERE id = ${row.id};
    `)
  }

  const runs = await db.execute(sql`
    SELECT id, generation_input, raw_output, parsed_output, spec, validation, apply_result
    FROM public.site_generation_runs;
  `)
  for (const row of rowsFrom<{
    id: string | number
    generation_input: unknown
    raw_output: unknown
    parsed_output: unknown
    spec: unknown
    validation: unknown
    apply_result: unknown
  }>(runs)) {
    await db.execute(sql`
      UPDATE public.site_generation_runs
      SET generation_input = ${JSON.stringify(normalizeNavbarActionsInStoredJson(row.generation_input))}::jsonb,
          raw_output = ${JSON.stringify(normalizeNavbarActionsInStoredJson(row.raw_output))}::jsonb,
          parsed_output = ${JSON.stringify(normalizeNavbarActionsInStoredJson(row.parsed_output))}::jsonb,
          spec = ${JSON.stringify(normalizeNavbarActionsInStoredJson(row.spec))}::jsonb,
          validation = ${JSON.stringify(normalizeNavbarActionsInStoredJson(row.validation))}::jsonb,
          apply_result = ${JSON.stringify(normalizeNavbarActionsInStoredJson(row.apply_result))}::jsonb
      WHERE id = ${row.id};
    `)
  }
}

const navbarActionColumns = [
  "chrome_navbar_cta_label",
  "chrome_navbar_cta_href",
  "chrome_navbar_cta_external",
  "chrome_navbar_secondary_action_label",
  "chrome_navbar_secondary_action_href",
  "chrome_navbar_secondary_action_external",
] as const

const promoteAndRemoveNavbarSecondaryAction = async (db: MigrateUpArgs["db"]) => {
  const result = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'site_settings'
      AND column_name IN (
        'chrome_navbar_cta_label',
        'chrome_navbar_cta_href',
        'chrome_navbar_cta_external',
        'chrome_navbar_secondary_action_label',
        'chrome_navbar_secondary_action_href',
        'chrome_navbar_secondary_action_external'
      )
  `)
  const existingColumns = new Set(rowsFrom<{ column_name: string }>(result).map((row) => row.column_name))
  const hasCompleteColumnSet = navbarActionColumns.every((column) => existingColumns.has(column))

  if (hasCompleteColumnSet) {
    await db.execute(sql`
      UPDATE public.site_settings
      SET chrome_navbar_cta_label = CASE
            WHEN (NULLIF(BTRIM(chrome_navbar_cta_label), '') IS NULL
              OR NULLIF(BTRIM(chrome_navbar_cta_href), '') IS NULL)
              AND NULLIF(BTRIM(chrome_navbar_secondary_action_label), '') IS NOT NULL
              AND NULLIF(BTRIM(chrome_navbar_secondary_action_href), '') IS NOT NULL
            THEN chrome_navbar_secondary_action_label
            ELSE chrome_navbar_cta_label
          END,
          chrome_navbar_cta_href = CASE
            WHEN (NULLIF(BTRIM(chrome_navbar_cta_label), '') IS NULL
              OR NULLIF(BTRIM(chrome_navbar_cta_href), '') IS NULL)
              AND NULLIF(BTRIM(chrome_navbar_secondary_action_label), '') IS NOT NULL
              AND NULLIF(BTRIM(chrome_navbar_secondary_action_href), '') IS NOT NULL
            THEN chrome_navbar_secondary_action_href
            ELSE chrome_navbar_cta_href
          END,
          chrome_navbar_cta_external = CASE
            WHEN (NULLIF(BTRIM(chrome_navbar_cta_label), '') IS NULL
              OR NULLIF(BTRIM(chrome_navbar_cta_href), '') IS NULL)
              AND NULLIF(BTRIM(chrome_navbar_secondary_action_label), '') IS NOT NULL
              AND NULLIF(BTRIM(chrome_navbar_secondary_action_href), '') IS NOT NULL
            THEN chrome_navbar_secondary_action_external
            ELSE chrome_navbar_cta_external
          END;
    `)
  }

  await db.execute(sql`
    ALTER TABLE public.site_settings
      DROP COLUMN IF EXISTS chrome_navbar_secondary_action_label,
      DROP COLUMN IF EXISTS chrome_navbar_secondary_action_href,
      DROP COLUMN IF EXISTS chrome_navbar_secondary_action_external,
      DROP COLUMN IF EXISTS chrome_header_secondary_action_label,
      DROP COLUMN IF EXISTS chrome_header_secondary_action_href,
      DROP COLUMN IF EXISTS chrome_header_secondary_action_external;
  `)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await promoteAndRemoveNavbarSecondaryAction(db)
  await normalizePublishedJson(db)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    "This migration removes the provisional second navbar action; restore a database backup to roll it back.",
  )
}
