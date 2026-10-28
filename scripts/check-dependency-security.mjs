import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises"
import { resolve, dirname, join } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import { collectSourceEvidence, dependencyIdentities } from "./collect-dependency-evidence.mjs"
import { validateDependencyReview, validatePublisherConstraints } from "./dependency-security-policy.mjs"
import { sha256Bytes, sha256File } from "./image-artifact.mjs"
import { rescanDependencyImages } from "./rescan-dependency-images.mjs"
import { loadDependencyImages, validateImageReview } from "./dependency-image-review.mjs"
export { normalizeAudit, validateDependencyReview, validatePublisherConstraints } from "./dependency-security-policy.mjs"

export async function checkDependencySecurity(args = process.argv.slice(2)) {
  const root = fileURLToPath(new URL("..", import.meta.url))
  const options = { release: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--release") options.release = true
    else if (["--source-evidence", "--images", "--candidate", "--archive-dir"].includes(arg) && args[index + 1] && !args[index + 1].startsWith("--")) options[arg.slice(2)] = arg === "--candidate" ? args[++index] : resolve(args[++index])
    else throw new Error("Unknown or incomplete dependency gate argument: " + arg)
  }
  if (options.release && options["source-evidence"]) throw new Error("Release checks require fresh collection, not supplied audit evidence")
  const policySHA = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
  const candidateSHA = options.candidate ?? policySHA
  if (!/^[a-f0-9]{40}$/.test(candidateSHA)) throw new Error("Candidate must be a full source SHA")
  execFileSync("git", ["merge-base", "--is-ancestor", candidateSHA, "HEAD"], { cwd: root })
  let candidateRoot = root
  let temporary = null
  if (candidateSHA !== policySHA) {
    temporary = await mkdtemp(join(tmpdir(), "siab-dependency-candidate-"))
    try { execFileSync("git", ["-c", "core.hooksPath=/dev/null", "worktree", "add", "--quiet", "--detach", temporary, candidateSHA], { cwd: root, timeout: 60000 }) }
    catch (error) { await rm(temporary, { recursive: true, force: true }); throw error }
    candidateRoot = temporary
  }
  try {
    const reviewPath = resolve(root, "docs/dependency-security.json")
    const reviewBytes = await readFile(reviewPath)
    const reviewHash = sha256Bytes(reviewBytes)
    const record = JSON.parse(reviewBytes.toString("utf8"))
    const evidence = options["source-evidence"] ? JSON.parse(await readFile(options["source-evidence"], "utf8")) : await collectSourceEvidence(candidateRoot, record.publisherFacts, record.publisherConstraints)
    const identities = await dependencyIdentities(candidateRoot)
    const sourceSHA = candidateSHA
    if (evidence.schemaVersion !== 2 || evidence.auditRegistry !== "https://registry.npmjs.org" || evidence.sourceSHA !== sourceSHA || evidence.graphHash !== identities.graph.sha256 ||
        evidence.configurationHash !== identities.configuration.sha256 || !Number.isFinite(Date.parse(evidence.collectedAt)) ||
        Date.parse(evidence.collectedAt) > Date.now() + 300000 || Date.now() - Date.parse(evidence.collectedAt) > 24 * 60 * 60 * 1000) {
      throw new Error("Source advisory evidence is unavailable, expired or differs from the exact candidate")
    }
    if (options["source-evidence"] && process.env.GITHUB_RUN_ID &&
        (evidence.verificationRunId !== process.env.GITHUB_RUN_ID || evidence.verificationRunAttempt !== process.env.GITHUB_RUN_ATTEMPT)) {
      throw new Error("Source advisory evidence belongs to another hosted run or attempt")
    }
    if (options.release && (evidence.sourceDirty || execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim())) throw new Error("Release evidence requires a clean exact-source checkout")
    validatePublisherConstraints(record, evidence.publisherVersions)
    if (!options["source-evidence"]) {
      await mkdir(resolve(root, "artifacts"), { recursive: true })
      await writeFile(resolve(root, "artifacts/dependency-source.json"), JSON.stringify(evidence, null, 2) + "\n")
    }
    const source = validateDependencyReview({ record, ...evidence, release: options.release })
    let images = null
    let imageEvidence = null
    if (options["archive-dir"]) {
      if (!options.release || !options.images) throw new Error("Archive rescanning requires release mode and a complete candidate image directory")
      options.images = await rescanDependencyImages({ root, directory: options.images, archiveDirectory: options["archive-dir"], sourceSHA })
    }
    if (options.images) {
      imageEvidence = await loadDependencyImages(options.images, sourceSHA)
      images = validateImageReview(record, imageEvidence, options.release, evidence.facts)
    }
    else if (options.release) throw new Error("Release readiness requires exact-source application and infrastructure image evidence")
    if (await sha256File(reviewPath) !== reviewHash) throw new Error("Dependency review changed during candidate validation")
    const sourceEvidencePath = options["source-evidence"] ?? resolve(root, "artifacts/dependency-source.json")
    const result = { sourceSHA, sourceDirty: evidence.sourceDirty, policySourceSHA: policySHA, reviewRecordSha256: reviewHash, collectedAt: evidence.collectedAt,
      graphHash: evidence.graphHash, configurationHash: evidence.configurationHash, sourceEvidenceSha256: await sha256File(sourceEvidencePath), source, images,
      imageEvidence: imageEvidence?.map((image) => ({ application: image.application, imageId: image.imageId, archiveSha256: image.archiveSha256,
        reportSha256: image.reportSha256, nativeInventorySha256: image.nativeInventorySha256, scanner: image.scanner })) ?? null,
      releaseCleared: options.release && !source.releaseBlocked && !images.releaseBlocked,
      limitation: options.images ? "Current reviewed inventory; unresolved findings still block release" : "Source inventory only; no native/OS or release clearance" }
    const output = resolve(root, "artifacts/dependency-readiness.json")
    await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(result, null, 2) + "\n")
    console.log("Dependency inventory qualified; dependency release gate " + (result.releaseCleared ? "CLEARED for this candidate" : "NOT CLEARED") + "; source " + sourceSHA + (evidence.sourceDirty ? " (dirty working tree; not release evidence)" : ""))
    return result
  } finally {
    if (temporary) {
      try { execFileSync("git", ["worktree", "remove", temporary], { cwd: root, timeout: 60000, stdio: "pipe" }) }
      catch { console.error("Preserved changed candidate worktree for inspection: " + temporary) }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { await checkDependencySecurity() } catch (error) {
    const root = fileURLToPath(new URL("..", import.meta.url))
    const sourceSHA = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
    const reason = error instanceof Error ? error.message : String(error)
    await mkdir(resolve(root, "artifacts"), { recursive: true })
    await writeFile(resolve(root, "artifacts/dependency-readiness.json"), JSON.stringify({ sourceSHA, checkedAt: new Date().toISOString(), status: "blocked", releaseCleared: false, reason }, null, 2) + "\n")
    console.error(reason); process.exitCode = 1
  }
}
