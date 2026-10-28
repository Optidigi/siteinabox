import { canonicalHash } from "./image-artifact.mjs"
import { dependencyImageApplications } from "./image-evidence.mjs"
import { evaluateReleaseRisk, reviewedRiskItems, securityFacts } from "./release-risk.mjs"
const severities = ["info", "low", "moderate", "high", "critical"]
const hashPattern = /^[a-f0-9]{64}$/
const text = (value) => typeof value === "string" && value.trim().length > 0
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const identity = (row) => JSON.stringify([row.scope, row.id, row.package, row.version])

function paths(value) {
  if (!Array.isArray(value) || !value.length || value.some((entry) => !text(entry))) {
    throw new Error("Advisory paths are missing or malformed")
  }
  return [...new Set(value)].sort()
}

export function reviewedDispositions(record, scopes, facts) {
  const allowed = ["full", "production", ...dependencyImageApplications.map(app => "image:" + app)]
  if (record?.schemaVersion !== 3 || record.policy !== "production-risk-v1" || !Array.isArray(record.findings)) throw new Error("Approved canonical risk policy is missing")
  const all = new Map()
  for (const row of record.findings) {
    if (!row || !allowed.includes(row.scope) || !text(row.id) || !text(row.package) || !text(row.version) || ![...severities, "unknown"].includes(row.severity) || all.has(identity(row)) ||
        !["affected", "under_investigation", "not_affected", "fixed"].includes(row.state) || !text(row.reason) || !text(row.reviewOwner) ||
        !row.sources?.length || row.sources.some(id => !facts.has(id))) throw new Error("Invalid or unknown finding disposition")
    paths(row.paths); all.set(identity(row), row)
  }
  return new Map([...all].filter(([, row]) => scopes.includes(row.scope)))
}

export function assertReviewedFindings(inventory, reviews) {
  const seen = new Set()
  for (const finding of inventory) {
    const row = reviews.get(identity(finding))
    if (!row || row.severity !== finding.severity || !equal(paths(row.paths), finding.paths) ||
        (finding.factsHash !== undefined && row.factsHash !== finding.factsHash)) {
      throw new Error("New or changed advisory requires review: " + identity(finding))
    }
    seen.add(identity(finding))
  }
  if (seen.size !== reviews.size) throw new Error("Stale advisory dispositions require fresh review")
}

export function validatePublisherConstraints(record, actual) {
  if (!Array.isArray(record.publisherConstraints) || !record.publisherConstraints.length || !Array.isArray(actual)) throw new Error("Publisher security constraints are missing")
  const facts = new Set(record.publisherFacts.map((fact) => fact.id))
  const stable = (version) => typeof version === "string" && /^\d+\.\d+\.\d+$/.test(version)
  const atLeast = (value, floor) => {
    const left = value.split(".").map(Number); const right = floor.split(".").map(Number)
    for (let index = 0; index < 3; index += 1) { if (left[index] !== right[index]) return left[index] > right[index] }
    return true
  }
  const seen = new Set()
  for (const entry of record.publisherConstraints) {
    const key = JSON.stringify([entry.package, entry.manifest])
    const found = actual.find((value) => value.package === entry.package && value.manifest === entry.manifest)
    if (!text(entry.package) || !text(entry.manifest) || seen.has(key) || !stable(entry.version) || !stable(entry.minimumQualifiedVersion) ||
        !atLeast(entry.version, entry.minimumQualifiedVersion) || !entry.sources?.length || entry.sources.some((id) => !facts.has(id)) ||
        !Array.isArray(entry.lockedVersions) || !entry.lockedVersions.length || entry.lockedVersions.some((version) => !stable(version) || !atLeast(version, entry.minimumQualifiedVersion)) ||
        !found || found.specifier !== entry.specifier || !equal([...new Set(found.lockedVersions)].sort(), [...new Set(entry.lockedVersions)].sort())) {
      throw new Error("Publisher-reviewed package changed or security floor is unmet: " + entry.package)
    }
    seen.add(key)
  }
  if (actual.length !== seen.size) throw new Error("Publisher package inventory differs from the reviewed constraints")
}

