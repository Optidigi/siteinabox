import test from "node:test"
import assert from "node:assert/strict"
import { dependencyImageApplications, imageReviewFindings, nativeReviewFingerprint, validateImageReview } from "./dependency-image-review.mjs"
import { reviewedRiskItems } from "./release-risk.mjs"
const now = Date.parse("2026-10-21T00:00:00Z")
function fixture() {
  const facts = [{ id: "primary", facts: { id: "CVE-fixture", affected: [{ range: "<1.1.0" }] } }, { id: "cisa-kev", facts: { count: 0, dateReleased: "2026-10-20T00:00:00Z", vulnerabilities: [] } }]
  const images = dependencyImageApplications.map(application => ({ application, scanner: { version: "0.76.1" }, osEndOfLife: false,
    runtimePlatform: { architecture: "amd64", os: "alpine", version: "3.24.3" }, nativeInventory: { files: [], ...(application === "exchange-worker" ? { workerRuntime: { inventory: { files: [] } } } : {}) },
    analysisGaps: null, inventory: { findings: [], unversionedPackages: [] } }))
  images[0].inventory.findings.push({ id: "CVE-fixture", package: "fixture", version: "1.0.0", severity: "high", paths: ["app/fixture"], fixedVersion: "1.1.0", source: "https://example.test/advisory", modifiedAt: "yesterday", references: ["https://old.test"] })
  const record = { schemaVersion: 3, policy: "production-risk-v1", findings: imageReviewFindings(images).map(row => ({ ...row, state: "under_investigation", reason: "Package present; applicability under review", reviewOwner: "security owner", reviewedAt: "2026-10-20T00:00:00Z", deadline: "2026-10-27T00:00:00Z", issue: "https://example.test/issues/1", sources: ["primary"] })) }
  const evaluate = (release = false) => validateImageReview(record, images, release, facts, now)
  return { images, record, facts, evaluate }
}
test("reviewed high-risk inventory never implies release clearance", () => {
  const x = fixture(); assert.equal(x.evaluate().releaseBlocked, true); assert.throws(() => x.evaluate(true), /Release blocked/)
})
test("new findings, fixes, paths, selected severities and missing scope require triage", () => {
  for (const change of [x => x.images.pop(), x => x.images[0].inventory.findings[0].paths.push("new/path"), x => { x.images[0].inventory.findings[0].fixedVersion = "1.2.0" }, x => { x.record.findings[0].severity = "low" }, x => { x.record.findings = [] }]) { const x = fixture(); change(x); assert.throws(() => x.evaluate()) }
})
test("informational reference changes retain raw audit data without invalidating identical risk semantics", () => {
  const x = fixture(); const before = imageReviewFindings(x.images)
  Object.assign(x.images[0].inventory.findings[0], { references: ["https://new.test"], modifiedAt: "today" })
  assert.deepEqual(imageReviewFindings(x.images), before); assert.equal(x.evaluate().releaseBlocked, true)
})
test("complete zero-finding bundles qualify without a permanent manual block", () => {
  const x = fixture(); x.images[0].inventory.findings = []; x.record.findings = []
  assert.equal(x.evaluate(true).releaseBlocked, false)
})
test("missing required coverage blocks even when findings have nonaffected evidence", () => {
  const x = fixture(); x.images[0].inventory.findings = []; x.record.findings = []
  x.images[1].analysisGaps = { missingTargets: ["app/esbuild"], missingTypes: [] }
  x.images[1].nativeInventory.files.push({ path: "app/esbuild", sha256: "a".repeat(64) })
  x.record.findings = imageReviewFindings(x.images).map(row => ({ ...row, state: "under_investigation", reason: "Unknown target coverage", reviewOwner: "security owner", sources: ["primary"], reviewedAt: "2026-10-20T00:00:00Z", deadline: "2026-10-27T00:00:00Z" }))
  assert.equal(x.evaluate().releaseBlocked, true); assert.throws(() => x.evaluate(true))
})
test("nonaffected evidence invalidates on changed platform, advisory or exact component bytes", () => {
  for (const change of [x => { x.images[0].runtimePlatform.architecture = "arm64" }, x => { x.facts[0].facts.affected = [{ range: "<2.0.0" }] }, x => { x.images[0].nativeInventory.bundledScripts = [{ path: "app/dist-runtime/helper.mjs", sha256: "c".repeat(64) }] }]) {
    const x = fixture(); const row = x.record.findings[0]
    const reviews = new Map([[JSON.stringify([row.scope, row.id, row.package, row.version]), row]])
    const binding = reviewedRiskItems(imageReviewFindings(x.images), reviews, { facts: x.facts, binding: finding => ({ scope: finding.scope, platform: "linux/amd64", fingerprint: nativeReviewFingerprint(x.images[0]) }) })[0].binding
    row.state = "not_affected"
    row.evidence = { binding, justification: "Primary vendor confirms target is unaffected", sources: ["primary"] }
    assert.equal(x.evaluate(true).releaseBlocked, false)
    change(x); assert.equal(x.evaluate().releaseBlocked, true)
  }
})
test("worker duplicate/alternate files and mapping gaps remain explicit", () => {
  const x = fixture(); const worker = x.images.find(i => i.application === "exchange-worker")
  worker.nativeInventory.workerRuntime.inventory.files.push({ path: "/alternate/example.dll", sha256: "a".repeat(64), metadataGap: "Mapping required" })
  assert(imageReviewFindings(x.images).some(row => row.id === "WORKER_NATIVE_MAPPING_INCOMPLETE"))
})
