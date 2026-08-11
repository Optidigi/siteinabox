import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { classifyEnvironmentName, classifyInventory } from "./environment-contract.mjs"

test("public browser configuration is classified as public build input", () => {
  assert.deepEqual(classifyEnvironmentName("landing", "PUBLIC_TURNSTILE_SITE_KEY"), {
    app: "landing",
    name: "PUBLIC_TURNSTILE_SITE_KEY",
    exposure: "public",
    phase: "build",
    requiredness: "optional",
  })
})

test("CMS secrets remain server-side and operation-scoped", () => {
  assert.deepEqual(classifyEnvironmentName("cms", "MOLLIE_API_KEY"), {
    app: "cms",
    name: "MOLLIE_API_KEY",
    exposure: "secret",
    phase: "runtime",
    requiredness: "operation-scoped",
  })
})

test("CMS startup requirements are explicit", () => {
  assert.equal(classifyEnvironmentName("cms", "PAYLOAD_SECRET").requiredness, "startup-required")
  assert.equal(classifyEnvironmentName("cms", "DATABASE_URI").requiredness, "startup-required")
})

test("static site and renderer phases remain application-specific", () => {
  assert.equal(classifyEnvironmentName("intake", "SITE_URL").phase, "build")
  assert.equal(classifyEnvironmentName("renderer", "SITE_URL").phase, "runtime")
})

test("the checked-in inventory is fully classifiable", async () => {
  const inventory = JSON.parse(await readFile(new URL("../docs/environment-inventory.json", import.meta.url), "utf8"))
  const classifications = classifyInventory(inventory)
  assert.equal(classifications.length, 100)
  assert.ok(classifications.every(({ exposure, phase, requiredness }) => exposure && phase && requiredness))
})