/** Normalize complete pnpm audit results, never an output excerpt. */
export function normalizeAudit(audit, scope = "full") {
  if (!audit || !audit.advisories || typeof audit.advisories !== "object" || Array.isArray(audit.advisories) ||
      !audit.metadata?.vulnerabilities || !["full", "production"].includes(scope)) {
    throw new Error("Advisory inventory unavailable or malformed")
  }
  const counts = Object.fromEntries(severities.map((severity) => [severity, 0]))
  const rows = []
  const seen = new Set()
  for (const advisory of Object.values(audit.advisories)) {
    if (!advisory || !text(advisory.github_advisory_id) || !text(advisory.module_name) ||
        !severities.includes(advisory.severity) || !Array.isArray(advisory.findings) || !advisory.findings.length) {
      throw new Error("Advisory inventory is incomplete or malformed")
    }
    counts[advisory.severity] += 1
    for (const finding of advisory.findings) {
      if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(finding?.version ?? "")) throw new Error("Invalid advisory package version")
      const row = { scope, id: advisory.github_advisory_id, package: advisory.module_name,
        version: finding.version, severity: advisory.severity, ...(Array.isArray(advisory.cves) ? { aliases: [...new Set(advisory.cves)].sort() } : {}), paths: paths(finding.paths) }
      if (seen.has(identity(row))) throw new Error("Duplicate advisory inventory finding")
      seen.add(identity(row)); rows.push(row)
    }
  }
  if (severities.some((severity) => audit.metadata.vulnerabilities[severity] !== counts[severity])) {
    throw new Error("Incomplete audit response: severity totals do not match advisories")
  }
  return rows.sort((a, b) => identity(a).localeCompare(identity(b)))
}

/** Validate fresh source evidence, then delegate the risk decision. */
export function validateDependencyReview({ record, graphHash, configurationHash, audits, facts, now = Date.now(), release = false }) {
  if (!Number.isFinite(now) || ![graphHash, configurationHash].every(value => hashPattern.test(value ?? "")) || !text(record?.reviewOwner) || !Array.isArray(facts) || !facts.length || !Array.isArray(record.publisherFacts)) throw new Error("Complete source evidence and reviewed policy are required")
  const current = new Map()
  for (const fact of facts) {
    if (!text(fact?.id) || current.has(fact.id) || !/^https:\/\//.test(fact.url ?? "") || canonicalHash(fact.facts) !== fact.sha256) throw new Error("Publisher evidence is malformed or altered")
    current.set(fact.id, fact)
  }
  for (const descriptor of record.publisherFacts) {
    const fact = current.get(descriptor.id)
    if (!fact || fact.url !== descriptor.url || !["pin", "advisory", "monitor"].includes(descriptor.role) || (descriptor.role !== "monitor" && canonicalHash(securityFacts(fact.facts)) !== descriptor.securityHash)) throw new Error("Selected publisher or advisory semantics changed; review required")
  }
  if (current.size !== record.publisherFacts.length) throw new Error("Unreviewed publisher evidence present")
  const reviewed = reviewedDispositions(record, ["full", "production"], new Set(current.keys()))
  const inventory = [normalizeAudit(audits?.full, "full"), normalizeAudit(audits?.production, "production")].flat()
  assertReviewedFindings(inventory, reviewed)
  const items = reviewedRiskItems(inventory, reviewed, { facts, binding: finding => ({ scope: finding.scope, platform: "source", fingerprint: canonicalHash({ graphHash, configurationHash }) }) })
  const decision = evaluateReleaseRisk({ items, now })
  if (release && decision.releaseBlocked) throw new Error("Release blocked by source risk: " + decision.blockers.map(item => item.id).join(", "))
  return { reviewedFindings: inventory.length, ...decision }
}
