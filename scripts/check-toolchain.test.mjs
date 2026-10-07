import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

test("real toolchain gate rejects another same-major runtime and workflow drift", () => {
  const root = mkdtempSync(join(tmpdir(), "siab-toolchain-"))
  try {
    for (const directory of ["scripts", ".github/workflows", "apps/cms", "docs/runbooks"]) mkdirSync(join(root, directory), { recursive: true })
    copyFileSync(new URL("./check-toolchain.mjs", import.meta.url), join(root, "scripts/check-toolchain.mjs"))
    const pnpm = execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim()
    writeFileSync(join(root, "package.json"), JSON.stringify({ packageManager: "pnpm@" + pnpm, engines: { node: ">=26.0.0 <27.0.0" } }))
    writeFileSync(join(root, "docs/runbooks/local-development.md"), "pnpm@" + pnpm)
    const configure = (version, workflow = version) => {
      writeFileSync(join(root, ".nvmrc"), version)
      writeFileSync(join(root, "apps/cms/Dockerfile"), "FROM node:" + version + "-alpine")
      writeFileSync(join(root, ".github/workflows/ci.yml"), "node-version: " + workflow)
    }
    const run = () => spawnSync(process.execPath, [join(root, "scripts/check-toolchain.mjs")], { encoding: "utf8" })
    configure(process.versions.node)
    assert.equal(run().status, 0)
    configure("26.0.0")
    assert.match(run().stderr, /does not match .nvmrc/)
    configure(process.versions.node, "26")
    assert.match(run().stderr, /declares Node 26, expected/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
