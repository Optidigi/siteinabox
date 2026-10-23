import test from "node:test"
import assert from "node:assert/strict"
import { affectedProfiles } from "./check-affected.mjs"

test("local preflight selects owners and broadens shared or unknown inputs", () => {
  assert.deepEqual(affectedProfiles(["apps/cms/src/styles/fonts.css"]), ["fast", "cms-fast"])
  assert.deepEqual(affectedProfiles(["docs/engineering.md"]), ["fast"])
  assert.deepEqual(affectedProfiles(["apps/renderer/src/index.ts"]), ["fast", "renderer-fast"])
  for (const path of ["packages/ui/src/button.tsx", "pnpm-lock.yaml", "scripts/check-affected.mjs", "new-unmapped-app/main.ts"]) {
    assert.deepEqual(affectedProfiles([path]), ["fast", "cms-fast", "renderer-fast", "site-fast"])
  }
  assert.equal(affectedProfiles(["apps/cms/src/a.ts", "apps/cms/src/b.ts"]).filter(p => p === "cms-fast").length, 1)
})
