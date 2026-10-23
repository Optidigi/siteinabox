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
    const combined = JSON.parse(readFileSync(matrixPath, "utf8"))
    combined.profiles.local = ["probe"]
    writeFileSync(matrixPath, JSON.stringify(combined))
    writeFileSync(join(root, "probe.mjs"), 'import {appendFileSync} from "node:fs"; appendFileSync("invocations", "one\\n")')
    assert.equal(run("ci,local").status, 0)
    assert.equal(readFileSync(join(root, "invocations"), "utf8"), "one\n", "combined profiles execute a shared command once")
    const timing = JSON.parse(readFileSync(join(root, "artifacts/verification.json"), "utf8"))
    assert.equal(timing.checks.length, 1)
    assert.equal(timing.checks[0].status, 0)
    assert(timing.checks[0].elapsedMs >= 0)
    writeFileSync(join(root, "probe.mjs"), "process.exit(7)")
    assert.equal(run("ci").status, 7, "a failed check must fail the profile")
    assert.equal(JSON.parse(readFileSync(join(root, "artifacts/verification.json"), "utf8")).checks[0].status, 7)
    const matrixCheck = { ...check, command: "pnpm probe cms", run: ["pnpm", "probe", "cms"], env: {} }
    matrix.checks = [matrixCheck]
    matrix.profileEnv = { ci: { CI: "true" } }
    writeFileSync(matrixPath, JSON.stringify(matrix))
    const matrixWorkflow = (env = "") => `jobs:\n  quality:\n    strategy:\n      matrix:\n        app: [cms]\n    steps:\n      - name: Matrix probe\n${env}        run: pnpm probe \${{ matrix.app }}\n`
    writeFileSync(join(root, ".github/workflows/ci.yml"), matrixWorkflow())
    assert.equal(run().status, 0)
    writeFileSync(join(root, ".github/workflows/ci.yml"), matrixWorkflow('        env:\n          TEST_SETTING: "hosted-only"\n'))
    assert.notEqual(run().status, 0, "matrix expansion must retain its originating step environment")
  } finally { rmSync(root, { recursive: true, force: true }) }
})
