#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** @typedef {{ file: string, line: number, column: number, kind: string, text: string }} Violation */

/**
 * Violation kinds enforced by the type-safety gate:
 * - as-any: `as any` casts
 * - annotated-any: `: any` type annotations
 * - any-array: `any[]` array shorthand
 * - array-any: `Array<any>` generic array form
 * - record-any: `Record<…, any>` object maps
 * - generic-any: type arguments containing bare `any` (e.g. `Promise<any>`, `Foo<any>`)
 * - generic-default-any: generic/type defaults to `any` (e.g. `type T<X = any>` or `type Alias = any`)
 * - z-any: `z.any()` schema escapes
 * - ts-nocheck / ts-ignore: TypeScript directive comments that bypass checking
 * - ts-expect-error: not scanned; allowed only per docs/engineering.md (review)
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
]

const DIRECTIVE_PATTERNS = [
  { kind: "ts-nocheck", regex: /@ts-nocheck\b/g },
  { kind: "ts-ignore", regex: /@ts-ignore\b/g },
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
    .filter((file) => {
      const extension = file.slice(file.lastIndexOf("."))
      return extension === ".ts" || extension === ".tsx" || extension === ".mts"
    })
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

/**
 * @param {{
 *   root?: string
 *   current?: Violation[]
 * }} [options]
 */
export async function runTypeSafetyCheck(options = {}) {
  const root = options.root ?? ROOT
  const current = options.current ?? (await collectViolations(root))

  return {
    current,
    ok: current.length === 0,
  }
}

function formatViolation(violation) {
  return `${violation.file}:${violation.line}:${violation.column} [${violation.kind}] ${violation.text}`
}

function printSummary(result) {
  const counts = summarizeByKind(result.current)
  const parts = VIOLATION_KINDS.filter((kind) => counts[kind] > 0).map((kind) => `${kind}=${counts[kind]}`)
  console.log(`Tracked violations: ${result.current.length}${parts.length > 0 ? ` (${parts.join(", ")})` : ""}`)
}

async function main() {
  const result = await runTypeSafetyCheck()
  printSummary(result)

  if (result.ok) {
    console.log("✓ type-safety:check passed — zero explicit-any violations")
    return
  }

  console.error(
    [
      `✗ type-safety:check failed — ${result.current.length} violation(s) found`,
      "First-party TypeScript must not use explicit `any`, `z.any()`, `@ts-nocheck`, or `@ts-ignore`.",
      ...result.current.slice(0, 25).map((violation) => `  ${formatViolation(violation)}`),
      ...(result.current.length > 25 ? [`  ... and ${result.current.length - 25} more`] : []),
    ].join("\n"),
  )
  process.exit(1)
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
