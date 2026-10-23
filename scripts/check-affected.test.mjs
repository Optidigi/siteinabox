import test from "node:test"
import assert from "node:assert/strict"
import { affectedProfiles } from "./check-affected.mjs"
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join } from "node:path"
import { tmpdir } from "node:os"

test("local preflight selects owners and broadens shared or unknown inputs", () => {
  assert.deepEqual(affectedProfiles(["apps/cms/src/styles/fonts.css"]), ["fast", "cms-fast"])
  assert.deepEqual(affectedProfiles(["docs/engineering.md"]), ["fast"])
  assert.deepEqual(affectedProfiles(["apps/renderer/src/index.ts"]), ["fast", "renderer-fast"])
  for (const path of ["packages/ui/src/button.tsx", "pnpm-lock.yaml", "scripts/check-affected.mjs", "new-unmapped-app/main.ts"]) {
    assert.deepEqual(affectedProfiles([path]), ["fast", "cms-fast", "renderer-fast", "site-fast"])
  }
  assert.equal(affectedProfiles(["apps/cms/src/a.ts", "apps/cms/src/b.ts"]).filter(p => p === "cms-fast").length, 1)
})

test("CLI selects the original owner when a tracked source file moves into docs", () => {
  const root = mkdtempSync(join(tmpdir(), "siab-affected-"))
  try {
    for (const folder of ["scripts", "apps/cms", "docs"]) mkdirSync(join(root, folder), { recursive: true })
    copyFileSync(new URL("./check-affected.mjs", import.meta.url), join(root, "scripts/check-affected.mjs"))
    writeFileSync(join(root, "apps/cms/original.ts"), "export const fixture = 1\n".repeat(20))
    const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
    git(["init", "--quiet"]); git(["add", "."])
    git(["-c", "user.name=Fixture", "-c", "user.email=fixture@test.invalid", "commit", "--quiet", "-m", "base"])
    const base = git(["rev-parse", "HEAD"])
    git(["mv", "apps/cms/original.ts", "docs/moved.ts"])
    const result = JSON.parse(execFileSync(process.execPath, [join(root, "scripts/check-affected.mjs"), "--base", base, "--plan"], { cwd: root, encoding: "utf8" }))
    assert.deepEqual(result.profiles, ["fast", "cms-fast"])
    assert.equal(result.changedPaths, 2)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
