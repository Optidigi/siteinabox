import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { open, readFile, writeFile, stat, lstat } from "node:fs/promises"
import { resolve } from "node:path"
import { prepareDependencyScanner } from "./prepare-dependency-scanner.mjs"
import { validateImageInventory, imageInventoryStatus, NativeAnalysisIncompleteError } from "./dependency-image-evidence.mjs"
import { sha256File } from "./image-artifact.mjs"

export function validateScannerDiagnostics(diagnostics, report) {
  // Trivy's documented cross-vendor severity selection is provenance, not a
  // failed analyzer. Recognize only the exact notice from the pinned scanner.
  const documentation = "https://trivy.dev/docs/v0.76/guide/scanner/vulnerability#severity-selection"
  const message = "Using severities from other vendors for some vulnerabilities. Read " + documentation + " for details."
  const notices = []
  for (const line of diagnostics.split("\n")) {
    if (!/(?:^|\t)(?:WARN|ERROR|FATAL)(?:\t|\s)/.test(line)) continue
    const warning = line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})\tWARN\t(.*)$/)
    if (warning?.[1] === message) {
      notices.push({ code: "VENDOR_SEVERITY_FALLBACK", diagnostic: line, documentation })
      continue
    }
    // A missing detail-bucket entry is not a rejected CVE or a clean scan.
    // Retain the exact warning only when its package findings still exist as
    // unresolved UNKNOWN evidence; ordinary review and release rejection apply.
    const missingDetails = warning?.[1].startsWith("Unable to get vulnerability details (CVE may be rejected)\t") &&
      line.includes('err.message="failed to get vulnerability"') &&
      line.includes('err.err="failed to get vulnerability: no vulnerability details"') &&
      line.match(/(?:\s|^)err\.context\.vuln_id="(CVE-\d{4}-\d{4,})"(?:\s|$)/)
    const findings = missingDetails && report?.Results?.flatMap((result) => result.Vulnerabilities ?? [])
      .filter((finding) => finding.VulnerabilityID === missingDetails[1])
    if (findings?.length && findings.every((finding) => finding.Severity === "UNKNOWN" &&
        typeof finding.PkgName === "string" && finding.PkgName && typeof finding.InstalledVersion === "string" && finding.InstalledVersion &&
        finding.DataSource?.ID && !finding.PrimaryURL && !finding.Title && !finding.Description && !finding.References?.length)) {
      notices.push({ code: "ADVISORY_DETAILS_UNAVAILABLE", advisoryId: missingDetails[1],
        affectedFindings: findings.length, diagnostic: line })
      continue
    }
    throw new Error("Scanner reported analysis warnings/errors; inventory completeness requires review")
  }
  return notices
}

export async function scanImageDependencies({ root, archive, image, nativeInventory, outputPrefix, requiredTypes }) {
  const archiveStat = await lstat(archive)
  if (!archiveStat.isFile() || archiveStat.isSymbolicLink() || archiveStat.size > 4 * 1024 ** 3 ||
      await sha256File(archive) !== image.archiveSha256) throw new Error("Scan input differs from the exact verified image archive or exceeds its bound")
  if (!nativeInventory || !Array.isArray(nativeInventory.files) || !Array.isArray(nativeInventory.goTargets) || !Array.isArray(nativeInventory.bundledScripts)) {
    throw new Error("Independent native/bundled-byte inventory is missing")
  }
  const scanner = await prepareDependencyScanner(root)
  const reportFile = outputPrefix + ".trivy.json"
  const stdoutFile = outputPrefix + ".scanner.stdout.log"
  const stderrFile = outputPrefix + ".scanner.stderr.log"
  const reportHandle = await open(reportFile, "wx"); await reportHandle.close()
  const stdout = await open(stdoutFile, "wx")
  const stderr = await open(stderrFile, "wx")
  try {
    execFileSync(scanner.binary, ["image", "--config", scanner.config, "--input", resolve(archive),
      "--scanners", "vuln", "--pkg-types", "os,library", "--list-all-pkgs", "--format", "json", "--output", resolve(reportFile),
      "--timeout", "10m", "--max-image-size", "4GB", "--exit-code", "0", "--cache-dir", scanner.cache,
      "--skip-db-update", "--skip-java-db-update", "--offline-scan", "--disable-telemetry", "--ignorefile", "", "--no-progress"],
    { cwd: root, env: scanner.env, timeout: 660000, stdio: ["ignore", stdout.fd, stderr.fd] })
  } catch {
    throw new Error("Image scanner failed or exceeded its bound; retained diagnostics require review")
  } finally { await stdout.close(); await stderr.close() }
  if ((await stat(reportFile)).size > 128 * 1024 * 1024 || (await stat(stderrFile)).size > 16 * 1024 * 1024) {
    throw new Error("Image scanner output exceeded its completeness bound")
  }
  const diagnostics = await readFile(stderrFile, "utf8")
  const report = JSON.parse(await readFile(reportFile, "utf8"))
  const scannerNotices = validateScannerDiagnostics(diagnostics, report)
  if (await sha256File(archive) !== image.archiveSha256 || await sha256File(scanner.databaseFile) !== scanner.evidence.databaseSha256 ||
      await sha256File(scanner.metadataFile) !== scanner.evidence.metadataSha256) throw new Error("Archive or advisory database changed during scanning")
  let inventory
  let analysisGaps = null
  try {
    inventory = validateImageInventory({ image, report, scanner: scanner.evidence, requiredTypes, requiredTargets: nativeInventory.goTargets })
  } catch (error) {
    if (!(error instanceof NativeAnalysisIncompleteError)) throw error
    // Retain an explicit failed assessment; this cannot become release clearance.
    inventory = error.inventory
    analysisGaps = { code: error.code, missingTargets: error.missingTargets, missingTypes: error.missingTypes }
  }
  const evidence = { schemaVersion: 1, application: image.application, sourceSHA: image.sourceSHA ?? null,
    candidateSourceSHA: image.candidateSourceSHA ?? image.sourceSHA, reference: image.reference ?? null, runtimePlatform: image.runtimePlatform,
    imageId: image.imageId, archiveIdentity: image.archiveIdentity ?? null, archiveSha256: image.archiveSha256,
    collectedAt: new Date().toISOString(), scanner: scanner.evidence, reportSha256: await sha256File(reportFile),
    stdoutSha256: await sha256File(stdoutFile), stderrSha256: await sha256File(stderrFile),
    scannerNotices, inventoryStatus: imageInventoryStatus(inventory, analysisGaps), analysisGaps,
    nativeInventory, nativeInventorySha256: createHash("sha256").update(JSON.stringify(nativeInventory)).digest("hex"), inventory,
    releaseCleared: false, limitation: "Inventory collection is not advisory disposition or release clearance" }
  await writeFile(outputPrefix + ".dependencies.json", JSON.stringify(evidence, null, 2) + "\n", { flag: "wx" })
  return evidence
}
