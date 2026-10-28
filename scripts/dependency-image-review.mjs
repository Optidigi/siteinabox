import { canonicalHash } from "./image-artifact.mjs"
import { evaluateReleaseRisk, reviewedRiskItems, securityFacts } from "./release-risk.mjs"
import { imageApplications, dependencyImageApplications } from "./image-evidence.mjs"
import { readWorkerRuntimeEvidence } from "./worker-runtime-evidence.mjs"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { isDeepStrictEqual } from "node:util"
import { sha256File } from "./image-artifact.mjs"
import { validateImageInventory, imageInventoryStatus, NativeAnalysisIncompleteError, requiredImageAnalysisTypes } from "./dependency-image-evidence.mjs"
import { infrastructure } from "./infrastructure-images.mjs"
import { reviewedDispositions, assertReviewedFindings } from "./dependency-security-policy.mjs"

export { dependencyImageApplications } from "./image-evidence.mjs"
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const identity = (row) => JSON.stringify([row.scope, row.id, row.package, row.version])

export function imageReviewFindings(images) {
  const grouped = new Map()
  function add(row, facts) {
    const key = identity(row)
    const previous = grouped.get(key)
    if (previous) {
      if (previous.severity !== row.severity) throw new Error("Inconsistent image advisory severities")
      previous.paths = [...new Set([...previous.paths, ...row.paths])].sort()
      previous.facts.push(facts)
    } else grouped.set(key, { ...row, paths: [...new Set(row.paths)].sort(), facts: [facts] })
  }
  for (const image of images) {
    const scope = "image:" + image.application
    for (const finding of image.inventory.findings) add({ scope, id: finding.id, package: finding.package,
      version: finding.version, severity: finding.severity === "medium" ? "moderate" : finding.severity, paths: finding.paths },
    { fixedVersion: finding.fixedVersion, source: finding.source, modifiedAt: finding.modifiedAt,
      severitySource: finding.severitySource ?? null, vendorSeverity: finding.vendorSeverity ?? null,
      sourceStatus: finding.sourceStatus ?? "recorded", dataSource: finding.dataSource ?? null, references: finding.references ?? [] })
    for (const item of image.inventory.unversionedPackages) add({ scope, id: "UNVERSIONED_NATIVE_COMPONENT", package: item.name,
      version: "(not-recorded)", severity: "unknown", paths: [item.target] }, { purl: item.purl })
    if (image.application === "exchange-worker") {
      const gaps = image.nativeInventory.workerRuntime?.inventory?.files?.filter(file => file.metadataGap)
      if (!Array.isArray(gaps)) throw new Error("Worker native inventory is missing managed coverage")
      if (gaps.length) add({ scope, id: "WORKER_NATIVE_MAPPING_INCOMPLETE", package: "powershell-module-native-inspection", version: image.scanner.version,
        severity: "unknown", paths: gaps.map(file => file.path) }, { files: gaps })
    }
    if (image.analysisGaps) {
      const paths = [...image.analysisGaps.missingTargets, ...image.analysisGaps.missingTypes.map((type) => "analysis-type:" + type)]
      add({ scope, id: "NATIVE_ANALYSIS_INCOMPLETE", package: "gobinary-inspection", version: image.scanner.version,
        severity: "unknown", paths }, { files: image.nativeInventory.files.filter((file) => image.analysisGaps.missingTargets.includes(file.path)) })
    }
  }
  return [...grouped.values()].map(({ facts, ...row }) => ({ ...row,
    factsHash: canonicalHash(facts.map(securityFacts).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))) })).sort((a, b) => identity(a).localeCompare(identity(b)))
}

