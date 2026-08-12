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
    const text = decodePayload(body)
    return [{ ...JSON.parse(text), transport: "siab-direct" }]
  }
  if (!url.pathname.endsWith("/e/")) return []

  const text = decodePayload(body, url.searchParams.get("compression") === "gzip-js")
  const decoded = JSON.parse(text)
  const events = Array.isArray(decoded) ? decoded : decoded.batch ?? [decoded]
  return events.map((event) => ({ ...event, transport: "posthog-js" }))
}

function decodePayload(body, compressed = false) {
  const encoded = body.toString("utf8")
  const data = encoded.startsWith("data=")
    ? new URLSearchParams(encoded).get("data")
    : null
  const payload = data ? Buffer.from(data, "base64") : body
  const isGzip = compressed || (payload[0] === 0x1f && payload[1] === 0x8b)
  return isGzip ? gunzipSync(payload).toString("utf8") : payload.toString("utf8")
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
    let failConsentedRequests = false
    let failedConsentedRequests = 0
    let revoked = false
    let consentedAttemptsAfterRevoke = 0
    page.on("request", (request) => {
      if (/posthog/i.test(new URL(request.url()).hostname)) externalAnalyticsRequests.push(request.url())
    })

    await page.route(`${ingestOrigin}/**`, async (route) => {
      const decoded = decodedEvents(route.request())
      const isConsented = decoded.some((event) => event.properties?.analytics_tier === "consented")
      if (revoked && isConsented) consentedAttemptsAfterRevoke += 1
      if (failConsentedRequests && isConsented) {
        failedConsentedRequests += 1
        await route.abort("failed")
        return
      }
      events.push(...decoded)
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

    await page.addInitScript(({ key }) => {
      if (!sessionStorage.getItem("siab_lifecycle_stale_seeded")) {
        localStorage.setItem(key, JSON.stringify({ version: "stale", categories: { necessary: true, analytics: true } }))
        sessionStorage.setItem("siab_lifecycle_stale_seeded", "1")
      }
    }, { key: "siab_lifecycle_test_consent" })

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
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem("siab_lifecycle_test_consent"))),
      { version: "test", categories: { necessary: true, analytics: true } },
      "runtime consent transition persists the accepted receipt",
    )

    const journeyBeforeRevoke = events.filter((event) => event.event === "site_journey_step").length
    const eventsBeforeRevoke = events.length
    failConsentedRequests = true
    await page.evaluate(() => {
      const action = document.querySelector("button:not([data-consent-action])")
      action?.dispatchEvent(new MouseEvent("click", { bubbles: true, view: window }))
    })
    await waitFor(() => failedConsentedRequests > 0, "consented request fixture did not fail")
    await page.evaluate(() => window.SIABAnalytics.revokeConsent())
    revoked = true
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem("siab_lifecycle_test_consent"))),
      { version: "test", categories: { necessary: true, analytics: false } },
      "runtime revoke persists the declined receipt",
    )
    await page.evaluate(() => {
      const action = document.querySelector("a,button")
      action?.dispatchEvent(new MouseEvent("click", { bubbles: true, view: window }))
      window.dispatchEvent(new Event("scroll"))
    })
    await page.waitForTimeout(800)
    await page.waitForTimeout(6_500)
    assert.equal(
      events.slice(eventsBeforeRevoke).some((event) => event.event.startsWith("site_")),
      false,
      "revocation tears down renderer-owned interaction listeners and delayed events",
    )
    assert.equal(
      consentedAttemptsAfterRevoke,
      0,
      "revocation drops failed consented requests before the SDK retry queue can resend them",
    )
    failConsentedRequests = false
    revoked = false

    await page.evaluate(() => window.SIABAnalytics.grantConsent())
    await waitFor(
      () => events.filter((event) => event.event === "site_journey_step").length > journeyBeforeRevoke,
      "re-consent did not rebuild the renderer analytics lifecycle",
    )
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem("siab_lifecycle_test_consent"))),
      { version: "test", categories: { necessary: true, analytics: true } },
      "runtime re-consent persists the accepted receipt",
    )

    const preReloadPageleaves = events.filter(
      (event) => event.event === "$pageleave" && event.properties?.analytics_tier === "consented",
    ).length
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new PageTransitionEvent("pagehide"))
    })
    await waitFor(
      () => events.filter((event) => event.event === "$pageleave" && event.properties?.analytics_tier === "consented").length > preReloadPageleaves,
      "pre-reload lifecycle did not emit a consented pageleave",
    )
    const consentedLifecycleStart = events.length
    await page.reload({ waitUntil: "networkidle", timeout: 60_000 })
    await waitFor(
      () => events.slice(consentedLifecycleStart).some(
        (event) => event.event === "$pageview" && event.properties?.analytics_tier === "consented",
      ),
      `stored consent did not start a consented renderer lifecycle\n${output}`,
    )
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(250)

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new PageTransitionEvent("pagehide"))
    })
    await waitFor(
      () => events.slice(consentedLifecycleStart).some(
        (event) => event.event === "$pageleave" && event.transport === "posthog-js",
      ),
      "PostHog JS did not capture a pageleave",
    )

    // Snapshot before navigation so a later route change cannot add a second
    // $pageleave into the consented-lifecycle assertion window.
    const consentedLifecycle = events.slice(consentedLifecycleStart)
    const pageviews = consentedLifecycle.filter((event) => event.event === "$pageview")
    const pageleaves = consentedLifecycle.filter((event) => event.event === "$pageleave")
    const groupIdentify = consentedLifecycle.find((event) => event.event === "$groupidentify")
    const nativePageleave = pageleaves.find((event) => event.transport === "posthog-js")

    assert.equal(pageviews.length, 1, `one consented lifecycle emits one SDK-owned $pageview: ${JSON.stringify(pageviews)}`)
    assert.equal(pageleaves.length, 1, `one lifecycle must emit one $pageleave: ${JSON.stringify(pageleaves)}`)
    assert.ok(events.some((event) => event.event === "site_journey_step"), "semantic SIAB events remain active")
    assert.equal(events.some((event) => event.transport === "siab-direct"), false, "semantic events use PostHog JS")
    assert.equal(
      typeof nativePageleave?.properties?.page_duration_ms,
      "number",
      `pageleave lifecycle properties missing: ${JSON.stringify(nativePageleave)}`,
    )
    assert.equal(typeof nativePageleave?.properties?.scroll_depth, "number")
    assert.equal(nativePageleave?.properties?.interaction_type, "leave")
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
      nativeDuration: nativePageleave.properties.page_duration_ms,
      nativeMaxScroll: nativePageleave.properties.scroll_depth,
      semanticJourneyEvents: events.filter((event) => event.event === "site_journey_step").length,
    }))
  } finally {
    await browser.close()
  }
} finally {
  await stopChild(child)
}
