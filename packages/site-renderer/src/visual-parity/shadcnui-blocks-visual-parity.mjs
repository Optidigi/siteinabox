import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"
import { chromium } from "playwright"
import inventory from "../providers/shadcnui-blocks/inventory.json" with { type: "json" }

let referenceOrigin = process.env.SHADCNUI_BLOCKS_REFERENCE_ORIGIN
let runtimeOrigin = process.env.SIAB_PROVIDER_PARITY_ORIGIN
assert.equal(Boolean(referenceOrigin), Boolean(runtimeOrigin), "Set both parity origins or neither")

const children = []
const openPort = () => new Promise((resolve, reject) => {
  const server = createServer()
  server.unref()
  server.on("error", reject)
  server.listen(0, "127.0.0.1", () => {
    const address = server.address()
    server.close(() => resolve(address.port))
  })
})
const waitFor = async (origin, child, output) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Parity renderer exited early.\n${output()}`)
    try {
      const response = await fetch(`${origin}/provider-parity?variant=shadcnui-blocks.hero-01&reference=raw`)
      if (response.status === 200) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out starting parity renderer.\n${output()}`)
}
const stopChild = async (child) => {
  if (child.exitCode !== null) return
  child.kill("SIGTERM")
  await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))])
  if (child.exitCode === null) child.kill("SIGKILL")
}
if (!referenceOrigin) {
  const root = new URL("../../../../", import.meta.url)
  for (const purpose of ["reference", "runtime"]) {
    const port = await openPort()
    const origin = `http://127.0.0.1:${port}`
    let output = ""
    const viteCacheDir = join(tmpdir(), `siab-provider-parity-vite-${port}`)
    const child = spawn("pnpm", ["--dir", "apps/renderer", "exec", "astro", "dev", "--force", "--host", "127.0.0.1", "--port", String(port)], {
      cwd: root,
      env: { ...process.env, SIAB_ENABLE_PROVIDER_PARITY: "1", SIAB_RENDERER_FIXTURE_MODE: "1", SIAB_VITE_CACHE_DIR: viteCacheDir },
      stdio: ["ignore", "pipe", "pipe"],
    })
    child.stdout.on("data", (chunk) => { output += chunk })
    child.stderr.on("data", (chunk) => { output += chunk })
    children.push(child)
    child.viteCacheDir = viteCacheDir
    await waitFor(origin, child, () => output)
    if (purpose === "reference") referenceOrigin = origin
    else runtimeOrigin = origin
  }
}

const cases = [
  { name: "desktop-light", width: 1440, height: 1200, mode: "light" },
  { name: "desktop-dark", width: 1440, height: 1200, mode: "dark" },
  { name: "mobile-light", width: 390, height: 844, mode: "light" },
  { name: "mobile-dark", width: 390, height: 844, mode: "dark" },
]
const output = await mkdtemp(join(tmpdir(), "siab-provider-parity-"))
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  for (const viewport of cases) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: viewport.mode })
    const reference = await context.newPage()
    const runtime = await context.newPage()
    try {
      for (const variant of inventory.variants) {
      const query = `variant=${encodeURIComponent(variant.id)}&mode=${viewport.mode}`
      const responses = await Promise.all([reference.goto(`${referenceOrigin}/provider-parity?${query}&reference=raw`, { waitUntil: "load" }), runtime.goto(`${runtimeOrigin}/provider-parity?${query}&reference=adapter`, { waitUntil: "load" })])
      assert.deepEqual(responses.map((response) => response?.status()), [200, 200], `${variant.id} ${viewport.name} responses`)
      await Promise.all([reference.evaluate(() => document.fonts.ready), runtime.evaluate(() => document.fonts.ready)])
      const prefix = `${variant.upstreamName}-${viewport.name}`
      const referencePath = join(output, `${prefix}-reference.png`)
      const runtimePath = join(output, `${prefix}-runtime.png`)
      await Promise.all([
        reference.screenshot({ path: referencePath, fullPage: true, animations: "disabled" }),
        runtime.screenshot({ path: runtimePath, fullPage: true, animations: "disabled" }),
      ])
      const a = PNG.sync.read(await readFile(referencePath))
      const b = PNG.sync.read(await readFile(runtimePath))
      assert.equal(`${b.width}x${b.height}`, `${a.width}x${a.height}`, `${variant.id} ${viewport.name} dimensions`)
      const different = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 })
      const antialiasTolerance = Math.max(16, Math.ceil(a.width * a.height * 0.00001))
      assert.ok(different <= antialiasTolerance, `${variant.id} ${viewport.name} differs by ${different} pixels (tolerance ${antialiasTolerance})`)
      }
      console.log(`Pixel-matched ${inventory.variants.length} variants at ${viewport.name}.`)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
  await Promise.all(children.map(stopChild))
  await Promise.all(children.map((child) => rm(child.viteCacheDir, { force: true, recursive: true })))
  if (process.env.SIAB_KEEP_PROVIDER_PARITY !== "1") await rm(output, { recursive: true, force: true })
}
