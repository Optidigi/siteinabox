#!/usr/bin/env node
// scripts/check-no-css.mjs
// Phase D7 lint gate — enforces zero-authored-CSS rules per FE-46.
// Runs in CI alongside typecheck.
//
// Rules:
//   R1: No .css files in src/ outside the approved style entry/contract files
//   R2: No hex/rgb/rgba/hsl/oklch literals in components/app/hooks
//   R3: No arbitrary color Tailwind values in className attributes

import { readdir, readFile } from "node:fs/promises"
import { join, relative, resolve } from "node:path"

const ROOT = process.cwd()
const SRC = join(ROOT, "src")
const PLATFORM_ROOT = resolve(ROOT, "../..")
const UI_PACKAGE_SRC = join(PLATFORM_ROOT, "packages/ui/src")

const ALLOWED_CSS_FILES = new Set([
  "src/styles/globals.css",
  "src/styles/shadcn.css",
  "src/styles/siab.css",
  "packages/ui/src/styles/shadcn.css",
])

function displayPath(file) {
  return file.startsWith(ROOT) ? relative(ROOT, file) : relative(PLATFORM_ROOT, file)
}

// R2/R3 scope: check these top-level src/ subdirs for color literals.
const R2_DIRS = ["components", "app", "hooks"]
const R2_EXCLUDE_DIRS = []

// Lines containing this marker are exempt from R2/R3 checks.
// Use sparingly — only for genuinely non-CSS hex uses (e.g. <input type="color">
// fallback values, Zod validation message examples).
const IGNORE_MARKER = "lint:no-css:ignore"

const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g
const COLOR_FN_RE = /(?<![A-Za-z])(?:rgba?|hsla?|oklch)\s*\((?!\s*var\()/g
const ARBITRARY_COLOR_TAILWIND_RE =
  /\b(?:bg|text|border|fill|stroke|ring|shadow|from|to|via|outline|decoration|divide|placeholder|accent|caret)-\[(?:#[0-9a-fA-F]|rgba?\(|hsla?\(|oklch\()/g

async function walk(dir, exts = null) {
  const out = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (err.code === "ENOENT") return out
    throw err
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...(await walk(full, exts)))
    } else if (e.isFile()) {
      if (!exts || exts.some((ext) => e.name.endsWith(ext))) {
        out.push(full)
      }
    }
  }
  return out
}

async function ruleR1() {
  const cssFiles = [
    ...(await walk(SRC, [".css"])),
    ...(await walk(UI_PACKAGE_SRC, [".css"])),
  ]
  const violations = cssFiles
    .map((p) => displayPath(p))
    .filter((p) => !ALLOWED_CSS_FILES.has(p))
  return violations.map((p) => ({ rule: "R1", file: p, line: 0, snippet: ".css file" }))
}

async function findLines(file, re) {
  const text = await readFile(file, "utf8")
  const out = []
  const lines = text.split("\n")
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(IGNORE_MARKER)) continue
    const matches = lines[i].match(re)
    if (matches) {
      for (const m of matches) {
        out.push({ line: i + 1, snippet: lines[i].trim().slice(0, 120), match: m })
      }
    }
  }
  return out
}

function isExcluded(rel) {
  return R2_EXCLUDE_DIRS.some((dir) => rel.startsWith(dir))
}

async function ruleR2() {
  const files = []
  for (const sub of R2_DIRS) {
    files.push(...(await walk(join(SRC, sub), [".tsx", ".ts"])))
  }
  files.push(...(await walk(join(UI_PACKAGE_SRC, "components"), [".tsx", ".ts"])))
  files.push(...(await walk(join(UI_PACKAGE_SRC, "lib"), [".tsx", ".ts"])))
  files.push(...(await walk(join(UI_PACKAGE_SRC, "hooks"), [".tsx", ".ts"])))
  const violations = []
  for (const file of files) {
    const rel = displayPath(file)
    if (isExcluded(rel)) continue
    const hits = [
      ...(await findLines(file, HEX_RE)),
      ...(await findLines(file, COLOR_FN_RE)),
    ]
    for (const h of hits) {
      violations.push({ rule: "R2", file: rel, line: h.line, snippet: h.snippet, match: h.match })
    }
  }
  return violations
}

async function ruleR3() {
  const files = []
  for (const sub of R2_DIRS) {
    files.push(...(await walk(join(SRC, sub), [".tsx", ".ts"])))
  }
  files.push(...(await walk(join(UI_PACKAGE_SRC, "components"), [".tsx", ".ts"])))
  files.push(...(await walk(join(UI_PACKAGE_SRC, "lib"), [".tsx", ".ts"])))
  files.push(...(await walk(join(UI_PACKAGE_SRC, "hooks"), [".tsx", ".ts"])))
  const violations = []
  for (const file of files) {
    const rel = displayPath(file)
    if (isExcluded(rel)) continue
    const hits = await findLines(file, ARBITRARY_COLOR_TAILWIND_RE)
    for (const h of hits) {
      violations.push({ rule: "R3", file: rel, line: h.line, snippet: h.snippet, match: h.match })
    }
  }
  return violations
}

const violations = [
  ...(await ruleR1()),
  ...(await ruleR2()),
  ...(await ruleR3()),
]

if (violations.length === 0) {
  console.log("✓ lint:no-css passed — 0 violations across 3 rules")
  process.exit(0)
}

console.error(`✗ lint:no-css failed — ${violations.length} violation(s)\n`)
const byRule = violations.reduce((acc, v) => {
  ;(acc[v.rule] ??= []).push(v)
  return acc
}, {})
const ruleDesc = {
  R1: "No .css files in src/ outside the approved style entry/contract files",
  R2: "No hex/rgb/rgba/hsl/oklch literals in components/app/hooks (use design tokens instead)",
  R3: "No arbitrary color Tailwind values in className (use token classes instead, e.g. bg-background)",
}
for (const [rule, items] of Object.entries(byRule)) {
  console.error(`\n[${rule}] ${ruleDesc[rule]}  (${items.length} hit${items.length === 1 ? "" : "s"})`)
  for (const v of items) {
    console.error(`  ${v.file}:${v.line}  ${v.match ? `${v.match}` : ""}`)
    if (v.line > 0) console.error(`    ${v.snippet}`)
  }
}
console.error("\nZero authored CSS / zero hex+arbitrary-color Tailwind utilities outside approved style files.\n")
process.exit(1)
