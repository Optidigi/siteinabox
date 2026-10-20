import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

test("matrix admission preserves actual CI arguments and per-check settings", () => {
  const root = mkdtempSync(join(tmpdir(), "siab-verification-"))
  try {
    for (const dir of ["scripts", "docs", ".github/workflows"]) mkdirSync(join(root, dir), { recursive: true })
    for (const file of ["run-verification.mjs", "workflow-path-parser.mjs"]) copyFileSync(new URL(file, import.meta.url), join(root, "scripts", file))
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { probe: "node probe.mjs" } }))
    writeFileSync(join(root, "probe.mjs"), 'import {writeFileSync} from "node:fs"; writeFileSync("result.json", JSON.stringify({args: process.argv.slice(2), ci: process.env.CI, setting: process.env.TEST_SETTING}))')
    const check = { id: "probe", command: "pnpm probe --expected", run: ["pnpm", "probe", "--expected"], owner: "repository", ciJob: "quality", env: { TEST_SETTING: "1" }, prerequisites: ["pnpm"], risk: "low" }
    const configure = (args = "--expected", setting = "1") => {
      writeFileSync(join(root, "docs/verification-matrix.json"), JSON.stringify({ version: 1, profileEnv: { ci: { CI: "true" } }, profiles: { ci: ["probe"] }, checks: [check] }))
      writeFileSync(join(root, ".github/workflows/ci.yml"), `jobs:\n  quality:\n    steps:\n      - name: Probe\n        env:\n          TEST_SETTING: "${setting}"\n        run: pnpm probe ${args}\n`)
    }
    const run = (profile = "--check") => spawnSync(process.execPath, [join(root, "scripts/run-verification.mjs"), profile], { encoding: "utf8", env: { ...process.env, CI: "", TEST_SETTING: "inherited" } })
    configure()
    assert.equal(run().status, 0)
    configure("--wrong")
    assert.notEqual(run().status, 0, "different arguments must not count as CI coverage")
    configure("--expected --extra")
    assert.notEqual(run().status, 0, "extra arguments can change pass/fail semantics")
    configure("--expected", "0")
    assert.notEqual(run().status, 0, "changed CI test settings must be rejected")
    configure()
    const matrixPath = join(root, "docs/verification-matrix.json")
    const matrix = JSON.parse(readFileSync(matrixPath, "utf8"))
    delete matrix.profileEnv
    writeFileSync(matrixPath, JSON.stringify(matrix))
    assert.notEqual(run().status, 0, "full verification must retain CI mode")
    configure()
    const executed = run("ci")
    assert.equal(executed.status, 0, executed.stderr)
    assert.deepEqual(JSON.parse(readFileSync(join(root, "result.json"), "utf8")), { args: ["--expected"], ci: "true", setting: "1" })
    writeFileSync(join(root, "probe.mjs"), "process.exit(7)")
    assert.equal(run("ci").status, 7, "a failed check must fail the profile")
  } finally { rmSync(root, { recursive: true, force: true }) }
})
