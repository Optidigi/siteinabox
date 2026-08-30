import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const rowsFrom = <T,>(value: unknown): T[] =>
  isRecord(value) && Array.isArray(value.rows) ? value.rows as T[] : []

const NAVBAR_VARIANTS = new Set(["navbar-01", "navbar-02", "navbar-03"])
const NAVBAR_PLACEMENTS = new Set(["sticky", "hero-overlay"])

/**
 * The previous navbar fields were only configuration scaffolding. Keep the
 * useful placement intent, discard the removed search setting, and assign the
 * first owned design where no persisted design exists.
 */
const normalizeStoredJson = (value: unknown, insideChrome = false): unknown => {
  if (Array.isArray(value)) return value.map((entry) => normalizeStoredJson(entry, insideChrome))
  if (!isRecord(value)) return value

  const output: JsonRecord = {}
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeStoredJson(child, key === "chrome")
    if (insideChrome && key === "navbar" && isRecord(normalized)) {
      const behavior = normalized.behavior
      const placement = typeof normalized.placement === "string" && NAVBAR_PLACEMENTS.has(normalized.placement)
        ? normalized.placement
        : behavior === "static" ? "hero-overlay" : "sticky"
      output[key] = {
        ...normalized,
        variant: typeof normalized.variant === "string" && NAVBAR_VARIANTS.has(normalized.variant)
          ? normalized.variant
          : "navbar-01",
        placement,
      }
      delete (output[key] as JsonRecord).behavior
      delete (output[key] as JsonRecord).search
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
      SET snapshot = ${JSON.stringify(normalizeStoredJson(row.snapshot))}::jsonb
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
      SET generation_input = ${JSON.stringify(normalizeStoredJson(row.generation_input))}::jsonb,
          raw_output = ${JSON.stringify(normalizeStoredJson(row.raw_output))}::jsonb,
          parsed_output = ${JSON.stringify(normalizeStoredJson(row.parsed_output))}::jsonb,
          spec = ${JSON.stringify(normalizeStoredJson(row.spec))}::jsonb,
          validation = ${JSON.stringify(normalizeStoredJson(row.validation))}::jsonb,
          apply_result = ${JSON.stringify(normalizeStoredJson(row.apply_result))}::jsonb
      WHERE id = ${row.id};
    `)
  }
}

const replaceNavbarColumns = async (db: MigrateUpArgs["db"]) => {
  await db.execute(sql`
    ALTER TABLE public.site_settings
      DROP COLUMN IF EXISTS chrome_navbar_variant,
      DROP COLUMN IF EXISTS chrome_navbar_placement,
      DROP COLUMN IF EXISTS chrome_navbar_show_theme_toggle;

    DROP TYPE IF EXISTS public.enum_site_settings_chrome_navbar_variant;
    DROP TYPE IF EXISTS public.enum_site_settings_chrome_navbar_placement;

    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_chrome_navbar_variant'
      ) THEN
        CREATE TYPE public.enum_site_settings_chrome_navbar_variant AS ENUM ('navbar-01', 'navbar-02', 'navbar-03');
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_chrome_navbar_placement'
      ) THEN
        CREATE TYPE public.enum_site_settings_chrome_navbar_placement AS ENUM ('sticky', 'hero-overlay');
      END IF;
    END $do$;

    ALTER TABLE public.site_settings
      ADD COLUMN chrome_navbar_variant public.enum_site_settings_chrome_navbar_variant DEFAULT 'navbar-01',
      ADD COLUMN chrome_navbar_placement public.enum_site_settings_chrome_navbar_placement DEFAULT 'sticky',
      ADD COLUMN chrome_navbar_show_theme_toggle boolean DEFAULT false;
  `)

  // The old enum-backed behavior column cannot be referenced in a static
  // statement when a fresh database has already omitted it, so preserve it
  // through a guarded dynamic update before dropping the obsolete columns.
  await db.execute(sql`
    DO $do$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'site_settings'
          AND column_name = 'chrome_navbar_behavior'
      ) THEN
        EXECUTE $statement$
          UPDATE public.site_settings
          SET chrome_navbar_placement = CASE
            WHEN chrome_navbar_behavior::text = 'static'
              THEN 'hero-overlay'::public.enum_site_settings_chrome_navbar_placement
            ELSE 'sticky'::public.enum_site_settings_chrome_navbar_placement
          END
        $statement$;
      END IF;
    END $do$;

    ALTER TABLE public.site_settings
      DROP COLUMN IF EXISTS chrome_navbar_behavior,
      DROP COLUMN IF EXISTS chrome_navbar_search_enabled,
      DROP COLUMN IF EXISTS chrome_navbar_search_action,
      DROP COLUMN IF EXISTS chrome_navbar_search_placeholder;

    DROP TYPE IF EXISTS public.enum_site_settings_chrome_navbar_behavior;
  `)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await replaceNavbarColumns(db)
  await normalizePublishedJson(db)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    "This migration replaces provisional navbar fields with the first-party numbered navbar family; restore a database backup to roll it back.",
  )
}
