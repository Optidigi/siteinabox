import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { chromium } from "playwright"
import { createServer } from "vite"

const browserRoot = path.dirname(fileURLToPath(import.meta.url))
const cmsRoot = path.resolve(browserRoot, "../..")
const server = await createServer({
  root: browserRoot,
  configFile: false,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.join(cmsRoot, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 0,
    strictPort: false,
  },
})

let browser
try {
  await server.listen()
  const origin = server.resolvedUrls?.local[0]
  assert.ok(origin, "Vite did not expose a local checkout test URL.")
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
  })
  page.setDefaultTimeout(5_000)
  const pageErrors = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await page.goto(origin, { waitUntil: "networkidle" })

  const steps = page.locator("ol > li")
  assert.equal(await steps.count(), 3)
  assert.equal(await steps.nth(0).getAttribute("aria-current"), "step")
  assert.equal(await steps.nth(0).getAttribute("aria-label"), "Domain")
  assert.equal(await steps.nth(1).getAttribute("aria-label"), "Details")
  assert.equal(
    await steps.nth(2).getAttribute("aria-label"),
    "Subscription & review",
  )
  assert.equal(await page.locator("[aria-live]").count() > 0, true)
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    "Checkout overflows a 390px viewport.",
  )

  const continueButton = page.getByRole("button", { name: "Continue" })
  await continueButton.focus()
  await page.keyboard.press("Enter")
  await page.getByRole("heading", { name: "Review your details" }).waitFor()
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent?.trim()),
    "Review your details",
  )

  const domainStepButton = page.getByRole("button", { name: "Domain" })
  const target = await domainStepButton.boundingBox()
  assert.ok(target && target.width >= 44 && target.height >= 44)
  assert.equal(await domainStepButton.isVisible(), true)

  await page.getByRole("button", { name: "Continue" }).click()
  const errorSummary = page.getByLabel("Review these fields")
  await errorSummary.waitFor()
  assert.equal(await errorSummary.evaluate((node) => node === document.activeElement), true)
  await page.getByRole("link", { name: "First name requires confirmation." }).click()
  assert.equal(
    await page.getByLabel("First name").evaluate((node) => node === document.activeElement),
    true,
  )
  await page.getByLabel("First name").fill("Ada Updated")
  process.stdout.write("Checkout validation/focus contract passed.\n")

  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByRole("heading", { name: "Subscription & review" }).waitFor()
  assert.equal(await page.getByText(/229[.,]90/, { exact: false }).first().isVisible(), true)
  assert.equal(pageErrors.length, 0, pageErrors.join("\n"))
  process.stdout.write("Checkout keyboard/price contract passed.\n")

  const pendingPage = await browser.newPage({
    viewport: { width: 320, height: 700 },
  })
  pendingPage.setDefaultTimeout(5_000)
  await pendingPage.goto(`${origin}?payment=pending`, { waitUntil: "networkidle" })
  await pendingPage.getByRole("heading", { name: "Subscription & review" }).waitFor()
  const mobileOverflow = await pendingPage.evaluate(() => ({
    fits: document.documentElement.scrollWidth <= innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
    boxSizing: getComputedStyle(document.querySelector("main > div")).boxSizing,
    bodyMargin: getComputedStyle(document.body).margin,
    offenders: [...document.querySelectorAll("body *")]
      .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        className: element.getAttribute("class"),
        text: element.textContent?.trim().slice(0, 80),
        right: Math.round(element.getBoundingClientRect().right),
      })),
  }))
  assert.equal(
    mobileOverflow.fits,
    true,
    `Checkout overflows a 320px viewport: ${JSON.stringify(mobileOverflow)}`,
  )
  assert.equal(
    await pendingPage.getByRole("button", { name: "Checkout" }).isDisabled(),
    true,
  )
  await pendingPage.close()
  process.stdout.write("Checkout Chromium contract passed.\n")
} finally {
  await browser?.close()
  await server.close()
}
