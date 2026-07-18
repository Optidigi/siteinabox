import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { createServer } from "node:net"
import { gunzipSync } from "node:zlib"

import { chromium } from "playwright"

async function openPort() {
  const server = createServer()
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  assert.ok(address && typeof address === "object")
  const port = address.port
  server.close()
  await once(server, "close")
  return port
}

async function stopChild(child) {
  if (child.exitCode !== null) return
  child.kill("SIGTERM")
  const timeout = setTimeout(() => child.kill("SIGKILL"), 5000)
  try {
    await once(child, "exit")
  } finally {
    clearTimeout(timeout)
  }
}

async function buildLanding(env) {
  const child = spawn("pnpm", ["exec", "astro", "build"], {
    cwd: new URL("../..", import.meta.url),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })
  let output = ""
  child.stdout.on("data", (chunk) => { output += chunk })
  child.stderr.on("data", (chunk) => { output += chunk })
  const [code] = await once(child, "exit")
  assert.equal(code, 0, `landing production build failed\n${output}`)
}

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.fail(message)
}

async function waitForServer(origin, output) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(origin)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert.fail(`landing server did not start\n${output()}`)
}

function decodedEvents(request) {
  if (request.method() !== "POST") return []
  const url = new URL(request.url())
  const body = request.postDataBuffer()
  if (!body || !url.pathname.endsWith("/e/")) return []

  const text = url.searchParams.get("compression") === "gzip-js"
    ? gunzipSync(body).toString("utf8")
    : body.toString("utf8")
  const decoded = JSON.parse(text)
  return Array.isArray(decoded) ? decoded : decoded.batch ?? [decoded]
}

async function installIngestRoute(page, ingestOrigin, events, requests = []) {
  await page.route(`${ingestOrigin}/**`, async (route) => {
    requests.push(`${route.request().method()} ${route.request().url()}`)
    events.push(...decodedEvents(route.request()))
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: "{}",
    })
  })
}

async function installLandingRoute(page, publicOrigin, landingOrigin) {
  await page.route(`${publicOrigin}/**`, async (route) => {
    const requested = new URL(route.request().url())
    const response = await fetch(`${landingOrigin}${requested.pathname}${requested.search}`)
    const headers = Object.fromEntries(response.headers)
    delete headers["content-encoding"]
    delete headers["content-length"]
    delete headers["transfer-encoding"]
    await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) })
  })
}

const port = await openPort()
const landingOrigin = `http://127.0.0.1:${port}`
const publicOrigin = `http://landing.example.test:${port}`
const ingestOrigin = `http://ingest.example.test:${port}/ingest`
const testEnv = {
  ...process.env,
  NODE_ENV: "test",
  POSTHOG_PROJECT_TOKEN: "phc_landing_lifecycle_test",
  POSTHOG_PUBLIC_HOST: ingestOrigin,
  POSTHOG_HOST: ingestOrigin,
}
await buildLanding(testEnv)
const child = spawn("pnpm", ["exec", "astro", "preview", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: new URL("../..", import.meta.url),
  env: testEnv,
  stdio: ["ignore", "pipe", "pipe"],
})
let output = ""
child.stdout.on("data", (chunk) => { output += chunk })
child.stderr.on("data", (chunk) => { output += chunk })

