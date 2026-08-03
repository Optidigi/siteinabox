import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

const entrypoint = await readFile(new URL("./analytics.ts", import.meta.url), "utf8")
const runtime = await readFile(new URL("./analytics/runtime.ts", import.meta.url), "utf8")
const tracking = await readFile(new URL("./analytics/tracking.ts", import.meta.url), "utf8")
const contract = await readFile(new URL("../lib/landing-analytics.ts", import.meta.url), "utf8")
const source = [runtime, tracking, contract].join("\n")

describe("landing analytics contract", () => {
  it("keeps the entrypoint orchestration-only", () => {
    expect(entrypoint.trim().split("\n")).toHaveLength(10)
    expect(entrypoint).toContain("createLandingAnalyticsRuntime")
    expect(entrypoint).toContain("bindLandingAnalytics")
    expect(entrypoint).not.toContain("posthog.init")
    expect(entrypoint).not.toContain("IntersectionObserver")
  })

  it("uses consent-gated native PostHog lifecycle capture", () => {
    expect(source).toContain("opt_out_capturing_by_default: true")
    expect(source).toContain("capture_pageview: true")
    expect(source).toContain("capture_pageleave: true")
    expect(source).toContain("disable_scroll_properties: false")
    expect(source).toContain("opt_in_capturing({ captureEventName: false })")
    expect(source).toContain("await import('posthog-js')")
    expect(source).not.toMatch(/capture\(["']\$page(view|leave)["']/)
  })

  it("labels the marketing site as a platform site and strips element content", () => {
    expect(source).toContain("analytics_surface: 'site'")
    expect(source).toContain("site_kind: 'platform'")
    expect(source).toContain("delete properties.$elements")
    expect(source).toContain("...LANDING_EVENT_NAMES")
    expect(source).toContain("sanitizeSemanticProperties")
    expect(source).toContain("semanticPropertyKeys")
    expect(source).not.toContain("textContent?.trim()")
  })

  it("loads GA4 only through accepted analytics consent", () => {
    expect(source).toContain('initializeGoogleAnalytics()')
    expect(source).toContain("https://www.googletagmanager.com/gtag/js?id=")
    expect(source).toContain("analytics_storage: 'granted'")
    expect(source).toContain("ad_storage: 'denied'")
    expect(source).toContain('allow_google_signals: false')
    expect(source).toContain('allow_ad_personalization_signals: false')
    expect(source).toContain('disableGoogleAnalytics()')
    expect(source).toContain("dataLayer!.push(arguments)")
    expect(source).not.toContain("dataLayer?.push(args)")
    expect(source).not.toContain("((...args: unknown[]) => analyticsWindow.dataLayer?.push(args))")
  })

  it("sends the same consented semantic vocabulary to PostHog and GA4", () => {
    expect(source).toContain('posthog.capture(event, { ...baseProperties(), ...sanitized })')
    expect(source).toContain("analyticsWindow.gtag?.('event', event")
    expect(source).toContain("if (!consentGranted || !semanticEventNames.has(event)) return")
    expect(source).toContain("content_version: 'landing-retroui-v1'")
  })

  it("maps accepted landing outcomes to distinct GA4 key events", () => {
    expect(runtime).toContain("contact_form: 'generate_lead'")
    expect(runtime).toContain("contact_click: 'direct_contact_clicked'")
    expect(runtime).toContain("intake_handoff: 'intake_started'")
    expect(runtime).toContain("event === 'site_conversion_completed'")
    expect(runtime).toContain("googleKeyEventByConversionSource")
  })

  it("uses event-specific property types and cancels delayed observations", () => {
    expect(contract).toContain("LandingEventPropertiesByName")
    expect(contract).toContain("site_scroll_depth_reached: { scroll_depth: 25 | 50 | 75 | 90 }")
    expect(tracking).toContain("pendingTimers.forEach((timer) => window.clearTimeout(timer))")
    expect(tracking).toContain("sectionObserver.disconnect()")
    expect(tracking).toContain("componentObserver.disconnect()")
  })

  it("keeps local and test traffic out of production dashboards", () => {
    expect(runtime).toContain("hostname === '127.0.0.1'")
    expect(runtime).toContain("hostname.endsWith('.test')")
    expect(runtime).toContain("? 'development' : 'production'")
    expect(runtime).toContain("debug_mode: environment() === 'development'")
  })
})
