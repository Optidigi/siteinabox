import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const rowsFrom = <T,>(value: unknown): T[] =>
  isRecord(value) && Array.isArray(value.rows) ? value.rows as T[] : []

/**
 * Services is the first section family to receive an owned design. Older
 * stored JSON either has no variant or still carries the removed provisional
 * visual names, so normalize the presentation without changing service copy.
 */
export const normalizeServicesVariantInJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeServicesVariantInJson)
  if (!isRecord(value)) return value

  const output: JsonRecord = {}
  for (const [key, child] of Object.entries(value)) {
    output[key] = normalizeServicesVariantInJson(child)
  }
  if (output.blockType === "services") output.variant = "services-01"
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
      SET snapshot = ${JSON.stringify(normalizeServicesVariantInJson(row.snapshot))}::jsonb
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
      SET generation_input = ${JSON.stringify(normalizeServicesVariantInJson(row.generation_input))}::jsonb,
          raw_output = ${JSON.stringify(normalizeServicesVariantInJson(row.raw_output))}::jsonb,
          parsed_output = ${JSON.stringify(normalizeServicesVariantInJson(row.parsed_output))}::jsonb,
          spec = ${JSON.stringify(normalizeServicesVariantInJson(row.spec))}::jsonb,
          validation = ${JSON.stringify(normalizeServicesVariantInJson(row.validation))}::jsonb,
          apply_result = ${JSON.stringify(normalizeServicesVariantInJson(row.apply_result))}::jsonb
      WHERE id = ${row.id};
    `)
  }
}

const replaceServicesVariantColumn = async (db: MigrateUpArgs["db"]) => {
  // The column was removed by the earlier variant reset. Adding it as text
  // first also handles databases that still have the old enum-backed column.
  await db.execute(sql`
    ALTER TABLE public.pages_blocks_services
      ADD COLUMN IF NOT EXISTS variant text;
    ALTER TABLE public.pages_blocks_services
      ALTER COLUMN variant DROP DEFAULT;
    ALTER TABLE public.pages_blocks_services
      ALTER COLUMN variant TYPE text USING variant::text;
    UPDATE public.pages_blocks_services
      SET variant = 'services-01'
      WHERE variant IS DISTINCT FROM 'services-01';
    DROP TYPE IF EXISTS public.enum_pages_blocks_services_variant;
    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_pages_blocks_services_variant'
      ) THEN
        CREATE TYPE public.enum_pages_blocks_services_variant AS ENUM ('services-01');
      END IF;
    END $do$;
    ALTER TABLE public.pages_blocks_services
      ALTER COLUMN variant TYPE public.enum_pages_blocks_services_variant
      USING variant::public.enum_pages_blocks_services_variant;
    ALTER TABLE public.pages_blocks_services
      ALTER COLUMN variant SET DEFAULT 'services-01',
      ALTER COLUMN variant SET NOT NULL;
    ALTER TABLE public.pages_blocks_services_items
      ADD COLUMN IF NOT EXISTS icon varchar;
  `)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await replaceServicesVariantColumn(db)
  await normalizePublishedJson(db)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    "This migration replaces the services presentation contract; restore a database backup to roll it back.",
  )
}
