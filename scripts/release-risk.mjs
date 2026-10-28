import { canonicalHash } from "./image-artifact.mjs"
import { isDeepStrictEqual } from "node:util"

const day = 86400000
const states = ["affected", "under_investigation", "not_affected", "fixed"]
const severities = ["info", "low", "moderate", "high", "critical", "unknown"]
const text = value => typeof value === "string" && Boolean(value.trim())
const hash = value => /^[a-f0-9]{64}$/.test(value ?? "")

/** The sole risk decision. Callers validate source/bytes/coverage before supplying items. */
export function evaluateReleaseRisk({ items, requirements = [], now = Date.now() }) {
  if (!Array.isArray(items) || !Array.isArray(requirements) || !Number.isFinite(now)) throw new Error("Complete release-risk inputs are required")
  const blockers = [], tracked = []
  for (const requirement of requirements) {
    if (!text(requirement?.id) || !["passed", "failed", "unknown"].includes(requirement.status)) throw new Error("Verification requirement is malformed")
    if (requirement.status !== "passed") blockers.push({ id: requirement.id, reason: requirement.reason || "Required verification is incomplete" })
  }
  for (const { finding, review, binding } of items) {
    const block = reason => blockers.push({ id: finding?.id ?? "missing-finding", scope: binding?.scope, reason })
    if (!text(finding?.id) || !severities.includes(finding.severity) || typeof finding.knownExploited !== "boolean" || !states.includes(review?.state) || !text(review.reason) || !text(review.reviewOwner)) { block("Finding or accountable disposition is missing/invalid"); continue }
    const reviewedAt = Date.parse(review.reviewedAt), deadline = Date.parse(review.deadline)
    if (![reviewedAt, deadline].every(Number.isFinite) || reviewedAt > now || deadline <= now || deadline <= reviewedAt) { block("Disposition review is future, missing or overdue"); continue }
    if (finding.aliasesResolved === false) { block("Required CVE alias coverage is unresolved"); continue }
    if (["not_affected", "fixed"].includes(review.state)) {
      if (["NATIVE_ANALYSIS_INCOMPLETE", "UNVERSIONED_NATIVE_COMPONENT", "WORKER_NATIVE_MAPPING_INCOMPLETE"].includes(finding.id)) { block("Required analysis gaps must be resolved, not waived as nonaffected"); continue }
      const proof = review.evidence
      if (!text(binding?.scope) || !text(binding.platform) || !hash(binding.fingerprint) || !hash(binding.advisoryHash) || !isDeepStrictEqual(proof?.binding, binding) || !text(proof.justification) || !proof.sources?.length || proof.sources.some(source => !text(source) || !review.sources?.includes(source)) || deadline - reviewedAt > 90 * day) block("Nonaffected/fixed disposition lacks current exact scoped evidence")
      continue
    }
    if (finding.knownExploited || ["high", "critical", "unknown"].includes(finding.severity)) { block(finding.knownExploited ? "Known-exploited finding remains unresolved" : "High/critical finding or unknown severity remains unresolved"); continue }
    const days = finding.severity === "moderate" ? 30 : 90
    if (!/^https:\/\/[^\s]+$/.test(review.issue ?? "") || deadline - reviewedAt > days * day) { block("Lower-severity risk needs an owned issue and bounded review deadline"); continue }
    tracked.push({ id: finding.id, scope: binding?.scope, severity: finding.severity, owner: review.reviewOwner, issue: review.issue, deadline: review.deadline })
  }
  return { status: blockers.length ? "blocked" : "ready", releaseBlocked: blockers.length > 0, blockers, tracked }
}

/** A reference/date-only update is audit data, not changed vulnerability semantics. */
export function securityFacts(value) {
  if (Array.isArray(value)) return value.map(securityFacts)
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter(key => !["references", "source", "modifiedAt", "modified", "updatedAt", "published", "publishedAt"].includes(key)).map(key => [key, key === "dataSource" ? { ID: value[key]?.ID } : value[key]]))
  return value
}


export function reviewedRiskItems(inventory, reviews, { facts, binding }) {
  const catalog = facts?.find(fact => fact.id === "cisa-kev")?.facts
  if (!Array.isArray(catalog?.vulnerabilities) || catalog.count !== catalog.vulnerabilities.length || !Number.isFinite(Date.parse(catalog.dateReleased)) || catalog.vulnerabilities.some(entry => !/^CVE-\d{4}-\d{4,}$/.test(entry.cveID ?? ""))) throw new Error("Authoritative known-exploited catalog is unavailable or malformed")
  const exploited = new Set(catalog.vulnerabilities.map(entry => entry.cveID))
  return inventory.map(finding => {
    const key = JSON.stringify([finding.scope, finding.id, finding.package, finding.version])
    const review = reviews.get(key)
    if (!review) throw new Error("Finding disposition missing")
    const sources = review.sources.map(id => facts.find(fact => fact.id === id))
    if (sources.some(source => !source)) throw new Error("Disposition primary source is unavailable")
    if (["not_affected", "fixed"].includes(review.state) && !review.evidence?.sources?.some(id => sources.some(source => source.id === id && (source.facts?.id === finding.id || source.facts?.aliases?.includes(finding.id))))) throw new Error("Nonaffected/fixed decision lacks advisory-specific primary evidence")
    const authoritative = facts.filter(source => source.facts?.id === finding.id || source.facts?.aliases?.includes(finding.id))
    const aliases = [finding.id, ...(finding.aliases ?? []), ...authoritative.flatMap(source => source.facts.aliases ?? [])]
    const aliasesResolved = /^CVE-\d{4}-\d{4,}$/.test(finding.id) || ["NATIVE_ANALYSIS_INCOMPLETE", "UNVERSIONED_NATIVE_COMPONENT", "WORKER_NATIVE_MAPPING_INCOMPLETE"].includes(finding.id) || Array.isArray(finding.aliases) || authoritative.some(source => Array.isArray(source.facts.aliases))
    const context = typeof binding === "function" ? binding(finding) : binding
    return { finding: { ...finding, aliasesResolved, knownExploited: aliases.some(id => exploited.has(id)) }, review,
      binding: { ...context, advisoryHash: canonicalHash({ finding: securityFacts(finding), sources: sources.map(source => ({ id: source.id, facts: securityFacts(source.facts) })).sort((a, b) => a.id.localeCompare(b.id)) }) } }
  })
}
