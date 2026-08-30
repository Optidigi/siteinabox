import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const rowsFrom = <T,>(value: unknown): T[] =>
  isRecord(value) && Array.isArray(value.rows) ? value.rows as T[] : []

/**
 * CTA 01 is the first owned CTA presentation. Normalize stored page and
 * generation JSON before the canonical schema starts requiring its variant.
 * The content contract is unchanged; only the presentation identity is set.
 */
export const normalizeCtaVariantInJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeCtaVariantInJson)
  if (!isRecord(value)) return value

  const output: JsonRecord = {}
  for (const [key, child] of Object.entries(value)) {
    output[key] = normalizeCtaVariantInJson(child)
  }
  if (output.blockType === "cta") output.variant = "cta-01"
  return output
}

const normalizeStoredJson = async (db: MigrateUpArgs["db"]) => {
  const snapshots = await db.execute(sql`
    SELECT id, snapshot
    FROM public.published_site_snapshots;
  `)
  for (const row of rowsFrom<{ id: string | number; snapshot: unknown }>(snapshots)) {
    await db.execute(sql`
      UPDATE public.published_site_snapshots
      SET snapshot = ${JSON.stringify(normalizeCtaVariantInJson(row.snapshot))}::jsonb
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
      SET generation_input = ${JSON.stringify(normalizeCtaVariantInJson(row.generation_input))}::jsonb,
          raw_output = ${JSON.stringify(normalizeCtaVariantInJson(row.raw_output))}::jsonb,
          parsed_output = ${JSON.stringify(normalizeCtaVariantInJson(row.parsed_output))}::jsonb,
          spec = ${JSON.stringify(normalizeCtaVariantInJson(row.spec))}::jsonb,
          validation = ${JSON.stringify(normalizeCtaVariantInJson(row.validation))}::jsonb,
          apply_result = ${JSON.stringify(normalizeCtaVariantInJson(row.apply_result))}::jsonb
      WHERE id = ${row.id};
    `)
  }
}

const replaceCtaVariantColumn = async (db: MigrateUpArgs["db"]) => {
  await db.execute(sql`
    ALTER TABLE public.pages_blocks_cta
      ADD COLUMN IF NOT EXISTS variant text;
    ALTER TABLE public.pages_blocks_cta
      ALTER COLUMN variant DROP DEFAULT;
    ALTER TABLE public.pages_blocks_cta
      ALTER COLUMN variant TYPE text USING variant::text;
    UPDATE public.pages_blocks_cta
      SET variant = 'cta-01'
      WHERE variant IS DISTINCT FROM 'cta-01';
    DROP TYPE IF EXISTS public.enum_pages_blocks_cta_variant;
    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_pages_blocks_cta_variant'
      ) THEN
        CREATE TYPE public.enum_pages_blocks_cta_variant AS ENUM ('cta-01');
      END IF;
    END $do$;
    ALTER TABLE public.pages_blocks_cta
      ALTER COLUMN variant TYPE public.enum_pages_blocks_cta_variant
      USING variant::public.enum_pages_blocks_cta_variant;
    ALTER TABLE public.pages_blocks_cta
      ALTER COLUMN variant SET DEFAULT 'cta-01',
      ALTER COLUMN variant SET NOT NULL;
  `)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await replaceCtaVariantColumn(db)
  await normalizeStoredJson(db)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    "This migration replaces the CTA presentation contract; restore a database backup to roll it back.",
  )
}
