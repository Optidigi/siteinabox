import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pageSource = await readFile(new URL("../pages/[...path].astro", import.meta.url), "utf8")
const runtimeSource = await readFile(new URL("../client/analytics-runtime.ts", import.meta.url), "utf8")
const behaviorSource = await readFile(new URL("../client/site-behavior.ts", import.meta.url), "utf8")
const shellSource = await readFile(new URL("../../../../packages/site-renderer/src/SitePageShell.tsx", import.meta.url), "utf8")

test("public pages render settings-owned consent only with approved analytics", () => {
  assert.match(pageSource, /buildAnalyticsConfig/)
  assert.match(pageSource, /id="siab-analytics-config"/)
  assert.match(pageSource, /consentAvailable: Boolean\(analyticsConfig\?\.enabled\)/)
  assert.match(shellSource, /ConsentRenderer/)
  assert.match(shellSource, /consentAvailable/)
  assert.doesNotMatch(shellSource, /provider|shadcnui-blocks/i)
  assert.match(behaviorSource, /initializeConsentBehavior\(document\)/)
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
  assert.match(runtimeSource, /getConsent\(\)/)
  assert.match(runtimeSource, /applyConsent\(selection\)/)
  assert.match(runtimeSource, /consentDecided/)
  assert.doesNotMatch(runtimeSource, /capture\(["']\$pageview["']/)
  assert.doesNotMatch(runtimeSource, /capture\(["']\$pageleave["']/)
  assert.doesNotMatch(runtimeSource, /setupPageLifecycle|capturePageview|capturePageleave/)
})
