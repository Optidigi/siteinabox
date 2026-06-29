#!/usr/bin/env node
/**
 * Canonicalize production tenant ids after the Phase 0 audit.
 *
 * Goal:
 *   tenant 1 = Amicare (ami-care.nl), remapped from tenant 7
 *
 * Safety model:
 *   - Dry-run is the default. It never mutates the database or filesystem.
 *   - Mutation requires both `--apply` and `--backup-confirmed`.
 *   - Database mutations run in one transaction and use create/remap/delete,
 *     not direct primary-key updates.
 *   - Filesystem handling copies old tenant media directories to canonical
 *     directories before DB mutation and never deletes old directories.
 *   - Staging duplicate tenants 8/9 are retained unless
 *     `--retire-staging-duplicates` is supplied with `--apply`.
 *
 * Required backups before apply:
 *   pg_dump -Fc "$DATABASE_URI" > "siab-payload-before-tenant-canonicalize-$(date +%Y%m%d-%H%M%S).dump"
 *   tar -C /srv/data/saas/siab-payload -czf "siab-payload-tenants-before-tenant-canonicalize-$(date +%Y%m%d-%H%M%S).tgz" tenants
 *
 * Usage from apps/cms:
 *   pnpm exec node scripts/canonicalize-production-tenants.mjs
 *   DATABASE_URI='postgres://...' pnpm exec node scripts/canonicalize-production-tenants.mjs
 *   DATABASE_URI='postgres://...' pnpm exec node scripts/canonicalize-production-tenants.mjs --apply --backup-confirmed
 *   DATABASE_URI='postgres://...' pnpm exec node scripts/canonicalize-production-tenants.mjs --apply --backup-confirmed --retire-staging-duplicates
 */
import "dotenv/config"
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { Client } from "pg"

export const canonicalTenantMappings = Object.freeze([
  {
    label: "Amicare",
    sourceId: 7,
    targetId: 1,
    name: "Amicare",
    slug: "ami-care",
    domain: "ami-care.nl",
  },
])

export const stagingDuplicateTenantIds = Object.freeze([8, 9])

export const tenantReferenceColumns = Object.freeze([
  ["pages", "tenant_id"],
  ["site_settings", "tenant_id"],
  ["media", "tenant_id"],
  ["forms", "tenant_id"],
  ["block_presets", "tenant_id"],
  ["intake_submissions", "tenant_id"],
  ["site_generation_runs", "tenant_id"],
  ["published_site_snapshots", "tenant_id"],
  ["preview_access_grants", "tenant_id"],
  ["users_tenants", "tenant_id"],
  ["payload_locked_documents_rels", "tenants_id"],
])

const defaultDataDir = "/srv/data/saas/siab-payload/tenants"
const lockKey = 810104

const quoteIdent = (value) => `"${String(value).replaceAll('"', '""')}"`

export function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    apply: false,
    backupConfirmed: false,
    retireStagingDuplicates: false,
    databaseUri: env.DATABASE_URI || env.POSTGRES_URL || env.PGURI || "",
    dataDir: env.SIAB_TENANT_DATA_DIR || defaultDataDir,
  }

  for (const arg of argv) {
    if (arg === "--apply") options.apply = true
    else if (arg === "--backup-confirmed") options.backupConfirmed = true
    else if (arg === "--retire-staging-duplicates") options.retireStagingDuplicates = true
    else if (arg.startsWith("--data-dir=")) options.dataDir = arg.slice("--data-dir=".length)
    else if (arg === "--help" || arg === "-h") options.help = true
    else throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

export function buildStaticPlan({ retireStagingDuplicates = false, dataDir = defaultDataDir } = {}) {
  const lines = [
    "Backup first:",
    `  pg_dump -Fc "$DATABASE_URI" > "siab-payload-before-tenant-canonicalize-$(date +%Y%m%d-%H%M%S).dump"`,
    `  tar -C ${path.dirname(dataDir)} -czf "siab-payload-tenants-before-tenant-canonicalize-$(date +%Y%m%d-%H%M%S).tgz" ${path.basename(dataDir)}`,
    "",
    "Database plan:",
    "  BEGIN",
    "  acquire transaction advisory lock",
    "  verify tenant id 1 is absent or already canonical",
    "  verify source tenant 7 exists unless already canonicalized",
    "  copy tenant 7 to tenant 1 with canonical Amicare name/slug/domain",
    "  remap tenant FKs in Phase 0 tables",
    "  update JSON tenant ids in published_site_snapshots.snapshot",
    "  update JSON tenant ids in site_generation_runs.apply_result",
    "  delete source tenant 7 after references are clean",
    retireStagingDuplicates
      ? "  delete staging duplicate tenants 8 and 9 after canonical tenants verify cleanly"
      : "  leave staging duplicate tenants 8 and 9 untouched; pass --retire-staging-duplicates to delete them after verification",
    "  reset tenants_id_seq with setval(max(id))",
    "  COMMIT",
    "",
    "Filesystem plan:",
    `  copy ${dataDir}/7 -> ${dataDir}/1 when source exists and target does not`,
    "  never delete old tenant media directories; remove or archive them manually after backup validation",
  ]
  return lines.join("\n")
}

async function tableColumns(client) {
  const result = await client.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'`
  )
  const map = new Map()
  for (const row of result.rows) {
    if (!map.has(row.table_name)) map.set(row.table_name, new Set())
    map.get(row.table_name).add(row.column_name)
  }
  return map
}

