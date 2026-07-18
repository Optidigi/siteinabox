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
          tenantSlug: "tenant-test",
          tenantName: "Tenant Test",
          siteKind: "tenant",
          siteId: "site-test",
          pageId: "home",
          pagePath: "/",
        }
        const configScript = `<script id="siab-analytics-config" type="application/json">${JSON.stringify(config)}</script>`
        const source = body.toString("utf8")
        const html = source.includes('id="siab-analytics-config"')
          ? source.replace(/<script\b[^>]*\bid="siab-analytics-config"[^>]*>[\s\S]*?<\/script>/, configScript)
          : source.replace("</body>", `${configScript}</body>`)
        body = Buffer.from(html)
      }

      await route.fulfill({ status: response.status, headers, body })
    })

    await page.goto(`${publicOrigin}/?email=private%40example.test&utm_campaign=secret`, { waitUntil: "networkidle", timeout: 60_000 })
    await page.waitForFunction(
      () => typeof window.SIABAnalytics?.grantConsent === "function",
      undefined,
      { timeout: 60_000 },
    )
    await waitFor(
      () => events.some((event) => event.event === "$pageview" && event.transport === "posthog-js"),
      `cookieless baseline did not capture a renderer pageview\n${output}`,
    )
    const baselinePageviews = events.filter((event) => event.event === "$pageview")
    assert.equal(baselinePageviews.length, 1, "baseline captures one pageview")
    const baseline = baselinePageviews[0].properties
    assert.equal(baseline.analytics_tier, "baseline")
    assert.equal(baseline.distinct_id, "$posthog_cookieless")
    assert.equal(baseline.$device_id, null)
    assert.equal(baseline.$cookieless_mode, true)
    assert.equal(baseline.$process_person_profile, false)
    assert.equal(baseline.tenant_id, "tenant-test")
    assert.doesNotMatch(baseline.$current_url, /email|utm_campaign|private/)
    for (const forbidden of ["$session_id", "$referrer", "$referring_domain", "$groups", "tenant_name", "utm_campaign", "gclid"]) {
      assert.equal(forbidden in baseline, false, `baseline omits ${forbidden}`)
    }
    assert.equal(
      await page.evaluate(() => Object.keys(localStorage).filter((key) => /posthog/i.test(key)).length),
      0,
      "cookieless baseline creates no PostHog persistence",
    )

    await page.evaluate(() => window.SIABAnalytics.grantConsent())
    await waitFor(() => events.some((event) => event.event === "site_journey_step"), "semantic analytics did not activate")
    assert.equal(events.filter((event) => event.event === "$pageview").length, 1, "consent transition does not duplicate the current pageview")
    await page.evaluate(() => localStorage.setItem("siab_lifecycle_test_consent", JSON.stringify({
      version: "test",
      categories: { necessary: true, analytics: true },
    })))
    await page.reload({ waitUntil: "networkidle", timeout: 60_000 })
    await waitFor(
      () => events.some((event) => event.event === "$pageview" && event.properties?.analytics_tier === "consented"),
      `stored consent did not start a consented renderer lifecycle\n${output}`,
    )
    const consentedStart = events.findIndex((event) => event.event === "$pageview" && event.properties?.analytics_tier === "consented")
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(250)

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new PageTransitionEvent("pagehide"))
    })
    await waitFor(
      () => events.some((event) => event.event === "$pageleave" && event.transport === "posthog-js"),
      "PostHog JS did not capture a pageleave",
    )
    await page.goto(`${publicOrigin}/about`, { waitUntil: "load", timeout: 60_000 })

    const consentedLifecycle = events.slice(consentedStart)
    const pageviews = consentedLifecycle.filter((event) => event.event === "$pageview")
    const pageleaves = consentedLifecycle.filter((event) => event.event === "$pageleave")
    const groupIdentify = consentedLifecycle.find((event) => event.event === "$groupidentify")
    const nativePageleave = pageleaves.find((event) => event.transport === "posthog-js")

    assert.equal(pageviews.length, 1, `one consented lifecycle emits one SDK-owned $pageview: ${JSON.stringify(pageviews)}`)
    assert.equal(pageleaves.length, 1, `one lifecycle must emit one $pageleave: ${JSON.stringify(pageleaves)}`)
    assert.ok(events.some((event) => event.event === "site_journey_step"), "semantic SIAB events remain active")
    assert.equal(events.some((event) => event.transport === "siab-direct"), false, "semantic events use PostHog JS")
    assert.equal(typeof nativePageleave?.properties?.$prev_pageview_duration, "number")
    assert.equal(typeof nativePageleave?.properties?.$prev_pageview_max_scroll, "number")
    assert.equal(typeof nativePageleave?.properties?.$prev_pageview_max_scroll_percentage, "number")
    assert.equal(nativePageleave?.properties?.tenant_id, "tenant-test", "common enrichment remains on native lifecycle events")
    assert.deepEqual(pageviews.map((event) => event.properties.analytics_tier), ["consented"])
    assert.deepEqual(pageviews[0]?.properties?.$groups, { tenant: "tenant-test" })
    assert.equal(nativePageleave?.properties?.analytics_tier, "consented")
    assert.deepEqual(groupIdentify?.properties?.$group_set, {
      name: "Tenant Test",
      slug: "tenant-test",
      domain: "renderer.example.test",
      site_kind: "tenant",
    })
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
