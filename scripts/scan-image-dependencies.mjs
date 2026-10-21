import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { open, readFile, writeFile, stat, lstat } from "node:fs/promises"
import { resolve } from "node:path"
import { prepareDependencyScanner } from "./prepare-dependency-scanner.mjs"
import { validateImageInventory, NativeAnalysisIncompleteError } from "./dependency-image-evidence.mjs"
import { sha256File } from "./image-artifact.mjs"

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
  if (/(?:^|\t)(?:WARN|ERROR|FATAL)(?:\t|\s)/m.test(diagnostics)) throw new Error("Scanner reported analysis warnings/errors; inventory completeness requires review")
  if (await sha256File(archive) !== image.archiveSha256 || await sha256File(scanner.databaseFile) !== scanner.evidence.databaseSha256 ||
      await sha256File(scanner.metadataFile) !== scanner.evidence.metadataSha256) throw new Error("Archive or advisory database changed during scanning")
  const report = JSON.parse(await readFile(reportFile, "utf8"))
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
    imageId: image.imageId, archiveSha256: image.archiveSha256,
    collectedAt: new Date().toISOString(), scanner: scanner.evidence, reportSha256: await sha256File(reportFile),
    stdoutSha256: await sha256File(stdoutFile), stderrSha256: await sha256File(stderrFile),
    inventoryStatus: analysisGaps ? "incomplete" : "collected", analysisGaps,
    nativeInventory, nativeInventorySha256: createHash("sha256").update(JSON.stringify(nativeInventory)).digest("hex"), inventory,
    releaseCleared: false, limitation: "Inventory collection is not advisory disposition or release clearance" }
  await writeFile(outputPrefix + ".dependencies.json", JSON.stringify(evidence, null, 2) + "\n", { flag: "wx" })
  return evidence
}
