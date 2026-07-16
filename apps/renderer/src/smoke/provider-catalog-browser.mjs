import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium } from "playwright"
import inventory from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/inventory.json" with { type: "json" }
import { getOpenPort, waitForRenderer } from "./host-routing-harness.mjs"

const port = await getOpenPort()
const origin = `http://127.0.0.1:${port}`
const viteCacheDir = join(tmpdir(), `siab-provider-browser-vite-${port}`)
const child = spawn("pnpm", ["exec", "astro", "dev", "--force", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: new URL("../..", import.meta.url),
  env: { ...process.env, SIAB_ENABLE_PROVIDER_PARITY: "1", SIAB_RENDERER_FIXTURE_MODE: "1", SIAB_VITE_CACHE_DIR: viteCacheDir },
  stdio: ["ignore", "pipe", "pipe"],
})
let output = ""
child.stdout.on("data", (chunk) => { output += chunk })
child.stderr.on("data", (chunk) => { output += chunk })

try {
  await waitForRenderer(origin, child, () => output)
  {
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 1440, height: 1200 } })
      const page = await context.newPage()
      await page.goto(`${origin}/provider-parity?variant=shadcnui-blocks.navbar-02&mode=light&preference=system`, { waitUntil: "load", timeout: 60_000 })
      await page.waitForFunction(() => document.documentElement.dataset.siabColorMode === "dark")
      const darkBackground = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--background"))
      await page.emulateMedia({ colorScheme: "light" })
      await page.waitForFunction(() => document.documentElement.dataset.siabColorMode === "light")
      const lightBackground = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--background"))
      assert.notEqual(lightBackground, darkBackground, "system preference changes computed theme tokens")
      await page.locator("[data-theme-toggle]:visible").first().click()
      assert.equal(await page.evaluate(() => document.documentElement.dataset.siabColorMode), "dark", "navbar writes resolved color mode")
      assert.equal(await page.evaluate(() => localStorage.getItem("siab-color-mode")), "dark", "navbar persists visitor override")
      await page.reload({ waitUntil: "load" })
      await page.waitForFunction(() => document.documentElement.dataset.siabColorMode === "dark")
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--background")), darkBackground, "visitor override survives reload")
    } finally {
      await browser.close()
    }
  }
  const catalogVariants = inventory.variants
  assert.equal(catalogVariants.length, 156)
  const requestedVariant = process.env.SIAB_PROVIDER_VARIANT
  const variants = requestedVariant ? catalogVariants.filter((variant) => variant.id === requestedVariant) : catalogVariants
  assert.ok(variants.length, `Unknown SIAB_PROVIDER_VARIANT ${requestedVariant}`)
  const viewports = [
    { name: "desktop-light", width: 1440, height: 1200, mode: "light" },
    { name: "desktop-dark", width: 1440, height: 1200, mode: "dark" },
    { name: "mobile-light", width: 390, height: 844, mode: "light" },
    { name: "mobile-dark", width: 390, height: 844, mode: "dark" },
  ]
  for (const viewport of viewports) for (let offset = 0; offset < variants.length; offset += 8) {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: viewport.mode })
      const failures = []
      page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`)
      })
      page.on("pageerror", (error) => failures.push(`page: ${error.message}`))
      page.on("response", (response) => {
        if (response.status() >= 400) failures.push(`response: ${response.status()} ${response.url()}`)
      })
      for (const variant of variants.slice(offset, offset + 8)) {
        failures.length = 0
        const response = await page.goto(`${origin}/provider-parity?variant=${encodeURIComponent(variant.id)}&mode=${viewport.mode}`, { waitUntil: "load", timeout: 60_000 })
        const status = response?.status()
        assert.equal(status, 200, `${variant.id}: ${status === 200 ? "" : await response?.text()}\n${output}`)
        await page.locator(`[data-provider-variant="${variant.id}"]`).waitFor()
        await page.waitForFunction(() => document.documentElement.dataset.providerHydrated === "true", undefined, { timeout: 30_000 })
        const accessibilityFailures = await page.evaluate(() => {
          const failures = []
          const ids = [...document.querySelectorAll("[id]")].map((element) => element.id).filter(Boolean)
          const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]
          if (duplicateIds.length) failures.push(`duplicate ids: ${duplicateIds.join(", ")}`)
          if (document.querySelector("img:not([alt])")) failures.push("image without alt attribute")
          const unnamedButton = [...document.querySelectorAll("button:not([aria-hidden='true'])")].find((button) =>
            !button.textContent?.trim() && !button.getAttribute("aria-label") && !button.getAttribute("title") && !button.querySelector("img[alt]:not([alt=''])"),
          )
          if (unnamedButton) failures.push(`button without accessible name: ${unnamedButton.outerHTML.slice(0, 160)}`)
          const unnamedLink = [...document.querySelectorAll("a:not([aria-hidden='true'])")].find((link) =>
            !link.textContent?.trim() && !link.getAttribute("aria-label") && !link.getAttribute("title") && !link.querySelector("img[alt]:not([alt=''])"),
          )
          if (unnamedLink) failures.push(`link without accessible name: ${unnamedLink.outerHTML.slice(0, 160)}`)
          const unnamedControl = document.querySelector("form input:not([type='hidden']):not([disabled]):not([name]), form textarea:not([disabled]):not([name]), form select:not([disabled]):not([name])")
          if (unnamedControl) failures.push(`form control without name: ${unnamedControl.outerHTML.slice(0, 160)}`)
          if (document.documentElement.scrollWidth > document.documentElement.clientWidth) failures.push(`horizontal document overflow: ${document.documentElement.scrollWidth}px > ${document.documentElement.clientWidth}px`)
          const nestedPageScroller = [...document.querySelectorAll(".site-frame-root, [data-provider-variant]")].find((element) => {
            const overflow = getComputedStyle(element).overflowY
            return (overflow === "auto" || overflow === "scroll") && element.scrollHeight > element.clientHeight
          })
          if (nestedPageScroller) failures.push(`nested page scrollbar: ${nestedPageScroller.outerHTML.slice(0, 160)}`)
          return failures
        })
        assert.deepEqual(accessibilityFailures, [], `${variant.id} accessibility smoke`)
        const interactive = page.locator('[data-slot="accordion-trigger"]:not([disabled]):not([aria-disabled="true"]), [data-slot="carousel-next"]:not([disabled]), [data-slot="carousel-previous"]:not([disabled])').filter({ visible: true }).first()
        if (await interactive.count()) await interactive.click({ timeout: 5_000 })
        const navbarToggle = page.locator("[data-navbar-toggle]:visible").first()
        if (await navbarToggle.count()) {
          await navbarToggle.click()
          assert.equal(await navbarToggle.getAttribute("aria-expanded"), "true", `${variant.id} ${viewport.name} mobile navigation opens`)
          await navbarToggle.click()
          assert.equal(await navbarToggle.getAttribute("aria-expanded"), "false", `${variant.id} ${viewport.name} mobile navigation closes`)
        }
        // Radix force-mounts flyout content for deterministic SSR. Exercise the
        // desktop trigger only: on mobile its desktop container is off-canvas,
        // which Playwright's `:visible` intentionally does not classify as hidden.
        if (viewport.width >= 768) {
          const navTrigger = page.locator('[data-slot="navigation-menu-trigger"]:visible').first()
          const box = await navTrigger.count() ? await navTrigger.boundingBox({ timeout: 1_000 }) : null
          if (box && box.x < viewport.width && box.y < viewport.height && box.x + box.width > 0 && box.y + box.height > 0) {
            await navTrigger.click({ timeout: 5_000 })
          }
        }
        const themeToggle = page.locator("[data-theme-toggle]:visible").first()
        if (await themeToggle.count()) {
          const before = await page.evaluate(() => ({
            mode: document.documentElement.dataset.siabColorMode,
            background: getComputedStyle(document.documentElement).getPropertyValue("--background"),
          }))
          await themeToggle.click()
          const after = await page.evaluate(() => ({
            mode: document.documentElement.dataset.siabColorMode,
            background: getComputedStyle(document.documentElement).getPropertyValue("--background"),
            stored: localStorage.getItem("siab-color-mode"),
          }))
          assert.equal(after.mode, before.mode === "dark" ? "light" : "dark", `${variant.id} toggles color mode`)
          assert.equal(after.stored, after.mode, `${variant.id} persists color mode`)
          assert.notEqual(after.background, before.background, `${variant.id} changes computed theme tokens`)
          await page.evaluate(() => localStorage.removeItem("siab-color-mode"))
        }
        const consent = page.locator('[data-consent-action="accept"]:visible').first()
        if (await consent.count()) await consent.click()
        await page.waitForTimeout(25)
        assert.deepEqual(failures, [], `${variant.id} ${viewport.name}`)
      }
    } finally {
      await browser.close()
    }
  }
  console.log(`Browser-rendered, hydrated and interaction-checked ${variants.length} provider variants at four desktop/mobile light/dark viewports.`)
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM")
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))])
    if (child.exitCode === null) child.kill("SIGKILL")
  }
  await rm(viteCacheDir, { force: true, recursive: true })
}
