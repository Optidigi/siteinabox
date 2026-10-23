import test from "node:test"
import assert from "node:assert/strict"
import { sha256Bytes } from "./image-artifact.mjs"
import { assertReceiptIdentity } from "./inspect-ci-evidence.mjs"

test("artifact admission rejects substituted heads, runs, source bytes, policy and failed jobs", () => {
  const sourceBytes = Buffer.from("retained source bytes"), policyBytes = Buffer.from("reviewed policy bytes")
  const sha = "a".repeat(40), head = "b".repeat(40)
  const receipt = { workflow: ".github/workflows/ci.yml", sourceSHA: sha, pullRequestHeadSHA: head, runId: "123", runAttempt: "2", results: { quality: { result: "success" } } }
  const source = { schemaVersion: 2, auditRegistry: "https://registry.npmjs.org", sourceSHA: sha, sourceDirty: false,
    verificationRunId: "123", verificationRunAttempt: "2", collectedAt: new Date().toISOString() }
  const readiness = { sourceSHA: sha, policySourceSHA: sha, sourceDirty: false,
    sourceEvidenceSha256: sha256Bytes(sourceBytes), reviewRecordSha256: sha256Bytes(policyBytes) }
  const input = { receipt, source, readiness, sourceBytes, policyBytes, head, run: "123", attempt: "2", jobs: ["quality"] }
  assertReceiptIdentity(input)
  for (const change of [{ head: sha }, { run: "124" }, { attempt: "3" }, { sourceBytes: Buffer.from("changed") },
    { policyBytes: Buffer.from("changed") }, { source: { ...source, sourceDirty: true } },
    { source: { ...source, collectedAt: "2000-01-01T00:00:00Z" } },
    { receipt: { ...receipt, results: { quality: { result: "skipped" } } } }]) {
    assert.throws(() => assertReceiptIdentity({ ...input, ...change }))
  }
})
