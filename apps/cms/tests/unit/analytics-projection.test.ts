import { describe, expect, it } from "vitest"
import { pageToJson } from "@/lib/projection/pageToJson"
import { settingsToJson } from "@/lib/projection/settingsToJson"

describe("analytics projection", () => {
  it("adds page and block analytics metadata without leaking Payload row ids", () => {
    const json = pageToJson(
      {
        id: 10,
        title: "Home",
        slug: "home",
        updatedAt: "2026-06-04T00:00:00.000Z",
        blocks: [
          {
            id: "row-1",
            blockType: "hero",
            designVariant: "shadcnui-blocks.hero-01",
            anchor: "top",
            headline: "Welkom",
          },
          { id: "row-2", blockType: "cta", headline: "Contact", primary: { label: "Bel", href: "tel:+31612345678" } },
        ],
      },
      {
        tenantId: 7,
        tenantSlug: "amicare",
        siteDomain: "ami-care.nl",
        manifestVersion: 1,
      },
    )

    expect(json.analytics).toMatchObject({
      schemaVersion: 1,
      tenantId: "7",
      tenantSlug: "amicare",
      siteId: "7",
      siteDomain: "ami-care.nl",
      pageId: "10",
      pageSlug: "home",
      pagePath: "/",
      manifestVersion: 1,
    })
    expect(json.blocks[0]).not.toHaveProperty("id")
    expect(json.blocks[0].analytics).toMatchObject({
      sectionId: "top",
      sectionType: "hero",
      sectionPosition: 0,
      sectionAnchor: "top",
      providerVariant: "shadcnui-blocks.hero-01",
    })
    expect(json.blocks[0].analytics.contentSignature).toMatch(/^[a-f0-9]{24}$/)
    expect(json.blocks[1].analytics).toMatchObject({
      sectionId: "home:1:cta",
      sectionType: "cta",
      sectionPosition: 1,
      sectionAnchor: null,
    })
  })

  it("adds site analytics metadata and operator-managed conversion goals", () => {
    process.env.POSTHOG_PROJECT_TOKEN = "phc_test"
    process.env.POSTHOG_HOST = "https://eu.posthog.com"
    process.env.POSTHOG_PUBLIC_HOST = "https://r.siteinabox.nl"

    const json = settingsToJson(
      { siteName: "Amicare", siteUrl: "https://ami-care.nl" },
      [],
      {
        tenantId: 7,
        tenantSlug: "amicare",
        siteDomain: "ami-care.nl",
        manifestVersion: 1,
        analytics: { conversionGoals: { contactClicks: ["phone"] } },
      },
    )

    expect(json.analytics).toMatchObject({
      enabled: true,
      provider: "posthog",
      consentMode: "required",
      posthogHost: "https://r.siteinabox.nl",
      posthogUiHost: "https://eu.posthog.com",
      posthogProjectToken: "phc_test",
      tenantId: "7",
      tenantSlug: "amicare",
      siteId: "7",
      siteDomain: "ami-care.nl",
      manifestVersion: 1,
      conversionGoals: { acceptedForms: true, contactClicks: ["phone"] },
      dashboardVisible: true,
    })

    delete process.env.POSTHOG_PROJECT_TOKEN
    delete process.env.POSTHOG_HOST
    delete process.env.POSTHOG_PUBLIC_HOST
  })
})
