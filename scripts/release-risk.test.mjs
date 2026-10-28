import test from "node:test"
import assert from "node:assert/strict"
import { evaluateReleaseRisk } from "./release-risk.mjs"
const now = Date.parse("2026-10-28T12:00:00Z")
const binding = { scope: "image:worker", platform: "linux/amd64", fingerprint: "a".repeat(64), advisoryHash: "b".repeat(64) }
const item = (severity = "high") => ({ finding: { id: "CVE-fixture", severity, knownExploited: false }, binding,
  review: { state: "under_investigation", reason: "Vendor version found; application path under review", reviewOwner: "security owner", issue: "https://example.test/issues/1", reviewedAt: "2026-10-28T00:00:00Z", deadline: "2026-11-27T00:00:00Z", sources: ["primary"] } })
const evaluate = (items, requirements = []) => evaluateReleaseRisk({ items, requirements, now })
test("high, critical, unknown and known-exploited findings block regardless of fix availability", () => {
  for (const severity of ["high", "critical", "unknown"]) assert.equal(evaluate([item(severity)]).releaseBlocked, true)
  const kev = item("low"); kev.finding.knownExploited = true
  assert.equal(evaluate([kev]).releaseBlocked, true)
})
test("lower-severity risks require an accountable bounded remediation record", () => {
  for (const severity of ["moderate", "low"]) {
    const x = item(severity)
    assert.equal(evaluate([x]).releaseBlocked, false)
    assert.equal(evaluate([x]).tracked.length, 1)
    for (const change of [{ reviewOwner: "" }, { issue: "" }, { deadline: "2026-10-28T11:00:00Z" }, { deadline: "2027-10-28T00:00:00Z" }]) assert.equal(evaluate([{ ...x, review: { ...x.review, ...change } }]).releaseBlocked, true)
  }
})
test("nonaffected and vendor-fixed conclusions require exact scoped evidence", () => {
  for (const state of ["not_affected", "fixed"]) {
    const x = item(); x.review.state = state; x.review.evidence = { binding, justification: "Vendor explicitly limits this issue to Windows", sources: ["primary"] }
    assert.equal(evaluate([x]).releaseBlocked, false)
    for (const field of ["scope", "platform", "fingerprint", "advisoryHash"]) assert.equal(evaluate([{ ...x, binding: { ...binding, [field]: "changed" } }]).releaseBlocked, true)
    const unsupported = structuredClone(x); delete unsupported.review.evidence
    assert.equal(evaluate([unsupported]).releaseBlocked, true)
  }
})
test("missing coverage and failed verification cannot be overridden by finding decisions", () => {
  assert.equal(evaluate([], [{ id: "binary-target-coverage", status: "unknown" }]).releaseBlocked, true)
  assert.equal(evaluate([], [{ id: "tenant-isolation", status: "failed" }]).releaseBlocked, true)
  assert.equal(evaluate([], [{ id: "exact-image", status: "passed" }]).releaseBlocked, false)
  assert.equal(evaluate([{ ...item("low"), review: { ...item("low").review, state: "ignore" } }]).releaseBlocked, true)
})

test("reference metadata does not change security semantics; ranges and severity still do", async () => {
  const { securityFacts } = await import("./release-risk.mjs")
  const original = { fixedVersion: "1.2.3", severity: "high", references: ["https://old.test"], modifiedAt: "yesterday", vendorSeverity: { primary: "high" } }
  assert.deepEqual(securityFacts(original), securityFacts({ ...original, references: ["https://new.test"], modifiedAt: "today" }))
  assert.notDeepEqual(securityFacts(original), securityFacts({ ...original, fixedVersion: "1.2.4" }))
  assert.notDeepEqual(securityFacts(original), securityFacts({ ...original, severity: "critical" }))
})

