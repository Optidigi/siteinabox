import test from "node:test"
import assert from "node:assert/strict"
import { changedRows, compareSourceEvidence, compareImageInventories } from "./compare-dependency-evidence.mjs"

test("comparison reports additions/removals/content changes once and deterministically", () => {
  const before = [{ path: "removed", sha256: "a" }, { path: "changed", sha256: "a" }, { path: "same", sha256: "a" }]
  const after = [{ path: "same", sha256: "a" }, { path: "changed", sha256: "b" }, { path: "added", sha256: "b" }]
  assert.deepEqual(changedRows(before, after, row => row.path).map(({ id, change }) => ({ id, change })),
    [{ id: "added", change: "added" }, { id: "changed", change: "changed" }, { id: "removed", change: "removed" }])
  assert.throws(() => changedRows(before, [...after, after[0]], row => row.path), /duplicated/)
})

test("scanner refresh is retained separately from native byte changes", () => {
  const image = { application: "cms", runtimePlatform: { architecture: "amd64" },
    nativeInventory: { files: [], goTargets: [], bundledScripts: [] },
    inventory: { findings: [], unversionedPackages: [] }, inventoryStatus: "incomplete", analysisGaps: null,
    scanner: { databaseSha256: "a" } }
  const refreshed = { ...image, scanner: { databaseSha256: "b" } }
  const comparison = compareImageInventories([image], [refreshed])
  assert.equal(comparison.native.length, 0)
  assert.equal(comparison.scanner.length, 1)
  const changed = { ...refreshed, nativeInventory: { ...image.nativeInventory, files: [{ path: "app/native", sha256: "new-bytes" }] } }
  assert.equal(compareImageInventories([image], [changed]).native.length, 1)
})

test("incomplete source evidence fails instead of reporting no changes", () => {
  assert.throws(() => compareSourceEvidence({}, {}), /identity/)
  assert.throws(() => compareSourceEvidence({ schemaVersion: 2, sourceSHA: "a".repeat(40) }, {}), /inventory/)
})
