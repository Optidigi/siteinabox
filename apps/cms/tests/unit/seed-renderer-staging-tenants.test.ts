import { describe, expect, it } from "vitest"
import { amicarePublishedSiteSnapshot } from "@siteinabox/contracts/fixtures/tenants"
import { SiteGenerationSpecSchema } from "@siteinabox/contracts/generation"
import { retargetPublishedSiteSnapshot } from "@/lib/publish/retargetSnapshot"
import { validateSiteGenerationSpecForCms } from "@/lib/site-generation/applySiteGenerationSpec"
import {
  RENDERER_SEED_FIXTURES,
  buildRetargetOptionsForRendererSeedFixture,
  cloneForRendererSeedProfile,
  injectRendererSeedAnalytics,
  parseArgs,
  parseRendererSeedSpecForCms,
  selectRendererSeedFixtures,
} from "../../scripts/seed-renderer-staging-tenants"

describe("renderer seed profiles", () => {
  it("defaults to the Amicare staging profile and rejects unsupported tenant seeding", () => {
    expect(parseArgs([])).toMatchObject({
      execute: false,
      profile: "staging",
      tenants: ["amicare"],
    })

    expect(parseArgs(["--profile=production", "--tenant=amicare", "--execute"])).toMatchObject({
      execute: true,
      profile: "production",
      tenants: ["amicare"],
    })
    expect(() => parseArgs(["--tenant=customer"])).toThrow(/Unsupported --tenant/)
  })

  it("keeps the Amicare staging fixture unchanged when staging is selected", () => {
    const [amicare] = selectRendererSeedFixtures({
      profile: "staging",
      tenants: ["amicare"],
    })

    expect(amicare).toMatchObject({
      profile: "staging",
      slug: "amicare-renderer",
      domain: "amicare.optidigi.nl",
      siteUrl: "https://amicare.optidigi.nl",
      sourceMediaBaseUrl: "https://ami-care.nl",
    })
  })

  it("retargets production specs to the official Amicare CMS tenant and domain", () => {
    const amicare = cloneForRendererSeedProfile(RENDERER_SEED_FIXTURES.production.amicare)

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
  })

  it("validates the production Ami Care seed spec through the canonical tenant CMS path", () => {
    for (const fixture of selectRendererSeedFixtures({ profile: "production", tenants: ["amicare"] })) {
      const spec = cloneForRendererSeedProfile(fixture)

      expect(SiteGenerationSpecSchema.safeParse(spec).success, `${fixture.key} must use the generic schema`).toBe(true)
      expect(() => parseRendererSeedSpecForCms(fixture, spec, { validateSiteGenerationSpecForCms })).not.toThrow()
    }
  })

  it("builds production retarget options with the Amicare official domain and live media base", () => {
    const amicareOptions = buildRetargetOptionsForRendererSeedFixture(
      RENDERER_SEED_FIXTURES.production.amicare,
      41,
      3,
      "2026-06-28T12:00:00.000Z",
    )

    expect(amicareOptions).toMatchObject({
      tenantSlug: "ami-care",
      domain: "ami-care.nl",
      siteUrl: "https://ami-care.nl",
      mediaBaseUrl: "https://ami-care.nl",
    })

    const amicareSnapshot = retargetPublishedSiteSnapshot(amicarePublishedSiteSnapshot, amicareOptions)

    expect(amicareSnapshot.tenantSlug).toBe("ami-care")
    expect(amicareSnapshot.domain).toBe("ami-care.nl")
    expect(amicareSnapshot.siteUrl).toBe("https://ami-care.nl")
    expect(JSON.stringify(amicareSnapshot.pages)).toContain("https://ami-care.nl/media/toys.jpg")
    expect(JSON.stringify(amicareSnapshot.pages)).toContain("https://ami-care.nl/media/bedroom.jpg")
  })

  it("injects public PostHog analytics into the Amicare production snapshot from seed environment", () => {
    const previousToken = process.env.POSTHOG_PROJECT_TOKEN
    const previousPublicHost = process.env.POSTHOG_PUBLIC_HOST
    const previousHost = process.env.POSTHOG_HOST
    process.env.POSTHOG_PROJECT_TOKEN = "phc_seed_public"
    process.env.POSTHOG_PUBLIC_HOST = "https://r.siteinabox.nl/"
    process.env.POSTHOG_HOST = "https://eu.posthog.com/"

    try {
      const fixture = RENDERER_SEED_FIXTURES.production.amicare
      const snapshot = retargetPublishedSiteSnapshot(
        amicarePublishedSiteSnapshot,
        buildRetargetOptionsForRendererSeedFixture(fixture, 41, 8, "2026-06-28T12:00:00.000Z"),
      )
      const withAnalytics = injectRendererSeedAnalytics(snapshot, fixture, 41, 8)

      expect(withAnalytics.settings.analytics).toMatchObject({
        enabled: true,
        provider: "posthog",
        posthogHost: "https://r.siteinabox.nl",
        posthogUiHost: "https://eu.posthog.com",
        posthogProjectToken: "phc_seed_public",
        tenantSlug: "ami-care",
        siteDomain: "ami-care.nl",
        manifestVersion: 8,
      })
      expect(withAnalytics.settings.analyticsConsent).toMatchObject({
        enabled: true,
        provider: "posthog",
        consentStorageKey: "siab_cookie_consent_v1",
        consentVersion: "2026-07-07.1",
      })
      expect(withAnalytics.pages[0]?.analytics).toMatchObject({
        tenantSlug: "ami-care",
        siteDomain: "ami-care.nl",
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
