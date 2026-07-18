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
  await waitForRenderer(origin, () => output)
  {
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 1440, height: 1200 } })
      const page = await context.newPage()
      await page.goto(`${origin}/provider-parity?variant=shadcnui-blocks.navbar-02&mode=light&preference=system`, { waitUntil: "load", timeout: 60_000 })
      // The first browser request triggers Vite's one-time dependency
      // optimization/HMR cycle. Let that replacement document hydrate before
      // asserting pre-paint and media-query state.
      await page.waitForFunction(() => document.documentElement.dataset.providerHydrated === "true", undefined, { timeout: 60_000 }).catch((error) => {
        throw new Error(`Provider browser warm-up did not hydrate.\n${output}`, { cause: error })
      })
      await page.waitForTimeout(1_000)
      await page.waitForFunction(() => document.documentElement.dataset.providerHydrated === "true", undefined, { timeout: 60_000 })
      await page.waitForFunction(() => document.documentElement.dataset.siabColorMode === "dark", undefined, { timeout: 60_000 })
      const darkBackground = await page.evaluate(() => getComputedStyle(document.querySelector(".rt-canvas")).getPropertyValue("--background"))
      await page.emulateMedia({ colorScheme: "light" })
      await page.waitForFunction(() => document.documentElement.dataset.siabColorMode === "light")
      const lightBackground = await page.evaluate(() => getComputedStyle(document.querySelector(".rt-canvas")).getPropertyValue("--background"))
      assert.notEqual(lightBackground, darkBackground, "system preference changes computed theme tokens")
      await page.locator("[data-theme-toggle]:visible").first().click()
      assert.equal(await page.evaluate(() => document.documentElement.dataset.siabColorMode), "dark", "navbar writes resolved color mode")
      assert.equal(await page.evaluate(() => localStorage.getItem("siab-color-mode")), "dark", "navbar persists visitor override")
      await page.reload({ waitUntil: "load" })
      await page.waitForFunction(() => document.documentElement.dataset.siabColorMode === "dark")
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".rt-canvas")).getPropertyValue("--background")), darkBackground, "visitor override survives reload")

      await page.goto(`${origin}/provider-parity?variant=shadcnui-blocks.hero-01&mode=light&shape=rounded`, { waitUntil: "load" })
      const roundedButtonRadius = await page.locator('[data-provider-variant="shadcnui-blocks.hero-01"] [data-slot="button"]').first().evaluate((button) => getComputedStyle(button).borderTopLeftRadius)
      const roundedStructuralRadius = await page.locator('[data-provider-variant="shadcnui-blocks.hero-01"] .rounded-full:not([data-slot="button"])').first().evaluate((element) => getComputedStyle(element).borderTopLeftRadius)
      await page.goto(`${origin}/provider-parity?variant=shadcnui-blocks.hero-01&mode=light&shape=sharp`, { waitUntil: "load" })
      const sharpButtonRadius = await page.locator('[data-provider-variant="shadcnui-blocks.hero-01"] [data-slot="button"]').first().evaluate((button) => getComputedStyle(button).borderTopLeftRadius)
      const sharpStructuralRadius = await page.locator('[data-provider-variant="shadcnui-blocks.hero-01"] .rounded-full:not([data-slot="button"])').first().evaluate((element) => getComputedStyle(element).borderTopLeftRadius)
      assert.notEqual(roundedButtonRadius, sharpButtonRadius, "hero-01 semantic buttons follow the selected shape")
      assert.equal(sharpButtonRadius, "0px", "hero-01 semantic buttons become square under Sharp")
      assert.equal(roundedStructuralRadius, sharpStructuralRadius, "hero-01 structural circles remain circular")
    } finally {
      await browser.close()
    }
  }
  {
    const browser = await chromium.launch({ headless: true })
    try {
      for (const viewport of [{ width: 1440, height: 1200 }, { width: 390, height: 844 }]) {
        const page = await browser.newPage({ viewport, colorScheme: "light" })
        await page.goto(`${origin}/provider-parity?variant=shadcnui-blocks.banner-04&consent=1`, { waitUntil: "load", timeout: 60_000 })
        await page.waitForFunction(() => document.documentElement.dataset.providerHydrated === "true", undefined, { timeout: 60_000 })
        const consentChrome = page.locator('[data-siab-cookie-consent="true"]')
        await consentChrome.waitFor({ state: "visible" })
        const before = await consentChrome.evaluate((element) => ({
          bottom: element.getBoundingClientRect().bottom,
          position: getComputedStyle(element).position,
        }))
        await page.evaluate(() => {
          document.body.style.minHeight = "200vh"
          window.scrollTo(0, document.body.scrollHeight)
        })
        const after = await consentChrome.evaluate((element) => ({
          bottom: element.getBoundingClientRect().bottom,
          position: getComputedStyle(element).position,
        }))
        assert.equal(before.position, "fixed", `${viewport.width}px consent chrome is viewport-fixed`)
        assert.equal(after.position, "fixed", `${viewport.width}px consent chrome stays viewport-fixed after scrolling`)
        assert.ok(Math.abs(before.bottom - after.bottom) < 1, `${viewport.width}px consent chrome keeps its viewport position`)
        assert.ok(after.bottom <= viewport.height && after.bottom >= viewport.height - 40, `${viewport.width}px consent chrome remains near the viewport bottom`)
        assert.equal(await page.locator('[data-consent-action="accept"]:visible').count(), 1)
        assert.equal(await page.locator('[data-consent-action="reject"]:visible').count(), 1)
        await page.close()
      }
    } finally {
      await browser.close()
    }
  }
  const catalogVariants = inventory.variants
  assert.equal(catalogVariants.length, 156)
  const requestedVariant = process.env.SIAB_PROVIDER_VARIANT
  const variants = requestedVariant ? catalogVariants.filter((variant) => variant.id === requestedVariant) : catalogVariants
  assert.ok(variants.length, `Unknown SIAB_PROVIDER_VARIANT ${requestedVariant}`)
  for (let offset = 0; offset < variants.length; offset += 8) {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, colorScheme: "light" })
      const tokenFailures = []
      page.on("console", (message) => {
        if (message.type() === "error") tokenFailures.push(`console: ${message.text()}`)
      })
      page.on("pageerror", (error) => tokenFailures.push(`page: ${error.message}`))
      page.on("response", (response) => {
        if (response.status() >= 400) tokenFailures.push(`response: ${response.status()} ${response.url()}`)
      })
      page.on("requestfailed", (request) => tokenFailures.push(`request: ${request.failure()?.errorText ?? "failed"} ${request.url()}`))
      const readTokens = () => page.evaluate(() => {
        const root = document.querySelector("[data-provider-variant]")
        if (!root) throw new Error("Missing provider token root")
        const style = getComputedStyle(root)
        const heading = root.querySelector("h1, h2, h3, h4, h5, h6")
        const shaped = [...new Set([...root.querySelectorAll("*")].flatMap((element) => {
          const classes = typeof element.className === "string" ? element.className : ""
          if (/\*:[^\s]*rounded-(?:sm|md|lg|xl|2xl|3xl|4xl)\b/.test(classes)) return [...element.children]
          if (/\brounded-(?:full|none)\b/.test(classes)) return []
          return /\brounded-(?:sm|md|lg|xl|2xl|3xl|4xl)\b/.test(classes) || /rounded-\[[^\]]*var\(--(?:siab-)?radius-/.test(classes) ? [element] : []
        }))]
        return {
          primary: style.getPropertyValue("--primary").trim(),
          success: style.getPropertyValue("--success").trim(),
          chart1: style.getPropertyValue("--chart-1").trim(),
          radius: style.getPropertyValue("--siab-radius-lg").trim(),
          bodyFont: style.fontFamily,
          headingFont: heading ? getComputedStyle(heading).fontFamily : null,
          shapedRadii: shaped.map((element) => {
            const style = getComputedStyle(element)
            return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius]
          }),
        }
      })
      for (const variant of variants.slice(offset, offset + 8)) {
        tokenFailures.length = 0
        await page.goto(`${origin}/provider-parity?variant=${encodeURIComponent(variant.id)}&mode=light&colors=emerald-calm&fonts=friendly-organic&shape=rounded`, { waitUntil: "load", timeout: 60_000 })
        await page.waitForFunction(() => document.documentElement.dataset.providerHydrated === "true", undefined, { timeout: 60_000 }).catch(async (error) => {
          const state = await page.evaluate(() => ({ url: location.href, body: document.body.innerText.slice(0, 500) })).catch(() => null)
          throw new Error(`${variant.id} did not hydrate under the rounded token preset.\n${JSON.stringify(state)}\n${tokenFailures.join("\n")}\n${output}`, { cause: error })
        })
        const rounded = await readTokens()
        await page.goto(`${origin}/provider-parity?variant=${encodeURIComponent(variant.id)}&mode=light&colors=red-confident&fonts=classic-editorial&shape=sharp`, { waitUntil: "load", timeout: 60_000 })
        await page.waitForFunction(() => document.documentElement.dataset.providerHydrated === "true", undefined, { timeout: 60_000 }).catch(async (error) => {
          const state = await page.evaluate(() => ({ url: location.href, body: document.body.innerText.slice(0, 500) })).catch(() => null)
          throw new Error(`${variant.id} did not hydrate under the sharp token preset.\n${JSON.stringify(state)}\n${tokenFailures.join("\n")}\n${output}`, { cause: error })
        })
        const sharp = await readTokens()
        assert.notEqual(rounded.primary, sharp.primary, `${variant.id} resolves tenant accent colors`)
        assert.notEqual(rounded.chart1, sharp.chart1, `${variant.id} resolves tenant chart colors`)
        assert.ok(rounded.success && sharp.success, `${variant.id} resolves semantic status colors`)
        assert.notEqual(rounded.radius, sharp.radius, `${variant.id} resolves tenant shape`)
        assert.match(rounded.bodyFont, /Nunito/i, `${variant.id} applies the deterministic body font`)
        assert.match(sharp.bodyFont, /Fraunces/i, `${variant.id} applies the selected body font`)
        if (rounded.headingFont && sharp.headingFont) {
          assert.match(rounded.headingFont, /Nunito/i, `${variant.id} applies the deterministic heading font`)
          assert.match(sharp.headingFont, /Fraunces/i, `${variant.id} applies the selected heading font`)
        }
        if (rounded.shapedRadii.length) {
          assert.ok(rounded.shapedRadii.flat().some((radius) => radius !== "0px"), `${variant.id} renders its rounded shape preset`)
          assert.ok(sharp.shapedRadii.flat().every((radius) => radius === "0px"), `${variant.id} renders non-circular UI square under the sharp preset`)
        }
        assert.deepEqual(tokenFailures, [], `${variant.id} token response browser errors`)
      }
    } finally {
      await browser.close()
    }
  }
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
        const providerRoot = page.locator(`[data-provider-variant="${variant.id}"]`)
        await providerRoot.waitFor({ state: "attached" })
        assert.equal(await providerRoot.evaluate((root) => {
          const candidates = [root, ...root.querySelectorAll("*")]
          return candidates.some((element) => {
            const bounds = element.getBoundingClientRect()
            const style = getComputedStyle(element)
            return bounds.width > 0 && bounds.height > 0 && style.display !== "none" && style.visibility !== "hidden"
          })
        }), true, `${variant.id} has visible rendered content`)
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
            background: getComputedStyle(document.querySelector(".rt-canvas")).getPropertyValue("--background"),
          }))
          await themeToggle.click()
          const after = await page.evaluate(() => ({
            mode: document.documentElement.dataset.siabColorMode,
            background: getComputedStyle(document.querySelector(".rt-canvas")).getPropertyValue("--background"),
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
  console.log(`Browser-rendered, token-switched, hydrated and interaction-checked ${variants.length} provider variants at four desktop/mobile light/dark viewports.`)
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM")
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))])
    if (child.exitCode === null) child.kill("SIGKILL")
  }
  await rm(viteCacheDir, { force: true, recursive: true })
}
