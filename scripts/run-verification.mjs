import { access, readFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import { indentation, stripYamlComment } from "./workflow-path-parser.mjs"

const repoRoot = resolve(new URL("..", import.meta.url).pathname)
const matrixPath = resolve(repoRoot, "docs/verification-matrix.json")
const matrix = JSON.parse(await readFile(matrixPath, "utf8"))
const rootPackage = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"))
const ciSource = await readFile(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8")
const requestedProfile = process.argv[2]

function fail(message) {
  throw new Error("Verification matrix invalid: " + message)
}

async function fileExists(file) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function workflowJobBlock(source, job) {
  const lines = source.split("\n")
  const jobPattern = new RegExp(`^  ${escapeRegExp(job)}:\\s*$`)
  const start = lines.findIndex((line) => jobPattern.test(line))

  if (start === -1) fail(`CI job ${job} is not present in .github/workflows/ci.yml`)

  const block = [lines[start]]
  for (const line of lines.slice(start + 1)) {
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(line)) break
    block.push(line)
  }
  return block.join("\n")
}

function isBlockScalar(value) {
  return /^[|>](?:[+-]|\d[+-]?|[+-]\d)?$/.test(value)
}

function workflowRunCommands(source, job) {
  const lines = workflowJobBlock(source, job).split("\n")
  const commands = []

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)(?:-\s+)?run:\s*(.*)$/)
    if (!match) continue

    const value = stripYamlComment(match[2].trim())
    if (!isBlockScalar(value)) {
      if (value) commands.push(value)
      continue
    }

    const runIndent = match[1].length
    for (let next = index + 1; next < lines.length; next += 1) {
      const line = lines[next]
      const content = stripYamlComment(line.trim())
      if (!content) continue
      if (indentation(line) <= runIndent) {
        index = next - 1
        break
      }
      commands.push(content)
      index = next
    }
  }

  return commands
}

function shellTokens(command) {
  return command.match(/\S+/g) ?? []
}

const manifestCache = new Map([[repoRoot, rootPackage]])

async function packageManifest(packageDir) {
  if (manifestCache.has(packageDir)) return manifestCache.get(packageDir)
  const manifestPath = resolve(packageDir, "package.json")
  if (!(await fileExists(manifestPath))) fail(`package manifest is missing at ${manifestPath}`)
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  manifestCache.set(packageDir, manifest)
  return manifest
}

async function pnpmScriptKey(run) {
  if (run[0] !== "pnpm") return null

  let index = 1
  let packageDir = repoRoot
  while (index < run.length) {
    if (run[index] === "--dir" || run[index] === "-C") {
      if (!run[index + 1]) return null
      packageDir = resolve(repoRoot, run[index + 1])
      index += 2
      continue
    }
    if (run[index] === "run") {
      index += 1
      continue
    }
    break
  }

  const scriptName = run[index]
  if (!scriptName || scriptName.startsWith("-") || ["exec", "install", "update"].includes(scriptName)) {
    return null
  }

  const manifest = await packageManifest(packageDir)
  if (!manifest.scripts || !(scriptName in manifest.scripts)) return null
  return `${packageDir}:${scriptName}`
}

async function assertCommandAuthority(check) {
  const [executable, ...args] = check.run

  if (executable === "pnpm") {
    if (!(await pnpmScriptKey(check.run))) fail(`${check.id}: ${check.command} does not resolve to a package script`)
  } else {
    const scriptFile = args.find((argument) => /\.(?:c?m?js|ts)$/.test(argument))
    if (!scriptFile || !(await fileExists(resolve(repoRoot, scriptFile)))) {
      fail(`${check.id}: Node command target is missing: ${scriptFile ?? "<none>"}`)
    }
  }

  const ciCommands = workflowRunCommands(ciSource, check.ciJob)
  if (executable === "pnpm") {
    const matrixKey = await pnpmScriptKey(check.run)
    const ciKeys = await Promise.all(ciCommands.map((command) => pnpmScriptKey(shellTokens(command))))
    if (!ciKeys.includes(matrixKey)) {
      fail(`${check.id}: ${check.command} is not executed by a run field in CI job ${check.ciJob}`)
    }
  } else if (!ciCommands.includes(check.command)) {
    fail(`${check.id}: ${check.command} is not executed by a run field in CI job ${check.ciJob}`)
  }
}

function workflowJobNames(source) {
  const jobsStart = source.indexOf("jobs:")
  if (jobsStart === -1) fail("CI workflow has no jobs section")
  const jobsLineEnd = source.indexOf("\n", jobsStart)
  const names = []
  for (const line of source.slice(jobsLineEnd + 1).split("\n")) {
    if (!line.trim()) continue
    if (indentation(line) === 0) break
    const match = line.match(/^  ([A-Za-z0-9_-]+):\s*$/)
    if (match) names.push(match[1])
  }
  return names
}

async function assertCiMatrixCoverage(checks) {
  const matrixScriptKeys = new Set()
  for (const check of checks.values()) {
    const key = await pnpmScriptKey(check.run)
    if (key) matrixScriptKeys.add(key)
  }

  for (const job of workflowJobNames(ciSource)) {
    for (const command of workflowRunCommands(ciSource, job)) {
      const key = await pnpmScriptKey(shellTokens(command))
      if (key && !matrixScriptKeys.has(key)) {
        fail(`${job}: CI script ${command} is missing from docs/verification-matrix.json`)
      }
    }
  }
}

async function validateMatrix() {
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
    await assertCommandAuthority(check)
    checks.set(check.id, check)
  }

  for (const [profile, ids] of Object.entries(matrix.profiles)) {
    if (!Array.isArray(ids) || ids.length === 0) fail(profile + " profile is empty")
    for (const id of ids) if (!checks.has(id)) fail(profile + " references unknown check " + id)
  }

  const profileIds = new Set(Object.values(matrix.profiles).flat())
  for (const id of checks.keys()) if (!profileIds.has(id)) fail(id + " is not included in any profile")

  await assertCiMatrixCoverage(checks)

  return checks
}

const checks = await validateMatrix()

if (requestedProfile === "--check") {
  console.log(
    "Verification matrix OK: commands and CI ownership verified; " +
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
