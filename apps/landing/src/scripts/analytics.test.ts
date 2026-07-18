import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

const source = await readFile(new URL("./analytics.ts", import.meta.url), "utf8")

describe("landing analytics contract", () => {
  it("uses consent-gated native PostHog lifecycle capture", () => {
    expect(source).toContain("opt_out_capturing_by_default: true")
    expect(source).toContain("capture_pageview: true")
    expect(source).toContain("capture_pageleave: true")
    expect(source).toContain("disable_scroll_properties: false")
    expect(source).toContain("opt_in_capturing({ captureEventName: false })")
    expect(source).toContain('await import("posthog-js")')
    expect(source).not.toMatch(/capture\(["']\$page(view|leave)["']/)
  })

  it("labels the marketing site as a platform site and strips element content", () => {
    expect(source).toContain('analytics_surface: "site"')
    expect(source).toContain('site_kind: "platform"')
    expect(source).toContain("delete properties.$elements")
    expect(source).toContain('posthog.capture("site_conversion_completed"')
  })

  it("loads GA4 only through accepted analytics consent", () => {
    expect(source).toContain('initializeGoogleAnalytics()')
    expect(source).toContain("https://www.googletagmanager.com/gtag/js?id=")
    expect(source).toContain('analytics_storage: "granted"')
    expect(source).toContain('ad_storage: "denied"')
    expect(source).toContain('allow_google_signals: false')
    expect(source).toContain('allow_ad_personalization_signals: false')
    expect(source).toContain('disableGoogleAnalytics()')
  })
})
