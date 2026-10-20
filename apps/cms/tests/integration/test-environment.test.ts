import { execFileSync } from "node:child_process"
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
