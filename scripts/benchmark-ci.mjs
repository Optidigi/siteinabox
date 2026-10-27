import assert from "node:assert/strict"
import { readFile, mkdir, writeFile, mkdtemp, rm } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { expectedHostedJobs } from "./check-required-ci.mjs"

const seconds = (start, end) => {
  const value = (Date.parse(end) - Date.parse(start)) / 1000
  assert(Number.isFinite(value) && value >= 0, "Completed run/job timestamps are required")
  return value
}
export function summarizeCiPerformance(samples, expectedJobs) {
  const groups = new Map()
  for (const { run, jobs, receipt } of samples) {
    assert(run.status === "completed" && run.conclusion === "success", "Only full successful runs are comparable")
    assert(String(run.id) === receipt.runId && String(run.run_attempt) === receipt.runAttempt)
    assert(jobs.length === expectedJobs.length && jobs.every(job => job.conclusion === "success" && String(job.run_id) === receipt.runId && String(job.run_attempt) === receipt.runAttempt))
    assert.deepEqual(jobs.map(job => job.name).sort(), [...expectedJobs].sort())
    assert(["normal", "cold"].includes(receipt.cacheMode), "Cache mode must be recorded by the tested workflow")
    const key = receipt.sourceSHA + ":" + run.event + ":" + receipt.cacheMode
    const group = groups.get(key) ?? { sourceSHA: receipt.sourceSHA, event: run.event, cacheMode: receipt.cacheMode, runs: [] }
    assert(!group.runs.some(item => item.runId === receipt.runId && item.attempt === receipt.runAttempt), "A repeated observation is not another sample")
    group.runs.push({ runId: receipt.runId, attempt: receipt.runAttempt,
      elapsedSeconds: seconds(run.run_started_at, jobs.map(job => job.completed_at).sort().at(-1)),
      jobSeconds: jobs.reduce((sum, job) => sum + seconds(job.started_at, job.completed_at), 0),
      queueSeconds: seconds(run.created_at, run.run_started_at) })
    groups.set(key, group)
  }
  return [...groups.values()].map(group => {
    const sorted = group.runs.map(run => run.elapsedSeconds).sort((a, b) => a - b)
    const percentile = fraction => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]
    return { ...group, samples: sorted.length, p50Seconds: percentile(0.5), p95Seconds: percentile(0.95),
      limitation: sorted.length < 20 ? "Too few samples for a stable p95; descriptive observations only. Cache mode does not prove a cache hit." : "Descriptive percentiles; shared-runner/network variance and cache hits require separate interpretation." }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ids = process.argv.slice(2)
  assert(ids.length && ids.length <= 20 && ids.every(id => /^[1-9][0-9]*$/.test(id)), "Usage: node scripts/benchmark-ci.mjs RUN_ID [RUN_ID ...] (up to 20)")
  const matrix = JSON.parse(await readFile(new URL("../docs/verification-matrix.json", import.meta.url), "utf8"))
  const samples = []
  for (const id of ids) {
    const directory = "artifacts/ci-performance/" + id
    await mkdir(directory, { recursive: true })
    const api = suffix => JSON.parse(execFileSync("gh", ["api", "repos/Optidigi/siteinabox/actions/runs/" + id + suffix], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }))
    const run = api(""), { jobs, total_count: total } = api("/jobs?per_page=100")
    assert(total === jobs.length, "Incomplete job response")
    // This downloads existing diagnostic evidence; it never dispatches CI or writes GitHub settings.
    const temporary = await mkdtemp(directory + "/download-")
    let receipt
    try {
      execFileSync("gh", ["run", "download", id, "-n", "required-ci-evidence", "-D", temporary], { stdio: "pipe" })
      receipt = JSON.parse(await readFile(temporary + "/required-ci.json", "utf8"))
      await writeFile(directory + "/required-ci.json", JSON.stringify(receipt, null, 2) + "\n")
    } finally { await rm(temporary, { recursive: true, force: true }) }
    await writeFile(directory + "/run.json", JSON.stringify(run, null, 2) + "\n")
    await writeFile(directory + "/jobs.json", JSON.stringify({ jobs }, null, 2) + "\n")
    samples.push({ run, jobs, receipt })
  }
  const report = summarizeCiPerformance(samples, expectedHostedJobs(matrix))
  await writeFile("artifacts/ci-performance/report.json", JSON.stringify(report, null, 2) + "\n")
  console.log(JSON.stringify(report, null, 2))
}
