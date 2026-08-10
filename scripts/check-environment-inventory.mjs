import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const inventoryPath = path.join(root, "docs/environment-inventory.json")
const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"))
const appNames = Object.keys(inventory.apps).sort()
const sourceExtensions = /\.(?:astro|cjs|js|jsx|mjs|ts|tsx)$/
const envPatterns = [
  /\bprocess\.env(?:\.|\?\.)([A-Z][A-Z0-9_]*)\b/g,
  /\bprocess\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /\bimport\.meta\.env(?:\.|\?\.)([A-Z][A-Z0-9_]*)\b/g,
  /\bimport\.meta\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
]

function trackedSourceFiles(app) {
  const output = execFileSync("git", ["ls-files", "--", `apps/${app}`], {
    cwd: root,
    encoding: "utf8",
  })

  return output
    .split("\n")
    .filter((file) => file && sourceExtensions.test(file))
}

function readNames(files) {
  const names = new Set()
  for (const file of files) {
    const source = readFileSync(path.join(root, file), "utf8")
    for (const pattern of envPatterns) {
      for (const match of source.matchAll(pattern)) names.add(match[1])
    }
  }
  return names
}

function difference(left, right) {
  return [...left].filter((name) => !right.has(name)).sort()
}

const errors = []
let totalNames = 0

for (const app of appNames) {
  const expected = new Set(inventory.apps[app].names)
  const observed = readNames(trackedSourceFiles(app))
  const missing = difference(observed, expected)
  const stale = difference(expected, observed)

  if (missing.length > 0) errors.push(`${app}: source names missing from inventory: ${missing.join(", ")}`)
  if (stale.length > 0) errors.push(`${app}: inventory names no longer read by source: ${stale.join(", ")}`)
  if (inventory.apps[app].names.some((name, index, names) => names.indexOf(name) !== index)) {
    errors.push(`${app}: inventory contains duplicate names`)
  }
  totalNames += expected.size
}

if (inventory.classificationStatus !== "owner-review-required") {
  errors.push("top-level classificationStatus must remain owner-review-required until owners classify each app contract")
}

if (errors.length > 0) {
  console.error(errors.join("\n"))
  process.exitCode = 1
} else {
  console.log(`Environment inventory OK: ${appNames.length} apps, ${totalNames} source-read names; owner classification remains explicitly pending.`)
}
