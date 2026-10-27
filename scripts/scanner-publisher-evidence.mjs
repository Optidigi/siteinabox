import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { execFileSync } from "node:child_process"
import { dependencyIdentities, publisherFactHash } from "./collect-dependency-evidence.mjs"
import { scannerPin } from "./dependency-image-evidence.mjs"


export function assertScannerPublisherEvidence(evidence, policy, identity, now = Date.now()) {
  const fact = evidence.facts?.find(item => item.id === "scanner-release")
  const reviewed = policy.publisherFacts?.find(item => item.id === "scanner-release")
  const expectedUrl = "https://api.github.com/repos/aquasecurity/trivy/releases/tags/v" + scannerPin.version
  const age = now - Date.parse(evidence.collectedAt)
  const digest = fact && publisherFactHash(fact.facts)
  if (evidence.schemaVersion !== 2 || evidence.sourceDirty !== false || evidence.sourceSHA !== identity.sourceSHA ||
      evidence.verificationRunId !== identity.runId || evidence.verificationRunAttempt !== identity.attempt ||
      evidence.graphHash !== identity.graphHash || evidence.configurationHash !== identity.configurationHash ||
      !Number.isFinite(age) || age < -300000 || age > 86400000 || fact?.url !== expectedUrl || reviewed?.url !== expectedUrl ||
      fact?.sha256 !== digest || reviewed?.sha256 !== digest || !Array.isArray(fact?.facts?.assets)) {
    throw new Error("Scanner publisher evidence must be current, reviewed and bound to this source/run/attempt")
  }
  return { tag_name: fact.facts.tag, published_at: fact.facts.publishedAt, draft: fact.facts.draft,
    prerelease: fact.facts.prerelease, assets: fact.facts.assets }
}

export async function readScannerPublisherEvidence(root) {
  let evidence
  try { evidence = JSON.parse(await readFile(resolve(root, "artifacts/dependency-source/dependency-source.json"), "utf8")) }
  catch (error) { if (error.code === "ENOENT") return null; throw error }
  const policy = JSON.parse(await readFile(resolve(root, "docs/dependency-security.json"), "utf8"))
  const inputs = await dependencyIdentities(root)
  return assertScannerPublisherEvidence(evidence, policy, {
    sourceSHA: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    runId: process.env.GITHUB_RUN_ID ?? null, attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    graphHash: inputs.graph.sha256, configurationHash: inputs.configuration.sha256,
  })
}
