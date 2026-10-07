import { describe, expect, it, vi } from "vitest"
import { ensureTenantPostHogEnrollment, tenantAnalyticsAppUrls } from "@/lib/analytics/projectEnrollment"

const tenant = {
  id: 7,
  domain: "ami-care.nl",
  domainVerification: { status: "verified" as const },
}

describe("PostHog tenant enrollment", () => {
  it("derives both public and CMS URLs only for verified production domains", () => {
    expect(tenantAnalyticsAppUrls(tenant)).toEqual([
      "https://ami-care.nl",
      "https://admin.siteinabox.nl",
    ])
    expect(tenantAnalyticsAppUrls({ ...tenant, domain: "demo.localhost" })).toEqual([])
    expect(tenantAnalyticsAppUrls({ ...tenant, domainVerification: { status: "failed" } })).toEqual([])
  })

  it("merges new tenant URLs without deleting existing project URLs", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ app_urls: ["https://siteinabox.nl"] }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    await expect(ensureTenantPostHogEnrollment(tenant, {
      env: {
        POSTHOG_HOST: "https://eu.posthog.com/",
        POSTHOG_PROJECT_ID: "123",
        POSTHOG_PERSONAL_API_KEY: "test-only-key",
      },
      fetchImpl: fetchImpl,
    })).resolves.toBe("updated")

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://eu.posthog.com/api/projects/123/")
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({
      app_urls: ["https://admin.siteinabox.nl", "https://ami-care.nl", "https://siteinabox.nl"],
    })
  })

  it("is fail-closed without credentials and idempotent when URLs already exist", async () => {
    const absentFetch = vi.fn<typeof fetch>()
    await expect(ensureTenantPostHogEnrollment(tenant, { env: {}, fetchImpl: absentFetch })).resolves.toBe("skipped")
    expect(absentFetch).not.toHaveBeenCalled()

    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ app_urls: ["https://ami-care.nl", "https://admin.siteinabox.nl"] }))
    await expect(ensureTenantPostHogEnrollment(tenant, {
      env: { POSTHOG_PROJECT_ID: "123", POSTHOG_PERSONAL_API_KEY: "test-only-key" },
      fetchImpl: fetchImpl,
    })).resolves.toBe("unchanged")
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
