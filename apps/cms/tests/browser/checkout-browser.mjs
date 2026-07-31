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

  const domainInput = page.getByLabel("Domain name")
  await domainInput.fill("service-error.nl")
  await page.locator("[data-checkout-main-card]").getByText("service-error.nl", { exact: true }).waitFor()
  assert.equal(await page.getByText("Try again", { exact: true }).isVisible(), true)

  await domainInput.fill("analytical-engines.nl")
  await page.getByText("analytical-engines.com", { exact: true }).waitFor()
  assert.equal(await page.getByText("Unavailable", { exact: true }).isVisible(), true)
  assert.equal(await page.getByText("Premium", { exact: true }).isVisible(), true)
  assert.equal(await page.getByText("Available", { exact: true }).first().isVisible(), true)
  await page.getByText("analytical-engines.nl", { exact: true })
    .locator("xpath=../..").getByRole("button", { name: "Select", exact: true }).click()

  await domainInput.fill("stale-result")
  await domainInput.fill("fresh-result")
  await page.waitForTimeout(800)
  assert.equal(
    await page.getByText(/^stale-result\./).count(),
    0,
    "A superseded domain batch must never restore stale results.",
  )
  assert.equal(
    await page.getByRole("button", { name: "Continue" }).count(),
    0,
    "Changing the domain name must invalidate the previous order selection.",
  )
  await page.getByLabel(".org").click()
  assert.equal(
    await page.getByRole("button", { name: "Continue" }).count(),
    0,
    "Changing selected extensions must invalidate the previous order selection.",
  )
  await domainInput.fill("analytical-engines")
  await page.getByText("analytical-engines.com", { exact: true }).waitFor()
  await page.getByText("analytical-engines.nl", { exact: true })
    .locator("xpath=../..").getByRole("button", { name: "Select", exact: true }).click()

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

  assert.equal(await page.getByText(/Ada Lovelace.*owner@example\.test/).isVisible(), true)
  await page.getByRole("button", { name: "Edit" }).first().click()
  await page.getByRole("dialog").waitFor()
  await page.getByRole("button", { name: "Save and continue" }).click()
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
  assert.equal(
    await page.locator('[role="checkbox"]:visible').count(),
    2,
    "Only the two legally distinct declarations may be visible checkboxes.",
  )
  await page.getByRole("button", { name: /Checkout/ }).click()
  await page.getByRole("alert").filter({ hasText: "Confirm the required declarations" }).waitFor()
  assert.equal(
    await page.locator("#checkout-business-use").evaluate((node) => node === document.activeElement),
    true,
  )
  assert.equal(
    await page.locator("label button, a button, button a").count(),
    0,
    "Checkout must not contain nested interactive controls.",
  )
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
  assert.equal(
    await pendingPage.locator("[data-checkout-action-bar]").evaluate(
      (node) => getComputedStyle(node).position,
    ),
    "fixed",
    "The phone action row must remain visible without overlaying content.",
  )
  await pendingPage.close()

  const compactPage = await browser.newPage({ viewport: { width: 320, height: 568 } })
  compactPage.setDefaultTimeout(5_000)
  await compactPage.goto(origin, { waitUntil: "networkidle" })
  const compactGeometry = await compactPage.evaluate(() => {
    const shell = document.querySelector("[data-checkout-shell]")
    const card = document.querySelector("[data-checkout-main-card]")
    const action = document.querySelector("[data-checkout-action-bar]")
    return {
      fits: document.documentElement.scrollWidth <= innerWidth,
      shellLeft: shell?.getBoundingClientRect().left,
      shellRight: shell?.getBoundingClientRect().right,
      cardLeft: card?.getBoundingClientRect().left,
      cardRight: card?.getBoundingClientRect().right,
      actionPosition: action ? getComputedStyle(action).position : null,
      actionVisible: action
        ? action.getBoundingClientRect().top < innerHeight &&
          action.getBoundingClientRect().bottom > 0
        : false,
    }
  })
  assert.equal(compactGeometry.fits, true, "Checkout overflows a 320x568 viewport.")
  assert.equal(compactGeometry.actionPosition, "fixed")
  assert.equal(compactGeometry.actionVisible, true)
  assert.ok(compactGeometry.shellLeft != null && compactGeometry.cardLeft != null)
  assert.ok(compactGeometry.cardLeft >= compactGeometry.shellLeft)
  assert.ok(compactGeometry.shellRight != null && compactGeometry.cardRight != null)
  assert.ok(compactGeometry.cardRight <= compactGeometry.shellRight)
  assert.ok(
    Math.abs(compactGeometry.cardLeft - (320 - compactGeometry.cardRight)) <= 1,
    "The checkout card must use balanced shell gutters at 320px.",
  )
  await compactPage.close()

  const tabletPage = await browser.newPage({ viewport: { width: 768, height: 720 } })
  tabletPage.setDefaultTimeout(5_000)
  await tabletPage.goto(origin, { waitUntil: "networkidle" })
  assert.equal(
    await tabletPage.locator("[data-checkout-action-bar]").evaluate(
      (node) => getComputedStyle(node).position,
    ),
    "fixed",
    "The mobile action pattern must not disappear in the tablet breakpoint gap.",
  )
  await tabletPage.close()

  const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  desktopPage.setDefaultTimeout(5_000)
  await desktopPage.goto(`${origin}?payment=pending`, { waitUntil: "networkidle" })
  await desktopPage.getByRole("heading", { name: "Subscription & review" }).waitFor()
  const assertStickySummary = async (state) => {
    const summary = desktopPage.locator("[data-checkout-summary]")
    assert.equal(await summary.isVisible(), true, `Desktop summary missing on ${state}.`)
    assert.equal(
      await summary.evaluate((node) => getComputedStyle(node).position),
      "sticky",
      `Desktop summary is not sticky on ${state}.`,
    )
  }
  await assertStickySummary("overview")
  await desktopPage.getByRole("button", { name: "Details" }).click()
  await desktopPage.getByRole("heading", { name: "Review your details" }).waitFor()
  await assertStickySummary("details")
  await desktopPage.getByRole("button", { name: "Domain" }).click()
  await desktopPage.getByRole("heading", { name: "Domain name" }).waitFor()
  await assertStickySummary("domain")
  await desktopPage.close()

  const themePage = await browser.newPage({ viewport: { width: 320, height: 568 } })
  themePage.setDefaultTimeout(5_000)
  await themePage.emulateMedia({ colorScheme: "light" })
  await themePage.addInitScript(() => {
    if (!localStorage.getItem("theme")) localStorage.setItem("theme", "system")
  })
  await themePage.goto(origin, { waitUntil: "networkidle" })
  const systemLight = await themePage.evaluate(() => ({
    dark: document.documentElement.classList.contains("dark"),
    background: getComputedStyle(document.body).backgroundColor,
    fits: document.documentElement.scrollWidth <= innerWidth,
  }))
  assert.equal(systemLight.dark, false)
  assert.equal(systemLight.fits, true)
  await themePage.evaluate(() => localStorage.setItem("theme", "dark"))
  await themePage.reload({ waitUntil: "networkidle" })
  const explicitDark = await themePage.evaluate(() => ({
    dark: document.documentElement.classList.contains("dark"),
    background: getComputedStyle(document.body).backgroundColor,
    fits: document.documentElement.scrollWidth <= innerWidth,
  }))
  assert.equal(explicitDark.dark, true)
  assert.notEqual(explicitDark.background, systemLight.background)
  assert.equal(explicitDark.fits, true)
  await themePage.close()

  const unsupportedPage = await browser.newPage({
    viewport: { width: 320, height: 700 },
  })
  unsupportedPage.setDefaultTimeout(5_000)
  await unsupportedPage.goto(`${origin}?existing=unsupported`, {
    waitUntil: "networkidle",
  })
  await unsupportedPage.getByText("Existing domain", { exact: true }).click()
  await unsupportedPage.getByLabel("Domain name").fill("existing-example.nl")
  await unsupportedPage.getByRole("button", { name: "Check domain" }).click()
  await unsupportedPage.getByRole("alert").filter({
    hasText: "No safe automatic DNS source is available",
  }).waitFor()
  assert.equal(
    await unsupportedPage.getByRole("button", {
      name: "Connect Cloudflare securely",
    }).count(),
    0,
  )
  assert.equal(await unsupportedPage.getByLabel("Domain name").isEnabled(), true)
  assert.equal(
    await unsupportedPage.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth),
    true,
    "Unsupported existing-domain state overflows a 320px viewport.",
  )
  await unsupportedPage.close()

  const axfrPage = await browser.newPage({
    viewport: { width: 320, height: 760 },
  })
  axfrPage.setDefaultTimeout(5_000)
  await axfrPage.goto(`${origin}?existing=axfr`, { waitUntil: "networkidle" })
  await axfrPage.getByText("Existing domain", { exact: true }).click()
  await axfrPage.getByLabel("Domain name").fill("existing-example.nl")
  await axfrPage.getByRole("button", { name: "Check domain" }).click()
  await axfrPage.getByLabel("Authorized nameserver").waitFor()
  await axfrPage.getByLabel(/Transfer code/).fill("browser-transfer-code")
  await axfrPage.getByLabel(
    /I am authorized to transfer this customer-owned domain/,
  ).check()
  await axfrPage.getByRole("button", {
    name: "Verify complete DNS source",
  }).click()
  await axfrPage.getByRole("button", { name: "Continue" }).click()
  await axfrPage.getByRole("heading", { name: "Review your details" }).waitFor()
  await axfrPage.getByRole("button", { name: "Continue" }).click()
  await axfrPage.getByRole("heading", {
    name: "Subscription & review",
  }).waitFor()
  assert.equal(
    await axfrPage.getByText(
      "Effect of the domain transfer on renewal",
    ).isVisible(),
    true,
  )
  assert.equal(
    await axfrPage.getByText(
      "The current renewal date remains unchanged.",
    ).isVisible(),
    true,
  )
  assert.equal(
    await axfrPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    "AXFR checkout overflows a 320px viewport.",
  )
  await axfrPage.close()

  const cloudflarePage = await browser.newPage({
    viewport: { width: 320, height: 760 },
  })
  cloudflarePage.setDefaultTimeout(5_000)
  await cloudflarePage.goto(`${origin}?existing=cloudflare`, {
    waitUntil: "networkidle",
  })
  await cloudflarePage.getByText("Cloudflare connected securely").waitFor()
  assert.equal(
    await cloudflarePage.getByText(/temporary zone-scoped token/).count(),
    0,
  )
  await cloudflarePage.getByLabel(/Transfer code/).fill("browser-transfer-code")
  await cloudflarePage.getByLabel(
    /I am authorized to transfer this customer-owned domain/,
  ).check()
  await cloudflarePage.getByRole("button", { name: "Check domain" }).click()
  await cloudflarePage.getByRole("button", { name: "Continue" }).waitFor()
  assert.equal(
    await cloudflarePage.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth),
    true,
    "Cloudflare transfer checkout overflows a 320px viewport.",
  )
  await cloudflarePage.close()
  process.stdout.write("Checkout Chromium contract passed.\n")
} finally {
  await browser?.close()
  await server.close()
}
