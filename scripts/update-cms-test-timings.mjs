import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { cmsTestPlan, cmsTestPartitions, assertVitestResult } from "../apps/cms/tests/_helpers/testPlan.mjs"

const [directory, jobsFile] = process.argv.slice(2)
if (!directory || !jobsFile || process.argv.length !== 4) throw new Error("Usage: node scripts/update-cms-test-timings.mjs DOWNLOADED_PARTITION_ARTIFACTS JOBS_API_JSON")
const root = fileURLToPath(new URL("../apps/cms", import.meta.url)), plan = cmsTestPlan(root)
const executionsMs = {}, totals = { unit: { elapsed: 0, execution: 0, files: 0 }, integration: { elapsed: 0, execution: 0, files: 0 } }
let identity
for (const part of cmsTestPartitions) {
  const folder = path.join(directory, "cms-test-" + part)
  const receipt = JSON.parse(await readFile(path.join(folder, "receipt.json"), "utf8"))
  const report = JSON.parse(await readFile(path.join(folder, "vitest.json"), "utf8"))
  const current = { sourceSHA: receipt.sourceSHA, runId: receipt.runId, runAttempt: receipt.runAttempt }
  assert(/^[a-f0-9]{40}$/.test(current.sourceSHA) && /^[1-9][0-9]*$/.test(current.runId) && /^[1-9][0-9]*$/.test(current.runAttempt))
  identity ??= current
  assert.deepEqual(current, identity, "Timing reports must come from one source/run/attempt")
  assert(receipt.status === "passed" && receipt.sourceDirty === false && receipt.qualification === "hosted-canonical" && receipt.part === part)
  assert(Number.isFinite(receipt.elapsedMs) && receipt.elapsedMs > 0)
  const reportRoot = report.testResults[0].name.split("/tests/")[0]
  assertVitestResult(report, receipt.selected, reportRoot)
  const kind = part.startsWith("unit-") ? "unit" : "integration"
  totals[kind].elapsed += receipt.elapsedMs
  for (const file of receipt.selected) {
    assert(plan.files.includes(file) && !Object.hasOwn(executionsMs, file), "Unknown or duplicate test timing")
    const entry = report.testResults.find(result => result.name.endsWith("/" + file))
    const duration = entry?.endTime - entry?.startTime
    assert(Number.isFinite(duration) && duration >= 0, "Missing per-file execution timing")
    executionsMs[file] = Math.max(1, Math.round(duration))
    totals[kind].execution += duration
    totals[kind].files++
  }
}
assert.deepEqual(Object.keys(executionsMs).sort(), plan.files, "Timing refresh must cover the whole current inventory")
const jobs = JSON.parse(await readFile(jobsFile, "utf8")).jobs
assert(jobs.length && jobs.every(job => String(job.run_id) === identity.runId && String(job.run_attempt) === identity.runAttempt && job.conclusion === "success"))
const checkout = jobs.find(job => job.name === "cms-tests (unit-1)")?.steps.find(step => step.name === "Verify checkout browser contract")
assert(checkout?.conclusion === "success", "Checkout timing must come from the same successful run")
const checkoutMs = Date.parse(checkout.completed_at) - Date.parse(checkout.started_at)
assert(Number.isFinite(checkoutMs) && checkoutMs > 0)
const profile = { schemaVersion: 1, provenance: identity,
  limitation: "Historical estimates for scheduling only; Vitest execution excludes import/setup overhead, so partition wall time supplies an amortized estimate. Never coverage or qualification evidence.",
  overheadMs: Object.fromEntries(Object.entries(totals).map(([kind, total]) => [kind, Math.max(1, Math.round((total.elapsed - total.execution) / total.files))])),
  // The checkout browser fixture runs after unit-1; reserve its measured time.
  fixedMs: { "unit-1": checkoutMs, "unit-2": 0, "integration-1": 0, "integration-2": 0 },
  executionsMs: Object.fromEntries(Object.entries(executionsMs).sort(([a], [b]) => a.localeCompare(b))) }
await writeFile(new URL("../apps/cms/tests/_helpers/timings.json", import.meta.url), JSON.stringify(profile, null, 2) + "\n")
console.log("Updated historical scheduling estimates for " + plan.files.length + " files from run " + identity.runId)
