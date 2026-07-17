import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { gunzipSync } from "node:zlib"

import { chromium } from "playwright"

import { getOpenPort, waitForRenderer } from "./host-routing-harness.mjs"

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

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.fail(message)
}

function decodedEvents(request) {
  if (request.method() !== "POST") return []
  const url = new URL(request.url())
  const body = request.postDataBuffer()
  if (!body) return []

  if (url.pathname.endsWith("/capture/")) {
    return [{ ...JSON.parse(body.toString("utf8")), transport: "siab-direct" }]
  }
  if (!url.pathname.endsWith("/e/")) return []

  const text = url.searchParams.get("compression") === "gzip-js"
    ? gunzipSync(body).toString("utf8")
    : body.toString("utf8")
  const decoded = JSON.parse(text)
  const events = Array.isArray(decoded) ? decoded : decoded.batch ?? [decoded]
  return events.map((event) => ({ ...event, transport: "posthog-js" }))
}

const port = await getOpenPort()
const rendererOrigin = `http://127.0.0.1:${port}`
const publicOrigin = `http://renderer.example.test:${port}`
const ingestOrigin = `http://ingest.example.test:${port}/ingest`
const child = spawn("pnpm", ["exec", "astro", "dev", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: new URL("../..", import.meta.url),
  env: { ...process.env, NODE_ENV: "test", SIAB_RENDERER_FIXTURE_MODE: "1" },
  stdio: ["ignore", "pipe", "pipe"],
})
let output = ""
child.stdout.on("data", (chunk) => { output += chunk })
child.stderr.on("data", (chunk) => { output += chunk })

try {
  await waitForRenderer(rendererOrigin, () => output)
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  })
  try {
    const page = await browser.newPage({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    })
    const events = []
    const externalAnalyticsRequests = []
    page.on("request", (request) => {
      if (/posthog/i.test(new URL(request.url()).hostname)) externalAnalyticsRequests.push(request.url())
    })

    await page.route(`${ingestOrigin}/**`, async (route) => {
      events.push(...decodedEvents(route.request()))
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: "{}",
      })
    })
    await page.route(`${publicOrigin}/**`, async (route) => {
      const requested = new URL(route.request().url())
      const response = await fetch(`${rendererOrigin}${requested.pathname}${requested.search}`)
      let body = Buffer.from(await response.arrayBuffer())
      const headers = Object.fromEntries(response.headers)
      delete headers["content-encoding"]
      delete headers["content-length"]
      delete headers["transfer-encoding"]

      if (requested.pathname === "/") {
        const config = {
          enabled: true,
          provider: "posthog",
          consentMode: "required",
          posthogHost: ingestOrigin,
          posthogUiHost: ingestOrigin,
          posthogProjectToken: "phc_renderer_lifecycle_test",
          consentStorageKey: "siab_lifecycle_test_consent",
          consentVersion: "test",
          schemaVersion: 1,
          tenantId: "tenant-test",
          siteId: "site-test",
          pageId: "home",
          pagePath: "/",
        }
        const html = body.toString("utf8").replace(
          "</body>",
          `<script id="siab-analytics-config" type="application/json">${JSON.stringify(config)}</script></body>`,
        )
        body = Buffer.from(html)
      }

      await route.fulfill({ status: response.status, headers, body })
    })

    await page.goto(`${publicOrigin}/`, { waitUntil: "networkidle", timeout: 60_000 })
    await page.waitForFunction(
      () => typeof window.SIABAnalytics?.grantConsent === "function",
      undefined,
      { timeout: 60_000 },
    )
    assert.deepEqual(events, [], "analytics ingestion is empty before consent")

    await page.evaluate(() => window.SIABAnalytics.grantConsent())
    await waitFor(
      () => events.some((event) => event.event === "$pageview" && event.transport === "posthog-js"),
      `PostHog JS did not capture a pageview\n${output}`,
    )
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(250)

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.goto(`${publicOrigin}/about`, { waitUntil: "load", timeout: 60_000 })
    await waitFor(
      () => events.some((event) => event.event === "$pageleave" && event.transport === "posthog-js"),
      "PostHog JS did not capture a pageleave",
    )

    const pageviews = events.filter((event) => event.event === "$pageview")
    const pageleaves = events.filter((event) => event.event === "$pageleave")
    const nativePageleave = pageleaves.find((event) => event.transport === "posthog-js")

    assert.equal(pageviews.length, 1, `one lifecycle must emit one $pageview: ${JSON.stringify(pageviews)}`)
    assert.equal(pageleaves.length, 1, `one lifecycle must emit one $pageleave: ${JSON.stringify(pageleaves)}`)
    assert.ok(events.some((event) => event.event === "site_journey_step"), "semantic SIAB events remain active")
    assert.equal(typeof nativePageleave?.properties?.$prev_pageview_duration, "number")
    assert.equal(typeof nativePageleave?.properties?.$prev_pageview_max_scroll, "number")
    assert.equal(typeof nativePageleave?.properties?.$prev_pageview_max_scroll_percentage, "number")
    assert.equal(nativePageleave?.properties?.tenant_id, "tenant-test", "common enrichment remains on native lifecycle events")
    assert.deepEqual(externalAnalyticsRequests, [], "the regression never reaches a real PostHog host")

    console.log(JSON.stringify({
      pageviews: pageviews.map(({ transport }) => transport),
      pageleaves: pageleaves.map(({ transport }) => transport),
      nativeDuration: nativePageleave.properties.$prev_pageview_duration,
      nativeMaxScroll: nativePageleave.properties.$prev_pageview_max_scroll,
      semanticJourneyEvents: events.filter((event) => event.event === "site_journey_step").length,
    }))
  } finally {
    await browser.close()
  }
} finally {
  await stopChild(child)
}
