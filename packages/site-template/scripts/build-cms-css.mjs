#!/usr/bin/env node
// Production: compile src/styles/global.css to dist/cms/cms-editor.css.
// The payload orchestrator syncs this directory into the tenant data dir so
// the CMS canvas can load tenant CSS and font files.

import { spawnSync } from "node:child_process"
import { mkdirSync, copyFileSync, readdirSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"

const OUT_DIR = join(process.cwd(), "dist/cms")
const OUT = join(OUT_DIR, "cms-editor.css")
const FILES_OUT = join(OUT_DIR, "files")
mkdirSync(OUT_DIR, { recursive: true })
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

const r = spawnSync(
  "pnpm",
  ["exec", "tailwindcss", "-i", "src/styles/global.css", "-o", OUT, "--minify"],
  { stdio: "inherit" },
)
if (r.status !== 0) process.exit(r.status ?? 1)
console.log(`[cms-css] wrote ${OUT}`)
