import { describe, expect, it } from "vitest"
import type { NormalizedIntake } from "@siteinabox/contracts"
import {
  createMockSiteGenerationProvider,
  createSiteGenerationProviderRequest,
} from "@/lib/ai-generation/providers"
import { buildSiteGenerationModelInput, sitegenEligibilityFromIntake } from "@/lib/ai-generation/siteGenerationInput"
import { SITE_GENERATION_PROMPT_VERSION } from "@/lib/ai-generation/prompts/siteGenerationPrompt"
import { SITEGEN_SECTIONS } from "@/lib/sitegen/catalog"
import { sitegenMediaFacts } from "@/lib/sitegen/mediaEligibility"
import { validateSitegenOutput } from "@/lib/sitegen/validate"
import { normalizeSitegenOutput, sitegenNormalizationContextFromIntake } from "@/lib/sitegen/normalize"

const normalized: NormalizedIntake = {
  businessName: "Studio Noord",
  tenantSlug: "studio-noord",
  primaryDomain: "studio-noord.siteinabox.test",
  siteUrl: "https://studio-noord.siteinabox.test",
  language: "nl",
  contact: { name: "Test Operator", email: "hello@example.test", phone: "0612345678" },
  industry: "Visuele kwaliteitscontrole",
  serviceArea: ["Nederland"],
  goals: ["Maak de volgende stap duidelijk"],
  requestedPages: [{ slug: "index", title: "Overzicht", purpose: "Homepage" }],
}

