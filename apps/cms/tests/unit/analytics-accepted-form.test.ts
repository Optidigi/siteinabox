import { afterEach, describe, expect, it, vi } from "vitest"
import { captureAcceptedFormAnalytics } from "@/lib/analytics/acceptedForm"

import { asPayload } from "../_helpers/mockPayload"

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe("captureAcceptedFormAnalytics", () => {
  it("is a no-op when PostHog capture config is absent", async () => {
    delete process.env.POSTHOG_PROJECT_TOKEN
    const fetchMock = vi.spyOn(globalThis, "fetch")

    await captureAcceptedFormAnalytics({
      doc: { id: 1, tenant: 7, formName: "Contact", pageUrl: "https://ami-care.nl/contact" },
      payload: asPayload({ findByID: vi.fn() }),
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("emits accepted-form and conversion events without submitted PII", async () => {
    process.env.POSTHOG_PROJECT_TOKEN = "phc_test"
    process.env.POSTHOG_HOST = "https://eu.posthog.com"
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
    } as Response)

    await captureAcceptedFormAnalytics({
      doc: {
        id: 42,
        tenant: 7,
        formName: "Contact",
        pageUrl: "https://ami-care.nl/contact?email=person@example.com",
        email: "person@example.com",
        data: { message: "private" },
      },
      payload: asPayload({
        findByID: vi.fn().mockResolvedValue({
          id: 7,
          name: "Amicare",
          slug: "amicare",
          domain: "ami-care.nl",
          siteManifest: { version: 1 },
        }),
      }),
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)))
    expect(bodies.map((body) => body.event)).toEqual(["$groupidentify", "site_form_accepted", "site_conversion_completed"])
    expect(JSON.stringify(bodies)).not.toContain("person@example.com")
    expect(JSON.stringify(bodies)).not.toContain("private")
    expect(bodies[0].properties).toMatchObject({
      distinct_id: "$tenant:7",
      $group_type: "tenant",
      $group_key: "7",
      $group_set: { name: "Amicare", slug: "amicare", domain: "ami-care.nl" },
    })
    expect(bodies[1].properties).toMatchObject({
      tenant_id: "7",
      tenant_slug: "amicare",
      tenant_name: "Amicare",
      site_domain: "ami-care.nl",
      site_kind: "tenant",
      $groups: { tenant: "7" },
      page_path: "/contact",
      conversion_source: "accepted_form",
    })
    expect(bodies[1].properties.distinct_id).toBe("site:7:server-conversions")
    expect(JSON.stringify(bodies)).not.toContain('"form_id"')
    expect(JSON.stringify(bodies)).not.toContain('"form_name"')
  })
})
