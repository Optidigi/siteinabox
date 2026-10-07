import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

function run(mutate, extra = []) {
  const dir = mkdtempSync(join(tmpdir(), "dependency-gate-"))
  const policy = {
    schemaVersion: 1,
    expiresAt: "2999-01-01T00:00:00Z",
    advisories: [
      {
        advisoryId: "GHSA-fixture",
        package: "fixture",
        version: "1.0.0",
        severity: "high",
        paths: ["apps__cms>fixture"],
        disposition: "triaged",
        shippedReachability: "runtime",
        releaseBlocked: true,
        reason: "Fixture runtime exposure",
        sources: ["https://example.test/advisory"],
      },
    ],
  }
  const audit = {
    advisories: {
      1: {
        github_advisory_id: "GHSA-fixture",
        module_name: "fixture",
        severity: "high",
        findings: [{ version: "1.0.0", paths: ["apps__cms>fixture"] }],
      },
    },
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 },
    },
  }
  mutate?.(policy, audit)
  try {
    writeFileSync(join(dir, "policy.json"), JSON.stringify(policy))
    writeFileSync(join(dir, "audit.json"), JSON.stringify(audit))
    return spawnSync(
      process.execPath,
      [
        new URL("./check-dependency-security.mjs", import.meta.url).pathname,
        "--policy-file",
        join(dir, "policy.json"),
        "--audit-file",
        join(dir, "audit.json"),
        ...extra,
      ],
      { encoding: "utf8" },
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test("reviewed inventory can pass while release remains blocked", () => {
  assert.equal(run().status, 0)
  assert.match(run(undefined, ["--release"]).stderr, /Release blocked/)
})
test("runtime high cannot bypass release by clearing the row flag", () => {
  assert.equal(
    run(
      (policy) => {
        policy.advisories[0].releaseBlocked = false
      },
      ["--release"],
    ).status,
    1,
  )
})
test("new ID, severity, version, and resolved path each require review", () => {
  for (const mutate of [
    (_policy, audit) => {
      audit.advisories[1].github_advisory_id = "GHSA-new"
    },
    (_policy, audit) => {
      audit.advisories[1].severity = "critical"
      audit.metadata.vulnerabilities.high = 0
      audit.metadata.vulnerabilities.critical = 1
    },
    (_policy, audit) => {
      audit.advisories[1].findings[0].version = "1.0.1"
    },
    (_policy, audit) => {
      audit.advisories[1].findings[0].paths.push("apps__renderer>fixture")
    },
  ])
    assert.match(run(mutate).stderr, /requires review/)
})
test("expiry, malformed response, stale and untriaged dispositions fail closed", () => {
  for (const mutate of [
    (policy) => {
      policy.expiresAt = "2000-01-01T00:00:00Z"
    },
    (_policy, audit) => {
      delete audit.advisories
    },
    (_policy, audit) => {
      audit.advisories = {}
    },
    (_policy, audit) => {
      audit.metadata.vulnerabilities.high = 0
    },
    (policy) => {
      policy.advisories[0].disposition = "pending"
    },
  ])
    assert.equal(run(mutate).status, 1)
})
test("reviewed build-only high passes release without suppressing inventory review", () => {
  assert.equal(
    run(
      (policy) => {
        policy.advisories[0].shippedReachability = "build"
        policy.advisories[0].releaseBlocked = false
      },
      ["--release"],
    ).status,
    0,
  )
})
