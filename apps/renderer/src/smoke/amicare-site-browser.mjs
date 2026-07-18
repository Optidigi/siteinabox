import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"

import { chromium } from "playwright"

import { closeServer, getOpenPort, startStubCms, waitForRenderer } from "./host-routing-harness.mjs"

const appRoot = resolve(new URL("../..", import.meta.url).pathname)
const repoRoot = resolve(appRoot, "../..")

async function stopChild(child) {
  if (child.exitCode !== null) return
  child.kill("SIGTERM")
  const timeout = setTimeout(() => child.kill("SIGKILL"), 5_000)
  try {
    await once(child, "exit")
  } finally {
    clearTimeout(timeout)
  }
}

const cms = await startStubCms()
const dataDir = await mkdtemp(join(tmpdir(), "siab-amicare-browser-data-"))
const artifactDir = process.env.SIAB_VISUAL_ARTIFACT_DIR
  ? resolve(process.env.SIAB_VISUAL_ARTIFACT_DIR)
  : await mkdtemp(join(tmpdir(), "siab-amicare-browser-artifacts-"))
const removeArtifacts = !process.env.SIAB_VISUAL_ARTIFACT_DIR
const mediaDir = join(dataDir, "tenants", "tenant-ami-care", "media")
await mkdir(mediaDir, { recursive: true })
await mkdir(artifactDir, { recursive: true })
for (const filename of ["toys.jpg", "bedroom.jpg", "og-default.png", "apple-touch-icon.png"]) {
  await copyFile(join(repoRoot, "apps/landing/public/og-default.png"), join(mediaDir, filename))
}
await copyFile(join(repoRoot, "apps/landing/public/favicon.svg"), join(mediaDir, "favicon.svg"))
await copyFile(join(repoRoot, "apps/landing/public/favicon.ico"), join(mediaDir, "favicon.ico"))

const port = await getOpenPort()
const origin = `http://127.0.0.1:${port}`
const child = spawn("pnpm", ["exec", "astro", "dev", "--force", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: appRoot,
  env: {
    ...process.env,
    NODE_ENV: "test",
    SIAB_CMS_URL: cms.url,
    SIAB_RENDERER_FIXTURE_MODE: "",
    SITE_URL: origin,
    DATA_DIR: dataDir,
  },
  stdio: ["ignore", "pipe", "pipe"],
})
let output = ""
child.stdout.on("data", (chunk) => { output += chunk })
child.stderr.on("data", (chunk) => { output += chunk })

try {
  await waitForRenderer(origin, () => output)
  const browser = await chromium.launch({ headless: true })
  try {
    for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
      const context = await browser.newContext({
        viewport,
        colorScheme: "light",
        extraHTTPHeaders: { "x-forwarded-host": "ami-care.nl" },
      })
      await context.route("**/*posthog.com/**", async (route) => {
        const isScript = new URL(route.request().url()).pathname.endsWith(".js")
        await route.fulfill({
          status: 200,
          contentType: isScript ? "application/javascript" : "application/json",
          body: isScript ? "" : "{}",
        })
      })
      const page = await context.newPage()
      const failures = []
      page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`) })
      page.on("pageerror", (error) => failures.push(`page: ${error.message}`))
      page.on("requestfailed", (request) => failures.push(`request: ${request.failure()?.errorText ?? "failed"} ${request.url()}`))
      page.on("response", (response) => { if (response.status() >= 400) failures.push(`response: ${response.status()} ${response.url()}`) })

      await page.goto(origin, { waitUntil: "networkidle", timeout: 60_000 })
      await page.locator('[data-provider-variant="shadcnui-blocks.hero-02"]').waitFor({ state: "visible" })
      for (const variant of [
        "shadcnui-blocks.navbar-03",
        "shadcnui-blocks.hero-02",
        "shadcnui-blocks.features-01",
        "shadcnui-blocks.cta-03",
        "shadcnui-blocks.cta-02",
        "shadcnui-blocks.contact-01",
        "shadcnui-blocks.footer-07",
        "shadcnui-blocks.banner-04",
      ]) {
        assert.equal(await page.locator(`[data-provider-variant="${variant}"]`).count(), 1, `${viewport.name} renders ${variant} exactly once`)
      }
      const state = await page.evaluate(() => {
        const canvas = document.querySelector(".rt-canvas")
        const banner = document.querySelector('[data-siab-cookie-consent="true"]')
        const images = [...document.querySelectorAll('[data-provider-variant] img')]
        return {
          colorScheme: canvas?.getAttribute("data-theme-color"),
          primary: canvas ? getComputedStyle(canvas).getPropertyValue("--primary").trim() : "",
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          images: images.map((image) => ({ src: image.getAttribute("src"), width: image.naturalWidth, height: image.naturalHeight })),
          bannerPosition: banner ? getComputedStyle(banner).position : "",
          bannerBottom: banner?.getBoundingClientRect().bottom ?? 0,
        }
      })
      assert.equal(state.colorScheme, "terracotta-warm", `${viewport.name} uses the Ami Care color scheme`)
      assert.match(state.primary.toLowerCase(), /#a04e32|160[ ,]+78[ ,]+50/, `${viewport.name} resolves the Ami Care primary token`)
      assert.ok(state.overflow <= 1, `${viewport.name} has no horizontal overflow`)
      assert.ok(state.images.length >= 3, `${viewport.name} renders the bound hero and CTA media`)
      assert.ok(state.images.every((image) => image.width > 0 && image.height > 0), `${viewport.name} loads every bound image`)
      assert.ok(state.images.filter((image) => image.src?.includes("toys.jpg")).length >= 2, `${viewport.name} binds the hero and biography CTA media`)
      assert.ok(state.images.some((image) => image.src?.includes("bedroom.jpg")), `${viewport.name} binds the trust CTA media`)
      assert.equal(state.bannerPosition, "fixed", `${viewport.name} uses viewport-fixed cookie chrome`)
      assert.ok(state.bannerBottom <= viewport.height && state.bannerBottom >= viewport.height - 40, `${viewport.name} keeps cookie chrome at the viewport bottom`)
      assert.equal(await page.locator('[data-consent-action="accept"]:visible').count(), 1)
      assert.equal(await page.locator('[data-consent-action="reject"]:visible').count(), 1)
      assert.deepEqual(failures, [], `${viewport.name} has no browser or asset failures`)
      await page.screenshot({ path: join(artifactDir, `amicare-${viewport.name}.png`), fullPage: true, animations: "disabled" })
      await context.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`Ami Care browser smoke passed; screenshots: ${artifactDir}`)
} finally {
  await stopChild(child)
  await closeServer(cms.server)
  await rm(dataDir, { recursive: true, force: true })
  if (removeArtifacts) await rm(artifactDir, { recursive: true, force: true })
}
