import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { once } from "node:events"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"
import { chromium } from "playwright"
import inventory from "../providers/shadcnui-blocks/inventory.json" with { type: "json" }

const root = new URL("../../../../", import.meta.url)
const children = []
const temporaryDirectories = []
const supportsProcessGroups = process.platform !== "win32"
const openPort = () => new Promise((resolve, reject) => {
  const server = createServer()
  server.unref()
  server.on("error", reject)
  server.listen(0, "127.0.0.1", () => {
    const address = server.address()
    server.close(() => resolve(address.port))
  })
})
const stopChild = async (child) => {
  if (child.exitCode !== null) return
  const signal = (name) => {
    try {
      if (supportsProcessGroups && child.pid) process.kill(-child.pid, name)
      else child.kill(name)
    } catch (error) {
      if (error?.code !== "ESRCH") throw error
    }
  }
  signal("SIGTERM")
  await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))])
  if (child.exitCode === null) {
    signal("SIGKILL")
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))])
  }
}
const start = async ({ command, args, cwd, env, ready }) => {
  let output = ""
  const child = spawn(command, args, { cwd, detached: supportsProcessGroups, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] })
  child.stdout.on("data", (chunk) => { output += chunk })
  child.stderr.on("data", (chunk) => { output += chunk })
  children.push(child)
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Parity server exited early.\n${output}`)
    try {
      const response = await fetch(ready)
      if (response.status === 200) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out starting parity server.\n${output}`)
}
const addStyleAfterNavigation = async (page, content) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.addStyleTag({ content })
    } catch (error) {
      if (!/execution context was destroyed|navigation/i.test(String(error)) || attempt === 2) throw error
      await page.waitForLoadState("domcontentloaded")
    }
  }
}

let upstreamOrigin = process.env.SHADCNUI_BLOCKS_REFERENCE_ORIGIN
let runtimeOrigin = process.env.SIAB_PROVIDER_PARITY_ORIGIN
assert.equal(Boolean(upstreamOrigin), Boolean(runtimeOrigin), "Set both parity origins or neither")
if (!upstreamOrigin) {
  const checkout = await mkdtemp(join(tmpdir(), "siab-shadcnui-upstream-"))
  temporaryDirectories.push(checkout)
  const clone = spawnSync("git", ["clone", "--filter=blob:none", "--no-checkout", inventory.repository, checkout], { cwd: root, stdio: "inherit" })
  assert.equal(clone.status, 0, "clone pinned upstream")
  const pin = spawnSync("git", ["checkout", "--detach", inventory.commit], { cwd: checkout, stdio: "inherit" })
  assert.equal(pin.status, 0, "checkout pinned upstream")
  const install = spawnSync("corepack", ["pnpm@10.28.2", "install", "--frozen-lockfile"], { cwd: checkout, stdio: "inherit" })
  assert.equal(install.status, 0, "install pinned upstream")

  const upstreamPort = await openPort()
  upstreamOrigin = `http://127.0.0.1:${upstreamPort}`
  await start({ command: "corepack", args: ["pnpm@10.28.2", "dev", "--hostname", "127.0.0.1", "--port", String(upstreamPort)], cwd: checkout, ready: `${upstreamOrigin}/blocks/hero-01/preview?primitive=radix` })

  const runtimePort = await openPort()
  runtimeOrigin = `http://127.0.0.1:${runtimePort}`
  const viteCacheDir = await mkdtemp(join(tmpdir(), "siab-provider-parity-vite-"))
  temporaryDirectories.push(viteCacheDir)
  await start({
    command: "pnpm",
    args: ["--dir", "apps/renderer", "exec", "astro", "dev", "--force", "--host", "127.0.0.1", "--port", String(runtimePort)],
    cwd: root,
    env: { SIAB_ENABLE_PROVIDER_PARITY: "1", SIAB_RENDERER_FIXTURE_MODE: "1", SIAB_VITE_CACHE_DIR: viteCacheDir },
    ready: `${runtimeOrigin}/provider-parity?variant=shadcnui-blocks.hero-01&reference=raw`,
  })
}

