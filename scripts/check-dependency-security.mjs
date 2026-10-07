import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const args = process.argv.slice(2)
const release = args.includes("--release")
function option(name, fallback) {
  const index = args.indexOf(name)
  if (index < 0) return fallback
  if (!args[index + 1] || args[index + 1].startsWith("--"))
    throw new Error(`Missing ${name} value`)
  return args[index + 1]
}
function sortedPaths(paths) {
  if (
    !Array.isArray(paths) ||
    paths.length === 0 ||
    paths.some((path) => typeof path !== "string")
  ) {
    throw new Error("Advisory paths must be nonempty strings")
  }
  return [...new Set(paths)].sort()
}
function key(id, name, version) {
  return `${id}/${name}/${version}`
}

try {
  for (let i = 0; i < args.length; i++) {
    if (["--audit-file", "--policy-file"].includes(args[i])) {
      i++
      continue
    }
    if (args[i] !== "--release") throw new Error(`Unknown argument: ${args[i]}`)
  }
  const policy = JSON.parse(
    readFileSync(
      option(
        "--policy-file",
        fileURLToPath(
          new URL("../docs/dependency-security.json", import.meta.url),
        ),
      ),
      "utf8",
    ),
  )
  if (policy.schemaVersion !== 1 || !Array.isArray(policy.advisories))
    throw new Error("Invalid dependency security policy")
  const expiry = Date.parse(policy.expiresAt)
  if (!Number.isFinite(expiry) || Date.now() >= expiry)
    throw new Error(
      "Dependency advisory review expired; rerun inventory and review",
    )
  const auditFile = option("--audit-file")
  let audit
  if (auditFile) {
    audit = JSON.parse(readFileSync(auditFile, "utf8"))
  } else {
    const result = spawnSync("pnpm", ["audit", "--json"], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    })
    if (result.error || ![0, 1].includes(result.status))
      throw new Error(
        `Audit failed: ${result.error?.message || result.stderr || result.status}`,
      )
    audit = JSON.parse(result.stdout)
  }
  if (
    !audit.advisories ||
    typeof audit.advisories !== "object" ||
    Array.isArray(audit.advisories) ||
    !audit.metadata?.vulnerabilities
  ) {
    throw new Error("Invalid audit response; inventory unavailable")
  }
  const severityCounts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 }
  for (const advisory of Object.values(audit.advisories)) {
    if (!(advisory.severity in severityCounts))
      throw new Error("Invalid audit severity")
    severityCounts[advisory.severity]++
  }
  for (const [severity, count] of Object.entries(severityCounts)) {
    if (audit.metadata.vulnerabilities[severity] !== count)
      throw new Error(
        "Incomplete audit response; severity totals do not match advisories",
      )
  }
  const rows = new Map()
  for (const row of policy.advisories) {
    const rowKey = key(row.advisoryId, row.package, row.version)
    if (
      rows.has(rowKey) ||
      row.disposition !== "triaged" ||
      !["runtime", "build", "unknown"].includes(row.shippedReachability) ||
      typeof row.releaseBlocked !== "boolean" ||
      !row.reason ||
      !Array.isArray(row.sources) ||
      row.sources.length === 0
    ) {
      throw new Error(`Invalid or untriaged policy row: ${rowKey}`)
    }
    sortedPaths(row.paths)
    rows.set(rowKey, row)
  }
  const failures = []
  const seen = new Set()
  let count = 0
  for (const advisory of Object.values(audit.advisories)) {
    if (
      !advisory.github_advisory_id ||
      !advisory.module_name ||
      !Array.isArray(advisory.findings) ||
      advisory.findings.length === 0 ||
      !["info", "low", "moderate", "high", "critical"].includes(
        advisory.severity,
      )
    ) {
      throw new Error("Malformed audit advisory")
    }
    for (const finding of advisory.findings) {
      count++
      const rowKey = key(
        advisory.github_advisory_id,
        advisory.module_name,
        finding.version,
      )
      const row = rows.get(rowKey)
      const paths = sortedPaths(finding.paths)
      seen.add(rowKey)
      if (
        !row ||
        row.severity !== advisory.severity ||
        JSON.stringify(sortedPaths(row.paths)) !== JSON.stringify(paths)
      ) {
        failures.push(`New or changed advisory requires review: ${rowKey}`)
        continue
      }
      if (
        release &&
        (row.releaseBlocked ||
          (["high", "critical"].includes(advisory.severity) &&
            row.shippedReachability !== "build"))
      ) {
        failures.push(
          `Release blocked: ${rowKey} (${advisory.severity}, ${row.shippedReachability})`,
        )
      }
    }
  }
  for (const rowKey of rows.keys()) {
    if (!seen.has(rowKey))
      failures.push(`Stale advisory disposition requires review: ${rowKey}`)
  }
  if (failures.length) throw new Error(failures.join("\n"))
  console.log(
    `Dependency ${release ? "release" : "inventory"} gate passed: ${count} reviewed findings; review expires ${policy.expiresAt}`,
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
