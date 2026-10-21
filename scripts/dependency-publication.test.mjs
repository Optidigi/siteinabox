import test from "node:test"
import assert from "node:assert/strict"
import { assertNoDeclaredDependencyBlockers } from "./check-publication.mjs"

const clean = () => ({ advisories: [], imageAdvisories: [], nativeAssessments: Array.from({ length: 5 }, () => ({ status: "qualified" })) })
test("publication cannot access registry login while dependency blockers or unknown assessments remain", () => {
  assertNoDeclaredDependencyBlockers(clean()) // Preflight only; live candidate validation still follows.
  for (const mutate of [
    (record) => { record.advisories.push({ releaseBlocked: false }) },
    (record) => { record.imageAdvisories.push({ releaseBlocked: false }) },
    (record) => { record.nativeAssessments[0].status = "blocked" },
    (record) => { record.nativeAssessments = [] },
    (record) => { record.deferrals = [{ releaseBlocked: true }] },
  ]) { const record = clean(); mutate(record); assert.throws(() => assertNoDeclaredDependencyBlockers(record), /Publication blocked/) }
  assert.throws(() => assertNoDeclaredDependencyBlockers(null), /Publication blocked/)
})
