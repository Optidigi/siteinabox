import test from "node:test"
import assert from "node:assert/strict"
import { dependencyImageApplications, imageReviewFindings, nativeReviewFingerprint, validateImageReview } from "./dependency-image-review.mjs"

function fixture() {
  const images = dependencyImageApplications.map((application) => ({ application, scanner: { version: "0.76.0" },
    runtimePlatform: { architecture: "amd64", os: "alpine", version: "3.24.2" }, nativeInventory: { files: [], ...(application === "exchange-worker" ? { workerRuntime: { inventory: { files: [] } } } : {}) },
    analysisGaps: null, inventory: { findings: [], unversionedPackages: [] } }))
  images[0].inventory.findings.push({ id: "CVE-fixture", package: "fixture", version: "1.0.0", severity: "high", paths: ["app/fixture"], fixedVersion: null, source: "https://example.test/primary", modifiedAt: null })
  const record = { publisherFacts: [{ id: "primary" }], imageAdvisories: imageReviewFindings(images).map((row) => ({ ...row,
    classification: "affected_package_condition_unproven", releaseBlocked: true, reason: "Confirmed package; deployment condition unproven", reviewOwner: "dependency maintainer", recheck: "Before release or changed inputs", sources: ["primary"] })),
  nativeAssessments: images.map((image) => ({ application: image.application, fingerprint: nativeReviewFingerprint(image), status: "blocked", reason: "Remaining native proof is a release blocker", reviewOwner: "dependency maintainer", recheck: "Before release", sources: ["primary"] })) }
  return { record, images }
}
test("reviewed image blockers can qualify inventory but never release", () => {
  const { record, images } = fixture()
  assert.equal(validateImageReview(record, images).releaseBlocked, true)
  assert.throws(() => validateImageReview(record, images, true), /Release blocked/)
})
test("new native findings, fixes, paths, missing images and unknown assessments fail", () => {
  for (const mutate of [
    (x) => { x.images.pop() },
    (x) => { x.images[0].inventory.findings[0].paths.push("app/new-consumer") },
    (x) => { x.images[0].inventory.findings[0].fixedVersion = "1.0.1" },
    (x) => { x.images[0].runtimePlatform.version = "3.25.0" },
    (x) => { x.record.nativeAssessments[0].status = "unknown" },
    (x) => { x.record.nativeAssessments = [] },
    (x) => { x.record.imageAdvisories[0].releaseBlocked = false },
  ]) { const x = fixture(); mutate(x); assert.throws(() => validateImageReview(x.record, x.images)) }
})
test("an analyzer gap is a concrete retained blocker, not silently clean", () => {
  const { images } = fixture()
  images[1].analysisGaps = { missingTargets: ["app/esbuild"], missingTypes: [] }
  images[1].nativeInventory.files.push({ path: "app/esbuild", sha256: "a".repeat(64) })
  const rows = imageReviewFindings(images)
  assert(rows.some((row) => row.id === "NATIVE_ANALYSIS_INCOMPLETE" && row.severity === "unknown"))
})

test("complete evidence-supported clean bundles can qualify without a permanent blanket failure", () => {
  const { record, images } = fixture()
  images[0].inventory.findings = []; record.imageAdvisories = []
  for (const assessment of record.nativeAssessments) assessment.status = "qualified"
  assert.equal(validateImageReview(record, images, true).releaseBlocked, false)
})

 test("changed, added and removed bundled scripts invalidate qualified assessments", () => {
  for (const mutate of [
    (bundles) => { bundles[0].sha256 = "b".repeat(64) },
    (bundles) => { bundles.push({ path: "app/dist-runtime/new.mjs", sha256: "c".repeat(64) }) },
    (bundles) => { bundles.pop() },
  ]) {
    const { record, images } = fixture()
    images[0].inventory.findings = []; record.imageAdvisories = []
    images[0].nativeInventory.bundledScripts = [{ path: "app/dist-runtime/migrate.mjs", sha256: "a".repeat(64) }]
    for (const image of images) {
      const assessment = record.nativeAssessments.find((entry) => entry.application === image.application)
      assessment.fingerprint = nativeReviewFingerprint(image); assessment.status = "qualified"
    }
    assert.equal(validateImageReview(record, images, true).releaseBlocked, false)
    mutate(images[0].nativeInventory.bundledScripts)
    assert.throws(() => validateImageReview(record, images, true), /evidence changed or is unreviewed/)
  }
})

test("reviewed findings with unresolved advisory provenance can never clear release", () => {
  const { record, images } = fixture()
  const finding = images[0].inventory.findings[0]
  finding.source = null; finding.sourceStatus = "unresolved"; finding.severity = "unknown"
  Object.assign(record.imageAdvisories[0], imageReviewFindings(images)[0], { classification: "analysis_gap" })
  for (const assessment of record.nativeAssessments) assessment.status = "qualified"
  assert.equal(validateImageReview(record, images).releaseBlocked, true)
  assert.throws(() => validateImageReview(record, images, true), /Release blocked/)
  finding.source = "https://example.test/newly-recorded-advisory"; finding.sourceStatus = "recorded"
  assert.throws(() => validateImageReview(record, images), /New or changed advisory/)
})

test("worker managed and alternate-platform bytes remain part of native assessment", () => {
  const { images, record } = fixture()
  images[0].inventory.findings = []; record.imageAdvisories = []
  for (const assessment of record.nativeAssessments) assessment.status = "qualified"
  const worker = images.find(image => image.application === "exchange-worker")
  worker.nativeInventory.workerRuntime.inventory.files.push({ path: "/alternate/example.dll", sha256: "a".repeat(64), metadataGap: "Native mapping required" })
  assert.throws(() => validateImageReview(record, images, true))
  assert(imageReviewFindings(images).some(row => row.id === "WORKER_NATIVE_MAPPING_INCOMPLETE"))
})
