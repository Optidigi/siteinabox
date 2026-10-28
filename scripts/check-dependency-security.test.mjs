import test from "node:test"
import assert from "node:assert/strict"
import { canonicalHash } from "./image-artifact.mjs"
import { securityFacts } from "./release-risk.mjs"
import { normalizeAudit, validateDependencyReview } from "./check-dependency-security.mjs"
const now = Date.parse("2026-10-21T00:00:00Z"), hash = "a".repeat(64)
const advisory = { github_advisory_id: "GHSA-test-test-test", module_name: "fixture", severity: "high", findings: [{ version: "1.0.0", paths: ["apps__cms>fixture"] }] }
const audit = () => ({ advisories: { fixture: structuredClone(advisory) }, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 } } })
const clean = () => ({ advisories: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 } } })
function input() {
  const bodies = [{ id: "fixture-upstream", url: "https://example.test/advisory", facts: { id: advisory.github_advisory_id, aliases: [], vulnerabilities: [{ range: "<1.1.0" }] } }, { id: "cisa-kev", url: "https://example.test/kev", facts: { count: 0, dateReleased: "2026-10-20T00:00:00Z", vulnerabilities: [] } }]
  const facts = bodies.map(f => ({ ...f, sha256: canonicalHash(f.facts) }))
  const record = { schemaVersion: 3, policy: "production-risk-v1", reviewOwner: "security owner", publisherFacts: facts.map(f => ({ id: f.id, url: f.url, role: f.id === "cisa-kev" ? "monitor" : "advisory", securityHash: canonicalHash(securityFacts(f.facts)) })), findings: ["full", "production"].map(scope => ({ scope, id: advisory.github_advisory_id, package: "fixture", version: "1.0.0", severity: "high", paths: ["apps__cms>fixture"], state: "under_investigation", reason: "Package found; applicability under review", reviewOwner: "security owner", reviewedAt: "2026-10-20T00:00:00Z", deadline: "2026-10-27T00:00:00Z", issue: "https://example.test/issue/1", sources: ["fixture-upstream"] })) }
  return { record, facts, graphHash: hash, configurationHash: hash, audits: { full: audit(), production: audit() }, now }
}
test("reviewed high-risk inventory is distinct from release clearance", () => {
  const x = input(); assert.equal(validateDependencyReview(x).releaseBlocked, true)
  assert.throws(() => validateDependencyReview({ ...x, release: true }), /Release blocked/)
})
test("malformed evidence, altered publisher bytes and changed advisory ranges fail", () => {
  for (const mutate of [x => { x.record = null }, x => { x.record.schemaVersion = 2 }, x => { x.facts[0].facts.vulnerabilities = [] }, x => { x.facts = [] }, x => { x.facts[0].facts.vulnerabilities[0].range = "<2.0.0"; x.facts[0].sha256 = canonicalHash(x.facts[0].facts) }]) { const x = input(); mutate(x); assert.throws(() => validateDependencyReview(x)) }
})
test("fresh exact-source graph hashes are not duplicated as manual risk flags", () => {
  const x = input(); x.record.findings = []; x.audits = { full: clean(), production: clean() }
  x.graphHash = "b".repeat(64); x.configurationHash = "c".repeat(64)
  assert.equal(validateDependencyReview({ ...x, release: true }).releaseBlocked, false)
  // Owning CLI separately compares these hashes to actual checked-out source.
  x.graphHash = "invalid"; assert.throws(() => validateDependencyReview(x))
})
test("new advisories, paths, selected severity and missing review scopes require triage", () => {
  for (const mutate of [x => { delete x.audits.production }, x => { x.audits.full.advisories.fixture.github_advisory_id = "GHSA-new-new-new" }, x => { x.audits.full.advisories.fixture.findings[0].paths.push("apps__landing>fixture") }, x => { x.record.findings[0].severity = "moderate" }, x => { x.record.findings.pop() }, x => { x.record.findings.push(structuredClone(x.record.findings[0])) }]) { const x = input(); mutate(x); assert.throws(() => validateDependencyReview(x)) }
})
test("malformed/truncated audits and stale disposition rows cannot disappear", () => {
  for (const value of [null, {}, { advisories: {}, metadata: audit().metadata }, { ...audit(), advisories: { fixture: { ...advisory, findings: [] } } }]) assert.throws(() => normalizeAudit(value))
  const x = input(); x.audits.full = clean(); assert.throws(() => validateDependencyReview(x), /stale|changed/i)
})
test("unknown decisions and missing owners or enrolled evidence fail", () => {
  for (const mutate of [x => { x.record.findings[0].state = "ignore" }, x => { x.record.findings[0].reviewOwner = "" }, x => { x.record.findings[0].sources = ["unreviewed"] }]) { const x = input(); mutate(x); assert.throws(() => validateDependencyReview(x)) }
})
test("lower-severity production findings stay visible and require bounded ownership", () => {
  const x = input(); for (const scope of ["full", "production"]) { x.audits[scope].advisories.fixture.severity = "low"; x.audits[scope].metadata.vulnerabilities.high = 0; x.audits[scope].metadata.vulnerabilities.low = 1 }
  for (const row of x.record.findings) row.severity = "low"
  const result = validateDependencyReview({ ...x, release: true }); assert.equal(result.releaseBlocked, false); assert.equal(result.tracked.length, 2)
  x.record.findings[0].deadline = "2026-10-20T23:00:00Z"; assert.throws(() => validateDependencyReview({ ...x, release: true }))
})
test("publisher floors remain independent of an audit's advisory omission", async () => {
  const { validatePublisherConstraints } = await import("./check-dependency-security.mjs")
  const entry = { package: "fixture", manifest: "apps/cms/package.json", specifier: "1.2.0", version: "1.2.0", minimumQualifiedVersion: "1.1.1", lockedVersions: ["1.2.0"], sources: ["primary"] }
  const record = { publisherFacts: [{ id: "primary" }], publisherConstraints: [entry] }, actual = [{ package: "fixture", manifest: entry.manifest, specifier: "1.2.0", lockedVersions: ["1.2.0"] }]
  validatePublisherConstraints(record, actual)
  for (const change of [x => { x[0].lockedVersions.push("1.0.0") }, x => { x[0].specifier = "1.0.0" }, x => { x[0].lockedVersions = [] }]) { const x = structuredClone(actual); change(x); assert.throws(() => validatePublisherConstraints(record, x)) }
})
test("release CLI rejects cached audits and ambiguous source identities", async () => {
  const { checkDependencySecurity } = await import("./check-dependency-security.mjs")
  await assert.rejects(checkDependencySecurity(["--release", "--source-evidence", "cached.json"]), /fresh collection/)
  await assert.rejects(checkDependencySecurity(["--candidate", "not-a-source-sha"]), /full source SHA/)
})
