import { globSync, readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import path from "node:path"

export const cmsTestInclude = ["tests/**/*.test.ts", "tests/**/*.integration.test.ts", "tests/**/*.test.tsx"]
export const cmsTestExclude = ["tests/e2e/**"]
export const cmsTestPartitions = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../../../docs/verification-matrix.json"), "utf8")).cmsTestPartitions
const historicalTimings = JSON.parse(readFileSync(new URL("./timings.json", import.meta.url), "utf8"))
export const digest = value => createHash("sha256").update(value).digest("hex")

/** A single inventory for Vitest, the shard driver and aggregate admission. */
export function cmsTestPlan(root, timings = historicalTimings) {
  const files = [...new Set(globSync(cmsTestInclude, { cwd: root, exclude: cmsTestExclude }))].map(file => file.replaceAll("\\", "/")).sort()
  const pure = [...globSync("tests/pure/**/*.test.mts", { cwd: root })].sort()
  const partitions = Object.fromEntries(cmsTestPartitions.map(name => [name, []]))
  for (const kind of ["unit", "integration"]) {
    const matching = files.filter(file => file.startsWith("tests/integration/") === (kind === "integration"))
    const lanes = cmsTestPartitions.filter(part => part.startsWith(kind + "-"))
    const overhead = timings.overheadMs[kind]
    if (!Number.isFinite(overhead) || overhead <= 0) throw new Error("Invalid scheduling overhead")
    const samples = matching.map(file => timings.executionsMs[file]).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b)
    const fallback = samples[Math.floor(samples.length / 2)] ?? overhead
    const cost = file => overhead + (timings.executionsMs[file] ?? fallback)
    if (matching.some(file => !Number.isFinite(cost(file)) || cost(file) <= 0)) throw new Error("Invalid test timing estimate")
    const load = Object.fromEntries(lanes.map(part => [part, timings.fixedMs[part] ?? 0]))
    if (Object.values(load).some(value => !Number.isFinite(value) || value < 0)) throw new Error("Invalid fixed scheduling estimate")
    // Longest estimated file first; deterministic ties and a median fallback
    // keep new tests included without consulting runtime/network state.
    matching.sort((a, b) => cost(b) - cost(a) || a.localeCompare(b))
    for (const file of matching) {
      const empty = lanes.filter(lane => partitions[lane].length === 0)
      const lane = [...(empty.length ? empty : lanes)].sort((a, b) => load[a] - load[b] || a.localeCompare(b))[0]
      partitions[lane].push(file)
      load[lane] += cost(file)
    }
    for (const lane of lanes) partitions[lane].sort()
  }
  if (!files.length || !pure.length || Object.values(partitions).some(group => !group.length)) throw new Error("CMS test inventory is incomplete")
  const inputs = [...files, ...pure].map(file => ({ file, sha256: digest(readFileSync(path.join(root, file))) }))
  return { files, pure, partitions, hash: digest(JSON.stringify({ partitions, inputs })) }
}

export function assertVitestResult(report, selected, root) {
  const actual = report?.testResults?.map(result => path.relative(root, result.name).replaceAll("\\", "/")).sort()
  if (report?.success !== true || report.numFailedTests !== 0 || report.numFailedTestSuites !== 0 ||
      !Number.isInteger(report.numTotalTests) || report.numTotalTests < 1 || report.numPassedTests !== report.numTotalTests ||
      report.numPendingTests !== 0 || report.numTodoTests !== 0 ||
      JSON.stringify(actual) !== JSON.stringify([...selected].sort()) ||
      report.testResults.some(result => result.status !== "passed")) throw new Error("CMS shard did not pass its complete selected test inventory")
  return { files: actual.length, tests: report.numTotalTests }
}

export function assertNodeTestOutput(output) {
  const counts = Object.fromEntries(["tests", "pass", "fail", "cancelled", "skipped", "todo"].map(name => [name, Number(output.match(new RegExp("^# " + name + " (\\d+)$", "m"))?.[1] ?? NaN)]))
  if (!Number.isInteger(counts.tests) || counts.tests < 1 || counts.tests !== counts.pass || ["fail", "cancelled", "skipped", "todo"].some(name => counts[name] !== 0)) throw new Error("Pure provider tests failed or skipped cases")
  return counts.tests
}
