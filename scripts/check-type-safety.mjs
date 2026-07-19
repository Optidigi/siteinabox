#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const BASELINE_PATH = resolve(ROOT, "scripts/type-safety-baseline.json")

/** @typedef {{ file: string, line: number, column: number, kind: string, text: string }} Violation */

/**
 * Violation kinds enforced by the type-safety ratchet:
 * - as-any: `as any` casts
 * - annotated-any: `: any` type annotations
 * - any-array: `any[]` array shorthand
 * - array-any: `Array<any>` generic array form
 * - record-any: `Record<…, any>` object maps
 * - generic-any: type arguments containing bare `any` (e.g. `Promise<any>`, `Foo<any>`)
 * - generic-default-any: generic/type defaults to `any` (e.g. `type T<X = any>` or `type Alias = any`)
 * - z-any: `z.any()` schema escapes
 * - ts-nocheck / ts-ignore / ts-expect-error: TypeScript directive comments
 */
export const VIOLATION_KINDS = [
  "as-any",
  "annotated-any",
  "any-array",
  "array-any",
  "record-any",
  "generic-any",
  "generic-default-any",
  "z-any",
  "ts-nocheck",
  "ts-ignore",
  "ts-expect-error",
]

const DIRECTIVE_PATTERNS = [
  { kind: "ts-nocheck", regex: /@ts-nocheck\b/g },
  { kind: "ts-ignore", regex: /@ts-ignore\b/g },
  { kind: "ts-expect-error", regex: /@ts-expect-error\b/g },
]

const CODE_PATTERNS = [
  { kind: "z-any", regex: /\bz\.any\s*\(/g },
  { kind: "as-any", regex: /\bas\s+any\b/g },
  { kind: "any-array", regex: /\bany\[\]/g },
  { kind: "record-any", regex: /\bRecord<[^>]+,\s*any\s*>/g },
  { kind: "array-any", regex: /\bArray\s*<\s*any\s*>/g },
  { kind: "generic-any", regex: /<\s*any\s*>/g },
  { kind: "generic-default-any", regex: /=\s*any\b/g },
  { kind: "annotated-any", regex: /:\s*any\b/g },
]

const PATTERNS = [...DIRECTIVE_PATTERNS, ...CODE_PATTERNS]

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts"])

/**
 * @param {string} line
 */
export function stripLineComment(line) {
  let inSingle = false
  let inDouble = false
  let inTemplate = false
  let escaped = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === "\\") {
      escaped = true
      continue
    }
    if (!inDouble && !inTemplate && char === "'") {
      inSingle = !inSingle
      continue
    }
    if (!inSingle && !inTemplate && char === '"') {
      inDouble = !inDouble
      continue
    }
    if (!inSingle && !inDouble && char === "`") {
      inTemplate = !inTemplate
      continue
    }
    if (!inSingle && !inDouble && !inTemplate && char === "/" && line[index + 1] === "/") {
      return line.slice(0, index)
    }
  }

  return line
}

/**
 * @param {string} source
 * @param {string} file
 * @returns {Violation[]}
 */
export function scanSource(source, file) {
  /** @type {Violation[]} */
  const violations = []
  const lines = source.split(/\r?\n/)

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex]
    const searchable = stripLineComment(rawLine)

    for (const patterns of [DIRECTIVE_PATTERNS, CODE_PATTERNS]) {
      const sourceLine = patterns === DIRECTIVE_PATTERNS ? rawLine : searchable
      for (const { kind, regex } of patterns) {
        for (const match of sourceLine.matchAll(regex)) {
          if (kind === "annotated-any" && /\bas\s+any\b/.test(sourceLine)) {
            const asAnyIndex = sourceLine.search(/\bas\s+any\b/)
            if (asAnyIndex >= 0 && asAnyIndex < match.index) {
              continue
            }
          }

          violations.push({
            file,
            line: lineIndex + 1,
            column: match.index + 1,
            kind,
            text: match[0],
          })
        }
      }
    }
  }

  return violations
}

/**
 * @param {string} [root]
 * @returns {string[]}
 */
export function listTrackedSourceFiles(root = ROOT) {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "*.ts", "*.tsx", "*.mts"],
    { cwd: root, encoding: "utf8" },
  )

  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((file) => SOURCE_EXTENSIONS.has(file.slice(file.lastIndexOf("."))))
    .sort()
}

