import { afterEach, describe, expect, it, vi } from "vitest"
import {
  getComponentPerformance,
  getDeviceSplit,
  getCmsEventVolume,
  getCmsActionMetrics,
  getCmsDeviceMetrics,
  getCmsRouteMetrics,
  getCmsTenantUsage,
  getCmsUsageOverview,
  getFormFunnel,
  getGeoCities,
  getGeoCountries,
  getJourneySteps,
  getProviderVariantRanking,
  getSectionPerformance,
  getSiteAnalyticsOverview,
  getScrollDepth,
  getTenantPerformance,
  getTenantWebVitals,
  getTrafficSources,
  getTopCtas,
  getTopPages,
  getWebVitals,
} from "@/lib/analytics/queries"

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe("analytics queries", () => {
  it("returns unavailable overview when PostHog query config is absent", async () => {
    delete process.env.POSTHOG_PROJECT_ID
    delete process.env.POSTHOG_PERSONAL_API_KEY
    delete process.env.POSTHOG_API_KEY
    const fetchMock = vi.spyOn(globalThis, "fetch")

    await expect(getSiteAnalyticsOverview({ tenantId: 7, days: 30 })).resolves.toMatchObject({
      available: false,
      visitors: 0,
      pageviews: 0,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("queries tenant-scoped overview metrics", async () => {
    process.env.POSTHOG_PROJECT_ID = "123"
    process.env.POSTHOG_PERSONAL_API_KEY = "phx_test"
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ results: [[10, 25, 2, 5, 1]] }),
    } as Response)

    const overview = await getSiteAnalyticsOverview({ tenantId: 7, days: 30 })

    expect(overview).toEqual({
      available: true,
      visitors: 10,
      pageviews: 25,
      conversions: 2,
      conversionRate: 0.2,
      ctaClicks: 5,
      acceptedForms: 1,
    })
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.name).toBe("siab_site_analytics_overview")
    expect(body.query.query).toContain("properties.tenant_id = '7'")
    expect(body.query.query).toContain("INTERVAL 30 DAY")
  })

  it("allows intentional all-tenant overview queries without a tenant predicate", async () => {
    process.env.POSTHOG_PROJECT_ID = "123"
    process.env.POSTHOG_PERSONAL_API_KEY = "phx_test"
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ results: [[14, 35, 4, 8, 2]] }),
    } as Response)

    await expect(getSiteAnalyticsOverview({ days: 7 })).resolves.toMatchObject({
      available: true,
      visitors: 14,
      pageviews: 35,
      conversions: 4,
    })
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.query.query).not.toContain("properties.tenant_id =")
    expect(body.query.query).toContain("INTERVAL 7 DAY")
  })

  it("parses top pages and action metrics", async () => {
    process.env.POSTHOG_PROJECT_ID = "123"
    process.env.POSTHOG_PERSONAL_API_KEY = "phx_test"
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [["/contact", "contact", 12, 6, 3]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [["Plan intake", "primary", "internal", 8]] }),
      } as Response)

    await expect(getTopPages({ tenantId: 7 })).resolves.toEqual([{
      pagePath: "/contact",
      pageSlug: "contact",
      pageviews: 12,
      visitors: 6,
      conversions: 3,
      conversionRate: 0.5,
    }])
    await expect(getTopCtas({ tenantId: 7 })).resolves.toEqual([{
      label: "Plan intake",
      role: "primary",
      targetType: "internal",
      clicks: 8,
    }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("queries section performance by provider variant", async () => {
    process.env.POSTHOG_PROJECT_ID = "123"
    process.env.POSTHOG_PERSONAL_API_KEY = "phx_test"
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [[
          "top",
          "hero",
          "shadcnui-blocks.hero-01",
          "/",
          14,
          9,
          3,
        ]],
      }),
    } as Response)

    await expect(getSectionPerformance({ tenantId: 7 })).resolves.toEqual([{
      sectionId: "top",
      sectionType: "hero",
      providerVariant: "shadcnui-blocks.hero-01",
      pagePath: "/",
      views: 14,
      engagements: 9,
      ctaClicks: 3,
    }])

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.name).toBe("siab_section_performance")
    expect(body.query.query).toContain("properties.provider_variant AS provider_variant")
    expect(body.query.query).toContain("GROUP BY section_id, section_type, provider_variant, page_path")
  })

  it("queries and ranks cross-tenant provider variants using unique visitor outcomes", async () => {
    process.env.POSTHOG_PROJECT_ID = "123"
    process.env.POSTHOG_PERSONAL_API_KEY = "phx_test"
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [[
          "hero",
          "shadcnui-blocks.hero-01",
          80,
          40,
          24,
          20,
          12,
          10,
          2,
          2,
          2,
          3,
        ]],
      }),
    } as Response)

    await expect(getProviderVariantRanking({ days: 30 })).resolves.toEqual([
      expect.objectContaining({
        sectionType: "hero",
        providerVariant: "shadcnui-blocks.hero-01",
        exposedVisitors: 40,
        engagementRate: 0.5,
        interactionRate: 0.25,
        conversionRate: 0.05,
        confidence: "directional",
        rank: null,
      }),
    ])

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.name).toBe("siab_provider_variant_ranking")
    expect(body.query.query).toContain("uniqIf(person_id, event = 'site_section_viewed')")
    expect(body.query.query).toContain("coalesce(properties.site_kind, 'tenant') = 'tenant'")
    expect(body.query.query).not.toContain("properties.tenant_id =")
  })

  it("parses form funnel, traffic source, and device metrics", async () => {
    process.env.POSTHOG_PROJECT_ID = "123"
    process.env.POSTHOG_PERSONAL_API_KEY = "phx_test"
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [[9, 6, 3]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [["google.com", "search", 20, 11]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [["mobile", 14, 8], ["desktop", 6, 4]] }),
      } as Response)

    await expect(getFormFunnel({ tenantId: 7 })).resolves.toEqual({
      started: 9,
      submitted: 6,
      accepted: 3,
      submitRate: 6 / 9,
      acceptanceRate: 0.5,
    })
    await expect(getTrafficSources({ tenantId: 7 })).resolves.toEqual([{
      source: "google.com",
      sourceType: "search",
      pageviews: 20,
      visitors: 11,
    }])
    await expect(getDeviceSplit({ tenantId: 7 })).resolves.toEqual([
      { deviceType: "mobile", pageviews: 14, visitors: 8 },
      { deviceType: "desktop", pageviews: 6, visitors: 4 },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("parses component performance, journey, and scroll intelligence metrics", async () => {
    process.env.POSTHOG_PROJECT_ID = "123"
    process.env.POSTHOG_PERSONAL_API_KEY = "phx_test"
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [["hero", "header", "hero", 12, 6]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [["page-viewed", 1, 10, 8], ["action-clicked", 2, 4, 3]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [[25, 9, 11], [50, 5, 6]] }),
      } as Response)

    await expect(getComponentPerformance({ tenantId: 7 })).resolves.toEqual([{
      componentType: "hero",
      componentRole: "header",
      sectionType: "hero",
      interactions: 12,
      visitors: 6,
    }])
    await expect(getJourneySteps({ tenantId: 7 })).resolves.toEqual([
      { step: "page-viewed", stepIndex: 1, count: 10, visitors: 8 },
      { step: "action-clicked", stepIndex: 2, count: 4, visitors: 3 },
    ])
    await expect(getScrollDepth({ tenantId: 7 })).resolves.toEqual([
      { depth: 25, visitors: 9, events: 11 },
      { depth: 50, visitors: 5, events: 6 },
    ])

    const names = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).name)
    expect(names).toEqual(["siab_component_performance", "siab_journey_steps", "siab_scroll_depth"])
    const scrollBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))
    expect(scrollBody.query.query).toContain("event = '$pageleave'")
    expect(scrollBody.query.query).toContain("properties.$prev_pageview_max_content_percentage")
    expect(scrollBody.query.query).not.toContain("site_scroll_depth_reached")
  })

  it("parses native and per-tenant web vitals metrics", async () => {
    process.env.POSTHOG_PROJECT_ID = "123"
    process.env.POSTHOG_PERSONAL_API_KEY = "phx_test"
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [[2, 2000, 2600, 2]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [[0, null, null, 0]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [[1, 0.04, 0.04, 1]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [[2, 1200, 1500, 2]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [["7", "amicare", "ami-care.nl", 5, 3, 2000, null, 0.04, 1200]],
        }),
      } as Response)

    await expect(getWebVitals({ days: 7 })).resolves.toMatchObject([
      { name: "LCP", samples: 2, avgValue: 2000, visitors: 2 },
      { name: "CLS", samples: 1, avgValue: 0.04, visitors: 1 },
      { name: "FCP", samples: 2, avgValue: 1200, visitors: 2 },
    ])
    await expect(getTenantWebVitals({ days: 7 })).resolves.toEqual([{
      tenantId: "7",
      tenantSlug: "amicare",
      siteDomain: "ami-care.nl",
      samples: 5,
      visitors: 3,
      score: 100,
      lcpAvg: 2000,
      inpAvg: null,
      clsAvg: 0.04,
      fcpAvg: 1200,
    }])

    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)))
    expect(bodies[0].query.query).toContain("properties['$web_vitals_LCP_value']")
    expect(bodies[4].name).toBe("siab_tenant_web_vitals")
    expect(bodies[4].query.query).not.toContain("properties.tenant_id =")
  })

  it("parses geography metrics", async () => {
    process.env.POSTHOG_PROJECT_ID = "123"
    process.env.POSTHOG_PERSONAL_API_KEY = "phx_test"
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [["NL", "Netherlands", 14, 31]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [["Amsterdam", "NL", "Netherlands", 7, 12]] }),
      } as Response)

    await expect(getGeoCountries({ tenantId: 7 })).resolves.toEqual([{
      countryCode: "NL",
      countryName: "Netherlands",
      visitors: 14,
      pageviews: 31,
    }])
    await expect(getGeoCities({ tenantId: 7 })).resolves.toEqual([{
      city: "Amsterdam",
      countryCode: "NL",
      countryName: "Netherlands",
      visitors: 7,
      pageviews: 12,
    }])

    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)))
    expect(bodies.map((body) => body.name)).toEqual(["siab_geo_countries", "siab_geo_cities"])
    expect(bodies[0].query.query).toContain("properties.$geoip_country_code")
    expect(bodies[1].query.query).toContain("properties.$geoip_city_name")
  })

  it("parses tenant performance and event volume for internal analytics", async () => {
    process.env.POSTHOG_PROJECT_ID = "123"
    process.env.POSTHOG_PERSONAL_API_KEY = "phx_test"
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
      json: async () => ({ results: [["tenant", "7", "amicare", "ami-care.nl", 10, 25, 2, 5, 1]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [["cms_route_viewed", 25], ["cms_action_clicked", 2]] }),
      } as Response)

    await expect(getTenantPerformance({ days: 30 })).resolves.toEqual([{
      siteKind: "tenant",
      tenantId: "7",
      tenantSlug: "amicare",
      siteDomain: "ami-care.nl",
      visitors: 10,
      pageviews: 25,
      conversions: 2,
      conversionRate: 0.2,
      ctaClicks: 5,
      acceptedForms: 1,
    }])
    await expect(getCmsEventVolume({ days: 30 })).resolves.toEqual([
      { event: "cms_route_viewed", count: 25 },
      { event: "cms_action_clicked", count: 2 },
    ])
    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)))
    expect(bodies[0].query.query).toContain("coalesce(properties.analytics_surface, 'site') = 'site'")
    expect(bodies[1].query.query).toContain("properties.analytics_surface = 'cms'")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("parses CMS usage overview metrics", async () => {
    process.env.POSTHOG_PROJECT_ID = "123"
    process.env.POSTHOG_PERSONAL_API_KEY = "phx_test"
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ results: [[3, 9, 42, 18, 5, 4, 1, 4, 2, 1]] }),
    } as Response)

    await expect(getCmsUsageOverview({ tenantId: 7, days: 30 })).resolves.toEqual({
      available: true,
      activeUsers: 3,
      dashboardViews: 9,
      routeViews: 42,
      actionClicks: 18,
      editorOpens: 5,
      editorOpensDesktop: 4,
      editorOpensMobile: 1,
      pageSaves: 4,
      mediaUploads: 2,
      receivedSubmissions: 1,
    })
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.name).toBe("siab_cms_usage_overview")
    expect(body.query.query).toContain("event LIKE 'cms_%'")
    expect(body.query.query).toContain("properties.analytics_surface = 'cms'")
    expect(body.query.query).toContain("properties.tenant_id = '7'")
  })

  it("parses CMS route, action, and device intelligence metrics", async () => {
    process.env.POSTHOG_PROJECT_ID = "123"
    process.env.POSTHOG_PERSONAL_API_KEY = "phx_test"
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [["/pages/[id]", 12, 4, 2, 9, 1]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [["Save", 8, 3]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [["desktop", 20, 7, 5, 4], ["mobile", 6, 3, 2, 2]] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [["7", "amicare", "ami-care.nl", 4, 20, 7, 5, 3]] }),
      } as Response)

    await expect(getCmsRouteMetrics({ tenantId: 7, days: 30 })).resolves.toEqual([{
      route: "/pages/[id]",
      views: 12,
      users: 4,
      direct: 2,
      internal: 9,
      external: 1,
    }])
    await expect(getCmsActionMetrics({ tenantId: 7, days: 30 })).resolves.toEqual([{
      action: "Save",
      clicks: 8,
      users: 3,
    }])
    await expect(getCmsDeviceMetrics({ tenantId: 7, days: 30 })).resolves.toEqual([
      { deviceType: "desktop", routeViews: 20, actionClicks: 7, editorOpens: 5, users: 4 },
      { deviceType: "mobile", routeViews: 6, actionClicks: 3, editorOpens: 2, users: 2 },
    ])
    await expect(getCmsTenantUsage({ tenantId: 7, days: 30 })).resolves.toEqual([{
      tenantId: "7",
      tenantSlug: "amicare",
      siteDomain: "ami-care.nl",
      activeUsers: 4,
      routeViews: 20,
      actionClicks: 7,
      editorOpens: 5,
      pageSaves: 3,
    }])
    expect(fetchMock).toHaveBeenCalledTimes(4)
    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse(String(call[1]?.body))
      expect(body.query.query).toContain("properties.analytics_surface = 'cms'")
      expect(body.query.query).toContain("properties.tenant_id = '7'")
    }
  })
})
