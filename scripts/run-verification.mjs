import { readFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

const repoRoot = resolve(new URL("..", import.meta.url).pathname)
const matrixPath = resolve(repoRoot, "docs/verification-matrix.json")
const matrix = JSON.parse(await readFile(matrixPath, "utf8"))
const requestedProfile = process.argv[2]

function fail(message) {
  throw new Error("Verification matrix invalid: " + message)
}

function validateMatrix() {
  if (matrix.version !== 1) fail("unsupported version")
  if (!matrix.profiles || typeof matrix.profiles !== "object") fail("profiles are missing")
  if (!Array.isArray(matrix.checks)) fail("checks must be an array")

  const checks = new Map()
  for (const check of matrix.checks) {
    if (!check.id || checks.has(check.id)) fail("duplicate or missing check id: " + (check.id ?? "<empty>"))
    if (!check.owner || !check.ciJob || !check.command || !Array.isArray(check.run)) {
      fail(check.id + " is missing owner, ciJob, command, or run")
    }
    if (check.command !== check.run.join(" ")) fail(check.id + " command does not match run")
    if (!Array.isArray(check.prerequisites) || check.prerequisites.length === 0) {
      fail(check.id + " must document prerequisites")
    }
    if (!["low", "medium", "high"].includes(check.risk)) fail(check.id + " has an invalid risk")
    if (!check.run.length || !["node", "pnpm"].includes(check.run[0])) {
      fail(check.id + " must run through node or pnpm")
    }
    checks.set(check.id, check)
  }

  for (const [profile, ids] of Object.entries(matrix.profiles)) {
    if (!Array.isArray(ids) || ids.length === 0) fail(profile + " profile is empty")
    for (const id of ids) if (!checks.has(id)) fail(profile + " references unknown check " + id)
  }

  return checks
}

const checks = validateMatrix()

if (requestedProfile === "--check") {
  console.log(
    "Verification matrix OK: " +
      checks.size +
      " checks, " +
      Object.keys(matrix.profiles).length +
      " profiles.",
  )
  process.exit(0)
}

if (!requestedProfile || !matrix.profiles[requestedProfile]) {
  throw new Error("Usage: node scripts/run-verification.mjs <" + Object.keys(matrix.profiles).join("|") + ">")
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
for (const id of matrix.profiles[requestedProfile]) {
  const check = checks.get(id)
  console.log("\n[verification:" + requestedProfile + "] " + check.id + ": " + check.command)
  const env = { ...process.env, ...(check.env ?? {}) }
  const [command, ...args] = check.run
  const result = spawnSync(command === "pnpm" ? pnpm : command, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log("\nVerification profile passed: " + requestedProfile)