test("known exploitation is derived from the authoritative feed rather than review flags", async () => {
  const { reviewedRiskItems } = await import("./release-risk.mjs")
  const finding = { scope: "production", id: "GHSA-fixture", package: "fixture", version: "1.0.0", severity: "low", paths: ["fixture"] }
  const x = item("low"); const review = { ...x.review, sources: ["GHSA-fixture"] }
  const reviews = new Map([[JSON.stringify([finding.scope, finding.id, finding.package, finding.version]), review]])
  const facts = [{ id: "cisa-kev", facts: { count: 1, dateReleased: "2026-10-28T00:00:00Z", vulnerabilities: [{ cveID: "CVE-2026-12345" }] } }, { id: "GHSA-fixture", facts: { id: "GHSA-fixture", aliases: ["CVE-2026-12345"] } }]
  const items = reviewedRiskItems([finding], reviews, { facts, binding })
  assert.equal(evaluate(items).releaseBlocked, true)
  assert.throws(() => reviewedRiskItems([finding], reviews, { facts: facts.slice(1), binding }), /known-exploited/)
})

test("reviewer source selection cannot evade KEV or missing alias coverage", async () => {
  const { reviewedRiskItems } = await import("./release-risk.mjs")
  const f = { scope: "production", id: "GHSA-example", package: "fixture", version: "1.0.0", severity: "low", paths: ["fixture"] }
  const review = { ...item("low").review, sources: ["scanner-release"] }
  const map = new Map([[JSON.stringify([f.scope, f.id, f.package, f.version]), review]])
  const facts = [{ id: "cisa-kev", facts: { count: 1, dateReleased: "2026-10-28", vulnerabilities: [{ cveID: "CVE-2026-12345" }] } }, { id: "advisory", facts: { id: f.id, aliases: ["CVE-2026-12345"] } }, { id: "scanner-release", facts: { tag: "1.0.0" } }]
  assert.equal(evaluate(reviewedRiskItems([f], map, { facts, binding })).releaseBlocked, true)
  assert.equal(evaluate(reviewedRiskItems([f], map, { facts: facts.filter(x => x.id !== "advisory"), binding })).releaseBlocked, true)
})

test("malformed aliases cannot establish KEV non-membership", async () => {
  const { reviewedRiskItems } = await import("./release-risk.mjs")
  const f = { scope: "production", id: "GHSA-example", package: "fixture", version: "1.0.0", severity: "low", aliases: [null], paths: ["fixture"] }
  const reviews = new Map([[JSON.stringify([f.scope, f.id, f.package, f.version]), { ...item("low").review, sources: ["primary"] }]])
  const facts = [{ id: "cisa-kev", facts: { count: 0, dateReleased: "2026-10-28", vulnerabilities: [] } }, { id: "primary", facts: { id: f.id, aliases: [] } }]
  assert.throws(() => reviewedRiskItems([f], reviews, { facts, binding }), /alias/i)
  f.aliases = []; facts[1].facts.aliases = [null]
  assert.throws(() => reviewedRiskItems([f], reviews, { facts, binding }), /alias/i)
})

test("known exploitation follows transitive advisory aliases", async () => {
  const { reviewedRiskItems } = await import("./release-risk.mjs")
  const f = { scope: "production", id: "GO-2026-12345", package: "fixture", version: "1.0.0", severity: "low", paths: ["fixture"] }
  const reviews = new Map([[JSON.stringify([f.scope, f.id, f.package, f.version]), { ...item("low").review, sources: ["go"] }]])
  const facts = [
    { id: "cisa-kev", facts: { count: 1, dateReleased: "2026-10-28", vulnerabilities: [{ cveID: "CVE-2026-12345" }] } },
    { id: "github", facts: { id: "GHSA-example", aliases: [f.id, "CVE-2026-12345"] } },
    { id: "go", facts: { id: f.id, aliases: ["GHSA-example"] } },
  ]
  const items = reviewedRiskItems([f], reviews, { facts, binding })
  assert.equal(items[0].finding.aliasesResolved, true)
  assert.equal(items[0].finding.knownExploited, true)
  assert.equal(evaluate(items).releaseBlocked, true)
})
