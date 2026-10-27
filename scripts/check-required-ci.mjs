import { parseWorkflow, assertNoIgnoredFailures, assertCanonicalImageWorkflow, hasRequiredCommand, condition } from "./canonical-ci-workflow.mjs"
import { readFileSync } from "node:fs"
import { readFile, mkdir, writeFile, appendFile } from "node:fs/promises"
import { assertCmsTestReceipts, loadCmsTestReceipts } from "./check-cms-test-results.mjs"
import { cmsTestPlan } from "../apps/cms/tests/_helpers/testPlan.mjs"
import { infrastructure } from "./infrastructure-images.mjs"
import { cmsTestPartitions } from "../apps/cms/tests/_helpers/testPlan.mjs"
import { fileURLToPath } from "node:url"
import { checkDependencySecurity } from "./check-dependency-security.mjs"
import { imageApplications, assertImageVerificationEvidence } from "./image-evidence.mjs"

export function expectedCiJobs(matrix) {
  const checks = new Map(matrix.checks.map((check) => [check.id, check]))
  return [...new Set(matrix.profiles.ci.map((id) => checks.get(id)?.ciJob))].sort()
}

const canonicalMatrix = JSON.parse(readFileSync(new URL("../docs/verification-matrix.json", import.meta.url), "utf8"))

export function assertRequiredCiWorkflow(source, jobs) {
  const workflow = parseWorkflow(source), summary = workflow.jobs["required-ci"]
  if (!summary) throw new Error("CI must declare the required-ci summary job")
  const needs = [...(Array.isArray(summary.needs) ? summary.needs : [summary.needs])].sort()
  if (JSON.stringify(needs) !== JSON.stringify(jobs)) throw new Error("required-ci needs must cover exactly every canonical CI job")
  assertNoIgnoredFailures(workflow)
  if (condition(summary.if) !== "always()" || summary.env?.CI_JOB_RESULTS !== "${{ toJSON(needs) }}" ||
      !hasRequiredCommand(summary, "node scripts/check-required-ci.mjs")) throw new Error("required-ci must always check authentic dependency results")
  if (!jobs.includes("cms-browser")) return
  for (const job of jobs) {
    const owned = workflow.jobs[job]
    const actual = owned?.needs === undefined ? [] : Array.isArray(owned.needs) ? [...owned.needs].sort() : [owned.needs]
    if (!owned || JSON.stringify(actual) !== JSON.stringify([...(canonicalMatrix.ciDependencies[job] ?? [])].sort())) throw new Error("CI dependencies must match the canonical graph: " + job)
  }
  for (const name of ["cms-tests", "cms-browser"]) {
    const job = workflow.jobs[name], setup = job.steps?.find(step => step.uses === "./.github/actions/setup-ci")
    if (Object.hasOwn(job, "if") || !job.services?.postgres || job.env?.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" ||
        job.env?.SITE_GENERATION_PROVIDER !== "mock" || job.container?.image !== infrastructure.ciBrowser.reference ||
        setup?.with?.["dns-tools"] !== "true" ||
        !hasRequiredCommand(job, 'node scripts/authorize-cms-test-resource.mjs --create-database "$RUNNER_TEMP/siab-test-cms"') ||
        !hasRequiredCommand(job, "node scripts/check-browser-runtime.mjs cms --dns")) throw new Error("Parallel CMS jobs require independently owned PostgreSQL and verified pinned browser/BIND prerequisites: " + name)
  }
  if (jobs.includes("exchange-worker")) {
    const worker = workflow.jobs["exchange-worker"]
    const archive = worker.steps?.find(step => step.with?.name === "image-exchange-worker")
    if (Object.hasOwn(worker, "if") || !hasRequiredCommand(worker, "node scripts/verify-exchange-worker.mjs") ||
        condition(archive?.if) !== "github.ref == 'refs/heads/main' && github.event_name != 'pull_request'" ||
        archive?.with?.path !== "${{ steps.verify.outputs.artifact-path }}" || archive?.with?.["if-no-files-found"] !== "error") throw new Error("Worker verification must run unconditionally; its archive is trusted-main only")
  }
  const shards = workflow.jobs["cms-tests"], summaryJob = workflow.jobs["cms-test"]
  if (JSON.stringify(shards.strategy?.matrix) !== JSON.stringify({ part: cmsTestPartitions }) || shards.strategy?.["fail-fast"] !== false ||
      !hasRequiredCommand(shards, "node scripts/run-cms-tests.mjs ${{ matrix.part }}") ||
      condition(summaryJob?.if) !== "always()" || !hasRequiredCommand(summaryJob, 'test "$PARTITION_RESULT" = success') ||
      !hasRequiredCommand(summaryJob, "node scripts/check-cms-test-results.mjs")) throw new Error("Canonical CMS test partitions and fail-closed summary are required")
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

export const assertImageMatrix = assertCanonicalImageWorkflow

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const matrix = JSON.parse(await readFile(new URL("../docs/verification-matrix.json", import.meta.url), "utf8"))
  const source = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  if (process.argv[2] === "--check") {
    assertRequiredCiWorkflow(source, expectedCiJobs(matrix))
    assertImageMatrix(source)
    console.log("Required CI dependencies and consuming-image matrix verified")
  } else {
    const results = JSON.parse(process.env.CI_JOB_RESULTS ?? "null")
    assertRequiredCiResults(results, expectedCiJobs(matrix))
    const root = fileURLToPath(new URL("..", import.meta.url))
    const cmsTests = await loadCmsTestReceipts(root)
    assertCmsTestReceipts(cmsTests, cmsTestPlan(root + "/apps/cms"), { sourceSHA: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT })
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
      cacheMode: process.env.GITHUB_EVENT_PATH ? JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8")).inputs?.["cache-mode"] ?? "normal" : "normal",
      evidenceKind: "canonical CI and unpublished packaged-image verification; not deployment/provider proof",
      sourceSHA: process.env.GITHUB_SHA, pullRequestHeadSHA: process.env.PR_HEAD_SHA || null,
      workflow: ".github/workflows/ci.yml", runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT, results, images, cmsTests,
    }, null, 2) + "\n")
    if (process.env.GITHUB_STEP_SUMMARY) {
      const seconds = value => Number.isFinite(value) ? (value / 1000).toFixed(1) + "s" : "unavailable"
      const rows = ["## Canonical verification timings", "", "Execution remains fully required; cache inputs do not replace tests or image proof.", "", "| CMS partition | Files | Tests | Execution |", "| --- | ---: | ---: | ---: |",
        ...cmsTests.map(receipt => `| ${receipt.part} | ${receipt.counts.files} | ${receipt.counts.tests} | ${seconds(receipt.elapsedMs)} |`), "", "| Image | Build | Packaged smoke | Archive/hash | App inventory | Infrastructure inventory |", "| --- | ---: | ---: | ---: | ---: | ---: |",
        ...images.map(image => `| ${image.application} | ${seconds(image.timings?.buildMs)} | ${seconds(image.timings?.packagedSmokeMs)} | ${seconds(image.timings?.archiveMs)} | ${seconds(image.timings?.applicationInventoryMs)} | ${seconds(image.timings?.infrastructureInventoryMs)} |`)]
      await appendFile(process.env.GITHUB_STEP_SUMMARY, rows.join("\n") + "\n")
    }
    console.log("Every canonical CI job and exact-source packaged image succeeded")
  }
}
