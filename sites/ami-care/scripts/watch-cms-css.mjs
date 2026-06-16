#!/usr/bin/env node
// Local-dev: compiles src/styles/global.css (Tailwind v4 source — includes
// @import 'tailwindcss', @theme tokens, @plugin, @import './rich-text.css')
// into fully-resolved CSS at <CMS_DATA_DIR_ABS>/tenants/<TENANT_ID>/cms-editor.css.
// Also copies the @fontsource font files into the same `files/` subdirectory
// so the CMS canvas can serve them via its tenant-assets route.
// The CMS canvas loads that compiled bundle. Uses Tailwind's own --watch.
//
// Env:
//   CMS_TENANT_ID    — tenant id in siab-payload (default "1")
//   CMS_DATA_DIR_ABS — abs path to siab-payload's .data-out
//                      (default ../siab-payload/.data-out)
import { spawn } from "node:child_process"
import { mkdirSync, copyFileSync, readdirSync, existsSync } from "node:fs"
import { resolve, join, dirname } from "node:path"

const TENANT_ID = process.env.CMS_TENANT_ID ?? "1"
const DATA_DIR = process.env.CMS_DATA_DIR_ABS ?? resolve("../siab-payload/.data-out")
const TENANT_ROOT = join(DATA_DIR, "tenants", String(TENANT_ID))
const OUT = join(TENANT_ROOT, "cms-editor.css")
const FILES_OUT = join(TENANT_ROOT, "files")

mkdirSync(dirname(OUT), { recursive: true })
mkdirSync(FILES_OUT, { recursive: true })

/**
 * Tailwind v4's compiled CSS emits `src: url(./files/<font>.woff2)` for
 * @fontsource-variable packages but does NOT copy the files. Walk
 * node_modules/@fontsource* and copy every .woff2 into our tenant's
 * `files/` dir so the CMS asset route can serve them.
 */
const copyFontsourceFiles = () => {
  const fontsourceRoot = resolve("node_modules/@fontsource-variable")
  if (!existsSync(fontsourceRoot)) return 0
  // Use plain readdir — pnpm installs each family as a symlink, which
  // Dirent.isDirectory() reports as false; downstream existsSync handles
  // the actual files/ check.
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
console.log(`[cms-css] copied ${n} @fontsource woff2 file(s) → ${FILES_OUT}`)

console.log(`[cms-css] compiling src/styles/global.css → ${OUT} (watch mode)`)
const child = spawn(
  "pnpm",
  ["exec", "tailwindcss", "-i", "src/styles/global.css", "-o", OUT, "--watch=always"],
  { stdio: "inherit" },
)
child.on("exit", (code) => process.exit(code ?? 0))
