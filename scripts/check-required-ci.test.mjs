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
    workflow.replace("name: Install CMS verification prerequisite browser\n        run: pnpm --dir apps/cms exec playwright install --with-deps chromium", "name: Missing prerequisite\n        run: echo missing"),
    workflow.replace('node scripts/authorize-cms-test-resource.mjs --create-database "$RUNNER_TEMP/siab-test-cms"', "echo missing-ownership")]) {
    assert.throws(() => assertRequiredCiWorkflow(changed, expectedCiJobs(matrix)))
  }
  assertImageMatrix(workflow)
  for (const changed of [workflow.replace("app: [cms, renderer, site]", "app: [cms, renderer]"),
    workflow.replace("fail-fast: false", "fail-fast: true"),
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
