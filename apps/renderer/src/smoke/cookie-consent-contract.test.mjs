import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pageSource = await readFile(new URL("../pages/[...path].astro", import.meta.url), "utf8")
const runtimeSource = await readFile(new URL("../client/analytics-runtime.ts", import.meta.url), "utf8")
const chromeSource = await readFile(new URL("../../../../packages/site-renderer/src/chrome.tsx", import.meta.url), "utf8")
const providerChromeSource = await readFile(new URL("../../../../packages/site-renderer/src/providers/shadcnui-blocks/banner-views.tsx", import.meta.url), "utf8")

test("consent presentation is owned only by the approved cloned banner variant", () => {
  assert.doesNotMatch(pageSource, /renderer-cookie-consent|Cookievoorkeuren|Alles accepteren/)
  assert.match(pageSource, /buildAnalyticsConfig/)
  assert.match(pageSource, /id="siab-analytics-config"/)
  assert.doesNotMatch(chromeSource, /settings\.privacyDisclosure/)
  assert.match(providerChromeSource, /shadcnui-blocks\.banner-03/)
  assert.match(providerChromeSource, /data-siab-cookie-consent/)
  assert.match(providerChromeSource, /data-consent-action/)
  assert.match(providerChromeSource, /"accept"/)
  assert.match(providerChromeSource, /const renderedModel = isConsentChrome \? model : \{ \.\.\.model, consent: false \}/)
  assert.match(providerChromeSource, /ph-no-capture/)
})

test("renderer keeps only structural consent and transport guards here", () => {
  assert.match(runtimeSource, /capture_pageview: true/)
  assert.match(runtimeSource, /capture_pageleave: true/)
  assert.match(runtimeSource, /request_batching: false/)
  assert.match(runtimeSource, /cancelIdleCallback/)
  assert.match(runtimeSource, /posthogStartupToken/)
  assert.match(runtimeSource, /installPostHogConsentGate/)
  assert.match(runtimeSource, /_retryQueue/)
  assert.match(runtimeSource, /analytics_tier === "baseline"/)
  assert.match(runtimeSource, /disable_scroll_properties: false/)
  assert.match(runtimeSource, /opt_in_capturing\?\.\(\{ captureEventName: false \}\)/)
  assert.doesNotMatch(runtimeSource, /capture\(["']\$pageview["']/)
  assert.doesNotMatch(runtimeSource, /capture\(["']\$pageleave["']/)
  assert.doesNotMatch(runtimeSource, /setupPageLifecycle|capturePageview|capturePageleave/)
})
