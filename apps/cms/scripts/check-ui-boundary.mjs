#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"

const ROOT = process.cwd()
const PLATFORM_ROOT = resolve(ROOT, "../..")

const SHADCN_CSS = "src/styles/shadcn.css"
const PACKAGE_SHADCN_CSS = "packages/ui/src/styles/shadcn.css"
const PROTECTED_CSS = new Set(["src/styles/globals.css", "src/styles/siab.css"])

const UPSTREAM_UI_FILES = new Set([
  "alert.tsx",
  "avatar.tsx",
  "badge.tsx",
  "breadcrumb.tsx",
  "button.tsx",
  "card.tsx",
  "chart.tsx",
  "checkbox.tsx",
  "command.tsx",
  "dialog.tsx",
  "drawer.tsx",
  "dropdown-menu.tsx",
  "form.tsx",
  "input.tsx",
  "label.tsx",
  "pagination.tsx",
  "popover.tsx",
  "select.tsx",
  "separator.tsx",
  "sheet.tsx",
  "sidebar.tsx",
  "skeleton.tsx",
  "switch.tsx",
  "table.tsx",
  "tabs.tsx",
  "textarea.tsx",
  "toggle-group.tsx",
  "toggle.tsx",
  "tooltip.tsx",
])

const failures = []

const componentsJson = JSON.parse(await readFile(join(ROOT, "components.json"), "utf8"))
const configuredCss = componentsJson.tailwind?.css
if (configuredCss !== SHADCN_CSS) {
  failures.push(`components.json tailwind.css must be ${SHADCN_CSS}, got ${configuredCss}`)
}
if (PROTECTED_CSS.has(configuredCss)) {
  failures.push(`components.json tailwind.css points at protected CSS: ${configuredCss}`)
}

const globals = await readFile(join(ROOT, "src/styles/globals.css"), "utf8")
const expectedGlobals = '@import "./shadcn.css";\n@import "./siab.css";\n'
if (globals !== expectedGlobals) {
  failures.push("src/styles/globals.css must remain the stable shadcn/SIAB import shell")
}

const shadcn = await readFile(join(ROOT, "src/styles/shadcn.css"), "utf8")
const expectedShadcn = '@import "@siteinabox/ui/styles/shadcn.css";\n'
if (shadcn !== expectedShadcn) {
  failures.push("src/styles/shadcn.css must remain a compatibility import for @siteinabox/ui/styles/shadcn.css")
}

const uiDir = join(ROOT, "src/components/ui")
const entries = await readdir(uiDir, { withFileTypes: true })
const unknownUiFiles = entries
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => !UPSTREAM_UI_FILES.has(name))
  .sort()

if (unknownUiFiles.length > 0) {
  failures.push(
    [
      "src/components/ui is reserved for upstream shadcn primitive filenames only.",
      "Move new custom app components outside src/components/ui:",
      ...unknownUiFiles.map((name) => `  - ${name}`),
    ].join("\n"),
  )
}

for (const name of UPSTREAM_UI_FILES) {
  const source = await readFile(join(uiDir, name), "utf8")
  const exportPath = `@siteinabox/ui/components/${name.replace(/\.tsx$/, "")}`
  if (source.trim() !== `export * from "${exportPath}"`) {
    failures.push(`src/components/ui/${name} must remain a re-export shim for ${exportPath}`)
  }
}

const packageUiDir = join(PLATFORM_ROOT, "packages/ui/src/components")
const packageEntries = await readdir(packageUiDir, { withFileTypes: true })
const unknownPackageUiFiles = packageEntries
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => !UPSTREAM_UI_FILES.has(name))
  .sort()

if (unknownPackageUiFiles.length > 0) {
  failures.push(
    [
      "packages/ui/src/components is reserved for upstream-name primitive filenames.",
      "Move generic composites to a non-primitive package path:",
      ...unknownPackageUiFiles.map((name) => `  - ${name}`),
    ].join("\n"),
  )
}

const packageShadcn = await readFile(join(PLATFORM_ROOT, PACKAGE_SHADCN_CSS), "utf8")
if (!packageShadcn.includes('@source "../components";')) {
  failures.push(`${PACKAGE_SHADCN_CSS} must include @source "../components" so Tailwind scans package primitives`)
}

if (failures.length > 0) {
  console.error(`✗ lint:ui-boundary failed — ${failures.length} violation(s)\n`)
  console.error(failures.join("\n\n"))
  process.exit(1)
}

console.log(
  "✓ lint:ui-boundary passed — shadcn CSS target is isolated, CMS shims are re-exports, and packages/ui primitives are upstream-name-only",
)
