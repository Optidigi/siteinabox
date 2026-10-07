import { execFileSync } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"

const repository = process.env.GITHUB_REPOSITORY
if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "")) {
  throw new Error(
    "A GitHub repository is required for read-only control inspection",
  )
}
function api(path) {
  return JSON.parse(
    execFileSync("gh", ["api", "repos/" + repository + path], {
      encoding: "utf8",
      timeout: 30000,
    }),
  )
}
const listed = api("/rulesets?includes_parents=true&per_page=100")
if (!Array.isArray(listed) || listed.length === 100) {
  throw new Error("Ruleset inventory is malformed or incomplete")
}
const rulesets = listed.map((entry) => {
  if (!Number.isSafeInteger(entry.id))
    throw new Error("Invalid ruleset identity")
  const readback = api("/rulesets/" + entry.id)
  return {
    id: entry.id,
    name: readback.name,
    bypassListVisible: Array.isArray(readback.bypass_actors),
    readback,
  }
})
await mkdir("artifacts", { recursive: true })
await writeFile(
  "artifacts/delivery-control-readback.json",
  JSON.stringify(
    {
      repository,
      sourceSHA: process.env.GITHUB_SHA,
      inspectedAt: new Date().toISOString(),
      evidenceKind:
        "read-only token capability diagnostic; not installation or approval proof",
      rulesets,
    },
    null,
    2,
  ) + "\n",
)
for (const rule of rulesets) {
  console.log(
    `Ruleset ${rule.id}: bypass list ${rule.bypassListVisible ? "visible" : "unavailable to this token"}`,
  )
}
console.log(
  "Control inspection recorded; main installation and approvals remain separate gates",
)