try {
  await waitForServer(landingOrigin, () => output)
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  })
  try {
    const pageOptions = {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    }
    const acceptedPage = await browser.newPage(pageOptions)
    const acceptedEvents = []
    const ingestRequests = []
    const externalAnalyticsRequests = []
    const browserErrors = []
    acceptedPage.on("pageerror", (error) => browserErrors.push(String(error)))
    acceptedPage.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) browserErrors.push(`${message.type()}: ${message.text()}`)
    })
    acceptedPage.on("request", (request) => {
      const hostname = new URL(request.url()).hostname
      if (/posthog/i.test(hostname)) externalAnalyticsRequests.push(request.url())
    })
    await installIngestRoute(acceptedPage, ingestOrigin, acceptedEvents, ingestRequests)
    await installLandingRoute(acceptedPage, publicOrigin, landingOrigin)

    await acceptedPage.goto(publicOrigin, { waitUntil: "networkidle", timeout: 60_000 })
    const consentChrome = await acceptedPage.evaluate(() => {
      const banner = document.querySelector("[data-siab-cookie-consent]")
      const accept = document.querySelector('[data-consent-action="accept"]')
      const reject = document.querySelector('[data-consent-action="reject"]')
      const privacy = banner?.querySelector('a[href="/privacy-en-cookieverklaring"]')
      assertElement(banner, "consent banner")
      assertElement(accept, "accept button")
      assertElement(reject, "reject button")
      const bannerStyle = getComputedStyle(banner)
      const acceptStyle = getComputedStyle(accept)
      const rejectStyle = getComputedStyle(reject)
      return {
        labelledBy: banner.getAttribute("aria-labelledby"),
        describedBy: banner.getAttribute("aria-describedby"),
        privacyLabel: privacy?.textContent?.trim(),
        borderWidth: bannerStyle.borderTopWidth,
        borderRadius: bannerStyle.borderTopLeftRadius,
        boxShadow: bannerStyle.boxShadow,
        acceptBackground: acceptStyle.backgroundColor,
        rejectBackground: rejectStyle.backgroundColor,
        acceptShadow: acceptStyle.boxShadow,
        rejectShadow: rejectStyle.boxShadow,
        acceptWidth: accept.getBoundingClientRect().width,
        rejectWidth: reject.getBoundingClientRect().width,
        acceptHeight: accept.getBoundingClientRect().height,
        rejectHeight: reject.getBoundingClientRect().height,
      }

      function assertElement(value, label) {
        if (!(value instanceof HTMLElement)) throw new Error(`Missing ${label}`)
      }
    })
    assert.equal(consentChrome.labelledBy, "siab-cookie-consent-title")
    assert.equal(consentChrome.describedBy, "siab-cookie-consent-description")
    assert.match(consentChrome.privacyLabel ?? "", /gegevens omgaan/)
    assert.equal(consentChrome.borderWidth, "2px")
    assert.equal(consentChrome.borderRadius, "0px")
    assert.notEqual(consentChrome.boxShadow, "none")
    assert.equal(consentChrome.acceptBackground, "rgb(245, 233, 0)")
    assert.equal(consentChrome.rejectBackground, consentChrome.acceptBackground)
    assert.equal(consentChrome.rejectShadow, consentChrome.acceptShadow)
    assert.equal(consentChrome.rejectHeight, consentChrome.acceptHeight)
    assert.equal(consentChrome.rejectWidth, consentChrome.acceptWidth)
    assert.ok(consentChrome.acceptHeight >= 44, "accept target remains at least 44px high")
    assert.deepEqual(acceptedEvents, [], "analytics ingestion is empty before consent")
    assert.equal(
      await acceptedPage.evaluate(() => Object.keys(localStorage).filter((key) => /posthog/i.test(key)).length),
      0,
      "PostHog creates no storage before consent",
    )

    await acceptedPage.click('[data-consent-action="accept"]')
    try {
      await waitFor(
        () => acceptedEvents.some((event) => event.event === "$pageview"),
        "PostHog JS did not capture a landing pageview",
      )
    } catch {
      const state = await acceptedPage.evaluate(() => ({
        config: document.querySelector("#siab-analytics-config")?.textContent,
        consent: localStorage.getItem("siab_platform_analytics_consent"),
        localStorage: { ...localStorage },
        posthogKeys: Object.keys(localStorage).filter((key) => /posthog/i.test(key)),
      }))
      assert.fail(`PostHog JS did not capture a landing pageview\n${JSON.stringify({ state, ingestRequests, browserErrors }, null, 2)}\n${output}`)
    }
    await acceptedPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await acceptedPage.waitForTimeout(250)
    await acceptedPage.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new PageTransitionEvent("pagehide"))
    })
    await waitFor(
      () => acceptedEvents.some((event) => event.event === "$pageleave"),
      "PostHog JS did not capture a landing pageleave",
    )

    const pageviews = acceptedEvents.filter((event) => event.event === "$pageview")
    const pageleaves = acceptedEvents.filter((event) => event.event === "$pageleave")
    assert.equal(pageviews.length, 1, `one lifecycle must emit one $pageview: ${JSON.stringify(pageviews)}`)
    assert.equal(pageleaves.length, 1, `one lifecycle must emit one $pageleave: ${JSON.stringify(pageleaves)}`)
    assert.equal(pageviews[0]?.properties?.analytics_surface, "site")
    assert.equal(pageviews[0]?.properties?.site_kind, "platform")
    assert.equal(typeof pageleaves[0]?.properties?.$prev_pageview_duration, "number")
    assert.equal(typeof pageleaves[0]?.properties?.$prev_pageview_max_scroll, "number")
    assert.deepEqual(externalAnalyticsRequests, [], "the regression never reaches a real PostHog host")

    const rejectedPage = await browser.newPage({ ...pageOptions, viewport: { width: 375, height: 812 } })
    const rejectedEvents = []
    await installIngestRoute(rejectedPage, ingestOrigin, rejectedEvents)
    await installLandingRoute(rejectedPage, publicOrigin, landingOrigin)
    await rejectedPage.goto(publicOrigin, { waitUntil: "networkidle", timeout: 60_000 })
    const mobileActions = await rejectedPage.locator(".siab-cookie-consent__actions").evaluate((element) => ({
      display: getComputedStyle(element).display,
      columns: getComputedStyle(element).gridTemplateColumns,
      width: element.getBoundingClientRect().width,
    }))
    assert.equal(mobileActions.display, "grid")
    assert.match(mobileActions.columns, /^\d+(?:\.\d+)?px \d+(?:\.\d+)?px$/)
    assert.ok(mobileActions.width > 250, "mobile consent actions use the available width")
    await rejectedPage.click('[data-consent-action="reject"]')
    await rejectedPage.waitForTimeout(750)
    assert.deepEqual(rejectedEvents, [], "rejecting consent keeps PostHog disabled")
    assert.equal(
      await rejectedPage.evaluate(() => Object.keys(localStorage).filter((key) => /posthog/i.test(key)).length),
      0,
      "rejecting consent creates no PostHog storage",
    )

    console.log(JSON.stringify({
      pageviews: pageviews.length,
      pageleaves: pageleaves.length,
      nativeDuration: pageleaves[0].properties.$prev_pageview_duration,
      nativeMaxScroll: pageleaves[0].properties.$prev_pageview_max_scroll,
      rejectedEvents: rejectedEvents.length,
    }))
  } finally {
    await browser.close()
  }
} finally {
  await stopChild(child)
}
