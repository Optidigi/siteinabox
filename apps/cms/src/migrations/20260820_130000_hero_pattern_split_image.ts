import crypto from "node:crypto"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const queryRows = <T,>(result: unknown): T[] => {
  if (!isRecord(result)) return []
  return Array.isArray(result.rows) ? result.rows as T[] : []
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]"
  const record = value as JsonRecord
  return "{" + Object.keys(record).sort().map((key) => JSON.stringify(key) + ":" + stableStringify(record[key])).join(",") + "}"
}

const replaceHeroPatternSplit = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(replaceHeroPatternSplit)
  if (!isRecord(value)) return value

  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    key === "blockType" && child === "heroPatternSplit" ? "hero" : replaceHeroPatternSplit(child),
  ]))
}

type SnapshotRow = { id: string | number; snapshot: unknown }
type GenerationRunRow = {
  id: string | number
  generation_input: unknown
  raw_output: unknown
  parsed_output: unknown
  spec: unknown
  validation: unknown
  apply_result: unknown
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_hero_pattern_split"
      ADD COLUMN IF NOT EXISTS "image_id" integer;

    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'pages_blocks_hero_pattern_split_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_hero_pattern_split"
          ADD CONSTRAINT "pages_blocks_hero_pattern_split_image_id_media_id_fk"
          FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $do$;

    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_pattern_split_image_idx"
      ON "pages_blocks_hero_pattern_split" USING btree ("image_id");
  `)

  await db.execute(sql`
    DO $do$
    DECLARE
      row_count bigint;
    BEGIN
      SELECT count(*)
      FROM public.pages_blocks_hero_pattern_split AS old_block
      INNER JOIN public.pages_blocks_hero AS new_block ON new_block.id = old_block.id
      INTO row_count;

      IF row_count > 0 THEN
        RAISE EXCEPTION USING
          MESSAGE = 'Cannot migrate heroPatternSplit rows because a hero row already uses the same id',
          HINT = 'Restore from backup and resolve the duplicate block id before retrying the migration.';
      END IF;

      INSERT INTO public.pages_blocks_hero (
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href,
        image_id, anchor, block_name
      )
      SELECT
        "_order", "_parent_id", "_path", id, heading, body,
        primary_action_label, primary_action_href,
        secondary_action_label, secondary_action_href,
        NULL, anchor, block_name
      FROM public.pages_blocks_hero_pattern_split;

      DELETE FROM public.pages_blocks_hero_pattern_split;
    END $do$;
  `)

  const snapshotResult = await db.execute(sql`
    SELECT id, snapshot
    FROM public.published_site_snapshots
    WHERE snapshot::text LIKE '%heroPatternSplit%'
  `)

  for (const row of queryRows<SnapshotRow>(snapshotResult)) {
    const snapshot = replaceHeroPatternSplit(row.snapshot)
    const snapshotHash = crypto.createHash("sha256").update(stableStringify(snapshot)).digest("hex")
    await db.execute(sql`
      UPDATE public.published_site_snapshots
      SET snapshot = ${JSON.stringify(snapshot)}::jsonb,
          snapshot_hash = ${snapshotHash}
      WHERE id = ${row.id}
    `)
  }

  const generationResult = await db.execute(sql`
    SELECT id, generation_input, raw_output, parsed_output, spec, validation, apply_result
    FROM public.site_generation_runs
    WHERE coalesce(generation_input::text, '') LIKE '%heroPatternSplit%'
       OR coalesce(raw_output::text, '') LIKE '%heroPatternSplit%'
       OR coalesce(parsed_output::text, '') LIKE '%heroPatternSplit%'
       OR coalesce(spec::text, '') LIKE '%heroPatternSplit%'
       OR coalesce(validation::text, '') LIKE '%heroPatternSplit%'
       OR coalesce(apply_result::text, '') LIKE '%heroPatternSplit%'
  `)

  for (const row of queryRows<GenerationRunRow>(generationResult)) {
    await db.execute(sql`
      UPDATE public.site_generation_runs
      SET generation_input = ${JSON.stringify(replaceHeroPatternSplit(row.generation_input))}::jsonb,
          raw_output = ${JSON.stringify(replaceHeroPatternSplit(row.raw_output))}::jsonb,
          parsed_output = ${JSON.stringify(replaceHeroPatternSplit(row.parsed_output))}::jsonb,
          spec = ${JSON.stringify(replaceHeroPatternSplit(row.spec))}::jsonb,
          validation = ${JSON.stringify(replaceHeroPatternSplit(row.validation))}::jsonb,
          apply_result = ${JSON.stringify(replaceHeroPatternSplit(row.apply_result))}::jsonb
      WHERE id = ${row.id}
    `)
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("This migration converts image-less heroPatternSplit rows to hero; restore a database backup to roll it back.")
}
