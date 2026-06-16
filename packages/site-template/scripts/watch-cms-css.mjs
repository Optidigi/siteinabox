#!/usr/bin/env node
// Local-dev: compile src/styles/global.css into a Payload tenant data dir and
// keep watching. This lets the CMS canvas pick up template CSS while editing.

import { spawn } from "node:child_process"
import { mkdirSync, copyFileSync, readdirSync, existsSync } from "node:fs"
import { resolve, join, dirname } from "node:path"

const TENANT_ID = process.env.CMS_TENANT_ID ?? "1"
const DATA_DIR = process.env.CMS_DATA_DIR_ABS ?? resolve("../../apps/cms/.data-out")
const TENANT_ROOT = join(DATA_DIR, "tenants", String(TENANT_ID))
const OUT = join(TENANT_ROOT, "cms-editor.css")
const FILES_OUT = join(TENANT_ROOT, "files")

mkdirSync(dirname(OUT), { recursive: true })
mkdirSync(FILES_OUT, { recursive: true })

const copyFontsourceFiles = () => {
  const fontsourceRoot = resolve("node_modules/@fontsource-variable")
  if (!existsSync(fontsourceRoot)) return 0
  const families = readdirSync(fontsourceRoot)
  let copied = 0
  for (const family of families) {
    const filesDir = join(fontsourceRoot, family, "files")
    if (!existsSync(filesDir)) continue
    for (const entry of readdirSync(filesDir)) {
      if (!entry.endsWith(".woff2")) continue
      copyFileSync(join(filesDir, entry), join(FILES_OUT, entry))
      copied++
    }
  }
  return copied
}

const n = copyFontsourceFiles()
console.log(`[cms-css] copied ${n} @fontsource woff2 file(s) -> ${FILES_OUT}`)

console.log(`[cms-css] compiling src/styles/global.css -> ${OUT} (watch mode)`)
const child = spawn(
  "pnpm",
  ["exec", "tailwindcss", "-i", "src/styles/global.css", "-o", OUT, "--watch=always"],
  { stdio: "inherit" },
)
child.on("exit", (code) => process.exit(code ?? 0))
