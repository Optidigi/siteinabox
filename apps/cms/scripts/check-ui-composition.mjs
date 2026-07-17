#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises"
import { join, relative, resolve } from "node:path"

const ROOT = process.cwd()
const SRC = join(ROOT, "src")
const PLATFORM_ROOT = resolve(ROOT, "../..")
const UI_PACKAGE_SRC = join(PLATFORM_ROOT, "packages/ui/src")

const IGNORE_MARKER = "lint:ui-composition:ignore"

const SCAN_DIRS = ["components", "app", "hooks"]
const SOURCE_EXTS = [".ts", ".tsx"]

const ALLOWED_NATIVE_BUTTON_FILES = new Set([
  "src/components/common/mobile-floating-pill.tsx",
  "src/components/data-table.tsx",
  "src/components/editor/FieldRenderer.tsx",
  "src/components/editor/block-type-picker.tsx",
  "src/components/editor/mobile/mobile-array-drilldown.tsx",
  "src/components/editor/mobile/mobile-component-editor.tsx",
  "src/components/editor/mobile/mobile-icon-sheet.tsx",
  "src/components/editor/mobile/mobile-section-list.tsx",
  "src/components/editor/fields/array-item-card.tsx",
  "src/components/editor/fields/block-form-fields.tsx",
  "src/components/editor/icon-picker.tsx",
  "src/components/editor/richText/toolbar/block-chip.tsx",
  "src/components/editor/richText/toolbar/font-chip.tsx",
  "src/components/editor/richText/toolbar/link-chip.tsx",
  "src/components/editor/richText/toolbar/mark-chips.tsx",
  "src/components/editor/richText/toolbar/slash-menu.tsx",
  "src/components/editor/richText/toolbar/style-chip.tsx",
  "src/components/editor/richText/toolbar/themed-pill.tsx",
  "src/components/editor/sidebar-drill-down.tsx",
  "src/components/editor/theme/font-picker.tsx",
  "src/components/editor/theme/palette-picker.tsx",
  "src/components/list-search.tsx",
  "src/components/media/MediaGrid.tsx",
  "src/components/navigation/NavEntryRow.tsx",
  "src/components/onboarding-checklist.tsx",
  "src/components/save-ui/save-status-bar.tsx",
  "src/components/theme-toggle.tsx",
])

function displayPath(file) {
  return file.startsWith(ROOT) ? relative(ROOT, file) : relative(PLATFORM_ROOT, file)
}

async function walk(dir) {
  const out = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (err.code === "ENOENT") return out
    throw err
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walk(full)))
    } else if (entry.isFile() && SOURCE_EXTS.some((ext) => entry.name.endsWith(ext))) {
      out.push(full)
    }
  }
  return out
}

function ignored(lines, index) {
  return (
    lines[index]?.includes(IGNORE_MARKER) ||
    lines[index - 1]?.includes(IGNORE_MARKER)
  )
}

const files = []
for (const dir of SCAN_DIRS) {
  files.push(...(await walk(join(SRC, dir))))
}
files.push(...(await walk(join(UI_PACKAGE_SRC, "components"))))
files.push(...(await walk(join(UI_PACKAGE_SRC, "lib"))))
files.push(...(await walk(join(UI_PACKAGE_SRC, "hooks"))))

const violations = []
for (const file of files) {
  const rel = displayPath(file)
  const source = await readFile(file, "utf8")
  const lines = source.split(/\r?\n/)
  const isUiPrimitive =
    rel.startsWith("src/components/ui/") ||
    rel.startsWith("packages/ui/src/components/")

  lines.forEach((line, index) => {
    if (ignored(lines, index)) return
    const lineNo = index + 1

    if (!isUiPrimitive && /from\s+["'](?:@radix-ui|radix-ui)/.test(line)) {
      violations.push({
        rule: "R1",
        file: rel,
        line: lineNo,
        message: "Direct Radix imports belong in packages/ui primitives. Compose the shared primitive instead.",
      })
    }

    if (/style=\{\{/.test(line)) {
      violations.push({
        rule: "R2",
        file: rel,
        line: lineNo,
        message: "Inline style object found. Use token classes/CSP style helpers, or add a reviewed ignore marker.",
      })
    }

    if (!isUiPrimitive && /<button\b/.test(line) && !ALLOWED_NATIVE_BUTTON_FILES.has(rel)) {
      violations.push({
        rule: "R3",
        file: rel,
        line: lineNo,
        message: "Native <button> in a new file. Prefer @siteinabox/ui/components/button unless a reviewed DOM/canvas exception is needed.",
      })
    }
  })
}

if (violations.length > 0) {
  console.error(`✗ lint:ui-composition failed — ${violations.length} violation(s)\n`)
  for (const violation of violations) {
    console.error(`[${violation.rule}] ${violation.file}:${violation.line}`)
    console.error(`  ${violation.message}`)
  }
  console.error(`\nUse ${IGNORE_MARKER} only for reviewed exceptions.\n`)
  process.exit(1)
}

console.log(
  `✓ lint:ui-composition passed — Radix imports, inline styles, and native-button files stay within reviewed boundaries`,
)
