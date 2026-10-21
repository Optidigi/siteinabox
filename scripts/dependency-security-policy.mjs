const severities = ["info", "low", "moderate", "high", "critical"]
const hashPattern = /^[a-f0-9]{64}$/
const reviewWindowMs = 7 * 24 * 60 * 60 * 1000
const text = (value) => typeof value === "string" && value.trim().length > 0
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const identity = (row) => JSON.stringify([row.scope, row.id, row.package, row.version])

function paths(value) {
  if (!Array.isArray(value) || !value.length || value.some((entry) => !text(entry))) {
    throw new Error("Advisory paths are missing or malformed")
  }
  return [...new Set(value)].sort()
}

export function reviewedBlockers(rows, scopes, facts, native = false) {
  if (!Array.isArray(rows)) throw new Error("Advisory review missing")
  const reviews = new Map()
  for (const row of rows) {
    if (!row || !scopes.includes(row.scope) || !text(row.id) || !text(row.package) || !text(row.version) ||
        !(native ? [...severities, "unknown"] : severities).includes(row.severity) || reviews.has(identity(row)) ||
        !(native ? ["confirmed_affected_deployment", "affected_package_condition_unproven", "analysis_gap"] :
          ["confirmed_affected_deployment", "affected_package_condition_unproven"]).includes(row.classification) ||
        row.releaseBlocked !== true || !text(row.reason) || !text(row.reviewOwner) || !text(row.recheck) ||
        !Array.isArray(row.sources) || !row.sources.length || row.sources.some((id) => !facts.has(id))) {
      throw new Error("Invalid or unknown advisory disposition; unresolved risk cannot be accepted automatically")
    }
    paths(row.paths); reviews.set(identity(row), row)
  }
  return reviews
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
        version: finding.version, severity: advisory.severity, paths: paths(finding.paths) }
      if (seen.has(identity(row))) throw new Error("Duplicate advisory inventory finding")
      seen.add(identity(row)); rows.push(row)
    }
  }
  if (severities.some((severity) => audit.metadata.vulnerabilities[severity] !== counts[severity])) {
    throw new Error("Incomplete audit response: severity totals do not match advisories")
  }
  return rows.sort((a, b) => identity(a).localeCompare(identity(b)))
}

/** Inventory qualification is deliberately separate from release clearance. */
export function validateDependencyReview({ record, graphHash, configurationHash, audits, facts, now = Date.now(), release = false }) {
  const reviewedAt = Date.parse(record?.reviewedAt)
  const expiresAt = Date.parse(record?.expiresAt)
  if (!record || record.schemaVersion !== 2 || !Number.isFinite(now) || !Number.isFinite(reviewedAt) ||
      !Number.isFinite(expiresAt) || reviewedAt > now || expiresAt <= now || expiresAt <= reviewedAt ||
      expiresAt - reviewedAt > reviewWindowMs || !text(record.reviewOwner)) {
    throw new Error("Dependency review is missing, invalid, future or expired; collect and review current evidence")
  }
  if (![graphHash, configurationHash, record.graphHash, record.configurationHash].every((value) => hashPattern.test(value ?? "")) ||
      graphHash !== record.graphHash || configurationHash !== record.configurationHash) {
    throw new Error("Dependency graph or configuration changed; dispositions require fresh review")
  }
  if (!Array.isArray(facts) || !facts.length || !Array.isArray(record.publisherFacts) || !record.publisherFacts.length) {
    throw new Error("Publisher evidence unavailable")
  }
  const currentFacts = new Map()
  for (const fact of facts) {
    if (!text(fact?.id) || currentFacts.has(fact.id) || !/^https:\/\//.test(fact.url ?? "") || !hashPattern.test(fact.sha256 ?? "")) {
      throw new Error("Publisher evidence unavailable or malformed")
    }
    currentFacts.set(fact.id, fact)
  }
  const reviewedFacts = new Set()
  for (const fact of record.publisherFacts) {
    const current = currentFacts.get(fact?.id)
    if (!current || reviewedFacts.has(fact.id) || current.url !== fact.url || current.sha256 !== fact.sha256) {
      throw new Error("Publisher evidence changed or unavailable; review current primary facts")
    }
    reviewedFacts.add(fact.id)
  }
  if (currentFacts.size !== reviewedFacts.size) throw new Error("Publisher evidence changed; unreviewed facts present")
  let blockedDeferrals = 0
  const deferrals = new Set()
  for (const entry of record.deferrals ?? []) {
    if (!text(entry?.id) || deferrals.has(entry.id) || !text(entry.reason) || !text(entry.affectedSurface) || !text(entry.reviewOwner) ||
        !text(entry.recheck) || !Number.isFinite(Date.parse(entry.expiresAt)) || Date.parse(entry.expiresAt) > expiresAt || Date.parse(entry.expiresAt) <= now ||
        !["supported_release", "unresolved_blocker"].includes(entry.classification) || typeof entry.releaseBlocked !== "boolean" ||
        (entry.classification === "unresolved_blocker" && !entry.releaseBlocked) || !entry.sources?.length || entry.sources.some((id) => !reviewedFacts.has(id))) {
      throw new Error("Dependency deferral is missing, unknown or expired; review the owning compatibility surface")
    }
    deferrals.add(entry.id)
    if (entry.releaseBlocked) blockedDeferrals += 1
  }
  const reviews = reviewedBlockers(record.advisories, ["full", "production"], reviewedFacts)
  const inventory = [normalizeAudit(audits?.full, "full"), normalizeAudit(audits?.production, "production")].flat()
  assertReviewedFindings(inventory, reviews)
  if (release && (inventory.length || blockedDeferrals)) throw new Error("Release blocked by unresolved dependency findings/deferrals: " + inventory.length + "/" + blockedDeferrals)
  return { reviewedFindings: inventory.length, blockedDeferrals, releaseBlocked: inventory.length > 0 || blockedDeferrals > 0, expiresAt: record.expiresAt }
}
