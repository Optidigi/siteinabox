import { readFile, mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { checkDependencySecurity } from "./check-dependency-security.mjs"
import { imageApplications, assertImageVerificationEvidence } from "./image-evidence.mjs"

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
  if (!/^    if: \$\{\{ always\(\) \}\}$/m.test(block) || /continue-on-error:/.test(source)) {
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

export function expectedHostedJobs(matrix) {
  return [...new Set(matrix.profiles.ci.map((id) => {
    const check = matrix.checks.find((entry) => entry.id === id)
    return check.ciContext ?? check.ciJob
  })), "required-ci"].sort()
}

export function assertImageMatrix(source) {
  const block = source.match(/^  image-verification:\s*\n([\s\S]*?)(?=^  [\w-]+:\s*$|(?![\s\S]))/m)?.[1]
  // This exact diagnostic upload runs after failures; verification and evidence
  // steps still cannot acquire skip/conditional behavior.
  const verification = block?.replace(/      - name: Retain scanner failure diagnostics\n        if: always\(\)\n        uses: actions\/upload-artifact@[a-f0-9]{40}[^\n]*\n        with:\n          name: ci-dependency-diagnostics-\$\{\{ matrix.app \}\}\n          path: \|\n            artifacts\/siab-verify-\*\/image-\*\.json\n            artifacts\/siab-verify-\*\/image-\*\.log\n          if-no-files-found: ignore\n          retention-days: 7/, "")
  const triggers = source.split("jobs:")[0]
  if (!block || !triggers.includes("  pull_request:\n") || !triggers.includes("  push:\n") ||
      /paths(?:-ignore)?:|branches-ignore:|pull_request_target:/.test(triggers) ||
      !block.includes("app: [cms, renderer, site]") || !block.includes("fail-fast: false") ||
      /\bif:|continue-on-error:|exclude:|include:/m.test(verification) ||
      !block.includes("run: pnpm image:verify ${{ matrix.app }}") ||
      !block.includes("name: ci-image-${{ matrix.app }}") || !block.includes("if-no-files-found: error") ||
      /packages:\s*write|login-action|docker\s+push\b|type=registry/.test(source)) {
    throw new Error("Canonical CI must verify all three packaged images on every PR/main push without skips or registry writes")
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const matrix = JSON.parse(await readFile(new URL("../docs/verification-matrix.json", import.meta.url), "utf8"))
  const source = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  assertRequiredCiWorkflow(source, expectedCiJobs(matrix))
  assertImageMatrix(source)
  if (process.argv[2] === "--check") {
    console.log("Required CI dependencies and consuming-image matrix verified")
  } else {
    const results = JSON.parse(process.env.CI_JOB_RESULTS ?? "null")
    assertRequiredCiResults(results, expectedCiJobs(matrix))
    const images = []
    for (const image of imageApplications) {
      const evidence = JSON.parse(await readFile("artifacts/ci-images/image-" + image + ".json", "utf8"))
      assertImageVerificationEvidence({ sha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
        attempt: process.env.GITHUB_RUN_ATTEMPT, image }, evidence)
      images.push(evidence)
    }
    await checkDependencySecurity(["--source-evidence", "artifacts/dependency-source/dependency-source.json", "--images", "artifacts/ci-images"])
    await mkdir("artifacts", { recursive: true })
    await writeFile("artifacts/required-ci.json", JSON.stringify({
      evidenceKind: "canonical CI and unpublished packaged-image verification; not deployment/provider proof",
      sourceSHA: process.env.GITHUB_SHA, pullRequestHeadSHA: process.env.PR_HEAD_SHA || null,
      workflow: ".github/workflows/ci.yml", runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT, results, images,
    }, null, 2) + "\n")
    console.log("Every canonical CI job and exact-source packaged image succeeded")
  }
}
