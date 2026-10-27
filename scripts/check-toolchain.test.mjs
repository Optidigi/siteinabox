import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

test("real toolchain gate rejects another same-major runtime and workflow drift", () => {
  const root = mkdtempSync(join(tmpdir(), "siab-toolchain-"))
  try {
    for (const directory of ["scripts", ".github/workflows", ".github/actions/setup-ci", "apps/cms", "docs/runbooks"]) mkdirSync(join(root, directory), { recursive: true })
    copyFileSync(new URL("./check-toolchain.mjs", import.meta.url), join(root, "scripts/check-toolchain.mjs"))
    const major = Number(process.versions.node.split(".")[0])
    const pnpm = execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim()
    writeFileSync(join(root, "package.json"), JSON.stringify({ packageManager: "pnpm@" + pnpm, engines: { node: `>=${major}.0.0 <${major + 1}.0.0` } }))
    writeFileSync(join(root, "docs/runbooks/local-development.md"), "pnpm@" + pnpm)
    const configure = (version, workflow = version) => {
      writeFileSync(join(root, ".nvmrc"), version)
      writeFileSync(join(root, "apps/cms/Dockerfile"), "FROM node:" + version + "-alpine")
      writeFileSync(join(root, ".github/workflows/ci.yml"), "node-version: " + workflow)
    }
    const run = (args = []) => spawnSync(process.execPath, [...args, join(root, "scripts/check-toolchain.mjs")], { encoding: "utf8" })
    configure(process.versions.node)
    assert.equal(run().status, 0)
    configure(major + ".0.999")
    assert.match(run().stderr, /does not match .nvmrc/)
    configure(process.versions.node, String(major))
    assert.match(run().stderr, /declares Node \d+, expected/)
    configure(process.versions.node)
    writeFileSync(join(root, ".github/actions/setup-ci/action.yml"), "node-version: " + major)
    assert.match(run().stderr, /declares Node \d+, expected/)
    writeFileSync(join(root, ".github/actions/setup-ci/action.yml"), "node-version-file: .nvmrc")
    assert.equal(run().status, 0)
    const preload = join(root, "simulate-current.mjs")
    writeFileSync(preload, 'Object.defineProperty(process.release, "lts", { value: undefined })')
    assert.match(run(["--import", preload]).stderr, /must currently be an LTS release/)

  } finally { rmSync(root, { recursive: true, force: true }) }
})
