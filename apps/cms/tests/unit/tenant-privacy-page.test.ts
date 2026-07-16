import { describe, expect, it } from "vitest"
import {
  materializeTenantPrivacyPage,
  TENANT_PRIVACY_PAGE_SLUG,
  withDerivedTenantPrivacyDisclosure,
} from "@/lib/legal/tenantPrivacyPage"
import { validateSiteGenerationSpecForCms } from "@/lib/site-generation/applySiteGenerationSpec"

const spec = () => ({
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
    requestedPages: [],
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
      goals: [],
      proofTrust: [],
      contactPreferences: {
        selectedActions: ["message"],
        formType: "message",
        formOptions: ["message"],
        locationOptions: [],
      },
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
    chrome: { footer: { variant: "shadcnui-blocks.footer-01", legalLinks: [] } },
  },
  pages: [{
    slug: "index",
    title: "Home",
    blocks: [{
      blockType: "hero",
      designVariant: "shadcnui-blocks.hero-01",
      headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Voorbeeldbedrijf" }] },
    }],
  }],
}) as any

describe("tenant privacy page materialization", () => {
  it("derives controller facts before generation validation", () => {
    const result = withDerivedTenantPrivacyDisclosure(spec())
    expect(result.settings.privacyDisclosure).toMatchObject({
      controller: {
        legalName: "Voorbeeldbedrijf B.V.",
        tradeName: "Voorbeeldbedrijf",
        email: "info@voorbeeldbedrijf.nl",
        kvkNumber: "12345678",
      },
      contactMethods: { forms: { enabled: true, mode: "cms" } },
    })
  })

  it("creates a normal editable Page from explicit provider blocks", () => {
    const result = materializeTenantPrivacyPage(withDerivedTenantPrivacyDisclosure(spec()))
    const page = result.pages.find((candidate) => candidate.slug === TENANT_PRIVACY_PAGE_SLUG)
    expect(page).toMatchObject({
      title: "Privacy- en cookieverklaring",
      status: "draft",
      blocks: [
        {
          blockType: "hero",
          designVariant: "shadcnui-blocks.hero-01",
          metadata: { systemRole: "tenant-privacy" },
          eyebrow: { variant: "inline" },
        },
        { blockType: "contentSection", designVariant: "shadcnui-blocks.legal-content-01", metadata: { systemRole: "tenant-privacy" } },
      ],
    })
    expect(result.settings.chrome?.footer?.legalLinks).toContainEqual({
      label: "Privacy en cookies",
      href: "/privacy-en-cookieverklaring",
    })
    const validation = validateSiteGenerationSpecForCms(result, { variantScope: "self-serve", allowSystemPages: true })
    expect(validation.issues.filter((issue) => issue.path?.[0] === "pages" && issue.path?.[1] === 1)).toEqual([])
  })

  it("rejects optional marketing technology until approved consent chrome exists", () => {
    const result = materializeTenantPrivacyPage(withDerivedTenantPrivacyDisclosure(spec()))
    result.settings.privacyDisclosure!.marketingTechnologies = [{ name: "Ads", purpose: "Remarketing" }]
    const validation = validateSiteGenerationSpecForCms(result, { variantScope: "self-serve", allowSystemPages: true })
    expect(validation.valid).toBe(false)
    expect(validation.issues.map((issue) => issue.code)).toContain("unsupported_optional_tracking_without_consent_ui")
  })

  it("does not replace an explicitly supplied privacy page or duplicate its link", () => {
    const initial = withDerivedTenantPrivacyDisclosure(spec())
    initial.pages.push({
      slug: "privacy",
      title: "Ons privacybeleid",
      blocks: [{ blockType: "richText", body: { t: "root", variant: "block", children: [] } }],
    } as any)
    initial.settings.chrome!.footer!.legalLinks = [{ label: "Privacy", href: "/privacy" }]

    const once = materializeTenantPrivacyPage(initial)
    const twice = materializeTenantPrivacyPage(once)
    expect(once.pages.find((page) => page.slug === "privacy")?.title).toBe("Ons privacybeleid")
    expect(once.pages).toHaveLength(2)
    expect(twice).toEqual(once)
  })
})