/**
 * @param {string} [root]
 * @returns {Promise<Violation[]>}
 */
export async function collectViolations(root = ROOT) {
  const files = listTrackedSourceFiles(root)
  /** @type {Violation[]} */
  const violations = []

  for (const file of files) {
    let source
    try {
      source = await readFile(resolve(root, file), "utf8")
    } catch (error) {
      if (error.code === "ENOENT") continue
      throw error
    }
    violations.push(...scanSource(source, file))
  }

  return sortViolations(violations)
}

/**
 * @param {Violation[]} violations
 */
export function sortViolations(violations) {
  return [...violations].sort((left, right) => {
    if (left.file !== right.file) return left.file.localeCompare(right.file)
    if (left.line !== right.line) return left.line - right.line
    if (left.column !== right.column) return left.column - right.column
    if (left.kind !== right.kind) return left.kind.localeCompare(right.kind)
    return left.text.localeCompare(right.text)
  })
}

/**
 * @param {Violation} violation
 */
export function violationKey(violation) {
  return `${violation.file}:${violation.line}:${violation.column}:${violation.kind}`
}

/**
 * @param {Violation[]} violations
 */
export function summarizeByKind(violations) {
  /** @type {Record<string, number>} */
  const counts = {}
  for (const kind of VIOLATION_KINDS) counts[kind] = 0
  for (const violation of violations) {
    counts[violation.kind] = (counts[violation.kind] ?? 0) + 1
  }
  return counts
}

function resolveDiffBase() {
  return process.env.TYPE_SAFETY_DIFF_BASE?.trim() || ""
}

/**
 * @param {string} root
 * @param {string} baseRef
 */
