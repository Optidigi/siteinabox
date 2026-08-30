import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const rowsFrom = <T,>(value: unknown): T[] =>
  isRecord(value) && Array.isArray(value.rows) ? value.rows as T[] : []

const FOOTER_VARIANTS = new Set(["footer-01"])

/**
 * Footer is settings-owned chrome. Normalize only chrome.footer so similarly
 * named page navigation or arbitrary content fields are not changed.
 */
export const normalizeFooterVariantInStoredJson = (
  value: unknown,
  insideChrome = false,
): unknown => {
  if (Array.isArray(value)) return value.map((entry) => normalizeFooterVariantInStoredJson(entry, insideChrome))
  if (!isRecord(value)) return value

  const output: JsonRecord = {}
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeFooterVariantInStoredJson(child, key === "chrome")
    if (insideChrome && key === "footer" && isRecord(normalized)) {
      output[key] = {
        ...normalized,
        variant: typeof normalized.variant === "string" && FOOTER_VARIANTS.has(normalized.variant)
          ? normalized.variant
          : "footer-01",
      }
    } else {
      output[key] = normalized
    }
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
      SET snapshot = ${JSON.stringify(normalizeFooterVariantInStoredJson(row.snapshot))}::jsonb
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
      SET generation_input = ${JSON.stringify(normalizeFooterVariantInStoredJson(row.generation_input))}::jsonb,
          raw_output = ${JSON.stringify(normalizeFooterVariantInStoredJson(row.raw_output))}::jsonb,
          parsed_output = ${JSON.stringify(normalizeFooterVariantInStoredJson(row.parsed_output))}::jsonb,
          spec = ${JSON.stringify(normalizeFooterVariantInStoredJson(row.spec))}::jsonb,
          validation = ${JSON.stringify(normalizeFooterVariantInStoredJson(row.validation))}::jsonb,
          apply_result = ${JSON.stringify(normalizeFooterVariantInStoredJson(row.apply_result))}::jsonb
      WHERE id = ${row.id};
    `)
  }
}

const replaceFooterVariantColumn = async (db: MigrateUpArgs["db"]) => {
  // The previous chrome reset removed this column. Text first also handles a
  // database that still has the old provider-backed enum column.
  await db.execute(sql`
    ALTER TABLE public.site_settings
      ADD COLUMN IF NOT EXISTS chrome_footer_variant text;
    ALTER TABLE public.site_settings
      ALTER COLUMN chrome_footer_variant DROP DEFAULT;
    ALTER TABLE public.site_settings
      ALTER COLUMN chrome_footer_variant TYPE text USING chrome_footer_variant::text;
    UPDATE public.site_settings
      SET chrome_footer_variant = 'footer-01'
      WHERE chrome_footer_variant IS DISTINCT FROM 'footer-01';
    DROP TYPE IF EXISTS public.enum_site_settings_chrome_footer_variant;
    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_chrome_footer_variant'
      ) THEN
        CREATE TYPE public.enum_site_settings_chrome_footer_variant AS ENUM ('footer-01');
      END IF;
    END
    $do$;
    ALTER TABLE public.site_settings
      ALTER COLUMN chrome_footer_variant TYPE public.enum_site_settings_chrome_footer_variant
      USING chrome_footer_variant::public.enum_site_settings_chrome_footer_variant;
    ALTER TABLE public.site_settings
      ALTER COLUMN chrome_footer_variant SET DEFAULT 'footer-01';
  `)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await replaceFooterVariantColumn(db)
  await normalizePublishedJson(db)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    "This migration adds the first-party footer contract; restore a database backup to roll it back.",
  )
}
