import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { chromium } from "playwright"
import { createServer } from "vite"
import {
  assertCheckoutGeometry,
  checkoutGeometry,
  checkoutVisualCases,
} from "./checkout-visual-regression.mjs"

const browserRoot = path.dirname(fileURLToPath(import.meta.url))
const cmsRoot = path.resolve(browserRoot, "../..")
const screenshotRoot = process.env.CHECKOUT_SCREENSHOT_DIR
if (screenshotRoot) await fs.mkdir(screenshotRoot, { recursive: true })
const visualMatrixRoot = process.env.CHECKOUT_VISUAL_MATRIX_DIR
if (visualMatrixRoot) await fs.mkdir(visualMatrixRoot, { recursive: true })
const capture = async (page, name, dark = false) => {
  if (!screenshotRoot) return
  await page.evaluate(async (useDark) => {
    document.documentElement.classList.toggle("dark", useDark)
    await new Promise((resolve) => setTimeout(resolve, 200))
  }, dark)
  await page.screenshot({ path: path.join(screenshotRoot, `${name}.png`) })
}
const server = await createServer({
  root: browserRoot,
  publicDir: path.join(cmsRoot, "public"),
  configFile: false,
  plugins: [react(), {
    name: "checkout-domain-search-fixture",
    configureServer(viteServer) {
      viteServer.middlewares.use("/checkout/domain-search", (request, response) => {
        let raw = ""
        request.on("data", (chunk) => { raw += chunk })
        request.on("end", async () => {
          const body = JSON.parse(raw || "{}")
          if (String(body.query ?? "").includes("service-error")) {
            response.statusCode = 502
            response.setHeader("Content-Type", "application/json")
            response.end(JSON.stringify({ ok: false, results: [], hasMore: false }))
            return
          }
          const query = String(body.query ?? "").replace(/\..*$/, "")
          if (query === "loading-state") {
            await new Promise((resolve) => setTimeout(resolve, 1_000))
          }
          const extensions = body.mode === "more" ? ["net", "be", "de", "online", "shop"] : ["nl", "com", "info", "org", "eu"]
          const results = extensions.map((extension) => ({ domain: `${query}.${extension}`, availability: extension === "com" ? "unavailable" : extension === "eu" ? "premium" : "available", purchasable: !["com", "eu"].includes(extension), included: true, extraFee: null, checkedAt: "2026-08-03T10:00:00.000Z" }))
          response.setHeader("Content-Type", "application/json")
          response.end(JSON.stringify({ ok: true, results, hasMore: body.mode !== "more" }))
        })
      })
    },
  }],
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
  await page.context().route("**/checkout/domain-search", async (route) => {
    const body = route.request().postDataJSON()
    const query = String(body.query ?? "").replace(/\..*$/, "")
    const mode = body.mode === "more" ? "more" : "primary"
    if (String(body.query).includes("service-error")) {
      await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, results: [], hasMore: false }) })
      return
    }
    if (query === "stale-result") await new Promise((resolve) => setTimeout(resolve, 700))
    const extensions = mode === "more"
      ? ["net", "be", "de", "online", "shop"]
      : ["nl", "com", "info", "org", "eu"]
    const results = extensions.map((extension) => ({
      domain: `${query}.${extension}`,
      availability: extension === "com" ? "unavailable" : extension === "eu" ? "premium" : "available",
      purchasable: !["com", "eu"].includes(extension),
      included: true,
      extraFee: null,
      checkedAt: "2026-08-03T10:00:00.000Z",
    }))
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, results, hasMore: mode === "primary" }) })
  })
  await page.goto(origin, { waitUntil: "networkidle" })

  await page.getByRole("heading", { name: "Put your website online" }).waitFor()
  assert.equal(await page.getByText("Only check what is still needed. Your details and design are saved.").isVisible(), true)
  assert.equal(await page.locator("[aria-live]").count() > 0, true)
  const phoneProgress = await page.locator("[data-checkout-mobile-progress]").evaluate((node) => {
    const box = node.getBoundingClientRect()
    return { height: box.height, left: box.left, right: box.right }
  })
  assert.ok(phoneProgress.height >= 80, "The phone progress panel must retain its intended presence.")
  const accessibleProgress = page.getByRole("progressbar", { name: "Website address" })
  assert.equal(await accessibleProgress.getAttribute("aria-valuenow"), "1")
  assert.equal(await accessibleProgress.getAttribute("aria-valuemax"), "2")
  assert.equal(await accessibleProgress.getByText("Step 1 of 2", { exact: true }).isVisible(), true)
  assert.equal(await accessibleProgress.getByText("Choose or connect", { exact: true }).isVisible(), true)
  assert.equal(await page.locator('[data-checkout-progress-segment][data-complete="true"]').count(), 1)
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    "Checkout overflows a 390px viewport.",
  )
  assert.equal(
    await page.locator('#checkout-domain-form [role="checkbox"], #checkout-domain-form input[type="checkbox"]').count(),
    0,
    "The prototype domain search must not expose an extension selector.",
  )
  assert.equal(
    await page.getByRole("button", { name: "Check availability", exact: true }).count(),
    1,
    "The domain sheet must expose one availability action.",
  )

  const domainInput = page.locator("#checkout-domain")
  await domainInput.fill("service-error.nl")
  assert.equal(await page.getByRole("alert").count(), 0, "Typing alone must not check availability.")
  await page.getByRole("button", { name: "Check availability", exact: true }).click()
  await page.getByRole("alert").first().waitFor()
  assert.equal(await page.getByRole("button", { name: "Check again", exact: true }).isVisible(), true)

  await domainInput.fill("analytical-engines.nl")
  await page.getByRole("button", { name: "Check availability", exact: true }).click()
  await page.getByText("analytical-engines.nl", { exact: true }).waitFor()
  assert.equal(
    await page.getByText("analytical-engines.com", { exact: true }).count(),
    1,
    "Primary discovery must preserve the server-owned candidate order and status.",
  )
  assert.equal(await page.getByText("analytical-engines.net", { exact: true }).count(), 0)
  await page.getByRole("button", { name: "Show more extensions", exact: true }).click()
  await page.getByText("analytical-engines.net", { exact: true }).waitFor()
  await domainInput.fill("analytical-engines")
  await page.getByRole("button", { name: "Check availability", exact: true }).click()
  await page.getByRole("button", { name: "Show more extensions", exact: true }).click()
  await page.getByText("analytical-engines.net", { exact: true }).waitFor()
  await page.setViewportSize({ width: 320, height: 568 })
  await page.getByText("Live results", { exact: true }).evaluate((node) => {
    node.scrollIntoView({ block: "start" })
    window.scrollBy(0, -64)
  })
  await capture(page, "phone-light-domain-results-320x568")
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.getByText("Unavailable", { exact: true }).count(), 1)
  assert.equal(await page.getByText("Premium", { exact: true }).count(), 1)
  assert.equal(await page.getByText("Available", { exact: true }).first().isVisible(), true)
  const domainOrderBeforeSelection = await page.locator("[data-domain-status]").evaluateAll((rows) =>
    rows.map((row) => row.querySelector("strong")?.textContent?.trim()))
  await page.locator('[data-domain-status="available"]', { hasText: "analytical-engines.nl" })
    .getByRole("button", { name: "Choose", exact: true }).click()
  assert.deepEqual(
    await page.locator("[data-domain-status]").evaluateAll((rows) =>
      rows.map((row) => row.querySelector("strong")?.textContent?.trim())),
    domainOrderBeforeSelection,
    "Selecting a domain must not reorder discovery rows.",
  )
  assert.equal(await domainInput.inputValue(), "analytical-engines")

  await domainInput.fill("stale-result")
  await page.getByRole("button", { name: "Check availability", exact: true }).click()
  await domainInput.fill("fresh-result")
  await page.getByRole("button", { name: "Check availability", exact: true }).click()
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
  assert.equal(
    await page.getByRole("button", { name: /^\.[a-z]+$/ }).count(),
    0,
    "Automatic extension checks must not expose a separate extension picker.",
  )
  await domainInput.fill("analytical-engines")
  await page.getByRole("button", { name: "Check availability", exact: true }).click()
  await page.getByRole("button", { name: "Show more extensions", exact: true }).click()
  await page.getByText("analytical-engines.net", { exact: true }).waitFor()
  await page.locator('[data-domain-status="available"]', { hasText: "analytical-engines.nl" })
    .getByRole("button", { name: "Choose", exact: true }).click()

  const continueButton = page.getByRole("button", { name: "Continue" })
  const desktopReviewButton = page.getByRole("button", {
    name: "Review details",
    exact: true,
    includeHidden: true,
  })
  assert.equal(await desktopReviewButton.getAttribute("data-variant"), "brand")
  await continueButton.focus()
  await page.keyboard.press("Enter")
  await page.getByRole("heading", { name: "Review & pay" }).waitFor()
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent?.trim()),
    "Review & pay",
  )

  const reviewProgress = page.getByRole("progressbar", { name: "Review & pay" })
  assert.equal(await reviewProgress.getAttribute("aria-valuenow"), "2")
  assert.equal(await reviewProgress.getByText("Step 2 of 2", { exact: true }).isVisible(), true)
  assert.equal(await reviewProgress.getByText("Confirm and launch", { exact: true }).isVisible(), true)
  assert.equal(await page.locator('[data-checkout-progress-segment][data-complete="true"]').count(), 2)

  assert.equal(await page.getByText("Ada Lovelace", { exact: true }).isVisible(), true)
  await page.locator('[data-details-group="contact"] [aria-expanded="false"]').click()
  assert.equal(await page.getByText("owner@example.test", { exact: true }).first().isVisible(), true)
  assert.equal(await page.locator("[data-details-group]").count(), 5)
  assert.equal(await page.locator('[data-details-group="contact"]').getByRole("button", { name: /Edit contact/i }).isVisible(), true)
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
  await page.getByRole("button", { name: "Save and continue" }).click()
  process.stdout.write("Checkout validation/focus contract passed.\n")

  await page
    .getByRole("heading", { name: "Plan" })
    .waitFor()
  assert.match(
    await page.locator('[data-slot="toggle-group-item"][data-state="on"]').textContent(),
    /Monthly/,
    "A fresh checkout must default to the monthly plan.",
  )
  await page.setViewportSize({ width: 1280, height: 900 })
  await capture(page, "desktop-light-review-ready")
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.locator("[data-checkout-action-bar]").getByText(/22[.,]99/, { exact: false }).first().isVisible(), true)
  assert.equal(
    await page.locator('[role="checkbox"]:visible').count(),
    2,
    "Terms/privacy and website approval must be the two required checkout confirmations.",
  )
  const payButton = page.getByRole("button", { name: /Approve & pay/ })
  assert.equal(await payButton.isDisabled(), true, "Payment stays unavailable until every required confirmation is accepted.")
  await page.locator("#checkout-terms").check()
  assert.equal(await payButton.isDisabled(), true)
  await page.locator("#checkout-preview-approval").check()
  assert.equal(await payButton.isEnabled(), true, "Payment becomes available only after all required confirmations are accepted.")
  await page.setViewportSize({ width: 320, height: 568 })
  await capture(page, "phone-dark-declarations-ready-320x568", true)
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
  await pendingPage.getByRole("heading", { name: "Launch website" }).waitFor()
  await capture(pendingPage, "phone-dark-payment-pending-320x700", true)
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
  assert.equal(await pendingPage.getByRole("button", { name: /Approve & pay/ }).count(), 0)
  assert.equal(await pendingPage.locator("[data-checkout-action-bar]").count(), 0)
  assert.equal(await pendingPage.locator("[data-checkout-mobile-progress]").isVisible(), true)
  assert.equal(await pendingPage.getByRole("progressbar", { name: "Review & pay" }).getAttribute("aria-valuenow"), "2")
  await pendingPage.close()

  const failedPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  failedPage.setDefaultTimeout(5_000)
  await failedPage.goto(`${origin}?scenario=payment-failed`, { waitUntil: "networkidle" })
  await failedPage.getByRole("heading", { name: "Launch website" }).waitFor()
  await capture(failedPage, "desktop-dark-payment-failed", true)
  await failedPage.close()

  const compactPage = await browser.newPage({ viewport: { width: 320, height: 568 } })
  compactPage.setDefaultTimeout(5_000)
  await compactPage.goto(origin, { waitUntil: "networkidle" })
  const domainControlGeometry = await compactPage.evaluate(() => {
    const input = document.querySelector("#checkout-domain")
    const submit = document.querySelector('#checkout-domain-form button[type="submit"]')
    return {
      inputHeight: input?.getBoundingClientRect().height,
      submitHeight: submit?.getBoundingClientRect().height,
    }
  })
  assert.equal(domainControlGeometry.inputHeight, 48, "The prototype domain input is 48px high.")
  assert.equal(domainControlGeometry.submitHeight, 44, "The prototype domain check action is 44px high.")
  assert.equal(
    await compactPage.locator("[data-checkout-action-bar]").count(),
    0,
    "The phone action row must not compete with domain search before a domain is selected.",
  )
  await compactPage.locator("#checkout-domain").fill("analytical-engines")
  await compactPage.getByRole("button", { name: "Check availability", exact: true }).click()
  await compactPage.getByText("analytical-engines.nl", { exact: true }).waitFor()
  await compactPage.getByRole("button", { name: "Show more extensions", exact: true }).click()
  await compactPage.getByText("analytical-engines.net", { exact: true }).waitFor()
  await compactPage.locator('[data-domain-status="available"]', { hasText: "analytical-engines.nl" })
    .getByRole("button", { name: "Choose", exact: true }).click()
  const compactGeometry = await compactPage.evaluate(() => {
    const shell = document.querySelector("[data-checkout-shell]")
    const card = document.querySelector("[data-checkout-main-card]")
    const progress = shell?.querySelector("[data-checkout-mobile-progress]")
    const action = document.querySelector("[data-checkout-action-bar]")
    return {
      fits: document.documentElement.scrollWidth <= innerWidth,
      shellLeft: shell?.getBoundingClientRect().left,
      shellRight: shell?.getBoundingClientRect().right,
      shellWidth: shell?.getBoundingClientRect().width,
      cardLeft: card?.getBoundingClientRect().left,
      cardRight: card?.getBoundingClientRect().right,
      progressLeft: progress?.getBoundingClientRect().left,
      progressRight: progress?.getBoundingClientRect().right,
      progressHeight: progress?.getBoundingClientRect().height,
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
  assert.equal(compactGeometry.progressLeft, compactGeometry.cardLeft)
  assert.equal(compactGeometry.progressRight, compactGeometry.cardRight)
  assert.ok(
    compactGeometry.progressHeight != null &&
      compactGeometry.progressHeight >= 60 &&
      compactGeometry.progressHeight <= 120,
    "The compact progress panel must stay prominent without dominating the viewport.",
  )
  assert.equal(compactGeometry.shellWidth, 300, "The 320px prototype workspace is 300px wide.")
  assert.ok(
    compactGeometry.shellLeft != null && Math.abs(compactGeometry.shellLeft - 10) <= 1,
    "The phone workspace must keep the prototype's 10px left gutter.",
  )
  assert.ok(
    compactGeometry.cardRight != null && Math.abs(320 - compactGeometry.cardRight - 10) <= 1,
    "The phone workspace must remain centered with the prototype's 10px outer gutter.",
  )
  await compactPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const nonOverlayGeometry = await compactPage.evaluate(() => {
    const card = document.querySelector("[data-checkout-main-card]")
    const action = document.querySelector("[data-checkout-action-bar]")
    return {
      cardBottom: card?.getBoundingClientRect().bottom,
      actionTop: action?.getBoundingClientRect().top,
    }
  })
  assert.ok(
    nonOverlayGeometry.cardBottom != null &&
      nonOverlayGeometry.actionTop != null &&
      nonOverlayGeometry.cardBottom <= nonOverlayGeometry.actionTop + 1,
    "The fixed phone action row must not cover checkout content at the end of the workspace.",
  )
  await compactPage.close()

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 768, height: 900 },
  ]) {
    const responsivePage = await browser.newPage({ viewport })
    responsivePage.setDefaultTimeout(5_000)
    await responsivePage.goto(`${origin}?scenario=review-ready`, { waitUntil: "networkidle" })
    assert.equal(
      await responsivePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `Checkout overflows a ${viewport.width}x${viewport.height} viewport.`,
    )
    assert.equal(
      await responsivePage.locator("[data-checkout-action-bar]").isVisible(),
      true,
      `The mobile action row must remain visible at ${viewport.width}px.`,
    )
    assert.equal(
      await responsivePage.locator("[data-checkout-summary]").isVisible(),
      false,
      `The permanent summary rail must remain hidden below 880px (${viewport.width}px).`,
    )
    await responsivePage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const terminalClearance = await responsivePage.evaluate(() => {
      const card = document.querySelector("[data-checkout-main-card]")
      const action = document.querySelector("[data-checkout-action-bar]")
      return {
        cardBottom: card?.getBoundingClientRect().bottom,
        actionTop: action?.getBoundingClientRect().top,
      }
    })
    assert.ok(
      terminalClearance.cardBottom != null &&
        terminalClearance.actionTop != null &&
        terminalClearance.cardBottom <= terminalClearance.actionTop + 1,
      `The fixed action row covers terminal content at ${viewport.width}x${viewport.height}.`,
    )
    await responsivePage.close()
  }

  const tabletPage = await browser.newPage({ viewport: { width: 880, height: 720 } })
  tabletPage.setDefaultTimeout(5_000)
  await tabletPage.goto(origin, { waitUntil: "networkidle" })
  assert.equal(
    await tabletPage.locator("[data-checkout-action-bar]").isVisible(),
    false,
    "The phone action row must yield to the desktop summary at the two-column breakpoint.",
  )
  assert.equal(
    await tabletPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    "Checkout overflows at the 880px responsive boundary.",
  )
  assert.equal(
    await tabletPage.locator("[data-checkout-summary]").isVisible(),
    true,
    "The compact summary must occupy the second column once the two-column layout begins.",
  )
  assert.equal(
    await tabletPage.locator("[data-checkout-summary]").evaluate(
      (node) => getComputedStyle(node).position,
    ),
    "sticky",
    "The 880px two-column summary must remain sticky.",
  )
  assert.equal(
    await tabletPage.locator("[data-checkout-summary]").getByRole("button").count(),
    0,
    "The address-step summary must stay informational; domain actions belong to the launch sheet.",
  )
  await tabletPage.close()

  const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  desktopPage.setDefaultTimeout(5_000)
  await desktopPage.goto(`${origin}?scenario=review-ready`, { waitUntil: "networkidle" })
  await desktopPage.getByRole("heading", { name: /launch$/i }).first().waitFor()
  const desktopGeometry = await desktopPage.evaluate(() => {
    const shell = document.querySelector("[data-checkout-shell]")
    const card = document.querySelector("[data-checkout-main-card]")
    const launchSheet = card?.parentElement
    const summary = document.querySelector("[data-checkout-summary]")
    const grid = summary?.parentElement
    const shellBox = shell?.getBoundingClientRect()
    const sheetBox = launchSheet?.getBoundingClientRect()
    const summaryBox = summary?.getBoundingClientRect()
    return {
      shellLeft: shellBox?.left,
      shellWidth: shellBox?.width,
      sheetWidth: sheetBox?.width,
      summaryWidth: summaryBox?.width,
      gap: sheetBox && summaryBox ? summaryBox.left - sheetBox.right : null,
      gridColumns: grid ? getComputedStyle(grid).gridTemplateColumns : null,
      sheetRadius: launchSheet ? getComputedStyle(launchSheet).borderRadius : null,
    }
  })
  assert.equal(desktopGeometry.shellLeft, 48, "The widened 1280px workspace must remain centered.")
  assert.equal(desktopGeometry.shellWidth, 1184, "The desktop workspace is wide enough for the customer price rail.")
  assert.equal(desktopGeometry.sheetWidth, 818, "The desktop launch sheet fills the widened workspace.")
  assert.equal(desktopGeometry.summaryWidth, 348, "The desktop summary rail is 348px wide.")
  assert.equal(desktopGeometry.gap, 18, "The desktop sheet-to-summary gap is 18px.")
  assert.equal(desktopGeometry.gridColumns, "818px 348px")
  assert.equal(desktopGeometry.sheetRadius, "22px")
  const assertStickySummary = async (state) => {
    const summary = desktopPage.locator("[data-checkout-summary]")
    assert.equal(await summary.isVisible(), true, `Desktop summary missing on ${state}.`)
    assert.equal(
      await summary.evaluate((node) => getComputedStyle(node).position),
      "sticky",
      `Desktop summary is not sticky on ${state}.`,
    )
  }
  await assertStickySummary("review")
  await desktopPage.locator('[data-details-group="account"]')
    .getByRole("button", { name: /Edit/ }).click()
  await desktopPage.getByRole("progressbar", { name: "Website address" })
    .getByRole("heading", { name: "Website address", exact: true }).waitFor()
  await assertStickySummary("domain")
  await desktopPage.close()

  const fulfilledPage = await browser.newPage({ viewport: { width: 390, height: 844 } })
  fulfilledPage.setDefaultTimeout(5_000)
  await fulfilledPage.goto(`${origin}?state=fulfilled`, { waitUntil: "networkidle" })
  await fulfilledPage.getByText("analytical-engines.nl", { exact: false }).first().waitFor()
  await capture(fulfilledPage, "phone-dark-fulfilment-complete-390x844", true)
  assert.equal(
    await fulfilledPage.locator("[data-checkout-action-bar]").count(),
    0,
    "Fulfilment must replace the editable checkout action state.",
  )
  assert.equal(await fulfilledPage.locator('section[role="status"] ol > li').count(), 6)
  assert.equal(await fulfilledPage.locator('[role="checkbox"]').count(), 0)
  assert.equal(
    await fulfilledPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    "Fulfilment overflows a 390px phone viewport.",
  )
  assert.equal(
    await fulfilledPage.locator("label button, a button, button a").count(),
    0,
    "Fulfilment must not introduce nested interactive controls.",
  )
  await fulfilledPage.close()

  const transferActionPage = await browser.newPage({ viewport: { width: 320, height: 568 } })
  transferActionPage.setDefaultTimeout(5_000)
  await transferActionPage.goto(`${origin}?scenario=fulfilment-action-transfer`, { waitUntil: "networkidle" })
  const transferAction = transferActionPage.getByText("Enter your transfer code", { exact: true })
  await transferAction.waitFor()
  await transferAction.scrollIntoViewIfNeeded()
  assert.equal(await transferActionPage.getByLabel("New transfer code").isVisible(), true)
  assert.equal(await transferActionPage.getByRole("button", { name: "Continue transfer" }).isVisible(), true)
  await capture(transferActionPage, "phone-dark-fulfilment-action-transfer-320x568", true)
  await transferActionPage.close()

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

  const existingReadyPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  existingReadyPage.setDefaultTimeout(5_000)
  await existingReadyPage.goto(`${origin}?scenario=existing-ready&existing=cloudflare-ready`, { waitUntil: "networkidle" })
  await existingReadyPage.getByText("Use an existing domain", { exact: true }).click()
  await existingReadyPage.locator("#checkout-domain").fill("existing-example.nl")
  await existingReadyPage.getByRole("button", { name: "Check connection" }).click()
  await existingReadyPage.getByRole("status").getByText("We found a low-risk path", { exact: false }).waitFor()
  const cloudflareMigrationRadio = existingReadyPage.getByRole("radio", {
    name: "My DNS is on Cloudflare — authorize read-only access for this domain through Cloudflare",
  })
  const axfrMigrationRadio = existingReadyPage.getByRole("radio", {
    name: "My DNS provider permits an authorized AXFR",
  })
  const cloudflareMigrationCard = existingReadyPage.locator(
    '[data-migration-source-card="cloudflare_api_v1"]',
  )
  assert.equal(await cloudflareMigrationRadio.getAttribute("aria-checked"), "true")
  assert.deepEqual(await cloudflareMigrationRadio.evaluate((node) => {
    const box = node.getBoundingClientRect()
    return { width: box.width, height: box.height }
  }), { width: 16, height: 16 })
  await cloudflareMigrationCard.click({ position: { x: 500, y: 36 } })
  assert.equal(await cloudflareMigrationRadio.getAttribute("aria-checked"), "true")
  const axfrMigrationCard = existingReadyPage.locator(
    '[data-migration-source-card="authorized_axfr_v1"]',
  )
  await axfrMigrationCard.click({ position: { x: 500, y: 36 } })
  assert.equal(await axfrMigrationRadio.getAttribute("aria-checked"), "true")
  const selectedCardColors = await axfrMigrationCard.evaluate((node) => {
    const style = getComputedStyle(node)
    return { background: style.backgroundColor, foreground: style.color }
  })
  assert.notEqual(
    selectedCardColors.background,
    selectedCardColors.foreground,
    "The selected migration card must not invert into a foreground-colored slab.",
  )
  await axfrMigrationCard.scrollIntoViewIfNeeded()
  await capture(existingReadyPage, "desktop-dark-existing-cloudflare-ready", true)
  await existingReadyPage.close()

  const unsupportedPage = await browser.newPage({
    viewport: { width: 320, height: 700 },
  })
  unsupportedPage.setDefaultTimeout(5_000)
  await unsupportedPage.goto(`${origin}?existing=unsupported`, {
    waitUntil: "networkidle",
  })
  await unsupportedPage.getByText("Use an existing domain", { exact: true }).click()
  await unsupportedPage.locator("#checkout-domain").fill("existing-example.nl")
  await unsupportedPage.getByRole("button", { name: "Check connection" }).click()
  await unsupportedPage.getByRole("alert").filter({
    hasText: "No safe automatic DNS source is available",
  }).waitFor()
  assert.equal(
    await unsupportedPage.getByRole("button", {
      name: "Connect Cloudflare securely",
    }).count(),
    0,
  )
  assert.equal(await unsupportedPage.locator("#checkout-domain").isEnabled(), true)
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
  await axfrPage.getByText("Use an existing domain", { exact: true }).click()
  await axfrPage.locator("#checkout-domain").fill("existing-example.nl")
  await axfrPage.getByRole("button", { name: "Check connection" }).click()
  await axfrPage.getByRole("radio", {
    name: "My DNS provider permits an authorized AXFR",
  }).check()
  await axfrPage.getByLabel("Authorized nameserver").waitFor()
  await axfrPage.getByLabel(/Transfer code/).fill("browser-transfer-code")
  await axfrPage.getByLabel(
    /I am authorized to transfer this customer-owned domain/,
  ).check()
  await axfrPage.getByRole("button", { name: "Check connection" }).click()
  await axfrPage.getByRole("button", { name: "Continue" }).click()
  await axfrPage.getByRole("heading", { name: /launch$/i }).first().waitFor()
  await axfrPage.getByRole("heading", {
    name: "Plan",
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
    ).first().isVisible(),
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
  await cloudflarePage.setViewportSize({ width: 1280, height: 900 })
  assert.equal(
    await cloudflarePage.getByText(/temporary zone-scoped token/).count(),
    0,
  )
  await cloudflarePage.getByLabel(/Transfer code/).fill("browser-transfer-code")
  await cloudflarePage.getByLabel(
    /I am authorized to transfer this customer-owned domain/,
  ).check()
  await cloudflarePage.getByRole("button", { name: "Check connection" }).click()
  await cloudflarePage.getByRole("button", { name: "Review details" }).waitFor()
  assert.equal(
    await cloudflarePage.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth),
    true,
    "Cloudflare transfer checkout overflows a 320px viewport.",
  )
  await cloudflarePage.close()

  const reviewScenarioIds = [
    "domain-start", "domain-loading", "domain-results", "domain-selected",
    "domain-premium", "domain-error", "existing-ready", "existing-blocked",
    "existing-review", "details-known", "details-missing", "editing-details",
    "profile-conflict", "review-ready", "declaration-block", "quote-refreshed",
    "payment-redirecting", "payment-pending", "payment-failed",
    "fulfilment-pending", "fulfilment-action-verify",
    "fulfilment-action-transfer", "fulfilment-complete",
  ]
  const driveReviewScenario = async (scenarioPage, scenarioId) => {
    if (["domain-loading", "domain-results", "domain-selected", "domain-premium"].includes(scenarioId)) {
      await scenarioPage.getByLabel(/Business or domain name|Domain name|Domain you already own|Domeinnaam|Domein dat je al bezit/i).fill(
        scenarioId === "domain-loading" ? "loading-state" : "analytical-engines",
      )
      await scenarioPage.getByRole("button", { name: /Check availability|Controleer beschikbaarheid/i }).click()
      if (scenarioId === "domain-loading") {
        await scenarioPage.locator('[data-domain-status="loading"]').first().waitFor()
        return
      }
      if (scenarioId !== "domain-premium") {
        await scenarioPage.getByText("analytical-engines.nl", { exact: true }).waitFor()
        await scenarioPage.getByRole("button", { name: "Show more extensions", exact: true }).click()
      }
      await scenarioPage.getByText(
        scenarioId === "domain-premium" ? "analytical-engines.eu" : "analytical-engines.net",
        { exact: true },
      ).waitFor()
      if (scenarioId === "domain-selected") {
        await scenarioPage.locator('[data-domain-status="available"]', { hasText: "analytical-engines.nl" })
          .getByRole("button", { name: "Choose", exact: true }).click()
        await scenarioPage.locator('[data-domain-selected="true"]').waitFor()
      }
      if (scenarioId === "domain-premium") {
        await scenarioPage.getByText("Premium", { exact: true }).waitFor()
      }
      return
    }
    if (scenarioId === "domain-error") {
      await scenarioPage.getByLabel(/Business or domain name|Domain name|Domain you already own|Domeinnaam|Domein dat je al bezit/i).fill("service-error.nl")
      await scenarioPage.getByRole("button", { name: /Check availability|Controleer beschikbaarheid/i }).click()
      await scenarioPage.getByRole("alert").first().waitFor()
      return
    }
    if (["existing-ready", "existing-blocked"].includes(scenarioId)) {
      await scenarioPage.getByText(/Use an existing domain|Gebruik een bestaand domein/i, { exact: true }).click()
      await scenarioPage.getByLabel(/Business or domain name|Domain name|Domain you already own|Domeinnaam|Domein dat je al bezit/i).fill("existing-example.nl")
      await scenarioPage.getByRole("button", { name: /Check connection|Verbinding controleren/i }).click()
      await scenarioPage.getByRole(scenarioId === "existing-blocked" ? "alert" : "status").first().waitFor()
      return
    }
    if (["editing-details", "profile-conflict"].includes(scenarioId)) {
      await scenarioPage.getByRole("button", { name: /Edit business/i }).click()
      await scenarioPage.getByRole("dialog").waitFor()
      if (scenarioId === "profile-conflict") {
        await scenarioPage.getByRole("button", { name: "Save and continue" }).click()
        await scenarioPage.getByText("changed in another session", { exact: false }).waitFor()
      }
      return
    }
    if (["declaration-block", "quote-refreshed", "payment-redirecting"].includes(scenarioId)) {
      if (scenarioId === "declaration-block") {
        await scenarioPage.locator("#checkout-terms").check()
        const paymentButton = scenarioPage.getByRole("button", { name: /Approve & pay/ }).first()
        if (!(await paymentButton.isDisabled())) {
          throw new Error("Payment action must remain disabled until all checkout declarations are accepted")
        }
        return
      } else {
        for (const checkbox of await scenarioPage.locator('[role="checkbox"]').all()) await checkbox.check()
      }
      await scenarioPage.getByRole("button", { name: /Approve & pay/ }).first().click()
      if (scenarioId === "quote-refreshed") {
        await scenarioPage.getByText("signed quote was refreshed", { exact: false }).waitFor()
      } else {
        await scenarioPage.getByText("Payment processing is still pending", { exact: false }).waitFor()
      }
    }
  }
  for (const scenarioId of reviewScenarioIds) {
    const scenarioPage = await browser.newPage({ viewport: { width: 320, height: 568 } })
    const scenarioErrors = []
    scenarioPage.setDefaultTimeout(5_000)
    scenarioPage.on("pageerror", (error) => scenarioErrors.push(error.message))
    await scenarioPage.goto(`${origin}?scenario=${scenarioId}`, { waitUntil: "networkidle" })
    await driveReviewScenario(scenarioPage, scenarioId)
    assert.equal(
      await scenarioPage.evaluate((expected) =>
        document.documentElement.dataset.checkoutScenario === expected,
      scenarioId),
      true,
      `Checkout scenario ${scenarioId} was not selected by the development harness.`,
    )
    assert.equal(await scenarioPage.locator("h1").count(), 1, `${scenarioId} must expose one h1.`)
    assert.equal(
      await scenarioPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `${scenarioId} overflows a 320px viewport.`,
    )
    assert.equal(scenarioErrors.length, 0, `${scenarioId}: ${scenarioErrors.join("\n")}`)
    await scenarioPage.close()
  }
  process.stdout.write("Checkout 23-state development harness passed.\n")

  if (visualMatrixRoot) {
    for (const visualCase of checkoutVisualCases) {
      const visualPage = await browser.newPage({
        viewport: { width: visualCase.width, height: visualCase.height },
      })
      visualPage.setDefaultTimeout(8_000)
      await visualPage.addInitScript((theme) => localStorage.setItem("theme", theme), visualCase.theme)
      await visualPage.goto(
        `${origin}?scenario=${visualCase.scenario}&locale=${visualCase.locale}`,
        { waitUntil: "networkidle" },
      )
      await driveReviewScenario(visualPage, visualCase.scenario)
      if (visualCase.scenario === "domain-results") {
        await visualPage.getByText("Live results", { exact: true }).evaluate((node) => {
          node.scrollIntoView({ block: "start" })
          window.scrollBy(0, -64)
        })
      } else if (visualCase.scenario === "declaration-block") {
        await visualPage.locator("#checkout-declarations-error").scrollIntoViewIfNeeded()
      } else if (visualCase.scenario === "fulfilment-action-transfer") {
        await visualPage.getByText(/transfer code|verhuiscode/i).last().scrollIntoViewIfNeeded()
      }
      assertCheckoutGeometry(assert, visualCase, await checkoutGeometry(visualPage))
      await visualPage.screenshot({
        path: path.join(visualMatrixRoot, `${visualCase.id}.png`),
        fullPage: false,
        animations: "disabled",
      })
      await visualPage.close()
    }
    await fs.writeFile(
      path.join(visualMatrixRoot, "manifest.json"),
      `${JSON.stringify({ cases: checkoutVisualCases }, null, 2)}\n`,
    )
    process.stdout.write(`Checkout visual evidence written to ${visualMatrixRoot}.\n`)
  }
  process.stdout.write("Checkout Chromium contract passed.\n")
} finally {
  await browser?.close()
  await server.close()
}
