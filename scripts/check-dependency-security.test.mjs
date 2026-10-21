import test from "node:test"
import assert from "node:assert/strict"
import { normalizeAudit, validateDependencyReview } from "./check-dependency-security.mjs"

const now = Date.parse("2026-10-21T00:00:00Z")
const hash = "a".repeat(64)
const advisory = { github_advisory_id: "GHSA-test-test-test", module_name: "fixture", severity: "high",
  findings: [{ version: "1.0.0", paths: ["apps__cms>fixture"] }] }
const audit = () => ({ advisories: { fixture: structuredClone(advisory) },
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 } } })
const record = () => ({ schemaVersion: 2, reviewedAt: "2026-10-20T00:00:00Z", expiresAt: "2026-10-27T00:00:00Z",
  graphHash: hash, configurationHash: hash, reviewOwner: "dependency maintainer", publisherFacts: [{ id: "fixture-upstream", url: "https://example.test/advisory", sha256: hash }],
  advisories: [{ scope: "full", id: advisory.github_advisory_id, package: "fixture", version: "1.0.0", severity: "high", paths: ["apps__cms>fixture"],
    classification: "affected_package_condition_unproven", releaseBlocked: true, reason: "Presence confirmed; deployment condition unproven; retain blocker", reviewOwner: "dependency maintainer", recheck: "Before release or changed inputs", sources: ["fixture-upstream"] },
    { scope: "production", id: advisory.github_advisory_id, package: "fixture", version: "1.0.0", severity: "high", paths: ["apps__cms>fixture"],
      classification: "affected_package_condition_unproven", releaseBlocked: true, reason: "Runtime path requires review", reviewOwner: "dependency maintainer", recheck: "Before release or changed inputs", sources: ["fixture-upstream"] }],
})
const input = () => ({ record: record(), graphHash: hash, configurationHash: hash,
  audits: { full: audit(), production: audit() }, facts: [{ id: "fixture-upstream", url: "https://example.test/advisory", sha256: hash }], now })

test("reviewed blocked inventory is distinct from release clearance", () => {
  assert.equal(validateDependencyReview(input()).releaseBlocked, true)
  assert.throws(() => validateDependencyReview({ ...input(), release: true }), /Release blocked/)
})
test("missing, invalid, future, expired and expiry-only reviews fail", () => {
  for (const mutate of [
    (x) => { x.record = null },
    (x) => { x.record.reviewedAt = "invalid" },
    (x) => { x.record.reviewedAt = "2026-10-22T00:00:00Z" },
    (x) => { x.record.expiresAt = "2026-10-20T00:00:00Z" },
    (x) => { x.record.expiresAt = "2026-11-27T00:00:00Z" },
  ]) { const x = input(); mutate(x); assert.throws(() => validateDependencyReview(x), /review/i) }
})
test("graph, configuration and publisher changes invalidate review", () => {
  for (const mutate of [
    (x) => { x.graphHash = "b".repeat(64) },
    (x) => { x.configurationHash = "b".repeat(64) },
    (x) => { x.facts[0].sha256 = "b".repeat(64) },
    (x) => { x.facts = [] },
  ]) { const x = input(); mutate(x); assert.throws(() => validateDependencyReview(x), /changed|unavailable/i) }
})
test("missing scope, new advisory, path or severity drift cannot pass", () => {
  for (const mutate of [
    (x) => { delete x.audits.production },
    (x) => { x.audits.full.advisories.fixture.github_advisory_id = "GHSA-new-new-new" },
    (x) => { x.audits.full.advisories.fixture.findings[0].paths.push("apps__landing>fixture") },
    (x) => { x.record.advisories[0].severity = "moderate" },
    (x) => { x.record.advisories.pop() },
    (x) => { x.record.advisories.push(structuredClone(x.record.advisories[0])) },
  ]) { const x = input(); mutate(x); assert.throws(() => validateDependencyReview(x)) }
})
test("malformed, truncated and inconsistent inventories fail", () => {
  for (const value of [null, {}, { advisories: {}, metadata: audit().metadata },
    { ...audit(), advisories: { fixture: { ...advisory, findings: [] } } },
    { ...audit(), advisories: { fixture: { ...advisory, findings: [{ version: "1", paths: [] }] } } }]) {
    assert.throws(() => normalizeAudit(value))
  }
})
test("removing findings requires fresh disposition rather than stale allowlisting", () => {
  const x = input(); x.audits.full = { advisories: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 } } }
  assert.throws(() => validateDependencyReview(x), /changed|stale/i)
})
test("unknown dispositions, missing owners and clearing risk flags never authorize release", () => {
  for (const mutate of [
    (x) => { x.record.advisories[0].classification = "unknown" },
    (x) => { x.record.advisories[0].reviewOwner = "" },
    (x) => { x.record.advisories[0].releaseBlocked = false },
    (x) => { x.record.advisories[0].sources = ["unreviewed"] },
  ]) { const x = input(); mutate(x); assert.throws(() => validateDependencyReview({ ...x, release: true })) }
})

test("a complete current zero-finding source review can qualify its own scope", () => {
  const x = input(); x.record.advisories = []
  const clean = { advisories: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 } } }
  x.audits = { full: clean, production: structuredClone(clean) }
  assert.equal(validateDependencyReview({ ...x, release: true }).releaseBlocked, false)
})

test("publisher floors hold even if the audit omits the known advisory", async () => {
  const { validatePublisherConstraints } = await import("./check-dependency-security.mjs")
  const constraint = { package: "fixture", manifest: "apps/cms/package.json", specifier: "1.2.0", version: "1.2.0", minimumQualifiedVersion: "1.1.1", lockedVersions: ["1.2.0"], sources: ["primary"] }
  const record = { publisherFacts: [{ id: "primary" }], publisherConstraints: [constraint] }
  const actual = [{ package: "fixture", manifest: "apps/cms/package.json", specifier: "1.2.0", lockedVersions: ["1.2.0"] }]
  validatePublisherConstraints(record, actual)
  for (const change of [
    (x) => { x[0].lockedVersions.push("1.0.0") },
    (x) => { x[0].specifier = "1.0.0" },
    (x) => { x[0].lockedVersions = [] },
  ]) { const x = structuredClone(actual); change(x); assert.throws(() => validatePublisherConstraints(record, x), /Publisher/) }
  const regressed = structuredClone(record); regressed.publisherConstraints[0].version = "1.0.0"
  assert.throws(() => validatePublisherConstraints(regressed, actual), /Publisher/)
})

test("release CLI cannot consume supplied cached audits or an ambiguous candidate", async () => {
  const { checkDependencySecurity } = await import("./check-dependency-security.mjs")
  await assert.rejects(checkDependencySecurity(["--release", "--source-evidence", "not-a-live-audit.json"]), /fresh collection/)
  await assert.rejects(checkDependencySecurity(["--candidate", "not-a-full-source-sha"]), /full source SHA/)
})
