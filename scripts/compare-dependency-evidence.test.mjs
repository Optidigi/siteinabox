import test from "node:test"
import assert from "node:assert/strict"
import { changedRows, compareSourceEvidence } from "./compare-dependency-evidence.mjs"

test("comparison reports additions/removals/content changes once and deterministically", () => {
  const before = [{ path: "removed", sha256: "a" }, { path: "changed", sha256: "a" }, { path: "same", sha256: "a" }]
  const after = [{ path: "same", sha256: "a" }, { path: "changed", sha256: "b" }, { path: "added", sha256: "b" }]
  assert.deepEqual(changedRows(before, after, row => row.path).map(({ id, change }) => ({ id, change })),
    [{ id: "added", change: "added" }, { id: "changed", change: "changed" }, { id: "removed", change: "removed" }])
  assert.throws(() => changedRows(before, [...after, after[0]], row => row.path), /duplicated/)
})

test("incomplete source evidence fails instead of reporting no changes", () => {
  assert.throws(() => compareSourceEvidence({}, {}), /identity/)
  assert.throws(() => compareSourceEvidence({ schemaVersion: 2, sourceSHA: "a".repeat(40) }, {}), /inventory/)
})
