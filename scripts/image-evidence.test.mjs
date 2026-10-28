import assert from "node:assert/strict"
import { test } from "node:test"
import { assertImageVerificationEvidence } from "./image-evidence.mjs"

const request = { sha: "a".repeat(40), runId: "42", attempt: "1", image: "cms" }
const evidence = { application: "cms", sourceSHA: request.sha, verificationRunId: "42", verificationRunAttempt: "1",
  tag: "siab-verify-deadbeef-" + request.sha + ":cms", imageId: "sha256:" + "b".repeat(64), archiveSha256: "c".repeat(64),
  archiveIdentity: { configDigest: "sha256:" + "b".repeat(64), manifestDigest: null, tag: "siab-verify-deadbeef-" + request.sha + ":cms", sourceSHA: request.sha, os: "linux", architecture: "amd64", rootfsDiffIds: ["sha256:" + "d".repeat(64)] },
  nodeVersion: "24.22.0", buildNodeLts: "Krypton", nodeLts: "Krypton", packagedSmoke: "passed", published: false, publishable: false }

test("CI evidence binds the source, current run/attempt, packaged image and successful smoke", () => {
  assertImageVerificationEvidence(request, evidence)
  for (const change of [{ sourceSHA: "d".repeat(40) }, { verificationRunId: "41" }, { verificationRunAttempt: "2" },
    { application: "renderer" }, { imageId: "latest" }, { tag: "unrelated" }, { archiveSha256: "missing" },
    { packagedSmoke: "failed" }, { published: true }, { publishable: undefined }]) {
    assert.throws(() => assertImageVerificationEvidence(request, { ...evidence, ...change }))
  }
  assert.throws(() => assertImageVerificationEvidence(request, null))
})


test("Current or missing LTS evidence cannot be admitted for promotion", () => {
  for (const change of [{ buildNodeLts: null }, { buildNodeLts: undefined }, { nodeLts: null },
    { nodeLts: "different runtime" }, { nodeVersion: undefined }]) {
    assert.throws(() => assertImageVerificationEvidence(request, { ...evidence, ...change }))
  }
  assertImageVerificationEvidence({ ...request, image: "site" }, { ...evidence,
    application: "site", tag: evidence.tag.replace(":cms", ":site"), archiveIdentity: { ...evidence.archiveIdentity, tag: evidence.tag.replace(":cms", ":site") }, nodeLts: null })
})

test("worker and PostgreSQL use their own runtime contracts without fabricated Node LTS evidence", () => {
  for (const image of ["exchange-worker", "postgres"]) {
    const native = { ...evidence, application: image, tag: evidence.tag.replace(":cms", ":" + image),
      archiveIdentity: { configDigest: evidence.imageId, manifestDigest: null, tag: evidence.tag.replace(":cms", ":" + image), sourceSHA: request.sha, os: "linux", architecture: "amd64", rootfsDiffIds: ["sha256:" + "d".repeat(64)] },
      runtimePlatform: { architecture: "amd64", os: image === "postgres" ? "alpine" : "ubuntu", version: "24.04" },
      runtimeVersion: image === "postgres" ? "18.6" : "7.6.9" }
    delete native.nodeVersion; delete native.nodeLts; delete native.buildNodeLts
    if (image === "exchange-worker") Object.assign(native, { runtimeInventorySha256: "e".repeat(64), dpkgInventorySha256: "f".repeat(64), commandContract: "passed", unauthenticatedStatus: 401, health: { healthy: true, protocolVersion: 1, dnsToolAvailable: true, moduleVersion: "3.10.1" } })
    else native.postgresRehearsal = { populatedDataPreserved: true, schemaPreserved: true, migrationHistoryPreserved: true, gracefulDatabaseStop: true, actualEntrypointRestartPassed: true, logicalRestore: true, lifecycleContract: "passed" }
    assertImageVerificationEvidence({ ...request, image }, native)
    for (const mutation of [{ runtimeVersion: null }, { archiveIdentity: null }, { sourceSHA: "c".repeat(40) }, image === "postgres" ? { postgresRehearsal: {} } : { runtimeInventorySha256: null }]) assert.throws(() => assertImageVerificationEvidence({ ...request, image }, { ...native, ...mutation }))
  }
})

test("static tunnel admission requires its exact native, trust, routing and shutdown contracts", () => {
  const tag = evidence.tag.replace(":cms", ":cloudflared")
  const native = { ...evidence, application: "cloudflared", tag, archiveIdentity: { ...evidence.archiveIdentity, tag },
    runtimeVersion: "2026.10.5", runtimePlatform: { architecture: "amd64", uid: 1000, gid: 1000 }, staticRuntime: true,
    runtimeContract: "passed", gracefulStop: true,
    trustProof: { bundleSha256: "e".repeat(64), rootCount: 118, compromisedRootsAbsent: true, trustedAccepted: true, untrustedRejected: true },
    tunnelVerification: { networkNone: true, targets: ["cms", "renderer"].map(kind => ({ kind, knownHostMatched: true, unknownHost404: true, missingCatchallRejected: true })) } }
  const request_ = { ...request, image: "cloudflared" }
  assertImageVerificationEvidence(request_, native)
  for (const change of [{ staticRuntime: false }, { gracefulStop: false }, { trustProof: {} },
    { runtimePlatform: { ...native.runtimePlatform, uid: 0 } }, { runtimePlatform: { ...native.runtimePlatform, os: "debian" } },
    { tunnelVerification: { ...native.tunnelVerification, targets: [] } }]) assert.throws(() => assertImageVerificationEvidence(request_, { ...native, ...change }))
  for (const key of ["compromisedRootsAbsent", "trustedAccepted", "untrustedRejected"]) assert.throws(() => assertImageVerificationEvidence(request_, { ...native, trustProof: { ...native.trustProof, [key]: false } }))
})
