import { execFileSync, spawnSync } from "node:child_process"
import { mkdtemp, rm, access } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { Client } from "pg"
import { assertDatabaseOwnership, assertEmptyTestDatabase, loadCmsTestEnvironment } from "../_helpers/cmsTestEnvironment.mjs"
import { getTestPayload } from "./_helpers"

describe("explicit disposable test ownership", () => {
  it("rejects a different ownership marker without initializing or resetting Payload", async () => {
    const { env, resource } = await loadCmsTestEnvironment()
    await expect(assertDatabaseOwnership(env, { ...resource, id: "0".repeat(32) }))
      .rejects.toThrow("ownership marker")
  })

  it("refuses every existing database when no matching private ownership record is supplied", async () => {
    const { env, resource } = await loadCmsTestEnvironment()
    const directory = await mkdtemp(path.join(env.DATA_DIR, "siab-test-refusal-"))
    try {
      const childEnv = { ...process.env }
      // Override dotenv defaults so the child reaches the database-refusal
      // boundary with storage scoped to its candidate resource.
      childEnv.DATA_DIR = directory
      const script = fileURLToPath(new URL("../../../../scripts/authorize-cms-test-resource.mjs", import.meta.url))
      const child = spawnSync(process.execPath, [script, "--create-database", directory], { env: childEnv, encoding: "utf8", timeout: 10_000 })
      expect(child.status).toBe(1)
      expect(child.stderr).toContain("Refusing an existing unowned database")
      await expect(access(path.join(directory, "resource.json"))).rejects.toThrow()
      await assertDatabaseOwnership(env, resource)
    } finally { await rm(directory, { recursive: true }) }
  })

  it("propagates ownership to child processes and rejects inherited provider credentials", () => {
    const guard = new URL("../_helpers/cmsTestEnvironment.mjs", import.meta.url).href
    const source = `const g = await import(${JSON.stringify(guard)}); const c = await g.loadCmsTestEnvironment(); await g.assertWorkerStorage(c.env, c.resource); await g.assertDatabaseOwnership(c.env, c.resource);`
    expect(() => execFileSync(process.execPath, ["--input-type=module", "-e", source], { stdio: "pipe" })).not.toThrow()
    expect(() => execFileSync(process.execPath, ["--input-type=module", "-e", source], {
      env: { ...process.env, OPENAI_API_KEY: "siab-test-double-not-an-inherited-credential" }, stdio: "pipe",
    })).toThrow()
  })

  it("applies committed migrations and persists a synthetic tenant through the guarded Local API", async () => {
    const payload = await getTestPayload()
    const tenant = await payload.create({ collection: "tenants", overrideAccess: true,
      data: { name: "Disposable ownership fixture", slug: "owned-test-fixture", domain: "owned.test", status: "active" } })
    const restored = await payload.findByID({ collection: "tenants", id: tenant.id, overrideAccess: true })
    expect(restored.name).toBe("Disposable ownership fixture")
    await payload.delete({ collection: "tenants", id: tenant.id, overrideAccess: true })
  }, 30_000)

  it.each([
    ["function-only", "CREATE FUNCTION public.siab_guard_fixture() RETURNS integer LANGUAGE sql AS 'SELECT 1'"],
    ["enum-only", "CREATE TYPE public.siab_guard_fixture AS ENUM ('synthetic')"],
    ["schema-only", "CREATE SCHEMA siab_guard_fixture"],
    ["pg-like user schema", "CREATE SCHEMA pgfoo; CREATE TABLE pgfoo.synthetic_fixture (id integer)"],
    ["collation-only", 'CREATE COLLATION public.siab_guard_fixture FROM pg_catalog."C"'],
    ["text-search dictionary", "CREATE TEXT SEARCH DICTIONARY public.siab_guard_fixture (TEMPLATE = pg_catalog.simple)"],
    ["text-search configuration", "CREATE TEXT SEARCH CONFIGURATION public.siab_guard_fixture (COPY = pg_catalog.simple)"],
    ["operator family", "CREATE OPERATOR FAMILY public.siab_guard_fixture USING btree"],
    ["conversion-only", "CREATE CONVERSION public.siab_guard_fixture FOR 'UTF8' TO 'LATIN1' FROM pg_catalog.utf8_to_iso8859_1"],
    ["large-object-only", "SELECT lo_create(0)"],
    ["custom default privileges", "ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO PUBLIC"],
  ])("refuses to authorize a %s database as empty", async (_name, statement) => {
    const { env, resource } = await loadCmsTestEnvironment()
    await assertDatabaseOwnership(env, resource)
    const client = new Client({ connectionString: resource.databaseUri })
    await client.connect()
    try {
      // Transactional fixture on the expressly authorized test database. Rollback
      // preserves the committed migrations and any preceding synthetic fixtures.
      await client.query("BEGIN")
      await client.query("DROP SCHEMA public CASCADE")
      await client.query("CREATE SCHEMA public")
      await client.query(statement)
      await expect(assertEmptyTestDatabase(client)).rejects.toThrow("nonempty")
    } finally {
      await client.query("ROLLBACK")
      await client.end()
    }
  })
})