const allCases = [
  { name: "desktop-light", width: 1440, height: 1200, mode: "light" },
  { name: "desktop-dark", width: 1440, height: 1200, mode: "dark" },
  { name: "mobile-light", width: 390, height: 844, mode: "light" },
  { name: "mobile-dark", width: 390, height: 844, mode: "dark" },
]
const requestedCase = process.env.SIAB_PROVIDER_PARITY_CASE
const cases = requestedCase ? allCases.filter((candidate) => candidate.name === requestedCase) : allCases
assert.ok(cases.length > 0, `Unknown parity case: ${requestedCase}`)
const requestedVariant = process.env.SIAB_PROVIDER_PARITY_VARIANT
const variants = requestedVariant
  ? inventory.variants.filter((variant) => variant.id === requestedVariant || variant.upstreamName === requestedVariant)
  : inventory.variants
assert.ok(variants.length > 0, `Unknown parity variant: ${requestedVariant}`)
const output = await mkdtemp(join(tmpdir(), "siab-provider-parity-"))
temporaryDirectories.push(output)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  for (const viewport of cases) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: viewport.mode })
    try {
      // Animated provider canvases seed their initial particles with
      // Math.random. Give both isolated pages the same seed so this comparison
      // measures the implementation rather than two unrelated particle sets.
      await context.addInitScript(() => {
        let state = 0x46c2e50
        Math.random = () => {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0
          return state / 0x100000000
        }
      })
      for (const variant of variants) {
        const reference = await context.newPage()
        const runtime = await context.newPage()
        try {
          const referenceUrl = `${upstreamOrigin}/blocks/${encodeURIComponent(variant.upstreamName)}/preview?primitive=radix`
          const runtimeUrl = `${runtimeOrigin}/provider-parity?variant=${encodeURIComponent(variant.id)}&mode=${viewport.mode}&reference=raw`
          const responses = await Promise.all([reference.goto(referenceUrl, { waitUntil: "domcontentloaded", timeout: 60_000 }), runtime.goto(runtimeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 })])
          assert.deepEqual(responses.map((response) => response?.status()), [200, 200], `${variant.id} ${viewport.name} responses`)
          if (viewport.mode === "dark") await reference.evaluate(() => document.documentElement.classList.add("dark"))
        // The upstream Next preview downloads Geist independently while SIAB
        // self-hosts its pinned package. Normalize glyph rasterization here so
        // pixel diffs measure block DOM/classes/layout rather than font files.
          const deterministicFont = "html,body{overflow-x:clip!important}body{height:auto!important}body,body *{font-family:Arial,sans-serif!important;font-feature-settings:normal!important}.animate-marquee,.animate-marquee-vertical{animation:none!important;transform:none!important}[style*='background-position']{background-position:0 0!important}img[class*='blur-']{visibility:hidden!important}[aria-hidden=true].pointer-events-none>canvas.size-full,[data-paper-shader]>canvas,[style*='offset-path']{visibility:hidden!important}"
          await Promise.all([
            addStyleAfterNavigation(reference, `nextjs-portal,.block-preview-wrapper .grow.bg-muted\\/50{display:none!important}.block-preview-wrapper{min-height:0!important;background:var(--background)!important}${deterministicFont}`),
            addStyleAfterNavigation(runtime, deterministicFont),
          ])
          await runtime.evaluate(() => {
            const referenceRoot = document.querySelector("[data-provider-reference]")
            if (!referenceRoot) return
            const styles = getComputedStyle(referenceRoot)
            document.body.style.backgroundColor = styles.getPropertyValue("--background")
            document.body.style.color = styles.getPropertyValue("--foreground")
          })
          await runtime.waitForFunction(() => document.documentElement.dataset.providerHydrated === "true").catch((error) => {
            throw new Error(`${variant.id} ${viewport.name} did not hydrate`, { cause: error })
          })
          await Promise.all([reference.evaluate(() => document.fonts.ready), runtime.evaluate(() => document.fonts.ready)])
          await reference.waitForFunction(() => [...document.images].every((image) => {
            if (!/^https?:/.test(image.currentSrc || image.src) || image.offsetParent === null) return true
            const bounds = image.getBoundingClientRect()
            return bounds.width > 0 && bounds.height > 0
          }), undefined, { timeout: 20_000 }).catch(async (error) => {
            const pending = await reference.locator("img").evaluateAll((images) => images
              .filter((image) => /^https?:/.test(image.currentSrc || image.src) && image.offsetParent !== null && (!image.getBoundingClientRect().width || !image.getBoundingClientRect().height))
              .map((image) => image.currentSrc || image.src))
            throw new Error(`${variant.id} ${viewport.name} upstream images did not establish layout: ${pending.join(", ")}`, { cause: error })
          })
          if (await reference.locator('[data-slot="carousel"]').count() || await runtime.locator('[data-slot="carousel"]').count()) {
            // Embla publishes button/dot state from a post-hydration effect.
            await Promise.all([reference.waitForTimeout(250), runtime.waitForTimeout(250)])
          }
          if (await reference.locator(".recharts-wrapper").count() || await runtime.locator(".recharts-wrapper").count()) {
            // Recharts performs its first path interpolation in JavaScript, so
            // Playwright's CSS-animation switch cannot freeze it. Compare the
            // identical settled chart rather than two request-timing frames.
            await Promise.all([reference.waitForTimeout(1_800), runtime.waitForTimeout(1_800)])
          }
          if (await reference.locator("number-flow-react").count() || await runtime.locator("number-flow-react").count()) {
            await Promise.all([reference.waitForTimeout(1_000), runtime.waitForTimeout(1_000)])
          }
          if (variant.upstreamName === "timeline-07") {
            // The pinned demo mutates its module-level array with reverse(), so
            // Next dev alternates the preview order on successive requests.
            // Normalize that upstream-only defect to its intended newest-first
            // presentation; SIAB's imported fallback is non-mutating already.
            const intendedOrder = await runtime.locator("h6").allTextContents()
            await reference.evaluate((order) => {
              const rows = [...document.querySelectorAll("h6")]
                .map((heading) => heading.closest(".group.relative"))
                .filter(Boolean)
              const parent = rows[0]?.parentElement
              const byVersion = new Map(rows.map((row) => [row.querySelector("h6")?.textContent ?? "", row]))
              if (parent) order.forEach((version) => {
                const row = byVersion.get(version)
                if (row) parent.append(row)
              })
            }, intendedOrder)
          }
          if (process.env.SIAB_PROVIDER_PARITY_DEBUG === "1") {
          const readStyles = (page) => page.evaluate(() => {
            const root = document.querySelector("[data-provider-reference]") ?? document.body.firstElementChild
            const card = document.querySelector("[data-slot=card]")
            const image = document.querySelector("img")
            const values = (element) => element ? Object.fromEntries(["backgroundColor", "color", "borderColor", "boxShadow", "fontFamily", "fontSize", "lineHeight", "width", "height", "position"].map((name) => [name, getComputedStyle(element)[name]])) : null
            return { body: values(document.body), root: values(root), card: values(card), image: values(image) }
          })
          console.log(JSON.stringify({ variant: variant.id, viewport: viewport.name, upstream: await readStyles(reference), vendored: await readStyles(runtime) }, null, 2))
          }
          const prefix = `${variant.upstreamName}-${viewport.name}`
          const referencePath = join(output, `${prefix}-upstream.png`)
          const runtimePath = join(output, `${prefix}-vendored.png`)
          await Promise.all([
            reference.screenshot({ path: referencePath, fullPage: true, animations: "disabled", mask: [reference.locator("img"), reference.locator('[data-slot="avatar"]')] }),
            runtime.screenshot({ path: runtimePath, fullPage: true, animations: "disabled", mask: [runtime.locator("img"), runtime.locator('[data-slot="avatar"]')] }),
          ])
          let a = PNG.sync.read(await readFile(referencePath))
          const b = PNG.sync.read(await readFile(runtimePath))
          if (a.width > b.width && b.width === viewport.width && a.height === b.height) {
            const visibleReference = new PNG({ width: b.width, height: a.height })
            PNG.bitblt(a, visibleReference, 0, 0, b.width, a.height, 0, 0)
            a = visibleReference
          }
          assert.equal(`${b.width}x${b.height}`, `${a.width}x${a.height}`, `${variant.id} ${viewport.name} dimensions`)
          const diff = new PNG({ width: a.width, height: a.height })
          const different = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 })
          // Allow at most 128 isolated rasterization pixels (or 0.01% for a
          // larger capture). This absorbs Chromium's subpixel edge jitter
          // without permitting a visible layout, color, or content delta.
          const tolerance = Math.max(128, Math.ceil(a.width * a.height * 0.0001))
          if (different > tolerance) await writeFile(join(output, `${prefix}-diff.png`), PNG.sync.write(diff))
          assert.ok(different <= tolerance, `${variant.id} ${viewport.name} differs by ${different} pixels (tolerance ${tolerance})`)
        } finally {
          await Promise.all([reference.close(), runtime.close()])
        }
      }
      console.log(`Pixel-matched ${variants.length} pinned variants against the true upstream at ${viewport.name}.`)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
  await Promise.all(children.map(stopChild))
  if (process.env.SIAB_KEEP_PROVIDER_PARITY !== "1") {
    await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })))
  }
}
