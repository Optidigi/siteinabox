import { execFileSync } from "node:child_process"
import { describe, expect, it } from "vitest"
import { assertDatabaseOwnership, loadCmsTestEnvironment } from "../_helpers/cmsTestEnvironment.mjs"
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
})
