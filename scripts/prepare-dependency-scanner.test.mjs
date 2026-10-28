import { scannerPin } from "./dependency-image-evidence.mjs"
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { prepareDependencyScanner } from "./prepare-dependency-scanner.mjs"

test("scanner setup refuses unowned resource directories before network or writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-scanner-owner-"))
  try {
    const target = join(root, "artifacts/dependency-tools/trivy-" + scannerPin.version)
    await mkdir(target, { recursive: true }); await writeFile(join(target, "unrelated"), "preserve")
    await assert.rejects(prepareDependencyScanner(root), /unowned/)
    assert.equal(await readFile(join(target, "unrelated"), "utf8"), "preserve")
  } finally { await rm(root, { recursive: true, force: true }) }
})
test("scanner setup refuses symbolic links without adopting their targets", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-scanner-link-"))
  try {
    const parent = join(root, "artifacts/dependency-tools")
    const unrelated = join(root, "unrelated")
    await mkdir(parent, { recursive: true }); await mkdir(unrelated)
    await symlink(unrelated, join(parent, "trivy-" + scannerPin.version))
    await assert.rejects(prepareDependencyScanner(root), /unowned/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("shared scanner metadata rejects stale, substituted and tampered source/run receipts", async () => {
  const { assertScannerPublisherEvidence } = await import("./scanner-publisher-evidence.mjs")
  const { publisherFactHash } = await import("./collect-dependency-evidence.mjs")
  const now = Date.now(), url = "https://api.github.com/repos/aquasecurity/trivy/releases/tags/v" + scannerPin.version
  const facts = { tag: "v" + scannerPin.version, publishedAt: "2026-01-01T00:00:00Z", draft: false, prerelease: false, eligibleForSelection: true, body: "fixture", assets: [{ name: "fixture.tar.gz", digest: "sha256:" + "a".repeat(64) }] }
  const fact = { id: "scanner-release", url, facts, sha256: publisherFactHash(facts) }
  const identity = { sourceSHA: "a".repeat(40), runId: "42", attempt: "1", graphHash: "b".repeat(64), configurationHash: "c".repeat(64) }
  const evidence = { schemaVersion: 2, sourceSHA: identity.sourceSHA, sourceDirty: false, verificationRunId: "42", verificationRunAttempt: "1", graphHash: identity.graphHash, configurationHash: identity.configurationHash, collectedAt: new Date(now).toISOString(), facts: [fact] }
  const policy = { publisherFacts: [{ id: fact.id, url, sha256: fact.sha256 }] }
  assert.equal(assertScannerPublisherEvidence(evidence, policy, identity, now).tag_name, "v" + scannerPin.version)
  for (const change of [{ sourceDirty: true }, { sourceSHA: "d".repeat(40) }, { verificationRunId: "43" }, { verificationRunAttempt: "2" }, { graphHash: "changed" }, { configurationHash: "changed" }, { collectedAt: new Date(now - 86400001).toISOString() }, { collectedAt: new Date(now + 300001).toISOString() }]) assert.throws(() => assertScannerPublisherEvidence({ ...evidence, ...change }, policy, identity, now))
  const tampered = structuredClone(evidence)
  tampered.facts[0].facts.assets[0].digest = "sha256:" + "f".repeat(64)
  assert.throws(() => assertScannerPublisherEvidence(tampered, policy, identity, now))
  tampered.facts[0].sha256 = publisherFactHash(tampered.facts[0].facts)
  assert.throws(() => assertScannerPublisherEvidence(tampered, policy, identity, now))
})

test("canonical image jobs cannot silently replace a missing receipt with live metadata", async () => {
  const { readScannerPublisherEvidence } = await import("./scanner-publisher-evidence.mjs")
  const root = await mkdtemp(join(tmpdir(), "siab-publisher-required-"))
  const previous = process.env.GITHUB_JOB
  try {
    process.env.GITHUB_JOB = "image-verification"
    await assert.rejects(readScannerPublisherEvidence(root), /requires the current-run publisher receipt/)
    process.env.GITHUB_JOB = "standalone-publisher-fixture"
    assert.equal(await readScannerPublisherEvidence(root), null)
  } finally {
    if (previous === undefined) delete process.env.GITHUB_JOB; else process.env.GITHUB_JOB = previous
    await rm(root, { recursive: true, force: true })
  }
})
