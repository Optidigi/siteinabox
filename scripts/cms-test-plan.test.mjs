import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { cmsTestPlan, cmsTestPartitions, assertVitestResult, assertNodeTestOutput } from "../apps/cms/tests/_helpers/testPlan.mjs"
import { assertCmsTestReceipts } from "./check-cms-test-results.mjs"

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "siab-test-plan-"))
  for (const file of ["tests/unit/a.test.ts", "tests/unit/b.test.tsx", "tests/integration/a.test.ts", "tests/integration/b.integration.test.ts", "tests/pure/provider.test.mts", "tests/e2e/excluded.test.ts"]) {
    const target = path.join(root, file); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, "// synthetic test source\n")
  }
  return root
}

test("one inventory partitions every Vitest file once and detects changed/new test inputs", () => {
  const root = fixture()
  try {
    const plan = cmsTestPlan(root)
    assert.equal(plan.files.length, 4); assert.equal(plan.pure.length, 1)
    assert.equal(new Set(Object.values(plan.partitions).flat()).size, 4)
    assert.deepEqual(Object.values(plan.partitions).map(files => files.length), [1,1,1,1])
    writeFileSync(path.join(root,"tests/unit/new.test.ts"),"// added\n")
    assert.notEqual(cmsTestPlan(root).hash, plan.hash)
    writeFileSync(path.join(root,"tests/unit/a.test.ts"),"// changed\n")
    assert.notEqual(cmsTestPlan(root).hash, plan.hash)
  } finally { rmSync(root, { recursive: true }) }
})

test("a successful process is insufficient if its Vitest result omits or fails selected files", () => {
  const root = fixture()
  try {
    const selected = ["tests/unit/a.test.ts"]
    const report = { success: true, numFailedTests: 0, numFailedTestSuites: 0, numTotalTests: 3, numPassedTests: 3, numPendingTests: 0, numTodoTests: 0, testResults: [{ name: path.join(root, selected[0]), status: "passed" }] }
    assert.deepEqual(assertVitestResult(report, selected, root), { files: 1, tests: 3 })
    for (const changed of [{ ...report, testResults: [] }, { ...report, numFailedTests: 1 }, { ...report, success: false }, { ...report, numTotalTests: 0 }, { ...report, numPassedTests: 2, numPendingTests: 1 }, { ...report, numTodoTests: 1 }, { ...report, testResults: [{ ...report.testResults[0], status: "failed" }] }]) assert.throws(() => assertVitestResult(changed, selected, root))
  } finally { rmSync(root, { recursive: true }) }
})

test("the aggregate rejects missing, duplicate, stale, cross-run and failed partitions", () => {
  const root = fixture()
  try {
    const plan = cmsTestPlan(root), identity = { sourceSHA: "a".repeat(40), runId: "42", runAttempt: "1" }
    const receipts = cmsTestPartitions.map(part => ({ version: 1, qualification: "hosted-canonical", sourceDirty: false, pureCount: part === "unit-1" ? 52 : 0, ...identity, part, planHash: plan.hash, selected: plan.partitions[part], pure: part === "unit-1" ? plan.pure : [], status: "passed", counts: { files: plan.partitions[part].length, tests: 1 } }))
    assertCmsTestReceipts(receipts, plan, identity)
    for (const invalid of [receipts.slice(1), [...receipts, receipts[0]], [receipts[0],receipts[0],...receipts.slice(2)]]) assert.throws(() => assertCmsTestReceipts(invalid,plan,identity))
    for (const change of [{ runId: "43" }, { runAttempt: "2" }, { sourceSHA: "b".repeat(40) }, { status: "failed" }, { sourceDirty: true }, { qualification: "local-diagnostic" }, { pureCount: 0 }, { planHash: "stale" }, { selected: [] }, { pure: [] }, { counts: { files: 0, tests: 0 } }]) assert.throws(() => assertCmsTestReceipts([{ ...receipts[0], ...change },...receipts.slice(1)],plan,identity))
  } finally { rmSync(root, { recursive: true }) }
})

test("Node test success must include executed counts with no skips, todos or cancellations", () => {
  const output = "# tests 52\n# pass 52\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"
  assert.equal(assertNodeTestOutput(output),52)
  for (const changed of ["",output.replace("# pass 52","# pass 51"),...['fail','cancelled','skipped','todo'].map(name => output.replace('# '+name+' 0','# '+name+' 1'))]) assert.throws(()=>assertNodeTestOutput(changed))
})

test("historical duration scheduling balances long files, includes new files and remains deterministic", () => {
  const root = fixture()
  try {
    for (const name of ["c", "d"]) writeFileSync(path.join(root, "tests/unit/" + name + ".test.ts"), "// scheduling fixture\n")
    const timings = { overheadMs: { unit: 1, integration: 1 }, fixedMs: {}, executionsMs: {
      "tests/unit/a.test.ts": 9000, "tests/unit/b.test.tsx": 8000,
      "tests/unit/c.test.ts": 2000, "tests/unit/d.test.ts": 1000,
    } }
    const plan = cmsTestPlan(root, timings)
    const loads = ["unit-1", "unit-2"].map(part => plan.partitions[part].reduce((sum, file) => sum + timings.executionsMs[file] + 1, 0))
    assert.equal(loads[0], loads[1])
    assert.deepEqual(cmsTestPlan(root, timings), plan)
    writeFileSync(path.join(root, "tests/unit/new.test.ts"), "// no historical timing\n")
    const updated = cmsTestPlan(root, timings)
    assert.equal(Object.values(updated.partitions).flat().filter(file => file === "tests/unit/new.test.ts").length, 1)
    assert.notEqual(updated.hash, plan.hash)
    assert.throws(() => cmsTestPlan(root, { ...timings, overheadMs: { unit: NaN, integration: 1 } }))
  } finally { rmSync(root, { recursive: true }) }
})
