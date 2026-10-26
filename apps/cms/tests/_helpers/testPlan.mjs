import { globSync, readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import path from "node:path"

export const cmsTestInclude = ["tests/**/*.test.ts", "tests/**/*.integration.test.ts", "tests/**/*.test.tsx"]
export const cmsTestExclude = ["tests/e2e/**"]
export const cmsTestPartitions = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../../../docs/verification-matrix.json"), "utf8")).cmsTestPartitions
export const digest = value => createHash("sha256").update(value).digest("hex")

/** A single inventory for Vitest, the shard driver and aggregate admission. */
export function cmsTestPlan(root) {
  const files = [...new Set(globSync(cmsTestInclude, { cwd: root, exclude: cmsTestExclude }))].map(file => file.replaceAll("\\", "/")).sort()
  const pure = [...globSync("tests/pure/**/*.test.mts", { cwd: root })].sort()
  const partitions = Object.fromEntries(cmsTestPartitions.map(name => [name, []]))
  for (const kind of ["unit", "integration"]) {
    const matching = files.filter(file => file.startsWith("tests/integration/") === (kind === "integration"))
    matching.forEach((file, index) => partitions[`${kind}-${index % 2 + 1}`].push(file))
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