describe("site generation model input", () => {
  it("projects only deterministic eligible semantic choices", () => {
    const input = buildSiteGenerationModelInput(normalized)
    expect(input.promptContract).toBe("sitegen-owned-sections")
    expect(input.supportedBlocks).toEqual(SITEGEN_SECTIONS.flatMap((section) => section.variants.map((variant) => `${section.blockType}:${variant.id}`)))
    expect(input.eligibleNavbars.map((navbar) => navbar.id)).toEqual(["navbar-01", "navbar-02", "navbar-03"])
    expect(input.eligibleFooters.map((footer) => footer.id)).toEqual(["footer-01"])
    expect(input.eligibleSections.map((section) => `${section.blockType}:${section.variant ?? ""}`)).toEqual([
      "hero:hero-01",
      "cta:cta-01",
      "cta:cta-02",
    ])
    expect(SITEGEN_SECTIONS).toHaveLength(3)
    expect(JSON.stringify(input)).not.toMatch(/shadcn|legacyVariant/i)
  })

  it("is deterministic for the owned prompt version", () => {
    const first = createSiteGenerationProviderRequest(normalized)
    const second = createSiteGenerationProviderRequest(normalized)
    expect(SITE_GENERATION_PROMPT_VERSION).toBe("sitegen-owned-v1")
    expect(first.inputHash).toBe(second.inputHash)
    expect(JSON.stringify(first.input)).toBe(JSON.stringify(second.input))
  })

  it("accepts a numbered navbar choice and rejects unknown placement values", () => {
    const valid = validateSitegenOutput({
      navbar: { variant: "navbar-02", placement: "hero-overlay" },
      pages: [{ slug: "index", title: "Overzicht", sections: [{
        blockType: "hero",
        variant: "hero-01",
        anchor: null,
        heading: "Een helder aanbod",
        body: "Praktische hulp voor jouw situatie.",
        primaryAction: { label: "Contact", href: "#contact" },
        secondaryAction: null,
        mediaId: null,
      }] }],
    }, {})
    expect(valid.success).toBe(true)
    const invalid = validateSitegenOutput({
      navbar: { variant: "navbar-02", placement: "fixed" },
      pages: [{ slug: "index", title: "Overzicht", sections: [{
        blockType: "hero",
        variant: "hero-01",
        anchor: null,
        heading: "Een helder aanbod",
        body: "Praktische hulp voor jouw situatie.",
        primaryAction: { label: "Contact", href: "#contact" },
        secondaryAction: null,
        mediaId: null,
      }] }],
    }, {})
    expect(invalid.success).toBe(false)
  })

  it("defaults an older response without a footer to the first owned footer", () => {
    const normalizedOutput = normalizeSitegenOutput({
      pages: [{
        slug: "index",
        title: "Overzicht",
        sections: [{
          blockType: "hero",
          variant: "hero-01",
          anchor: null,
          heading: "Een helder aanbod",
          body: "Praktische hulp voor jouw situatie.",
          primaryAction: { label: "Contact", href: "#contact" },
          secondaryAction: null,
          mediaId: null,
        }],
      }],
    }, {})
    expect(normalizedOutput.success).toBe(true)
    if (normalizedOutput.success) expect(normalizedOutput.footer).toEqual({ variant: "footer-01" })
  })

  it("keeps the local fixture on canonical numbered variants", async () => {
    const request = createSiteGenerationProviderRequest(normalized)
    const result = await createMockSiteGenerationProvider().generate(request)
    expect(result.spec?.pages[0]?.blocks.filter((block) => block.blockType === "hero").every((block) => block.variant === "hero-01")).toBe(true)
  })

  it("normalizes shallow model output into a canonical spec with intake-owned contact facts", () => {
    const output = {
      pages: [{
        slug: "index",
        title: "Overzicht",
        sections: [
          { blockType: "hero", variant: "hero-01", anchor: null, heading: "Studio Noord", body: "Heldere hulp.", primaryAction: { label: "Contact", href: "#contact" }, secondaryAction: null, mediaId: null },
          { blockType: "contact", anchor: null, heading: "Neem contact op", body: null, bookingAction: null, serviceArea: [], openingHours: null },
        ],
      }],
    }
    const eligibility = { hasForm: false, hasBooking: false, serviceAreaCount: normalized.serviceArea.length, contactMethodCount: 1 }
    const validated = validateSitegenOutput(output, eligibility)
    expect(validated.success).toBe(false)
    if (validated.success) return
    expect(validated.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringMatching(/not currently enabled/i) }),
    ]))
  })

  it("accepts one eligible explicit hero and rejects the wrong media contract", () => {
    const framed = {
      blockType: "hero",
      variant: "hero-04",
      anchor: null,
      heading: "Een helder aanbod",
      body: "Praktische hulp voor jouw situatie.",
      primaryAction: { label: "Neem contact op", href: "#contact" },
      secondaryAction: null,
      mediaId: "service-photo",
    } as const
    expect(validateSitegenOutput({ pages: [{ slug: "index", title: "Overzicht", sections: [framed] }] }, { hasImage: true }).success).toBe(true)
    const noMedia = validateSitegenOutput({ pages: [{ slug: "index", title: "Overzicht", sections: [{ ...framed, mediaId: null }] }] }, { hasImage: true })
    expect(noMedia.success).toBe(false)
    if (!noMedia.success) expect(noMedia.issues.some((issue) => /requires a supplied media ID/i.test(issue.message))).toBe(true)

    const normalized = normalizeSitegenOutput(
      { pages: [{ slug: "index", title: "Overzicht", sections: [framed] }] },
      { mediaById: { "service-photo": { url: "/media/service.jpg", alt: "Een onderhoudsproject" } } },
    )
    expect(normalized.success).toBe(true)
    if (normalized.success) expect(normalized.pages[0]?.blocks[0]).toMatchObject({ blockType: "hero", variant: "hero-04" })

    const inherited = validateSitegenOutput({
      pages: [{ slug: "index", title: "Overzicht", sections: [{ ...framed, backgroundMode: "none" }] }],
    }, { hasImage: true })
    expect(inherited.success).toBe(true)

    const imageOverrideWithoutMedia = validateSitegenOutput({
      pages: [{ slug: "index", title: "Overzicht", sections: [{ ...framed, variant: "hero-01", backgroundMode: "image", mediaId: null }] }],
    }, { hasImage: true })
    expect(imageOverrideWithoutMedia.success).toBe(false)
    if (!imageOverrideWithoutMedia.success) expect(imageOverrideWithoutMedia.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringMatching(/image background override requires/i) }),
    ]))

    const ctaImageOverrideWithoutMedia = validateSitegenOutput({
      pages: [{ slug: "index", title: "Overzicht", sections: [
        { ...framed, backgroundMode: "none" },
        { blockType: "cta", variant: "cta-01", anchor: null, backgroundMode: "image", heading: "Neem contact op", body: null, primaryAction: { label: "Mail", href: "mailto:hello@example.test" }, secondaryAction: null, mediaId: null },
      ] }],
    }, { hasImage: true })
    expect(ctaImageOverrideWithoutMedia.success).toBe(false)
    if (!ctaImageOverrideWithoutMedia.success) expect(ctaImageOverrideWithoutMedia.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringMatching(/image background override requires/i) }),
    ]))
  })

  it("keeps hero value points optional, bounded, and limited to the supported hero types", () => {
    const highlight = { title: "Heldere afspraken", body: "Je weet vooraf wat er gebeurt." }
    const hero = {
      blockType: "hero",
      variant: "hero-01",
      anchor: null,
      heading: "Een helder aanbod",
      body: "Praktische hulp voor jouw situatie.",
      primaryAction: { label: "Neem contact op", href: "#contact" },
      secondaryAction: null,
      mediaId: null,
      highlights: [highlight, { title: "Netjes gewerkt", body: "We laten de ruimte verzorgd achter." }],
    } as const

    expect(validateSitegenOutput({ pages: [{ slug: "index", title: "Overzicht", sections: [hero] }] }, {}).success).toBe(true)

    const oneHighlight = validateSitegenOutput({ pages: [{ slug: "index", title: "Overzicht", sections: [{ ...hero, highlights: [highlight] }] }] }, {})
    expect(oneHighlight.success).toBe(false)

    const unsupported = validateSitegenOutput({ pages: [{ slug: "index", title: "Overzicht", sections: [{
      blockType: "hero",
      variant: "hero-04",
      anchor: null,
      heading: "Een helder aanbod",
      body: "Praktische hulp voor jouw situatie.",
      primaryAction: { label: "Neem contact op", href: "#contact" },
      secondaryAction: null,
      mediaId: "photo",
      highlights: [highlight, highlight],
    }] }] }, { hasImage: true })
    expect(unsupported.success).toBe(false)
    if (!unsupported.success) expect(unsupported.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringMatching(/cannot use value-point highlights/i) }),
    ]))

    const normalized = normalizeSitegenOutput(
      { pages: [{ slug: "index", title: "Overzicht", sections: [{ ...hero, highlights: [...hero.highlights] }] }] },
      {},
    )
    expect(normalized.success).toBe(true)
    if (normalized.success) expect(normalized.pages[0]?.blocks[0]).toEqual(expect.objectContaining({ highlights: hero.highlights }))
  })

  it("checks the selected media against the hero's actual media requirement", () => {
    const assets = [
      { id: "portrait-photo", url: "/media/portrait.jpg", alt: "Portret van de professional", width: 900, height: 1200 },
      { id: "wide-photo", url: "/media/workshop.jpg", alt: "Werkplaats tijdens een project", width: 1600, height: 900 },
    ] as const
    const intakeWithAssets: NormalizedIntake = { ...normalized, brandSignals: { assets: [...assets] } }
    const eligibility = {
      ...sitegenEligibilityFromIntake(intakeWithAssets),
      mediaById: {
        "portrait-photo": sitegenMediaFacts(assets[0]),
        "wide-photo": sitegenMediaFacts(assets[1]),
      },
    }
    const wideHero = {
      blockType: "hero" as const,
      variant: "hero-02" as const,
      anchor: null,
      heading: "Een resultaat dat bij de plek past",
      body: "Duidelijke hulp van eerste vraag tot verzorgd resultaat.",
      primaryAction: { label: "Bespreek je vraag", href: "#contact" },
      secondaryAction: null,
      mediaId: "portrait-photo",
      serviceHighlights: [
        { title: "Wonen", body: "Praktische hulp.", heroHeading: "Een resultaat dat bij je woning past", heroBody: "Praktische hulp van eerste vraag tot nette afronding.", primaryAction: { label: "Bespreek je woning", href: "#contact" }, secondaryAction: null, mediaId: "portrait-photo" },
        { title: "Werk", body: "Duidelijke uitvoering.", heroHeading: "Een werkplek die prettig blijft werken", heroBody: "Duidelijke uitvoering met aandacht voor de dagelijkse praktijk.", primaryAction: { label: "Bespreek je werkplek", href: "#contact" }, secondaryAction: null, mediaId: "wide-photo" },
      ],
    }
    const servicePanel = wideHero

    const invalidWide = validateSitegenOutput({ pages: [{ slug: "index", title: "Overzicht", sections: [wideHero] }] }, eligibility)
    expect(invalidWide.success).toBe(false)
    if (!invalidWide.success) expect(invalidWide.issues.some((issue) => /requires a supplied wide media ID/i.test(issue.message))).toBe(true)

    const invalidServicePanel = validateSitegenOutput({ pages: [{ slug: "index", title: "Overzicht", sections: [servicePanel] }] }, eligibility)
    expect(invalidServicePanel.success).toBe(false)
    if (!invalidServicePanel.success) expect(invalidServicePanel.issues.some((issue) => /requires a supplied wide media ID/i.test(issue.message))).toBe(true)

    const normalizedWide = normalizeSitegenOutput(
      { pages: [{ slug: "index", title: "Overzicht", sections: [wideHero] }] },
      sitegenNormalizationContextFromIntake(intakeWithAssets),
    )
    expect(normalizedWide.success).toBe(false)
    if (!normalizedWide.success) expect(normalizedWide.issues.some((issue) => /requires a supplied wide media ID/i.test(issue.message))).toBe(true)
  })

  it("accepts supplied media on the lead hero and preserves it during normalization", () => {
    const result = validateSitegenOutput({
      pages: [{
        slug: "index",
        title: "Overzicht",
        sections: [{
          blockType: "hero",
          variant: "hero-01",
          anchor: null,
          heading: "Een helder aanbod",
          body: "Praktische hulp voor jouw situatie.",
          primaryAction: { label: "Contact", href: "#contact" },
          secondaryAction: null,
          mediaId: "service-photo",
        }],
      }],
    }, {
      hasImage: true,
      mediaById: {
        "service-photo": sitegenMediaFacts({ id: "service-photo", url: "/media/service.jpg", alt: "Werkplaats", width: 1600, height: 900 }),
      },
    })
    expect(result.success).toBe(true)

    const normalized = normalizeSitegenOutput(
      {
        pages: [{
          slug: "index",
          title: "Overzicht",
          sections: [{
            blockType: "hero",
            variant: "hero-01",
            anchor: null,
            heading: "Een helder aanbod",
            body: "Praktische hulp voor jouw situatie.",
            primaryAction: { label: "Contact", href: "#contact" },
            secondaryAction: null,
            mediaId: "service-photo",
          }],
        }],
      },
      { mediaById: { "service-photo": { url: "/media/service.jpg", alt: "Werkplaats" } } },
    )
    expect(normalized.success).toBe(true)
    if (normalized.success) expect(normalized.pages[0]?.blocks[0]).toEqual(expect.objectContaining({ blockType: "hero", image: { url: "/media/service.jpg", alt: "Werkplaats" } }))
  })

  it("does not treat URL-only media as a selectable evidence asset", () => {
    const intakeWithUrlOnlyAsset: NormalizedIntake = {
      ...normalized,
      brandSignals: { assets: [{ url: "/media/workshop.jpg", alt: "Werkplaats", width: 1600, height: 900 }] },
    }
    const eligibility = sitegenEligibilityFromIntake(intakeWithUrlOnlyAsset)
    expect(eligibility.hasImage).toBe(false)
    expect(eligibility.mediaById).toEqual({})
    expect(sitegenNormalizationContextFromIntake(intakeWithUrlOnlyAsset).mediaById).toBeUndefined()
  })

  it("treats all explicit hero block types as one homepage singleton family", () => {
    const output = {
      pages: [{
        slug: "index",
        title: "Overzicht",
        sections: [
          { blockType: "hero", variant: "hero-01", anchor: null, heading: "Eén", body: "Eén.", primaryAction: { label: "Start", href: "#start" }, secondaryAction: null, mediaId: null },
          { blockType: "hero", variant: "hero-01", anchor: null, heading: "Twee", body: "Twee.", primaryAction: { label: "Start", href: "#start" }, secondaryAction: null, mediaId: null },
        ],
      }],
    }
    const result = validateSitegenOutput(output, {})
    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues.some((issue) => /only one hero/i.test(issue.message))).toBe(true)
  })
})
