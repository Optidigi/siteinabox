import { describe, expect, it } from "vitest"
import type { Page, SiteSetting } from "@/payload-types"
import { ANALYTICS_EVENT_CONTRACT, analyticsEventContractByName } from "@/lib/analytics/contract"
import { combineSiteScore, scoreSiteQuality, webVitalRating, webVitalScore } from "@/lib/analytics/scoring"

import { cast } from "../_helpers/cast"
import type { SiabAnalyticsEventName } from "@/lib/analytics/events"

describe("analytics event contract", () => {
  it("keeps native PostHog page lifecycle events SDK-owned and duplicate-safe", () => {
    expect(analyticsEventContractByName.get("$pageview")).toMatchObject({
      source: "posthog-js-native",
      consentRequired: false,
      cmsConsentRequired: false,
    })
    expect(analyticsEventContractByName.get("$pageleave")).toMatchObject({
      source: "posthog-js-native",
      consentRequired: true,
      cmsConsentRequired: false,
    })
    expect(analyticsEventContractByName.get("$pageview")?.duplicatePrevention).toContain("does not manually emit $pageview")
    expect(analyticsEventContractByName.get("$pageleave")?.duplicatePrevention).toContain("does not manually emit $pageleave")
    expect(analyticsEventContractByName.get("$pageleave")?.duplicatePrevention).toContain("keeps SDK scroll properties enabled")
    expect(analyticsEventContractByName.get("$pageleave")?.queryConsumers).toContain("getScrollDepth")
    expect(analyticsEventContractByName.get("site_scroll_depth_reached")?.queryConsumers).not.toContain("getScrollDepth")
    expect(analyticsEventContractByName.has(cast<SiabAnalyticsEventName>("site_page_viewed"))).toBe(false)
    expect(analyticsEventContractByName.has(cast<SiabAnalyticsEventName>("site_page_left"))).toBe(false)
  })

  it("documents every contract event once", () => {
    const names = ANALYTICS_EVENT_CONTRACT.map((entry) => entry.event)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain("$web_vitals")
    expect(names).toContain("$autocapture")
    expect(names).toContain("site_form_accepted")
  })
})

describe("analytics scoring", () => {
  it("rates and scores current PostHog Web Vitals", () => {
    expect(webVitalRating("LCP", 2400)).toBe("good")
    expect(webVitalRating("LCP", 3000)).toBe("needs-improvement")
    expect(webVitalRating("LCP", 4100)).toBe("poor")
    expect(webVitalRating("CLS", 0.05)).toBe("good")
    expect(webVitalScore("INP", 200)).toBe(100)
    expect(webVitalScore("INP", 500)).toBe(0)
    expect(webVitalScore("INP", 350)).toBe(75)
  })

  it("scores CMS site-quality checks from settings and published pages", () => {
    const score = scoreSiteQuality({
      settings: cast<SiteSetting>({
        siteName: "Amicare",
        siteUrl: "https://ami-care.nl",
        description: "Care site",
        language: "nl",
        branding: { logo: 1, favicon: 2 },
        navHeader: [{ type: "page" }],
        contact: { phone: "+31" },
      }),
      pages: [
        cast<Page>({ slug: "home", status: "published", seo: { title: "Home", description: "Welcome", ogImage: 3 } }),
        cast<Page>({ slug: "about", status: "published", seo: { title: "About", description: "About us" } }),
        cast<Page>({ slug: "draft", status: "draft", seo: {} }),
      ],
    })

    expect(score.available).toBe(true)
    expect(score.score).toBe(100)
    expect(score.passed).toBe(score.total)
  })

  it("combines field performance and site quality without inventing unavailable scores", () => {
    expect(combineSiteScore({ webVitals: [], siteQuality: { available: false, score: null, passed: 0, total: 0, checks: [] } })).toBeNull()
    expect(combineSiteScore({
      webVitals: [{ name: "LCP", rating: "good", samples: 4, avgValue: 2000, maxValue: 2500, visitors: 3, score: 100 }],
      siteQuality: { available: true, score: 50, passed: 1, total: 2, checks: [] },
    })).toBe(80)
  })
})
