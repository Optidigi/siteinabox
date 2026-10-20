import { execFileSync } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

// Compare requested fields while accepting additive server metadata/defaults.
// Missing bypass visibility is never an empty list.
export function matchesProposal(actual, proposed) {
  if (Array.isArray(proposed)) return Array.isArray(actual) && actual.length === proposed.length &&
    proposed.every((value) => actual.some((entry) => matchesProposal(entry, value)))
  if (proposed && typeof proposed === "object") return actual && typeof actual === "object" &&
    Object.entries(proposed).every(([key, value]) => matchesProposal(actual[key], value))
  return actual === proposed
}

export function compareMainControls(inventory, proposal) {
  if (inventory.status !== "readable") return { status: "unknown", reason: "Ruleset inventory is unreadable" }
  const candidates = inventory.value.filter((entry) => entry.name === proposal.name)
  if (!candidates.length) return { status: "missing", reason: "Proposed main ruleset is not installed; inspect other effective rules separately" }
  if (candidates.length !== 1) return { status: "differs", reason: "Ambiguous ruleset ownership" }
  const entry = candidates[0]
  if (entry.detail.status !== "readable" || !Array.isArray(entry.detail.value.bypass_actors)) {
    return { status: "unknown", reason: "Ruleset detail or bypass list is unreadable" }
  }
  return { status: matchesProposal(entry.detail.value, proposal) ? "matching_proposal" : "differs", id: entry.id,
    limitation: "Readback comparison is not installation authorization or enforcement proof" }
}

export async function inspectDeliveryControls() {
  const repository = process.env.GITHUB_REPOSITORY
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "")) throw new Error("GITHUB_REPOSITORY is required for read-only inspection")
  function read(path, paginated = false) {
    try {
      const value = JSON.parse(execFileSync("gh", ["api", ...(paginated ? ["--paginate", "--slurp"] : []),
        "repos/" + repository + path], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }))
      return { status: "readable", value: paginated ? value.flat() : value }
    } catch (error) {
      const httpStatus = Number(String(error.stderr).match(/HTTP (\d{3})/)?.[1]) || null
      return { status: httpStatus === 404 ? "missing_or_hidden" : "unreadable", httpStatus }
    }
  }
  const proposal = JSON.parse(await readFile(new URL("../ops/github/main-ruleset.json", import.meta.url), "utf8"))
  const inventory = read("/rulesets?includes_parents=true&per_page=100", true)
  if (inventory.status === "readable") {
    if (!Array.isArray(inventory.value) || inventory.value.some((entry) => !Number.isSafeInteger(entry.id))) {
      throw new Error("Malformed ruleset inventory")
    }
    inventory.value = inventory.value.map((entry) => ({ id: entry.id, name: entry.name,
      detail: read("/rulesets/" + entry.id + "?includes_parents=true") }))
  }
  const report = {
    repository, sourceSHA: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    inspectedAt: new Date().toISOString(),
    evidenceKind: "read-only token capability diagnostic; not installation, bypass absence, approval or enforcement proof",
    comparison: compareMainControls(inventory, proposal), rulesets: inventory,
    effectiveMainRules: read("/rules/branches/main?per_page=100", true),
    legacyMainProtection: read("/branches/main/protection"),
    actions: read("/actions/permissions"), selectedActions: read("/actions/permissions/selected-actions"),
    publicationEnvironment: read("/environments/ghcr-publish"),
    publicationBranches: read("/environments/ghcr-publish/deployment-branch-policies?per_page=100", true),
  }
  await mkdir("artifacts", { recursive: true })
  await writeFile("artifacts/delivery-control-readback.json", JSON.stringify(report, null, 2) + "\n")
  console.log("Delivery control diagnostic: " + report.comparison.status + "; missing/hidden controls remain unproven")
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await inspectDeliveryControls()