const hasColumn = (columns, table, column) => columns.get(table)?.has(column) === true

async function countRows(client, table, column, value) {
  const result = await client.query(
    `SELECT count(*)::int AS count FROM ${quoteIdent(table)} WHERE ${quoteIdent(column)} = $1`,
    [value]
  )
  return result.rows[0]?.count ?? 0
}

async function inspectTenants(client) {
  const ids = [
    ...canonicalTenantMappings.flatMap((mapping) => [mapping.sourceId, mapping.targetId]),
    ...stagingDuplicateTenantIds,
  ]
  const result = await client.query(
    `SELECT id, name, slug, domain, status
       FROM tenants
      WHERE id = ANY($1::int[])
      ORDER BY id`,
    [ids]
  )
  return result.rows
}

async function inspectPlan(client, columns) {
  const tenants = await inspectTenants(client)
  const referenceCounts = []
  for (const [table, column] of tenantReferenceColumns) {
    if (!hasColumn(columns, table, column)) {
      referenceCounts.push({ table, column, exists: false })
      continue
    }
    const counts = {}
    for (const mapping of canonicalTenantMappings) {
      counts[mapping.sourceId] = await countRows(client, table, column, mapping.sourceId)
      counts[mapping.targetId] = await countRows(client, table, column, mapping.targetId)
    }
    for (const duplicateId of stagingDuplicateTenantIds) {
      counts[duplicateId] = await countRows(client, table, column, duplicateId)
    }
    referenceCounts.push({ table, column, exists: true, counts })
  }
  return { tenants, referenceCounts }
}

function printInspection(inspection) {
  console.log("Tenant rows:")
  if (inspection.tenants.length === 0) console.log("  none of ids 1/2/7/8/9/10 exist")
  for (const tenant of inspection.tenants) {
    console.log(`  ${tenant.id}: ${tenant.name} | ${tenant.slug} | ${tenant.domain} | ${tenant.status}`)
  }
  console.log("")
  console.log("Reference counts:")
  for (const item of inspection.referenceCounts) {
    if (!item.exists) {
      console.log(`  ${item.table}.${item.column}: table/column missing, skipped`)
      continue
    }
    const parts = Object.entries(item.counts).map(([id, count]) => `${id}=${count}`)
    console.log(`  ${item.table}.${item.column}: ${parts.join(", ")}`)
  }
}

function assertApplyOptions(options) {
  if (!options.apply) return
  if (!options.databaseUri) {
    throw new Error("--apply requires DATABASE_URI, POSTGRES_URL, or PGURI")
  }
  if (!options.backupConfirmed) {
    throw new Error("--apply requires --backup-confirmed after pg_dump and tenant media backup are complete")
  }
}

function assertTargetAvailability(rows) {
  const byId = new Map(rows.map((row) => [Number(row.id), row]))
  for (const mapping of canonicalTenantMappings) {
    const target = byId.get(mapping.targetId)
    if (!target) continue
    const alreadyCanonical =
      target.slug === mapping.slug &&
      target.domain === mapping.domain &&
      String(target.name).toLowerCase().includes(mapping.name.toLowerCase())
    if (!alreadyCanonical) {
      throw new Error(
        `tenant id ${mapping.targetId} is occupied by ${target.slug}/${target.domain}; expected it to be available or already ${mapping.slug}/${mapping.domain}`
      )
    }
  }
}

export function buildRenameSourceTenantForUniqueKeysQuery(mapping) {
  const archivedSlug = `canonicalized-from-${mapping.sourceId}-${mapping.slug}`
  const archivedDomain = `canonicalized-from-${mapping.sourceId}.${mapping.domain}`
  return {
    text: `UPDATE tenants
        SET slug = $2::text,
            domain = $3::text,
            notes = concat_ws(E'\\n', notes, $4::text),
            updated_at = now()
      WHERE id = $1
        AND (slug = $5::text OR domain = $6::text)`,
    values: [
      mapping.sourceId,
      archivedSlug,
      archivedDomain,
      `Canonicalization script temporarily renamed this source tenant before remapping to id ${mapping.targetId}.`,
      mapping.slug,
      mapping.domain,
    ],
  }
}

