import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  buildUpdateGenerationRunApplyResultTenantJsonQuery,
  buildUpdatePublishedSnapshotTenantJsonQuery,
  buildRenameSourceTenantForUniqueKeysQuery,
  buildStaticPlan,
  canonicalTenantMappings,
  parseArgs,
} from "../../scripts/canonicalize-production-tenants.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const scriptPath = path.resolve(__dirname, "../../scripts/canonicalize-production-tenants.mjs")

describe("canonicalize-production-tenants ops script", () => {
  it("defaults to dry-run without a database URI", () => {
    const options = parseArgs([], {} as NodeJS.ProcessEnv)

    expect(options.apply).toBe(false)
    expect(options.backupConfirmed).toBe(false)
    expect(options.databaseUri).toBe("")
  })

  it("requires an explicit apply flag before mutation mode", () => {
    const options = parseArgs(["--apply", "--backup-confirmed"], {
      DATABASE_URI: "postgres://payload:payload@localhost:5432/payload",
    } as unknown as NodeJS.ProcessEnv)

    expect(options.apply).toBe(true)
    expect(options.backupConfirmed).toBe(true)
    expect(options.databaseUri).toContain("localhost")
  })

  it("documents backup, create/remap/delete, sequence reset, and non-destructive media copies", () => {
    const plan = buildStaticPlan({ retireStagingDuplicates: true, dataDir: "/srv/data/saas/siab-payload/tenants" })

    expect(plan).toContain("pg_dump")
    expect(plan).toContain("copy tenant 7 to tenant 1")
    expect(plan).toContain("remap tenant FKs")
    expect(plan).toContain("delete source tenant 7")
    expect(plan).toContain("reset tenants_id_seq")
    expect(plan).toContain("copy /srv/data/saas/siab-payload/tenants/7 -> /srv/data/saas/siab-payload/tenants/1")
    expect(plan).not.toContain("tenant 10")
    expect(plan).toContain("never delete old tenant media directories")
  })

  it("casts rename query text placeholders so PostgreSQL can infer parameter types", () => {
    const query = buildRenameSourceTenantForUniqueKeysQuery(canonicalTenantMappings[0])

    expect(query.text).toContain("slug = $2::text")
    expect(query.text).toContain("domain = $3::text")
    expect(query.text).toContain("notes = concat_ws(E'\\n', notes, $4::text)")
    expect(query.text).toContain("slug = $5::text OR domain = $6::text")
    expect(query.values).toEqual([
      7,
      "canonicalized-from-7-ami-care",
      "canonicalized-from-7.ami-care.nl",
      "Canonicalization script temporarily renamed this source tenant before remapping to id 1.",
      "ami-care",
      "ami-care.nl",
    ])
  })

  it("retargets published snapshot tenant ids as JSON strings", () => {
    const query = buildUpdatePublishedSnapshotTenantJsonQuery(canonicalTenantMappings[0])

    expect(query.text).toContain("jsonb_set(snapshot, '{tenantId}', to_jsonb($2::text), true)")
    expect(query.text).toContain("'{manifest,tenantId}', to_jsonb($2::text), true")
    expect(query.text).not.toContain("to_jsonb($2::int)")
    expect(query.values).toEqual([7, 1])
  })

  it("retargets generation run apply results with the existing numeric id shape", () => {
    const query = buildUpdateGenerationRunApplyResultTenantJsonQuery(canonicalTenantMappings[0])

    expect(query.text).toContain("jsonb_set(apply_result, '{tenantId}', to_jsonb($2::int), true)")
    expect(query.values).toEqual([7, 1])
  })

  it("does not embed production host mutation commands", () => {
    const source = fs.readFileSync(scriptPath, "utf8")

    expect(source).not.toMatch(/\bssh\b/)
    expect(source).not.toMatch(/\bscp\b/)
    expect(source).not.toMatch(/\bpsql\s+/)
    expect(source).not.toMatch(/docker\s+exec/)
    expect(source).not.toMatch(/podman\s+exec/)
    expect(source).not.toMatch(/DELETE\s+FROM\s+\/srv/)
  })
})
