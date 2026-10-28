export const nodeImageApplications = ["cms", "renderer", "site"]
export const imageApplications = [...nodeImageApplications, "postgres", "exchange-worker"]
const hash = value => /^[a-f0-9]{64}$/.test(value ?? "")
const digest = value => /^sha256:[a-f0-9]{64}$/.test(value ?? "")

export function assertImageVerificationEvidence({ sha, runId, attempt, image }, evidence) {
  let valid = /^[a-f0-9]{40}$/.test(sha ?? "") && /^[1-9][0-9]*$/.test(runId ?? "") &&
    /^[1-9][0-9]*$/.test(attempt ?? "") && imageApplications.includes(image) &&
    evidence?.application === image && evidence.sourceSHA === sha &&
    evidence.verificationRunId === runId && evidence.verificationRunAttempt === attempt &&
    new RegExp("^siab-verify-[a-f0-9]{8}-" + sha + ":" + image + "$").test(evidence.tag ?? "") &&
    digest(evidence.imageId) && hash(evidence.archiveSha256) &&
    evidence.packagedSmoke === "passed" && evidence.published === false && typeof evidence.publishable === "boolean"
  const identity = evidence?.archiveIdentity
  valid &&= identity?.sourceSHA === sha && identity.tag === evidence.tag && identity.os === "linux" && identity.architecture === "amd64" &&
      digest(identity.configDigest) && (identity.manifestDigest === null || digest(identity.manifestDigest)) &&
      [identity.configDigest, identity.manifestDigest].includes(evidence.imageId) &&
      Array.isArray(identity.rootfsDiffIds) && identity.rootfsDiffIds.length > 0 && identity.rootfsDiffIds.every(digest)

  if (valid && nodeImageApplications.includes(image)) {
    valid = /^[0-9]+\.[0-9]+\.[0-9]+$/.test(evidence.nodeVersion ?? "") &&
      typeof evidence.buildNodeLts === "string" && Boolean(evidence.buildNodeLts.trim()) &&
      (image === "site" ? evidence.nodeLts === null : evidence.nodeLts === evidence.buildNodeLts)
  } else if (valid) {
    valid = /^\d+\.\d+(?:\.\d+)?$/.test(evidence.runtimeVersion ?? "") && evidence.runtimePlatform?.architecture === "amd64"
    if (image === "exchange-worker") valid &&= evidence.runtimePlatform.os === "ubuntu" && hash(evidence.runtimeInventorySha256) && hash(evidence.dpkgInventorySha256) &&
      evidence.commandContract === "passed" && evidence.unauthenticatedStatus === 401 && evidence.health?.healthy === true &&
      evidence.health.protocolVersion === 1 && evidence.health.dnsToolAvailable === true && /^\d+\.\d+\.\d+$/.test(evidence.health.moduleVersion ?? "")
    else valid &&= evidence.runtimePlatform.os === "alpine" && ["populatedDataPreserved", "schemaPreserved", "migrationHistoryPreserved", "gracefulDatabaseStop", "actualEntrypointRestartPassed", "logicalRestore"].every(key => evidence.postgresRehearsal?.[key] === true) && evidence.postgresRehearsal.lifecycleContract === "passed"
  }
  if (!valid) throw new Error("Image verification evidence is missing or mismatches source, run, attempt, runtime or successful packaged smoke")
}