export function buildUpdatePublishedSnapshotTenantJsonQuery(mapping) {
  return {
    text: `UPDATE published_site_snapshots
          SET snapshot = jsonb_set(
            jsonb_set(snapshot, '{tenantId}', to_jsonb($2::text), true),
            '{manifest,tenantId}', to_jsonb($2::text), true
          )
        WHERE snapshot IS NOT NULL
          AND (
            snapshot #>> '{tenantId}' = $1::text
            OR snapshot #>> '{manifest,tenantId}' = $1::text
          )`,
    values: [mapping.sourceId, mapping.targetId],
  }
}

export function buildUpdateGenerationRunApplyResultTenantJsonQuery(mapping) {
  return {
    text: `UPDATE site_generation_runs
          SET apply_result = jsonb_set(apply_result, '{tenantId}', to_jsonb($2::int), true)
        WHERE apply_result IS NOT NULL
          AND apply_result #>> '{tenantId}' = $1::text`,
    values: [mapping.sourceId, mapping.targetId],
  }
}

async function renameSourceTenantForUniqueKeys(client, mapping) {
  const query = buildRenameSourceTenantForUniqueKeysQuery(mapping)
  await client.query(query.text, query.values)
}

async function createCanonicalTenant(client, columns, mapping) {
  const target = await client.query(`SELECT id, slug, domain FROM tenants WHERE id = $1`, [mapping.targetId])
  if (target.rowCount > 0) return "already-exists"

  const source = await client.query(`SELECT id FROM tenants WHERE id = $1`, [mapping.sourceId])
  if (source.rowCount !== 1) {
    throw new Error(`source tenant ${mapping.sourceId} is missing and target ${mapping.targetId} does not exist`)
  }

  await renameSourceTenantForUniqueKeys(client, mapping)

  const tenantColumns = [...(columns.get("tenants") ?? [])].filter((column) => column !== "id")
  const insertColumns = ["id", ...tenantColumns].map(quoteIdent).join(", ")
  const selectValues = [
    "$2::int AS id",
    ...tenantColumns.map((column) => {
      if (column === "name") return "$3 AS name"
      if (column === "slug") return "$4 AS slug"
      if (column === "domain") return "$5 AS domain"
      if (column === "updated_at") return "now() AS updated_at"
      if (column === "created_at") return "created_at"
      return quoteIdent(column)
    }),
  ].join(", ")

  await client.query(
    `INSERT INTO tenants (${insertColumns})
      SELECT ${selectValues}
        FROM tenants
       WHERE id = $1`,
    [mapping.sourceId, mapping.targetId, mapping.name, mapping.slug, mapping.domain]
  )
  return "created"
}

async function remapTenantReferences(client, columns, mapping) {
  for (const [table, column] of tenantReferenceColumns) {
    if (!hasColumn(columns, table, column)) continue
    await client.query(
      `UPDATE ${quoteIdent(table)}
          SET ${quoteIdent(column)} = $2
        WHERE ${quoteIdent(column)} = $1`,
      [mapping.sourceId, mapping.targetId]
    )
  }
}

async function updateEmbeddedJson(client, columns, mapping) {
  if (hasColumn(columns, "published_site_snapshots", "snapshot")) {
    const query = buildUpdatePublishedSnapshotTenantJsonQuery(mapping)
    await client.query(query.text, query.values)
  }

  if (hasColumn(columns, "site_generation_runs", "apply_result")) {
    const query = buildUpdateGenerationRunApplyResultTenantJsonQuery(mapping)
    await client.query(query.text, query.values)
  }
}

async function assertNoOldReferences(client, columns, sourceId) {
  for (const [table, column] of tenantReferenceColumns) {
    if (!hasColumn(columns, table, column)) continue
    const count = await countRows(client, table, column, sourceId)
    if (count > 0) throw new Error(`${table}.${column} still has ${count} row(s) for tenant ${sourceId}`)
  }

  if (hasColumn(columns, "published_site_snapshots", "snapshot")) {
    const result = await client.query(
      `SELECT count(*)::int AS count
         FROM published_site_snapshots
        WHERE snapshot #>> '{tenantId}' = $1::text
           OR snapshot #>> '{manifest,tenantId}' = $1::text`,
      [sourceId]
    )
    if ((result.rows[0]?.count ?? 0) > 0) throw new Error(`published_site_snapshots.snapshot still references tenant ${sourceId}`)
  }

  if (hasColumn(columns, "site_generation_runs", "apply_result")) {
    const result = await client.query(
      `SELECT count(*)::int AS count
         FROM site_generation_runs
        WHERE apply_result #>> '{tenantId}' = $1::text`,
      [sourceId]
    )
    if ((result.rows[0]?.count ?? 0) > 0) throw new Error(`site_generation_runs.apply_result still references tenant ${sourceId}`)
  }
}

