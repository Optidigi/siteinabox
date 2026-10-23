import assert from "node:assert/strict"
import { isDeepStrictEqual } from "node:util"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { normalizeAudit } from "./dependency-security-policy.mjs"
import { loadDependencyImages, imageReviewFindings, nativeReviewFingerprint } from "./dependency-image-review.mjs"

export function changedRows(before, after, key) {
  const index = rows => {
    const result = new Map()
    for (const row of rows) {
      const id = key(row)
      assert(typeof id === "string" && id && !result.has(id), "Evidence row identity is missing or duplicated")
      result.set(id, row)
    }
    return result
  }
  const left = index(before), right = index(after)
  return [...new Set([...left.keys(), ...right.keys()])].sort().flatMap(id =>
    isDeepStrictEqual(left.get(id), right.get(id)) ? [] : [{ id,
      change: !left.has(id) ? "added" : !right.has(id) ? "removed" : "changed",
      before: left.get(id) ?? null, after: right.get(id) ?? null }])
}

export function compareSourceEvidence(before, after) {
  for (const evidence of [before, after]) {
    assert(evidence.schemaVersion === 2 && /^[a-f0-9]{40}$/.test(evidence.sourceSHA), "Source evidence identity is invalid")
    for (const kind of ["graph", "configuration"]) assert(Array.isArray(evidence.inputs?.[kind]?.files), "Source input inventory is missing")
    assert(Array.isArray(evidence.facts) && Array.isArray(evidence.publisherVersions), "Publisher inventory is missing")
  }
  const findings = evidence => [normalizeAudit(evidence.audits.full, "full"), normalizeAudit(evidence.audits.production, "production")].flat()
  return { graph: changedRows(before.inputs.graph.files, after.inputs.graph.files, row => row.path),
    configuration: changedRows(before.inputs.configuration.files, after.inputs.configuration.files, row => row.path),
    toolchain: isDeepStrictEqual(before.toolchain, after.toolchain) ? null : { before: before.toolchain, after: after.toolchain },
    advisories: changedRows(findings(before), findings(after), row => JSON.stringify([row.scope, row.id, row.package, row.version])),
    facts: changedRows(before.facts, after.facts, row => row.id),
    publisherVersions: changedRows(before.publisherVersions, after.publisherVersions, row => JSON.stringify([row.manifest, row.package])) }
}

export function compareImageInventories(left, right) {
  const native = image => ({ application: image.application, fingerprint: nativeReviewFingerprint(image),
    inventoryStatus: image.inventoryStatus, analysisGaps: image.analysisGaps })
  return { native: changedRows(left.map(native), right.map(native), row => row.application),
    scanner: changedRows(left.map(image => ({ application: image.application, scanner: image.scanner })),
      right.map(image => ({ application: image.application, scanner: image.scanner })), row => row.application),
    advisories: changedRows(imageReviewFindings(left), imageReviewFindings(right), row => JSON.stringify([row.scope, row.id, row.package, row.version])) }
}

export async function compareEvidenceFiles(beforeFile, afterFile, beforeImages, afterImages) {
  const read = async file => JSON.parse(await readFile(file, "utf8"))
  const before = await read(beforeFile), after = await read(afterFile)
  assert(Boolean(beforeImages) === Boolean(afterImages), "Image comparison requires both directories")
  const result = { before: { sourceSHA: before.sourceSHA, collectedAt: before.collectedAt },
    after: { sourceSHA: after.sourceSHA, collectedAt: after.collectedAt }, source: compareSourceEvidence(before, after), images: null,
    releaseCleared: false, limitation: "Comparison only; no freshness, approval, admission or release clearance" }
  if (beforeImages) {
    const left = await loadDependencyImages(beforeImages, before.sourceSHA)
    const right = await loadDependencyImages(afterImages, after.sourceSHA)
    result.images = compareImageInventories(left, right)
  }
  return result
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [before, after, ...images] = process.argv.slice(2)
  assert(before && after && [0, 2].includes(images.length), "Usage: dependency:compare before.json after.json [before-image-directory after-image-directory]")
  const result = await compareEvidenceFiles(resolve(before), resolve(after), ...images.map(file => resolve(file)))
  await mkdir("artifacts", { recursive: true })
  await writeFile("artifacts/dependency-comparison.json", JSON.stringify(result, null, 2) + "\n")
  console.log(JSON.stringify({ sourceChanges: Object.fromEntries(Object.entries(result.source).map(([key, value]) => [key, Array.isArray(value) ? value.length : Number(Boolean(value))])),
    imageChanges: result.images && { native: result.images.native.length, scanner: result.images.scanner.length, advisories: result.images.advisories.length },
    report: "artifacts/dependency-comparison.json", releaseCleared: false }))
}