export function assertDiffBaseResolvable(root, baseRef = resolveDiffBase()) {
  if (!baseRef) return

  try {
    execFileSync("git", ["rev-parse", "--verify", `${baseRef}^{commit}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch {
    throw new Error(
      [
        `TYPE_SAFETY_DIFF_BASE is set to ${JSON.stringify(baseRef)} but git cannot resolve that commit.`,
        "Touched-file enforcement requires the diff base to be available.",
        "In CI, use a full checkout (for example actions/checkout fetch-depth: 0) or fetch the base ref explicitly.",
      ].join(" "),
    )
  }
}

/**
 * @param {string} root
 * @param {string[]} gitArgs
 */
function runGitDiffNames(root, gitArgs) {
  try {
    return execFileSync("git", gitArgs, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    const baseRef = resolveDiffBase()
    if (baseRef && gitArgs.includes(baseRef)) {
      throw new Error(
        [
          `git diff against TYPE_SAFETY_DIFF_BASE ${JSON.stringify(baseRef)} failed.`,
          error.stderr?.toString().trim() || error.message,
          "Ensure the base commit is fetched before running pnpm type-safety:check.",
        ].join(" "),
      )
    }
    throw error
  }
}

/**
 * @param {string} [root]
 * @param {string} [baseRef]
 */
export function listTouchedSourceFiles(root = ROOT, baseRef = resolveDiffBase()) {
  /** @type {Set<string>} */
  const files = new Set()

  const addFromOutput = (output) => {
    for (const file of output.trim().split("\n").filter(Boolean)) {
      const extension = file.slice(file.lastIndexOf("."))
      if (SOURCE_EXTENSIONS.has(extension)) files.add(file)
    }
  }

  if (baseRef) {
    assertDiffBaseResolvable(root, baseRef)
    addFromOutput(
      runGitDiffNames(root, ["diff", "--name-only", "--diff-filter=ACMRTUXB", baseRef]),
    )
  }

  addFromOutput(
    runGitDiffNames(root, ["diff", "--name-only", "--cached", "--diff-filter=ACMRTUXB"]),
  )

  addFromOutput(
    runGitDiffNames(root, ["diff", "--name-only", "--diff-filter=ACMRTUXB"]),
  )

  return [...files].sort()
}

/**
 * @param {Violation[]} current
 * @param {Violation[]} baseline
 */
export function compareToBaseline(current, baseline) {
  const currentKeys = new Set(current.map(violationKey))
  const baselineKeys = new Set(baseline.map(violationKey))

  const added = current.filter((violation) => !baselineKeys.has(violationKey(violation)))
  const removed = baseline.filter((violation) => !currentKeys.has(violationKey(violation)))

  return { added, removed }
}

/**
 * @param {Violation[]} violations
 * @param {string[]} touchedFiles
 */
export function findTouchedFileViolations(violations, touchedFiles) {
  if (touchedFiles.length === 0) return []
  const touched = new Set(touchedFiles)
  return violations.filter((violation) => touched.has(violation.file))
}

/**
 * @param {string} [root]
 */
export async function loadBaseline(root = ROOT) {
  const raw = await readFile(resolve(root, "scripts/type-safety-baseline.json"), "utf8")
  const parsed = JSON.parse(raw)
  return sortViolations(parsed.violations)
}

/**
 * @param {Violation[]} violations
 * @param {string} [root]
 */
export async function writeBaseline(violations, root = ROOT) {
  const payload = {
    version: 1,
    violations: sortViolations(violations),
  }
  await writeFile(
    resolve(root, "scripts/type-safety-baseline.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  )
}

/**
 * @param {{
 *   root?: string
 *   baseline?: Violation[]
 *   touchedFiles?: string[]
 *   current?: Violation[]
 * }} [options]
 */
export async function runTypeSafetyCheck(options = {}) {
  const root = options.root ?? ROOT
  const current = options.current ?? (await collectViolations(root))
  const baseline = options.baseline ?? (await loadBaseline(root))
  const touchedFiles = options.touchedFiles ?? listTouchedSourceFiles(root)
  const { added, removed } = compareToBaseline(current, baseline)
  const touchedViolations = findTouchedFileViolations(current, touchedFiles)

  return {
    current,
    baseline,
    touchedFiles,
    added,
    removed,
    touchedViolations,
    ok: added.length === 0 && removed.length === 0 && touchedViolations.length === 0,
  }
}

function formatViolation(violation) {
  return `${violation.file}:${violation.line}:${violation.column} [${violation.kind}] ${violation.text}`
}

function printSummary(result) {
  const counts = summarizeByKind(result.current)
  const parts = VIOLATION_KINDS.filter((kind) => counts[kind] > 0).map((kind) => `${kind}=${counts[kind]}`)
  console.log(`Tracked violations: ${result.current.length} (${parts.join(", ")})`)
  if (result.touchedFiles.length > 0) {
    console.log(`Touched source files: ${result.touchedFiles.length}`)
  }
}

async function main() {
  const args = new Set(process.argv.slice(2))

  if (args.has("--write-baseline")) {
    const violations = await collectViolations()
    await writeBaseline(violations)
    const counts = summarizeByKind(violations)
    console.log(`Wrote ${violations.length} baseline violations to scripts/type-safety-baseline.json`)
    for (const kind of VIOLATION_KINDS) {
      if (counts[kind] > 0) console.log(`  ${kind}: ${counts[kind]}`)
    }
    return
  }

  const result = await runTypeSafetyCheck()
  printSummary(result)

  if (result.ok) {
    console.log("✓ type-safety:check passed — baseline matches and touched files are clean")
    return
  }

  const failures = []

  if (result.added.length > 0) {
    failures.push(
      [
        `New type-safety violations (${result.added.length}) not present in scripts/type-safety-baseline.json:`,
        ...result.added.slice(0, 25).map((violation) => `  ${formatViolation(violation)}`),
        ...(result.added.length > 25 ? [`  ... and ${result.added.length - 25} more`] : []),
      ].join("\n"),
    )
  }

  if (result.removed.length > 0) {
    failures.push(
      [
        `Resolved violations (${result.removed.length}) must shrink scripts/type-safety-baseline.json:`,
        "Run `pnpm type-safety:baseline` after intentional cleanup.",
        ...result.removed.slice(0, 25).map((violation) => `  ${formatViolation(violation)}`),
        ...(result.removed.length > 25 ? [`  ... and ${result.removed.length - 25} more`] : []),
      ].join("\n"),
    )
  }

  if (result.touchedViolations.length > 0) {
    failures.push(
      [
        `Touched source files must be free of type-safety violations (${result.touchedViolations.length} found):`,
        ...result.touchedViolations.slice(0, 25).map((violation) => `  ${formatViolation(violation)}`),
        ...(result.touchedViolations.length > 25 ? [`  ... and ${result.touchedViolations.length - 25} more`] : []),
      ].join("\n"),
    )
  }

  console.error(`✗ type-safety:check failed — ${failures.length} issue(s)\n`)
  console.error(failures.join("\n\n"))
  process.exit(1)
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
