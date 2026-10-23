import assert from "node:assert/strict"
import { readFile, readdir, copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { resolve, join } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { sha256Bytes } from "./image-artifact.mjs"
import { dependencyIdentities } from "./collect-dependency-evidence.mjs"
import { validateDependencyReview, validatePublisherConstraints } from "./dependency-security-policy.mjs"
import { loadDependencyImages, validateImageReview } from "./dependency-image-review.mjs"
import { assertImageVerificationEvidence } from "./image-evidence.mjs"
import { expectedCiJobs, assertRequiredCiResults } from "./check-required-ci.mjs"

export function assertReceiptIdentity({ receipt, source, readiness, sourceBytes, policyBytes, head, run, attempt, jobs }) {
  assert(/^[a-f0-9]{40}$/.test(head) && /^[1-9][0-9]*$/.test(run) && /^[1-9][0-9]*$/.test(attempt), "Expected head/run/attempt are required")
  assert.equal(receipt.workflow, ".github/workflows/ci.yml")
  assert.equal(receipt.pullRequestHeadSHA, head)
  assert.equal(receipt.runId, run); assert.equal(receipt.runAttempt, attempt)
  assert(/^[a-f0-9]{40}$/.test(receipt.sourceSHA), "Tested merge source is missing")
  assertRequiredCiResults(receipt.results, jobs)
  assert.equal(source.schemaVersion, 2); assert.equal(source.auditRegistry, "https://registry.npmjs.org")
  assert.equal(source.sourceSHA, receipt.sourceSHA); assert.equal(source.sourceDirty, false)
  assert.equal(source.verificationRunId, run); assert.equal(source.verificationRunAttempt, attempt)
  assert.equal(readiness.sourceSHA, receipt.sourceSHA); assert.equal(readiness.policySourceSHA, receipt.sourceSHA)
  assert.equal(readiness.sourceDirty, false)
  assert.equal(readiness.sourceEvidenceSha256, sha256Bytes(sourceBytes))
  assert.equal(readiness.reviewRecordSha256, sha256Bytes(policyBytes))
  const age = Date.now() - Date.parse(source.collectedAt)
  assert(Number.isFinite(age) && age >= -300000 && age <= 86400000, "Source evidence is expired or future-dated")
}

export async function inspectCiEvidence(directory, expected) {
  const root = fileURLToPath(new URL("..", import.meta.url))
  const read = async file => JSON.parse(await readFile(file, "utf8"))
  const receipt = await read(join(directory, "required-ci-evidence/required-ci.json"))
  const readiness = await read(join(directory, "required-ci-evidence/dependency-readiness.json"))
  const sourceBytes = await readFile(join(directory, "dependency-source-evidence/dependency-source.json"))
  const policyBytes = await readFile(join(root, "docs/dependency-security.json"))
  const source = JSON.parse(sourceBytes), policy = JSON.parse(policyBytes)
  const matrix = await read(join(root, "docs/verification-matrix.json"))
  assertReceiptIdentity({ receipt, source, readiness, sourceBytes, policyBytes, ...expected, jobs: expectedCiJobs(matrix) })
  const inputs = await dependencyIdentities(root)
  assert.equal(source.graphHash, inputs.graph.sha256); assert.equal(source.configurationHash, inputs.configuration.sha256)
  validatePublisherConstraints(policy, source.publisherVersions)
  const sourceResult = validateDependencyReview({ record: policy, ...source })
  const staging = await mkdtemp(join(tmpdir(), "siab-ci-receipts-"))
  try {
    const names = new Set()
    for (const app of ["cms", "renderer", "site"]) {
      const folder = join(directory, "ci-image-" + app)
      for (const name of (await readdir(folder)).filter(name => /^image-[a-z-]+(?:\.dependencies|\.trivy)?\.json$/.test(name))) {
        assert(!names.has(name), "Duplicate image evidence filename: " + name); names.add(name)
        await copyFile(join(folder, name), join(staging, name))
      }
      const image = await read(join(staging, "image-" + app + ".json"))
      assertImageVerificationEvidence({ sha: receipt.sourceSHA, runId: expected.run, attempt: expected.attempt, image: app }, image)
      assert.deepEqual(receipt.images.find(entry => entry.application === app), image)
    }
    assert(Array.isArray(receipt.images) && receipt.images.length === 3, "Aggregate must contain exactly three application images")
    const images = await loadDependencyImages(staging, receipt.sourceSHA)
    const imageResult = validateImageReview(policy, images)
    assert.deepEqual(readiness.source, sourceResult); assert.deepEqual(readiness.images, imageResult)
    return { sourceSHA: receipt.sourceSHA, pullRequestHeadSHA: expected.head, runId: expected.run, runAttempt: expected.attempt,
      source: sourceResult, images: imageResult, releaseCleared: false,
      inventoryStatuses: images.map(image => ({ application: image.application, status: image.inventoryStatus })),
      limitation: "Retained artifact validation only; verify live GitHub checks, base/tree, reviews and delivery controls separately. No release authorization." }
  } finally { await rm(staging, { recursive: true, force: true }) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [directory, ...args] = process.argv.slice(2), expected = {}
  for (let index = 0; index < args.length; index += 2) {
    assert(["--head", "--run", "--attempt"].includes(args[index]) && args[index + 1] && !expected[args[index].slice(2)], "Usage: ci:receipts directory --head SHA --run ID --attempt N")
    expected[args[index].slice(2)] = args[index + 1]
  }
  assert(directory, "Downloaded CI artifact directory is required")
  const result = await inspectCiEvidence(resolve(directory), expected)
  await mkdir("artifacts", { recursive: true })
  await writeFile("artifacts/ci-evidence-inspection.json", JSON.stringify(result, null, 2) + "\n")
  console.log(JSON.stringify(result))
}
