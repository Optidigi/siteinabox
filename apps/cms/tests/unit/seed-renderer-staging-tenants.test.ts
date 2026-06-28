import { describe, expect, it } from "vitest"
import { amblastPublishedSiteSnapshot, amicarePublishedSiteSnapshot } from "@siteinabox/contracts/fixtures/tenants"
import { retargetPublishedSiteSnapshot } from "@/lib/publish/retargetSnapshot"
import {
  RENDERER_SEED_FIXTURES,
  buildRetargetOptionsForRendererSeedFixture,
  cloneForRendererSeedProfile,
  injectRendererSeedAnalytics,
  parseArgs,
  selectRendererSeedFixtures,
} from "../../scripts/seed-renderer-staging-tenants"

describe("renderer seed profiles", () => {
  it("keeps staging as the backwards-compatible default CLI profile", () => {
    expect(parseArgs([])).toMatchObject({
      execute: false,
      profile: "staging",
      tenants: ["amicare", "amblast"],
    })

    expect(parseArgs(["--profile=production", "--tenant=amblast", "--execute"])).toMatchObject({
      execute: true,
      profile: "production",
      tenants: ["amblast"],
    })
  })

  it("keeps staging fixtures unchanged when staging is selected", () => {
    const [amicare, amblast] = selectRendererSeedFixtures({
      profile: "staging",
      tenants: ["amicare", "amblast"],
    })

    expect(amicare).toMatchObject({
      profile: "staging",
      slug: "amicare-renderer",
      domain: "amicare.optidigi.nl",
      siteUrl: "https://amicare.optidigi.nl",
      sourceMediaBaseUrl: "https://ami-care.nl",
    })
    expect(amblast).toMatchObject({
      profile: "staging",
      slug: "amblast-renderer",
      domain: "amblast.optidigi.nl",
      siteUrl: "https://amblast.optidigi.nl",
      sourceMediaBaseUrl: "https://amblast.siteinabox.nl",
    })
    expect(amblast?.importMediaBaseUrl).toBeUndefined()
  })

  it("retargets production specs to official CMS tenants and domains", () => {
    const amicare = cloneForRendererSeedProfile(RENDERER_SEED_FIXTURES.production.amicare)
    const amblast = cloneForRendererSeedProfile(RENDERER_SEED_FIXTURES.production.amblast)

    expect(amicare.intake.tenantSlug).toBe("ami-care")
    expect(amicare.intake.primaryDomain).toBe("ami-care.nl")
    expect(amicare.intake.siteUrl).toBe("https://ami-care.nl")
    expect(amicare.tenant.slug).toBe("ami-care")
    expect(amicare.tenant.domain).toBe("ami-care.nl")
    expect(amicare.settings.siteUrl).toBe("https://ami-care.nl")
    expect(amicare.generator?.name).toBe("renderer-production-bootstrap")
    expect(amicare.intake.goals).toEqual(expect.arrayContaining([
      expect.stringContaining("production live cutover"),
    ]))

    expect(amblast.intake.tenantSlug).toBe("amblast")
    expect(amblast.intake.primaryDomain).toBe("amblast.nl")
    expect(amblast.intake.siteUrl).toBe("https://amblast.nl")
    expect(amblast.tenant.slug).toBe("amblast")
    expect(amblast.tenant.domain).toBe("amblast.nl")
    expect(amblast.settings.siteUrl).toBe("https://amblast.nl")
    expect(JSON.stringify(amblast.pages)).toContain("https://amblast.nl/uploads/portfolio/IMG_20210402_151225-scaled.jpg")

    const amblastImportSpec = cloneForRendererSeedProfile(RENDERER_SEED_FIXTURES.production.amblast, {
      mediaBaseUrl: RENDERER_SEED_FIXTURES.production.amblast.importMediaBaseUrl!,
    })
    expect(amblastImportSpec.settings.siteUrl).toBe("https://amblast.nl")
    expect(JSON.stringify(amblastImportSpec.pages)).toContain("https://amblast.siteinabox.nl/uploads/portfolio/IMG_20210402_151225-scaled.jpg")
    expect(JSON.stringify(amblastImportSpec.pages)).not.toContain("https://amblast.nl/uploads/portfolio/IMG_20210402_151225-scaled.jpg")
  })

  it("builds production retarget options with official snapshot domains and live media bases", () => {
    const amicareOptions = buildRetargetOptionsForRendererSeedFixture(
      RENDERER_SEED_FIXTURES.production.amicare,
      41,
      3,
      "2026-06-28T12:00:00.000Z",
    )
    const amblastOptions = buildRetargetOptionsForRendererSeedFixture(
      RENDERER_SEED_FIXTURES.production.amblast,
      42,
      7,
      "2026-06-28T12:00:00.000Z",
    )

    expect(amicareOptions).toMatchObject({
      tenantSlug: "ami-care",
      domain: "ami-care.nl",
      siteUrl: "https://ami-care.nl",
      mediaBaseUrl: "https://ami-care.nl",
    })
    expect(amblastOptions).toMatchObject({
      tenantSlug: "amblast",
      domain: "amblast.nl",
      siteUrl: "https://amblast.nl",
      mediaBaseUrl: "https://amblast.nl",
    })

    const amicareSnapshot = retargetPublishedSiteSnapshot(amicarePublishedSiteSnapshot, amicareOptions)
    const amblastSnapshot = retargetPublishedSiteSnapshot(amblastPublishedSiteSnapshot, amblastOptions)

    expect(amicareSnapshot.tenantSlug).toBe("ami-care")
    expect(amicareSnapshot.domain).toBe("ami-care.nl")
    expect(amicareSnapshot.siteUrl).toBe("https://ami-care.nl")
    expect(JSON.stringify(amicareSnapshot.pages)).toContain("https://ami-care.nl/media/toys.jpg")
    expect(JSON.stringify(amicareSnapshot.pages)).toContain("https://ami-care.nl/api/tenant-media/7/bedroom.jpg")

    expect(amblastSnapshot.tenantSlug).toBe("amblast")
    expect(amblastSnapshot.domain).toBe("amblast.nl")
    expect(amblastSnapshot.siteUrl).toBe("https://amblast.nl")
    expect(JSON.stringify(amblastSnapshot.pages)).toContain("https://amblast.nl/uploads/portfolio/IMG_20210402_151225-scaled.jpg")
    expect(JSON.stringify(amblastSnapshot.pages)).toContain("Bericht via amblast.nl")
    expect(JSON.stringify(amblastSnapshot.pages)).not.toContain("amblast.optidigi.nl")
    expect(JSON.stringify(amblastSnapshot.pages)).not.toContain("https://amblast.siteinabox.nl/uploads/portfolio/IMG_20210402_151225-scaled.jpg")
  })

  it("injects public PostHog analytics into official production snapshots from seed environment", () => {
    const previousToken = process.env.POSTHOG_PROJECT_TOKEN
    const previousPublicHost = process.env.POSTHOG_PUBLIC_HOST
    const previousHost = process.env.POSTHOG_HOST
    process.env.POSTHOG_PROJECT_TOKEN = "phc_seed_public"
    process.env.POSTHOG_PUBLIC_HOST = "https://r.siteinabox.nl/"
    process.env.POSTHOG_HOST = "https://eu.posthog.com/"

    try {
      const fixture = RENDERER_SEED_FIXTURES.production.amblast
      const snapshot = retargetPublishedSiteSnapshot(
        amblastPublishedSiteSnapshot,
        buildRetargetOptionsForRendererSeedFixture(fixture, 42, 8, "2026-06-28T12:00:00.000Z"),
      )
      const withAnalytics = injectRendererSeedAnalytics(snapshot, fixture, 42, 8)

      expect(withAnalytics.settings.analytics).toMatchObject({
        enabled: true,
        provider: "posthog",
        posthogHost: "https://r.siteinabox.nl",
        posthogUiHost: "https://eu.posthog.com",
        posthogProjectToken: "phc_seed_public",
        tenantSlug: "amblast",
        siteDomain: "amblast.nl",
        manifestVersion: 8,
      })
      expect(withAnalytics.settings.analyticsConsent).toMatchObject({
        enabled: true,
        provider: "posthog",
        consentStorageKey: "siab_cookie_consent_v1",
      })
      expect(withAnalytics.pages[0]?.analytics).toMatchObject({
        tenantSlug: "amblast",
        siteDomain: "amblast.nl",
        pageSlug: "index",
        pagePath: "/",
        manifestVersion: 8,
      })
    } finally {
      if (previousToken == null) delete process.env.POSTHOG_PROJECT_TOKEN
      else process.env.POSTHOG_PROJECT_TOKEN = previousToken
      if (previousPublicHost == null) delete process.env.POSTHOG_PUBLIC_HOST
      else process.env.POSTHOG_PUBLIC_HOST = previousPublicHost
      if (previousHost == null) delete process.env.POSTHOG_HOST
      else process.env.POSTHOG_HOST = previousHost
    }
  })
})