async function verifyCanonicalTenant(client, mapping) {
  const result = await client.query(
    `SELECT id, name, slug, domain
       FROM tenants
      WHERE id = $1 AND slug = $2 AND domain = $3`,
    [mapping.targetId, mapping.slug, mapping.domain]
  )
  if (result.rowCount !== 1) {
    throw new Error(`canonical tenant ${mapping.targetId} did not verify as ${mapping.slug}/${mapping.domain}`)
  }
}

async function deleteSourceTenant(client, mapping) {
  await client.query(`DELETE FROM tenants WHERE id = $1`, [mapping.sourceId])
}

async function retireStagingDuplicates(client) {
  await client.query(`DELETE FROM tenants WHERE id = ANY($1::int[])`, [stagingDuplicateTenantIds])
}

async function resetTenantSequence(client) {
  await client.query(
    `SELECT setval(
      pg_get_serial_sequence('tenants', 'id'),
      GREATEST((SELECT COALESCE(max(id), 1) FROM tenants), 1),
      true
    )`
  )
}

async function applyDatabasePlan(client, columns, options) {
  await client.query("BEGIN")
  try {
    await client.query("SET LOCAL lock_timeout = '5s'")
    await client.query("SET LOCAL statement_timeout = '5min'")
    await client.query("SELECT pg_advisory_xact_lock($1)", [lockKey])

    const tenants = await inspectTenants(client)
    assertTargetAvailability(tenants)

    for (const mapping of canonicalTenantMappings) {
      const createStatus = await createCanonicalTenant(client, columns, mapping)
      console.log(`${mapping.label}: target tenant ${mapping.targetId} ${createStatus}`)
      await remapTenantReferences(client, columns, mapping)
      await updateEmbeddedJson(client, columns, mapping)
      await assertNoOldReferences(client, columns, mapping.sourceId)
      await verifyCanonicalTenant(client, mapping)
      await deleteSourceTenant(client, mapping)
    }

    for (const mapping of canonicalTenantMappings) {
      await verifyCanonicalTenant(client, mapping)
      await assertNoOldReferences(client, columns, mapping.sourceId)
    }

    if (options.retireStagingDuplicates) {
      await retireStagingDuplicates(client)
      console.log("Retired staging duplicate tenants 8/9; filesystem directories were not deleted.")
    }

    await resetTenantSequence(client)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  }
}

async function pathExists(candidate) {
  try {
    await fs.access(candidate)
    return true
  } catch {
    return false
  }
}

async function applyFilesystemCopies(dataDir) {
  for (const mapping of canonicalTenantMappings) {
    const source = path.join(dataDir, String(mapping.sourceId))
    const target = path.join(dataDir, String(mapping.targetId))
    const sourceExists = await pathExists(source)
    const targetExists = await pathExists(target)
    if (!sourceExists) {
      console.log(`filesystem: ${source} missing; skipped`)
      continue
    }
    if (targetExists) {
      console.log(`filesystem: ${target} already exists; skipped non-destructive copy from ${source}`)
      continue
    }
    await fs.cp(source, target, { recursive: true, force: false, errorOnExist: true, preserveTimestamps: true })
    console.log(`filesystem: copied ${source} -> ${target}`)
  }
}

async function main() {
  const options = parseArgs()
  if (options.help) {
    console.log(buildStaticPlan(options))
    return
  }

  assertApplyOptions(options)

  console.log(options.apply ? "Mode: APPLY" : "Mode: DRY-RUN")
  console.log(buildStaticPlan(options))
  console.log("")

  if (!options.databaseUri) {
    console.log("No DATABASE_URI/POSTGRES_URL/PGURI configured; dry-run stopped before database connection.")
    return
  }

  const client = new Client({ connectionString: options.databaseUri })
  await client.connect()
  try {
    const columns = await tableColumns(client)
    if (!columns.has("tenants")) throw new Error("public.tenants table was not found")
    const inspection = await inspectPlan(client, columns)
    printInspection(inspection)

    if (!options.apply) {
      console.log("")
      console.log("Dry-run complete. No database rows or filesystem paths were changed.")
      return
    }

    await applyFilesystemCopies(options.dataDir)
    await applyDatabasePlan(client, columns, options)
    console.log("Apply complete. Validate canonical tenants, media, snapshots, and renderer hosts before removing old media directories.")
  } finally {
    await client.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("[canonicalize-production-tenants] FAILED:", error)
    process.exit(1)
  })
}
