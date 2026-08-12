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

  const encoded = body.toString("utf8")
  const data = encoded.startsWith("data=")
    ? new URLSearchParams(encoded).get("data")
    : null
  const payload = data ? Buffer.from(data, "base64") : body
  const compressed = url.searchParams.get("compression") === "gzip-js"
    || (payload[0] === 0x1f && payload[1] === 0x8b)
  const text = compressed
    ? gunzipSync(payload).toString("utf8")
    : payload.toString("utf8")
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

async function installGoogleAnalyticsRoute(page, requests) {
  await page.route("https://www.googletagmanager.com/**", async (route) => {
    requests.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: "/* intercepted gtag.js: no external analytics write */",
    })
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
    const googleAnalyticsRequests = []
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
    await installGoogleAnalyticsRoute(acceptedPage, googleAnalyticsRequests)

    await acceptedPage.goto(`${publicOrigin}/?email=private%40example.test&utm_campaign=secret`, { waitUntil: "networkidle", timeout: 60_000 })
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
    assert.equal(consentChrome.privacyLabel, "Lees ons cookiebeleid")
    assert.equal(consentChrome.borderWidth, "2px")
    assert.equal(consentChrome.borderRadius, "0px")
    assert.notEqual(consentChrome.boxShadow, "none")
    assert.equal(consentChrome.acceptBackground, "rgb(245, 233, 0)")
    assert.equal(consentChrome.rejectBackground, "rgba(0, 0, 0, 0)")
    assert.notEqual(consentChrome.rejectBackground, consentChrome.acceptBackground)
    assert.notEqual(consentChrome.rejectShadow, "none")
    assert.notEqual(consentChrome.acceptShadow, "none")
    assert.equal(consentChrome.rejectHeight, consentChrome.acceptHeight)
    assert.equal(consentChrome.rejectWidth, consentChrome.acceptWidth)
    assert.ok(consentChrome.acceptHeight >= 44, "accept target remains at least 44px high")
    await waitFor(
      () => acceptedEvents.some((event) => event.event === "$pageview"),
      "cookieless baseline did not capture a landing pageview",
    )
    const baselinePageviews = acceptedEvents.filter((event) => event.event === "$pageview")
    assert.equal(baselinePageviews.length, 1, "baseline captures one pageview")
    const baseline = baselinePageviews[0].properties
    assert.equal(baseline.analytics_tier, "baseline")
    assert.equal(baseline.environment, "development")
    assert.equal(baseline.distinct_id, "$posthog_cookieless")
    assert.equal(baseline.$device_id, null)
    assert.equal(baseline.$cookieless_mode, true)
    assert.equal(baseline.$process_person_profile, false)
    assert.doesNotMatch(baseline.$current_url, /email|utm_campaign|private/)
    for (const forbidden of ["$session_id", "$referrer", "$referring_domain", "$groups", "tenant_name", "utm_campaign", "gclid"]) {
      assert.equal(forbidden in baseline, false, `baseline omits ${forbidden}`)
    }
    assert.equal(
      await acceptedPage.evaluate(() => Object.keys(localStorage).filter((key) => /posthog/i.test(key)).length),
      0,
      "PostHog creates no storage before consent",
    )
    assert.deepEqual(googleAnalyticsRequests, [], "Google Analytics does not load before consent")
    await acceptedPage.evaluate(() => {
      window.dispatchEvent(new CustomEvent("siab:landing-analytics", {
        detail: {
          event: "site_journey_step",
          properties: {
            journey_name: "landing_conversion",
            journey_step: "pre_consent_test",
            visitor_email: "must-not-leak@example.test",
          },
        },
      }))
    })
    await acceptedPage.waitForTimeout(100)
    assert.equal(
      acceptedEvents.some((event) => event.event === "site_journey_step"),
      false,
      "semantic analytics stays disabled before consent",
    )

    await acceptedPage.click('[data-consent-action="accept"]')
    await waitFor(() => googleAnalyticsRequests.length === 1, "accepted consent did not load gtag.js")
    assert.match(googleAnalyticsRequests[0], /\/gtag\/js\?id=G-EM6YQ9893X$/)
    assert.equal(acceptedEvents.filter((event) => event.event === "$pageview").length, 1, "consent transition does not duplicate the current pageview")
    await acceptedPage.evaluate(() => {
      window.dispatchEvent(new CustomEvent("siab:landing-analytics", {
        detail: {
          event: "site_journey_step",
          properties: {
            journey_name: "landing_conversion",
            journey_step: "semantic_contract_test",
            action_key: "hero_start",
            visitor_email: "must-not-leak@example.test",
          },
        },
      }))
    })
    await waitFor(
      () => acceptedEvents.some((event) => event.event === "site_journey_step"),
      "accepted consent did not send the semantic event to PostHog",
    )
    const semanticEvent = acceptedEvents.find((event) => event.event === "site_journey_step")
    assert.equal(semanticEvent.properties.journey_step, "semantic_contract_test")
    assert.equal(semanticEvent.properties.action_key, "hero_start")
    assert.equal("visitor_email" in semanticEvent.properties, false, "semantic properties are allowlisted")
    const semanticGoogleCommand = await acceptedPage.evaluate(() =>
      (window.dataLayer ?? []).find((entry) => entry[0] === "event" && entry[1] === "site_journey_step"),
    )
    assert.equal(semanticGoogleCommand?.[2]?.journey_step, "semantic_contract_test")
    assert.equal("visitor_email" in (semanticGoogleCommand?.[2] ?? {}), false, "GA4 receives the same sanitized payload")
    await acceptedPage.evaluate(() => {
      for (const conversion_source of ["contact_form", "contact_click", "intake_handoff"]) {
        window.dispatchEvent(new CustomEvent("siab:landing-analytics", {
          detail: {
            event: "site_conversion_completed",
            properties: {
              conversion_source,
              form_id: "platform_contact",
              visitor_email: "must-not-leak@example.test",
            },
          },
        }))
      }
    })
    const googleKeyEvents = await acceptedPage.evaluate(() =>
      (window.dataLayer ?? [])
        .filter((entry) =>
          entry[0] === "event"
          && ["generate_lead", "direct_contact_clicked", "intake_started"].includes(entry[1]),
        )
        .map((entry) => ({ event: entry[1], properties: entry[2] })),
    )
    assert.deepEqual(
      googleKeyEvents.map(({ event }) => event).sort(),
      ["direct_contact_clicked", "generate_lead", "intake_started"],
      "GA4 receives distinct business outcomes instead of one ambiguous key event",
    )
    assert.ok(
      googleKeyEvents.every(({ properties }) => !("visitor_email" in properties)),
      "GA4 key events keep the final semantic property allowlist",
    )
    await acceptedPage.reload({ waitUntil: "networkidle", timeout: 60_000 })
    await waitFor(
      () => acceptedEvents.some((event) => event.event === "$pageview" && event.properties?.analytics_tier === "consented"),
      "stored consent did not start a consented PostHog lifecycle",
    )
    await waitFor(() => googleAnalyticsRequests.length === 2, "stored consent did not reload gtag.js")
    const googleCommands = await acceptedPage.evaluate(() => (window.dataLayer ?? []).map((entry) => ({
      shape: Object.prototype.toString.call(entry),
      command: entry[0],
      target: entry[1],
      options: entry[2],
    })))
    assert.ok(
      googleCommands.every(({ shape }) => shape === "[object Arguments]"),
      `gtag queue rows must be Arguments objects, not Arrays: ${JSON.stringify(googleCommands)}`,
    )
    assert.ok(googleCommands.some(({ command, target, options }) =>
      command === "consent"
      && target === "default"
      && options?.analytics_storage === "granted"
      && options?.ad_storage === "denied"
      && options?.ad_user_data === "denied"
      && options?.ad_personalization === "denied",
    ), "GA4 consent defaults allow analytics only")
    assert.ok(googleCommands.some(({ command, target, options }) =>
      command === "config"
      && target === "G-EM6YQ9893X"
      && options?.send_page_view === true
      && options?.allow_google_signals === false
      && options?.allow_ad_personalization_signals === false,
    ), "GA4 config uses the approved measurement and privacy controls")
    const consentedStart = acceptedEvents.findIndex((event) => event.event === "$pageview" && event.properties?.analytics_tier === "consented")
    await acceptedPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await acceptedPage.waitForTimeout(250)
    await acceptedPage.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new PageTransitionEvent("pagehide"))
    })
    await waitFor(
      () => acceptedEvents.slice(consentedStart).some((event) => event.event === "$pageleave"),
      "PostHog JS did not capture a landing pageleave",
    )

    const consentedLifecycle = acceptedEvents.slice(consentedStart)
    const pageviews = consentedLifecycle.filter((event) => event.event === "$pageview")
    const pageleaves = consentedLifecycle.filter((event) => event.event === "$pageleave")
    assert.equal(pageviews.length, 1, `one consented lifecycle emits one SDK-owned $pageview: ${JSON.stringify(pageviews)}`)
    assert.equal(pageleaves.length, 1, `one lifecycle must emit one $pageleave: ${JSON.stringify(pageleaves)}`)
    assert.equal(pageviews[0]?.properties?.analytics_surface, "site")
    assert.equal(pageviews[0]?.properties?.site_kind, "platform")
    assert.equal(pageviews[0]?.properties?.environment, "development")
    assert.deepEqual(pageviews.map((event) => event.properties.analytics_tier), ["consented"])
    assert.equal(pageleaves[0]?.properties?.analytics_tier, "consented")
    assert.equal(typeof pageleaves[0]?.properties?.$prev_pageview_duration, "number")
    assert.equal(typeof pageleaves[0]?.properties?.$prev_pageview_max_scroll, "number")
    assert.deepEqual(externalAnalyticsRequests, [], "the regression never reaches a real PostHog host")

    const rejectedPage = await browser.newPage({ ...pageOptions, viewport: { width: 375, height: 812 } })
    const rejectedEvents = []
    const rejectedGoogleAnalyticsRequests = []
    await installIngestRoute(rejectedPage, ingestOrigin, rejectedEvents)
    await installLandingRoute(rejectedPage, publicOrigin, landingOrigin)
    await installGoogleAnalyticsRoute(rejectedPage, rejectedGoogleAnalyticsRequests)
    await rejectedPage.goto(`${publicOrigin}/?token=must-not-leak`, { waitUntil: "networkidle", timeout: 60_000 })
    const mobileActions = await rejectedPage.locator("[data-consent-actions]").evaluate((element) => ({
      display: getComputedStyle(element).display,
      columns: getComputedStyle(element).gridTemplateColumns,
      width: element.getBoundingClientRect().width,
    }))
    assert.equal(mobileActions.display, "grid")
    assert.match(mobileActions.columns, /^\d+(?:\.\d+)?px \d+(?:\.\d+)?px$/)
    assert.ok(mobileActions.width > 250, "mobile consent actions use the available width")
    await rejectedPage.evaluate(() => {
      document.cookie = "_ga=test-cookie; path=/; SameSite=Lax"
      document.cookie = "_ga_EM6YQ9893X=test-cookie; path=/; SameSite=Lax"
    })
    await rejectedPage.click('[data-consent-action="reject"]')
    await rejectedPage.waitForTimeout(750)
    const rejectedPageviews = rejectedEvents.filter((event) => event.event === "$pageview")
    assert.equal(rejectedPageviews.length, 1, "rejecting retains one minimized baseline pageview")
    assert.equal(rejectedPageviews[0].properties.analytics_tier, "baseline")
    assert.equal(rejectedPageviews[0].properties.distinct_id, "$posthog_cookieless")
    assert.doesNotMatch(rejectedPageviews[0].properties.$current_url, /token|must-not-leak/)
    assert.equal(rejectedEvents.some((event) => event.event === "$pageleave" || event.event === "$autocapture"), false)
    assert.deepEqual(rejectedGoogleAnalyticsRequests, [], "rejecting consent never loads Google Analytics")
    assert.deepEqual(
      await rejectedPage.evaluate(() => document.cookie.split(";").map((entry) => entry.trim()).filter((entry) => entry.startsWith("_ga"))),
      [],
      "rejecting consent clears known GA4 cookies",
    )
    assert.equal(
      await rejectedPage.evaluate(() => Object.keys(localStorage).filter((key) => /posthog/i.test(key)).length),
      0,
      "rejecting consent creates no PostHog storage",
    )
    await rejectedPage.evaluate(() => {
      document.querySelector("[data-consent-settings]")?.click()
    })
    assert.equal(
      await rejectedPage.locator("[data-siab-cookie-consent]").isVisible(),
      true,
      "cookie settings reopens the consent choice",
    )
    assert.equal(
      await rejectedPage.evaluate(() => document.activeElement?.hasAttribute("data-consent-action")),
      true,
      "reopened consent moves focus to its first action",
    )
    await rejectedPage.click('[data-consent-action="accept"]')
    await waitFor(
      () => rejectedGoogleAnalyticsRequests.length === 1,
      "accepting from cookie settings did not enable GA4",
    )
    await rejectedPage.evaluate(() => {
      window.dispatchEvent(new CustomEvent("siab:landing-analytics", {
        detail: {
          event: "site_journey_step",
          properties: {
            journey_name: "consent_regression",
            journey_step: "before_revocation",
          },
        },
      }))
    })
    await waitFor(
      () => rejectedEvents.some((event) =>
        event.event === "site_journey_step"
        && event.properties?.journey_step === "before_revocation"),
      "accepted cookie settings did not enable semantic PostHog events",
    )
    const journeyEventsBeforeRevocation = rejectedEvents.filter((event) => event.event === "site_journey_step").length
    await rejectedPage.evaluate(() => document.querySelector("[data-consent-settings]")?.click())
    await rejectedPage.click('[data-consent-action="reject"]')
    await rejectedPage.evaluate(() => {
      window.dispatchEvent(new CustomEvent("siab:landing-analytics", {
        detail: {
          event: "site_journey_step",
          properties: {
            journey_name: "consent_regression",
            journey_step: "after_revocation",
          },
        },
      }))
    })
    await rejectedPage.waitForTimeout(250)
    assert.equal(
      rejectedEvents.filter((event) => event.event === "site_journey_step").length,
      journeyEventsBeforeRevocation,
      "revocation stops subsequent semantic events",
    )
    const revokedGoogleConsent = await rejectedPage.evaluate(() =>
      (window.dataLayer ?? []).some((entry) =>
        entry[0] === "consent"
        && entry[1] === "update"
        && entry[2]?.analytics_storage === "denied"),
    )
    assert.equal(revokedGoogleConsent, true, "revocation updates GA4 consent to denied")

    console.log(JSON.stringify({
      pageviewsByTier: pageviews.map((event) => event.properties.analytics_tier),
      pageleaves: pageleaves.length,
      nativeDuration: pageleaves[0].properties.$prev_pageview_duration,
      nativeMaxScroll: pageleaves[0].properties.$prev_pageview_max_scroll,
      rejectedBaselinePageviews: rejectedPageviews.length,
      consentedGtagLoads: googleAnalyticsRequests.length,
      settingsGtagLoads: rejectedGoogleAnalyticsRequests.length,
      semanticDestinations: ["posthog", "ga4"],
    }))
  } finally {
    await browser.close()
  }
} finally {
  await stopChild(child)
}
