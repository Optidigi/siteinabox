import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"
import { materializeLegacyPrivacyDisclosure, normalizeLegacySnapshot, normalizeLegacyStoredJson } from "./sitegenLegacyData"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const rowsFrom = <T,>(value: unknown): T[] =>
  isRecord(value) && Array.isArray(value.rows) ? value.rows as T[] : []

const migrateStoredJson = (value: unknown): unknown => normalizeLegacyStoredJson(value)

const addPrivacyDisclosureFields = async (db: MigrateUpArgs["db"]) => {
  await db.execute(sql`
    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_privacy_disclosure_mode'
      ) THEN
        CREATE TYPE public.enum_site_settings_privacy_disclosure_mode AS ENUM ('template', 'custom');
      END IF;
    END $do$;

    ALTER TABLE public.site_settings
      ADD COLUMN IF NOT EXISTS privacy_disclosure_enabled boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS privacy_disclosure_mode public.enum_site_settings_privacy_disclosure_mode DEFAULT 'template',
      ADD COLUMN IF NOT EXISTS privacy_disclosure_title varchar,
      ADD COLUMN IF NOT EXISTS privacy_disclosure_body jsonb,
      ADD COLUMN IF NOT EXISTS privacy_disclosure_version varchar DEFAULT 'tenant-privacy-owned-2026-08-13.1',
      ADD COLUMN IF NOT EXISTS privacy_disclosure_effective_at varchar DEFAULT '2026-07-10T00:00:00.000Z',
      ADD COLUMN IF NOT EXISTS privacy_disclosure_controller_legal_name varchar,
      ADD COLUMN IF NOT EXISTS privacy_disclosure_controller_trade_name varchar,
      ADD COLUMN IF NOT EXISTS privacy_disclosure_controller_email varchar,
      ADD COLUMN IF NOT EXISTS privacy_disclosure_controller_privacy_email varchar,
      ADD COLUMN IF NOT EXISTS privacy_disclosure_controller_kvk_number varchar,
      ADD COLUMN IF NOT EXISTS privacy_disclosure_controller_address varchar,
      ADD COLUMN IF NOT EXISTS privacy_disclosure_contact_methods jsonb,
      ADD COLUMN IF NOT EXISTS privacy_disclosure_marketing_technologies jsonb,
      ADD COLUMN IF NOT EXISTS privacy_disclosure_additional_processors jsonb;
  `)
}

const removeUnimplementedVariantColumns = async (db: MigrateUpArgs["db"]) => {
  await db.execute(sql`
    ALTER TABLE public.site_settings
      DROP COLUMN IF EXISTS chrome_navbar_variant,
      DROP COLUMN IF EXISTS chrome_footer_variant,
      DROP COLUMN IF EXISTS chrome_announcement_variant,
      DROP COLUMN IF EXISTS consent_variant,
      DROP COLUMN IF EXISTS system_templates_not_found_variant,
      DROP COLUMN IF EXISTS maintenance_variant;
  `)

  await db.execute(sql`
    DROP TYPE IF EXISTS public.enum_site_settings_chrome_navbar_variant;
    DROP TYPE IF EXISTS public.enum_site_settings_chrome_footer_variant;
    DROP TYPE IF EXISTS public.enum_site_settings_chrome_announcement_variant;
    DROP TYPE IF EXISTS public.enum_site_settings_consent_variant;
    DROP TYPE IF EXISTS public.enum_site_settings_system_templates_not_found_variant;
    DROP TYPE IF EXISTS public.enum_site_settings_maintenance_variant;
    DROP TYPE IF EXISTS public.enum_site_settings_chrome_header_variant_legacy;
    DROP TYPE IF EXISTS public.enum_site_settings_chrome_banner_variant_legacy;
  `)
}

const removePageRichTextTable = async (db: MigrateUpArgs["db"]) => {
  const table = await db.execute(sql`
    SELECT to_regclass('public.pages_blocks_rich_text') AS table_name;
  `)
  if (!rowsFrom<{ table_name: string | null }>(table)[0]?.table_name) return

  const result = await db.execute(sql`
    SELECT count(*)::int AS count
    FROM public.pages_blocks_rich_text;
  `)
  const count = rowsFrom<{ count: number | string }>(result)[0]?.count ?? 0
  if (Number(count) > 0) {
    throw new Error(
      `Cannot drop pages_blocks_rich_text: ${count} persisted page richText row(s) remain. Move each document to a semantic section or Site Settings > Privacy disclosure before rerunning the migration.`,
    )
  }

  await db.execute(sql`
    DROP TABLE IF EXISTS public.pages_blocks_rich_text CASCADE;
  `)
}

const removeRichTextPresets = async (db: MigrateUpArgs["db"]) => {
  const result = await db.execute(sql`
    SELECT count(*)::int AS count
    FROM public.block_presets
    WHERE block_type::text = 'richText';
  `)
  const count = rowsFrom<{ count: number | string }>(result)[0]?.count ?? 0
  if (Number(count) > 0) {
    throw new Error(
      `Cannot remove the richText preset type: ${count} richText preset row(s) remain. Recreate those presets for a supported semantic block before rerunning the migration.`,
    )
  }

  await db.execute(sql`
    ALTER TABLE public.block_presets
      ALTER COLUMN block_type SET DATA TYPE text USING block_type::text;
    DROP TYPE IF EXISTS public.enum_block_presets_block_type;
    CREATE TYPE public.enum_block_presets_block_type AS ENUM ('hero', 'services', 'about', 'process', 'work', 'reviews', 'pricing', 'faq', 'cta', 'contact');
    ALTER TABLE public.block_presets
      ALTER COLUMN block_type SET DATA TYPE public.enum_block_presets_block_type
      USING block_type::public.enum_block_presets_block_type;
  `)
}

const normalizePublishedJson = async (db: MigrateUpArgs["db"]) => {
  const snapshots = await db.execute(sql`
    SELECT id, snapshot
    FROM public.published_site_snapshots;
  `)
  for (const row of rowsFrom<{ id: string | number; snapshot: unknown }>(snapshots)) {
    await db.execute(sql`
      UPDATE public.published_site_snapshots
      SET snapshot = ${JSON.stringify(normalizeLegacySnapshot(row.snapshot))}::jsonb
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
      SET generation_input = ${JSON.stringify(migrateStoredJson(row.generation_input))}::jsonb,
          raw_output = ${JSON.stringify(migrateStoredJson(row.raw_output))}::jsonb,
          parsed_output = ${JSON.stringify(migrateStoredJson(row.parsed_output))}::jsonb,
          spec = ${JSON.stringify(migrateStoredJson(row.spec))}::jsonb,
          validation = ${JSON.stringify(migrateStoredJson(row.validation))}::jsonb,
          apply_result = ${JSON.stringify(migrateStoredJson(row.apply_result))}::jsonb
      WHERE id = ${row.id};
    `)
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await addPrivacyDisclosureFields(db)
  await materializeLegacyPrivacyDisclosure(db)
  await normalizePublishedJson(db)
  await removeRichTextPresets(db)
  await removePageRichTextTable(db)
  await removeUnimplementedVariantColumns(db)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    "This migration removes an obsolete page block and unimplemented chrome variants; restore a database backup to roll it back.",
  )
}
