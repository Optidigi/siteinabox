import { readFile, mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { execFileSync, spawnSync } from "node:child_process"
import { cmsTestPlan, cmsTestPartitions, assertVitestResult, assertNodeTestOutput } from "../apps/cms/tests/_helpers/testPlan.mjs"

const root = fileURLToPath(new URL("..", import.meta.url))
const cms = path.join(root, "apps/cms")
const part = process.argv[2]
if (!cmsTestPartitions.includes(part) || process.argv.length !== 3) throw new Error("Choose one canonical CMS test partition: " + cmsTestPartitions.join(", "))
const plan = cmsTestPlan(cms)
const output = path.join(root, "artifacts/cms-tests", part)
await mkdir(output, { recursive: true })
const started = Date.now()
const sourceSHA = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
const sourceDirty = Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim())
const result = { version: 1, part, sourceSHA, sourceDirty, qualification: process.env.GITHUB_RUN_ID ? "hosted-canonical" : "local-diagnostic", pureCount: 0, runId: process.env.GITHUB_RUN_ID ?? null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null, planHash: plan.hash,
  selected: plan.partitions[part], pure: part === "unit-1" ? plan.pure : [], status: "failed" }
let exit = 1
try {
  if (process.env.GITHUB_RUN_ID && sourceDirty) throw new Error("Hosted CMS verification requires clean exact source")
  if (part === "unit-1") {
    const pure = spawnSync(process.execPath, ["--conditions=react-server", "--test", "--test-reporter=tap", ...plan.pure], { cwd: cms, env: process.env, stdio: ["inherit", "pipe", "inherit"], encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
    process.stdout.write(pure.stdout ?? "")
    if (pure.error || pure.status !== 0) throw new Error("Pure provider tests failed")
    result.pureCount = assertNodeTestOutput(pure.stdout)
  }
  const reportPath = path.join(output, "vitest.json")
  const tests = spawnSync("pnpm", ["exec", "vitest", "run", "--reporter=default", "--reporter=json", "--outputFile=" + reportPath], { cwd: cms, env: { ...process.env, SIAB_TEST_CMS_PARTITION: part }, stdio: "inherit" })
  if (tests.error || tests.status !== 0) throw new Error(`CMS test partition failed (exit=${tests.status}, signal=${tests.signal ?? "none"}${tests.error ? ", " + tests.error.message : ""})`)
  result.counts = assertVitestResult(JSON.parse(await readFile(reportPath, "utf8")), plan.partitions[part], cms)
  if (execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim() !== sourceSHA) throw new Error("Checkout changed during verification")
  if (cmsTestPlan(cms).hash !== plan.hash) throw new Error("Test inventory changed during execution")
  result.sourceDirty ||= Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim())
  if (process.env.GITHUB_RUN_ID && result.sourceDirty) throw new Error("Source changed during hosted verification")
  result.status = "passed"; exit = 0
} catch (error) { console.error(error.message) }
finally { await writeFile(path.join(output, "receipt.json"), JSON.stringify({ ...result, elapsedMs: Date.now() - started }, null, 2) + "\n") }
process.exitCode = exit
