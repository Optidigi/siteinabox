import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "admin.siteinabox.nl" })),
}))

import { captureCmsUsageEvent } from "@/lib/analytics/cms"

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe("CMS analytics tenancy", () => {
  it("attributes a super-admin managed route to the server-resolved tenant group", async () => {
    process.env.POSTHOG_PROJECT_TOKEN = "phc_test"
    process.env.POSTHOG_HOST = "https://eu.posthog.com"
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response)

    await captureCmsUsageEvent({
      event: "cms_route_viewed",
      user: { id: 3, role: "super-admin" } as never,
      ctx: { mode: "super-admin", tenant: null } as never,
      surface: "/sites/[slug]/pages",
      properties: { cms_route: "/sites/[slug]/pages" },
      managedTenant: { id: 7, name: "Amicare", slug: "amicare", domain: "ami-care.nl" } as never,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const group = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    const event = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
    expect(group).toMatchObject({
      event: "$groupidentify",
      properties: { distinct_id: "$tenant:7", $group_type: "tenant", $group_key: "7" },
    })
    expect(event).toMatchObject({
      event: "cms_route_viewed",
      properties: {
        distinct_id: "cms:3",
        analytics_surface: "cms",
        site_kind: "tenant",
        tenant_id: "7",
        tenant_slug: "amicare",
        tenant_name: "Amicare",
        site_domain: "ami-care.nl",
        admin_host: "admin.siteinabox.nl",
        cms_mode: "super-admin",
        cms_tenant_context: "managed",
        $groups: { tenant: "7" },
      },
    })
  })
})
