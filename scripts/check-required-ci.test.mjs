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