export async function loadDependencyImages(directory, sourceSHA) {
  const results = []
  for (const app of imageApplications) {
    const image = JSON.parse(await readFile(resolve(directory, "image-" + app + ".json"), "utf8"))
    if (image.application !== app || image.sourceSHA !== sourceSHA || image.packagedSmoke !== "passed" || image.published !== false ||
        image.dependencyInventory?.sourceSHA !== sourceSHA || !isDeepStrictEqual(image.archiveIdentity, image.dependencyInventory.archiveIdentity) || image.dependencyInventory?.imageId !== image.imageId || image.dependencyInventory.archiveSha256 !== image.archiveSha256) {
      throw new Error("Dependency image evidence differs from the exact verified candidate")
    }
    if (app === "exchange-worker") {
      const runtime = await readWorkerRuntimeEvidence(directory, image)
      if (!isDeepStrictEqual(runtime, image.dependencyInventory.nativeInventory?.workerRuntime)) throw new Error("Worker managed inventory is missing from native review")
    }
    results.push(image.dependencyInventory)
    if (app === "cms") results.push(...(image.infrastructureDependencies ?? []))
  }
  if (!isDeepStrictEqual(results.map((image) => image?.application).sort(), [...dependencyImageApplications].sort())) {
    throw new Error("Dependency evidence must cover every application plus pinned PostgreSQL and cloudflared")
  }
  for (const image of results) {
    if ("linux/" + image.runtimePlatform?.architecture !== infrastructure.verificationPlatform) throw new Error("Dependency evidence platform differs from the reviewed target")
    if (image.application.startsWith("cms-") && image.reference !== infrastructure.images[image.application.slice(4)]?.reference) {
      throw new Error("Infrastructure scan differs from the current immutable publisher reference")
    }
    if (image.schemaVersion !== 1 || image.candidateSourceSHA !== sourceSHA || image.releaseCleared !== false ||
        digest(image.nativeInventory) !== image.nativeInventorySha256) throw new Error("Native dependency provenance is incomplete")
    const path = resolve(directory, "image-" + image.application + ".trivy.json")
    if (await sha256File(path) !== image.reportSha256) throw new Error("Image vulnerability report bytes changed")
    const report = JSON.parse(await readFile(path, "utf8"))
    image.osEndOfLife = report.Metadata.OS?.EOSL === true
    let actual
    let gaps = null
    try {
      actual = validateImageInventory({ image: { imageId: image.imageId, sourceSHA: image.sourceSHA,
        runtimePlatform: image.runtimePlatform, archiveIdentity: image.archiveIdentity }, report, scanner: image.scanner,
      requiredTypes: requiredImageAnalysisTypes(image.application), requiredTargets: image.nativeInventory.goTargets })
    } catch (error) {
      if (!(error instanceof NativeAnalysisIncompleteError)) throw error
      actual = error.inventory; gaps = { code: error.code, missingTargets: error.missingTargets, missingTypes: error.missingTypes }
    }
    if (!isDeepStrictEqual(actual, image.inventory) || !isDeepStrictEqual(gaps, image.analysisGaps) ||
        image.inventoryStatus !== imageInventoryStatus(actual, gaps)) throw new Error("Image analysis metadata does not match retained report bytes")
  }
  return results
}

export function nativeReviewFingerprint(image) {
  return digest({ runtimePlatform: image.runtimePlatform, files: image.nativeInventory.files,
    goTargets: image.nativeInventory.goTargets ?? [], bundledScripts: image.nativeInventory.bundledScripts ?? [], ...(image.nativeInventory.workerRuntime ? { workerRuntime: image.nativeInventory.workerRuntime } : {}) })
}

export function validateImageReview(record, images, release = false, facts = [], now = Date.now()) {
  if (!isDeepStrictEqual(images.map(image => image.application).sort(), [...dependencyImageApplications].sort())) throw new Error("Required image coverage is missing")
  const scopes = dependencyImageApplications.map(app => "image:" + app)
  const rows = reviewedDispositions(record, scopes, new Set(facts.map(fact => fact.id)))
  const inventory = imageReviewFindings(images)
  assertReviewedFindings(inventory, rows)
  const items = reviewedRiskItems(inventory, rows, { facts, binding: finding => {
    const image = images.find(image => "image:" + image.application === finding.scope)
    return { scope: finding.scope, platform: "linux/" + image.runtimePlatform.architecture, fingerprint: nativeReviewFingerprint(image) }
  } })
  const requirements = images.flatMap(image => [
    { id: image.application + ":analysis-coverage", status: image.analysisGaps ? "unknown" : "passed" },
    { id: image.application + ":package-version-coverage", status: image.inventory.unversionedPackages.length ? "unknown" : "passed" },
    { id: image.application + ":supported-os", status: image.osEndOfLife === false ? "passed" : "unknown" },
  ])
  const decision = evaluateReleaseRisk({ items, requirements, now })
  if (release && decision.releaseBlocked) throw new Error("Release blocked by image risk/coverage: " + decision.blockers.map(item => item.id).join(", "))
  return { reviewedFindings: inventory.length, ...decision }
}
