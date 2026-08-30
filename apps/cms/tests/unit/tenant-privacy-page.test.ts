import { describe, expect, it } from "vitest"
import type { SiteGenerationSpec } from "@siteinabox/contracts/generation"
import {
  materializeTenantPrivacyDisclosure,
  TENANT_PRIVACY_DOCUMENT_SLUG,
  withDerivedTenantPrivacyDisclosure,
} from "@/lib/legal/tenantPrivacyPage"
import { validateSiteGenerationSpecForCms } from "@/lib/site-generation/applySiteGenerationSpec"

import { cast } from "../_helpers/cast"

const spec = (): SiteGenerationSpec => cast<SiteGenerationSpec>({
  schemaVersion: 1,
  generatedAt: "2026-07-10T10:00:00.000Z",
  intake: {
    businessName: "Voorbeeldbedrijf",
    tenantSlug: "voorbeeldbedrijf",
    primaryDomain: "voorbeeldbedrijf.nl",
    siteUrl: "https://voorbeeldbedrijf.nl",
    language: "nl",
    contact: { email: "info@voorbeeldbedrijf.nl", phone: "0612345678" },
    serviceArea: [],
    goals: [],
    requestedPages: [{ slug: "index", title: "Home", purpose: "Introduce the business" }],
    companyFacts: {
      source: "kvk",
      companyName: "Voorbeeldbedrijf B.V.",
      kvkNumber: "12345678",
      address: "Voorbeeldstraat 1, Amsterdam",
      secondaryActivities: [],
    },
    intakeBrief: {
      services: [],
      serviceArea: [],
      workModes: [],
      proofTrust: [],
      contactPreferences: {
        selectedActions: ["message"],
        formOptions: ["message"],
        locationOptions: [],
      },
      callsToAction: ["message"],
      visualPreferences: {},
      tone: [],
      addOnInterest: [],
    },
  },
  tenant: { name: "Voorbeeldbedrijf B.V.", slug: "voorbeeldbedrijf", domain: "voorbeeldbedrijf.nl" },
  theme: {
    version: 3,
    appearance: { mode: "light" },
    colors: { schemeId: "blue-professional" },
    fonts: { schemeId: "clear-modern" },
    shape: { schemeId: "soft" },
  },
  settings: {
    siteName: "Voorbeeldbedrijf",
    siteUrl: "https://voorbeeldbedrijf.nl",
    language: "nl",
    contactEmail: "info@voorbeeldbedrijf.nl",
    nap: { legalName: "Voorbeeldbedrijf B.V.", kvkNumber: "12345678" },
    chrome: { footer: { legalLinks: [] } },
    privacyDisclosure: {
      enabled: true,
      mode: "template",
      title: "Privacy- en cookieverklaring",
      version: "tenant-privacy-owned-2026-08-13.1",
      effectiveAt: "2026-07-10T00:00:00.000Z",
      controller: {
        legalName: "Voorbeeldbedrijf B.V.",
        email: "info@voorbeeldbedrijf.nl",
        kvkNumber: "12345678",
      },
      contactMethods: { forms: { enabled: true, mode: "cms" } },
    },
  },
  pages: [{
    slug: "index",
    title: "Home",
    blocks: [{
      blockType: "hero",
      variant: "hero-01",
      heading: "Voorbeeldbedrijf",
      body: "Een duidelijke volgende stap.",
      primaryAction: { label: "Contact", href: "#contact" },
    }],
  }],
})

describe("tenant privacy document materialization", () => {
  it("derives controller facts before generation validation", () => {
    const result = withDerivedTenantPrivacyDisclosure(spec())
    expect(result.settings.privacyDisclosure).toBeDefined()
  })

  it("materializes an enabled settings-owned document without creating a Page", () => {
    const result = materializeTenantPrivacyDisclosure(withDerivedTenantPrivacyDisclosure(spec()))
    expect(result.pages).toHaveLength(1)
    expect(result.settings.privacyDisclosure).toMatchObject({
      enabled: true,
      mode: "template",
      title: "Privacy- en cookieverklaring",
      controller: { legalName: "Voorbeeldbedrijf B.V.", email: "info@voorbeeldbedrijf.nl" },
    })
    expect(result.settings.privacyDisclosure?.body).toBeTruthy()
    expect(result.settings.chrome?.footer?.legalLinks).toContainEqual({
      label: "Privacy en cookies",
      href: "/privacy-en-cookieverklaring",
    })
    expect(JSON.stringify(result.settings.privacyDisclosure)).toContain("privacyvriendelijke bezoek- en prestatiestatistieken")
    const validation = validateSiteGenerationSpecForCms(result, { variantScope: "self-serve", allowSystemPages: true })
    expect(validation.valid).toBe(true)
  })

  it("rejects optional marketing technology until approved consent chrome exists", () => {
    const result = materializeTenantPrivacyDisclosure(withDerivedTenantPrivacyDisclosure(spec()))
    result.settings.privacyDisclosure!.marketingTechnologies = [{ name: "Ads", purpose: "Remarketing" }]
    const validation = validateSiteGenerationSpecForCms(result, { variantScope: "self-serve", allowSystemPages: true })
    expect(validation.valid).toBe(false)
    expect(validation.issues.map((issue) => issue.code)).toContain("unsupported_optional_tracking_without_consent_ui")
  })

  it("does not replace an explicitly supplied privacy page or duplicate its link", () => {
    const initial = withDerivedTenantPrivacyDisclosure(spec())
    initial.settings.chrome!.footer!.legalLinks = [{ label: "Privacy", href: `/${TENANT_PRIVACY_DOCUMENT_SLUG}` }]

    const once = materializeTenantPrivacyDisclosure(initial)
    const twice = materializeTenantPrivacyDisclosure(once)
    expect(once.pages).toHaveLength(1)
    expect(once.settings.chrome?.footer?.legalLinks).toEqual([{ label: "Privacy", href: `/${TENANT_PRIVACY_DOCUMENT_SLUG}` }])
    expect(twice).toEqual(once)
  })
})
