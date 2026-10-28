import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import { test } from "node:test"
import { assertRequiredCiResults, assertRequiredCiWorkflow } from "./check-required-ci.mjs"

const jobs = ["cms-test", "site"]
const source = `jobs:
  required-ci:
    if: \${{ always() }}
    needs: [site, cms-test]
    runs-on: ubuntu-latest
    env:
      CI_JOB_RESULTS: \${{ toJSON(needs) }}
    steps:
      - run: node scripts/check-required-ci.mjs
`

test("summary accepts all successes and rejects skipped, cancelled, failed and missing jobs", () => {
  assertRequiredCiResults({ "cms-test": { result: "success" }, site: { result: "success" } }, jobs)
  for (const result of ["skipped", "cancelled", "failure", "neutral", undefined]) {
    assert.throws(() => assertRequiredCiResults({ "cms-test": { result }, site: { result: "success" } }, jobs))
  }
  for (const results of [null, [], {}, { site: { result: "success" } }]) {
    assert.throws(() => assertRequiredCiResults(results, jobs))
  }
})

test("workflow cannot omit a canonical job, skip the summary or ignore its failure", () => {
  assertRequiredCiWorkflow(source, jobs)
  assert.throws(() => assertRequiredCiWorkflow(source.replace("site, cms-test", "site"), jobs))
  assert.throws(() => assertRequiredCiWorkflow(source.replace("always()", "success()"), jobs))
  assert.throws(() => assertRequiredCiWorkflow(source + "    continue-on-error: true\n", jobs))
  assert.throws(() => assertRequiredCiWorkflow(source.replace("check-required-ci.mjs", "unused.mjs"), jobs))
})

// Structural policy is the behavior under test: the actual aggregate must bind
// every current command owner and all image variants, without conditional work.
test("the committed CI workflow covers every canonical job and image variant", async () => {
  const { readFile } = await import("node:fs/promises")
  const { expectedCiJobs, assertImageMatrix } = await import("./check-required-ci.mjs")
  const matrix = JSON.parse(await readFile(new URL("../docs/verification-matrix.json", import.meta.url), "utf8"))
  const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  assertRequiredCiWorkflow(workflow, expectedCiJobs(matrix))
  for (const changed of [workflow.replace("  cms-browser:\n", "  cms-browser:\n    if: false\n"),
    workflow.replace("node scripts/check-browser-runtime.mjs cms --dns", "echo missing-browser"),
    workflow.replace('dns-tools: "true"', 'dns-tools: "false"'),
    workflow.replace('run: node scripts/verify-exchange-worker.mjs', 'if: false\n        run: node scripts/verify-exchange-worker.mjs'),
    workflow.replace('  site:\n', '  site:\n    needs: [cms-quality]\n'),
    workflow.replace('needs: [package-quality, image-verification, exchange-worker]', 'needs: [image-verification]'),
    workflow.replace('node scripts/authorize-cms-test-resource.mjs --create-database "$RUNNER_TEMP/siab-test-cms"', "echo missing-ownership")]) {
    assert.throws(() => assertRequiredCiWorkflow(changed, expectedCiJobs(matrix)))
  }
  assertImageMatrix(workflow)
  for (const changed of [workflow.replace("app: [cms, renderer, site]", "app: [cms, renderer]"),
    workflow.replaceAll("fail-fast: false", "fail-fast: true"),
    workflow.replace("  image-verification:\n", "  image-verification:\n    if: false\n")]) {
    assert.throws(() => assertImageMatrix(changed))
  }
})

test("always diagnostics cannot make verification conditional", async () => {
  const { assertImageMatrix } = await import("./check-required-ci.mjs")
  const source = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  assertImageMatrix(source)
  assert.throws(() => assertImageMatrix(source.replace("id: verify\n        run:", "id: verify\n        if: false\n        run:")))
  assert.throws(() => assertImageMatrix(source.replace("artifacts/siab-verify-*/image-*.json", "path: arbitrary-source")))
})

test("workflow policy accepts label, key order and indentation changes without accepting unsafe semantics", async () => {
  const { parse, stringify } = await import("yaml")
  const { expectedCiJobs, assertImageMatrix } = await import("./check-required-ci.mjs")
  const matrix = JSON.parse(readFileSync(new URL("../docs/verification-matrix.json", import.meta.url), "utf8"))
  const document = parse(readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"))
  for (const job of Object.values(document.jobs)) {
    job.steps = job.steps.map(({ name, ...step }) => ({ ...step, name: "Human label is not policy" }))
  }
  const reformatted = stringify(document, { indent: 4, flowCollectionPadding: false })
  assertRequiredCiWorkflow(reformatted, expectedCiJobs(matrix))
  assertImageMatrix(reformatted)
  const upload = document.jobs["image-verification"].steps.find(step => step.with?.name === "image-${{ matrix.app }}")
  const cold = structuredClone(document)
  delete cold.jobs["cms-browser"].steps.find(step => step.uses === "./.github/actions/setup-ci").with.cache
  assert.throws(() => assertImageMatrix(stringify(cold)))
  const skipped = structuredClone(document)
  skipped.jobs["cms-tests"].steps.find(step => step.run === "node scripts/run-cms-tests.mjs ${{ matrix.part }}").if = false
  assert.throws(() => assertRequiredCiWorkflow(stringify(skipped), expectedCiJobs(matrix)))
  upload.if = "always()"
  assert.throws(() => assertImageMatrix(stringify(document)))
  assert.throws(() => assertImageMatrix("jobs: {}\njobs: {}"))
  assert.throws(() => assertImageMatrix("jobs: &jobs {}\non: *jobs"))
})

test("worker proof cannot nest its receipt under a wildcard directory", async () => {
  const { parse, stringify } = await import("yaml")
  const { expectedCiJobs } = await import("./check-required-ci.mjs")
  const matrix = JSON.parse(readFileSync(new URL("../docs/verification-matrix.json", import.meta.url), "utf8"))
  const source = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  const workflow = parse(source)
  const upload = workflow.jobs["exchange-worker"].steps.find(step => step.with?.name === "ci-image-exchange-worker")
  upload.with.path = ["artifacts/siab-worker-*/image-*.json", "artifacts/siab-worker-*/*.log", "artifacts/siab-worker-*/worker-runtime-inventory.json", "artifacts/siab-worker-*/worker-dpkg-inventory.txt"].join("\n")
  assert.throws(() => assertRequiredCiWorkflow(stringify(workflow), expectedCiJobs(matrix)), /flat|layout/)
})
