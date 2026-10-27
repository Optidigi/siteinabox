import { infrastructure } from "./infrastructure-images.mjs"
import assert from "node:assert/strict"
import { test } from "node:test"
import { summarizeCiPerformance } from "./benchmark-ci.mjs"
const sample = (id, cacheMode = "normal", sourceSHA = "a".repeat(40)) => ({
  run: { id, run_attempt: 1, event: "workflow_dispatch", status: "completed", conclusion: "success", created_at: "2026-10-27T00:00:00Z", run_started_at: "2026-10-27T00:00:00Z", updated_at: "2026-10-27T00:10:00Z" },
  jobs: [{ name: "required-ci", conclusion: "success", run_id: id, run_attempt: 1, started_at: "2026-10-27T00:00:00Z", completed_at: "2026-10-27T00:10:00Z" }],
  receipt: { runId: String(id), runAttempt: "1", cacheMode, sourceSHA,
    images: ["cms", "renderer", "site"].map(application => ({ application, timings: { buildMs: 1000 }, buildEnvironment: { builder: infrastructure.ciBuildkit.reference, driver: "docker-container", cacheEnabled: cacheMode !== "cold" } })),
  },
})
test("performance comparison separates source, trigger and cache modes and labels small samples", () => {
  const report = summarizeCiPerformance([sample(1), sample(2), sample(3, "cold"), sample(4, "normal", "b".repeat(40))], ["required-ci"])
  assert.equal(report.length, 3)
  assert.equal(report[0].samples, 2)
  assert.equal(report[0].p50Seconds, 600)
  assert.match(report[0].limitation, /Too few samples/)
})
test("partial, failed, cross-run and repeated observations cannot inflate a benchmark", () => {
  const valid = sample(1)
  for (const changed of [ { ...valid, jobs: [] }, { ...valid, run: { ...valid.run, conclusion: "failure" } }, { ...valid, receipt: { ...valid.receipt, runAttempt: "2" } } ]) assert.throws(() => summarizeCiPerformance([changed], ["required-ci"]))
  assert.throws(() => summarizeCiPerformance([valid, valid], ["required-ci"]))
  const confounded = structuredClone(valid)
  confounded.receipt.images[0].buildEnvironment.driver = "docker"
  assert.throws(() => summarizeCiPerformance([confounded], ["required-ci"]))
})
