import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pageSource = await readFile(new URL("../pages/[...path].astro", import.meta.url), "utf8")
const runtimeSource = await readFile(new URL("../client/analytics-runtime.ts", import.meta.url), "utf8")
const behaviorSource = await readFile(new URL("../client/site-behavior.ts", import.meta.url), "utf8")
const amicareSource = await readFile(new URL("../../../../packages/site-renderer/src/tenant-renderers/amicare/AmicarePage.tsx", import.meta.url), "utf8")
const chromeSource = await readFile(new URL("../../../../packages/site-renderer/src/chrome.tsx", import.meta.url), "utf8")
const providerChromeSource = await readFile(new URL("../../../../packages/site-renderer/src/providers/shadcnui-blocks/banner-views.tsx", import.meta.url), "utf8")

test("consent presentation is owned only by the approved cloned banner variant", () => {
  assert.doesNotMatch(pageSource, /renderer-cookie-consent|Cookievoorkeuren|Alles accepteren/)
  assert.doesNotMatch(amicareSource, /cookie-consent-banner|AmicareCookieConsent|data-cookie-consent/)
  assert.doesNotMatch(pageSource, /siab-analytics-config/)
  assert.doesNotMatch(chromeSource, /settings\.privacyDisclosure/)
  assert.doesNotMatch(amicareSource, /settings\.privacyDisclosure/)
  assert.match(providerChromeSource, /shadcnui-blocks\.banner-04/)
  assert.match(providerChromeSource, /data-siab-cookie-consent/)
  assert.match(providerChromeSource, /data-consent-action/)
  assert.match(providerChromeSource, /"accept"/)
})

test("approved banner persists a versioned receipt and controls analytics", () => {
  assert.match(behaviorSource, /receipt = \{ version:/)
  assert.match(behaviorSource, /categories: \{ necessary: true, analytics: accepted \}/)
  assert.match(behaviorSource, /SIABAnalytics\?\.grantConsent/)
  assert.match(behaviorSource, /SIABAnalytics\?\.revokeConsent/)
  assert.match(runtimeSource, /receipt\.version/)
  assert.match(runtimeSource, /state\.config\?\.consentVersion/)
  assert.match(runtimeSource, /receipt\.categories\?\.analytics === true/)
  assert.match(runtimeSource, /state\.config\?\.consentVersion \? null : stored/)
})

test("PostHog JS is the sole page lifecycle owner", () => {
  assert.match(runtimeSource, /capture_pageview: true/)
  assert.match(runtimeSource, /capture_pageleave: true/)
  assert.match(runtimeSource, /disable_scroll_properties: false/)
  assert.match(runtimeSource, /opt_in_capturing\?\.\(\{ captureEventName: false \}\)/)
  assert.doesNotMatch(runtimeSource, /capture\(["']\$pageview["']/)
  assert.doesNotMatch(runtimeSource, /capture\(["']\$pageleave["']/)
  assert.doesNotMatch(runtimeSource, /setupPageLifecycle|capturePageview|capturePageleave/)
})
