import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import process from "node:process"

import { extractWorkflowPaths, usesRootDockerContext } from "./workflow-path-parser.mjs"

const root = process.cwd()
const workflowDir = path.join(root, ".github/workflows")
const matrixPath = path.join(root, "docs/workflow-path-matrix.json")
const matrix = JSON.parse(readFileSync(matrixPath, "utf8"))
const expectedWorkflows = Object.keys(matrix.workflows).sort()
const discoveredWorkflows = readdirSync(workflowDir)
  .filter((file) => /^build-.*-image\.yml$/.test(file))
  .sort()

function difference(left, right) {
  return left.filter((value) => !right.includes(value))
}

function workflowPaths(file) {
  const source = readFileSync(path.join(workflowDir, file), "utf8")
  return extractWorkflowPaths(source, file)
}

function pathBase(entry) {
  return entry.endsWith("/**") ? entry.slice(0, -3) : entry
}

const errors = []
const missingWorkflowEntries = difference(expectedWorkflows, discoveredWorkflows)
const untrackedWorkflowEntries = difference(discoveredWorkflows, expectedWorkflows)

if (missingWorkflowEntries.length > 0) errors.push(`matrix workflows missing from repository: ${missingWorkflowEntries.join(", ")}`)
if (untrackedWorkflowEntries.length > 0) errors.push(`image workflows missing from matrix: ${untrackedWorkflowEntries.join(", ")}`)

let invariantCount = 0
for (const workflow of expectedWorkflows) {
  const expectedPaths = matrix.workflows[workflow].requiredPaths
  const actualPaths = workflowPaths(workflow)
  const missingPaths = difference(expectedPaths, actualPaths)
  const duplicatePaths = actualPaths.filter((entry, index) => actualPaths.indexOf(entry) !== index)

  const source = readFileSync(path.join(workflowDir, workflow), "utf8")
  if (usesRootDockerContext(source)) {
    if (!expectedPaths.includes(".dockerignore")) {
      errors.push(`${workflow}: root Docker context requires .dockerignore in matrix`)
    }
    if (!actualPaths.includes(".dockerignore")) {
      errors.push(`${workflow}: root Docker context requires .dockerignore in workflow paths`)
    }
  }

  if (missingPaths.length > 0) errors.push(`${workflow}: required paths missing from workflow: ${missingPaths.join(", ")}`)
  if (duplicatePaths.length > 0) errors.push(`${workflow}: duplicate paths: ${[...new Set(duplicatePaths)].join(", ")}`)
  for (const entry of expectedPaths) {
    const base = path.join(root, pathBase(entry))
    if (!statSafe(base)) errors.push(`${workflow}: matrix path does not exist: ${entry}`)
  }
  invariantCount += expectedPaths.length
}

if (errors.length > 0) {
  console.error(errors.join("\n"))
  process.exitCode = 1
} else {
  console.log(`Workflow path matrix OK: ${expectedWorkflows.length} image workflows; ${invariantCount} required path invariants.`)
}

function statSafe(file) {
  try {
    statSync(file)
    return true
  } catch {
    return false
  }
}
