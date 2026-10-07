import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

export function expectedCiJobs(matrix) {
  const checks = new Map(matrix.checks.map((check) => [check.id, check]))
  return [...new Set(matrix.profiles.ci.map((id) => checks.get(id)?.ciJob))].sort()
}

export function assertRequiredCiWorkflow(source, jobs) {
  const block = source.match(/^  required-ci:\s*\n([\s\S]*?)(?=^  [\w-]+:\s*$|(?![\s\S]))/m)?.[1]
  if (!block) throw new Error("CI must declare the required-ci summary job")
  const needs = block.match(/^    needs: \[([^\]]+)\]$/m)?.[1].split(/,\s*/).sort()
  if (JSON.stringify(needs) !== JSON.stringify(jobs)) {
    throw new Error("required-ci needs must cover exactly every canonical CI job")
  }
  if (!/^    if: \$\{\{ always\(\) \}\}$/m.test(block) || /continue-on-error:/.test(block)) {
    throw new Error("required-ci must always run and propagate failures")
  }
  if (!block.includes("run: node scripts/check-required-ci.mjs") ||
      !block.includes("CI_JOB_RESULTS: ${{ toJSON(needs) }}")) {
    throw new Error("required-ci must check authentic dependency results")
  }
}

export function assertRequiredCiResults(results, jobs) {
  if (!results || typeof results !== "object" || Array.isArray(results) ||
      JSON.stringify(Object.keys(results).sort()) !== JSON.stringify(jobs)) {
    throw new Error("Canonical CI job results are missing or unexpected")
  }
  const failed = jobs.filter((job) => results[job]?.result !== "success")
  if (failed.length) throw new Error("Canonical CI did not succeed: " + failed.join(", "))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const matrix = JSON.parse(await readFile(new URL("../docs/verification-matrix.json", import.meta.url), "utf8"))
  assertRequiredCiResults(JSON.parse(process.env.CI_JOB_RESULTS ?? "null"), expectedCiJobs(matrix))
  console.log("Every canonical CI job succeeded")
}
