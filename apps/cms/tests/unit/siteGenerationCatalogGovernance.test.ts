import { describe, expect, it } from "vitest"
import {
  SITE_CHROME_CATALOG,
  SITE_GENERATION_BLOCK_CATALOG,
  SITE_SELF_SERVE_CHROME_VARIANTS,
  SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS,
  SITE_SOURCE_BACKED_BLOCK_VARIANTS,
} from "@siteinabox/contracts/block-catalog"
import { GeneratedSiteSettingsSchema, SiteGenerationSpecSchema } from "@siteinabox/contracts/generation"
import { buildSiteGenerationModelInput } from "@/lib/ai-generation/siteGenerationInput"
import {
  SITE_GENERATION_SYSTEM_PROMPT,
  SUPPORTED_SITE_GENERATION_BLOCKS,
} from "@/lib/ai-generation/prompts/siteGenerationPrompt"
import { siteGenerationJsonSchema } from "@/lib/ai-generation/providers"
import { validateSiteGenerationSpecForCms } from "@/lib/site-generation/applySiteGenerationSpec"

const normalizedIntake = {
  businessName: "Catalog Governance",
  tenantSlug: "catalog-governance",
  primaryDomain: "catalog-governance.test",
  siteUrl: "https://catalog-governance.test",
  language: "en",
  serviceArea: ["Amsterdam"],
  goals: ["Generate a governed draft"],
  requestedPages: [{ slug: "index", title: "Home", purpose: "Root page" }],
}

const blockSchemaFor = (blockType: string) => {
  const pageSchema = (siteGenerationJsonSchema.properties.pages.items as any)
  const blockSchemas = pageSchema.properties.blocks.items.anyOf as any[]
  const schema = blockSchemas.find((entry) => entry.properties.blockType.const === blockType)
  if (!schema) throw new Error(`Missing schema for ${blockType}`)
  return schema
}

describe("site generation catalog governance", () => {
  it("prompts structured data only and forbids style/source escapes", () => {
    expect(SITE_GENERATION_SYSTEM_PROMPT).toContain("structured data only")
    expect(SITE_GENERATION_SYSTEM_PROMPT).toContain("source code")
    expect(SITE_GENERATION_SYSTEM_PROMPT).toContain("file paths")
    expect(SITE_GENERATION_SYSTEM_PROMPT).toContain("unsupported block slugs")
    expect(SITE_GENERATION_SYSTEM_PROMPT).toContain("Tailwind Plus only")
    expect(SITE_GENERATION_SYSTEM_PROMPT).toContain("Do not use tenant-renderer blocks")
    expect(SITE_GENERATION_SYSTEM_PROMPT).toContain("block.designVariant")
    expect(SITE_GENERATION_SYSTEM_PROMPT).toContain("Do not author legacy page-block visual identity fields")
  })

  it("passes only active self-serve source-backed variants to the model input", () => {
    const input = buildSiteGenerationModelInput(normalizedIntake)
    const serializedInput = JSON.stringify(input)
    expect(SITE_SOURCE_BACKED_BLOCK_VARIANTS.every((variant) => variant.variant && !variant.variant.includes(":"))).toBe(true)
    const approved = SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS.map((variant) => ({
      blockType: variant.slug,
      designVariant: variant.variant,
      legacyDesignVariant: variant.legacyDesignVariant,
      sourceName: variant.provenance.sourceName,
      variantId: variant.variantId,
    }))

    expect(input.approvedDesignVariants.map(({ slots: _slots, providerVariantId: _providerVariantId, ...variant }) => variant)).toEqual(approved)
    expect(input.approvedDesignVariants).toHaveLength(SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS.length)
    expect(input.approvedDesignVariants).toEqual(expect.arrayContaining([
      expect.objectContaining({
        blockType: "hero",
        designVariant: "tailwindplus.marketing.hero.with-stats",
        legacyDesignVariant: "tailwindPlusHeroWithStats",
        providerVariantId: "tailwindplus.marketing.hero.with-stats",
        slots: expect.objectContaining({
          links: expect.objectContaining({ kind: "repeater", status: "required", exposed: true, minItems: 4, maxItems: 4 }),
          linkLabel: expect.objectContaining({ status: "required", exposed: true }),
          linkHref: expect.objectContaining({ status: "required", exposed: true }),
          stats: expect.objectContaining({ kind: "repeater", status: "required", exposed: true, minItems: 4, maxItems: 4 }),
          statValue: expect.objectContaining({ status: "required", exposed: true }),
          statLabel: expect.objectContaining({ status: "required", exposed: true }),
          eyebrow: expect.objectContaining({ status: "inactive", exposed: false }),
          cta: expect.objectContaining({ status: "inactive", exposed: false }),
          secondary: expect.objectContaining({ status: "inactive", exposed: false }),
        }),
      }),
      expect.objectContaining({
        blockType: "newsletter",
        designVariant: "tailwindplus.marketing.newsletter.side-by-side-with-details",
        legacyDesignVariant: "tailwindPlusNewsletterSideBySideWithDetails",
        providerVariantId: "tailwindplus.marketing.newsletter.side-by-side-with-details",
        slots: expect.objectContaining({
          benefits: expect.objectContaining({ kind: "repeater", status: "required", exposed: true, minItems: 2, maxItems: 2 }),
          benefitTitle: expect.objectContaining({ status: "required", exposed: true }),
          benefitDescription: expect.objectContaining({ status: "required", exposed: true }),
          benefitIcon: expect.objectContaining({ status: "inactive", exposed: false }),
          consentLabel: expect.objectContaining({ status: "inactive", exposed: false }),
        }),
      }),
      expect.objectContaining({
        blockType: "bentoGrid",
        designVariant: "tailwindplus.marketing.bento.three-column-bento-grid",
        legacyDesignVariant: "tailwindPlusThreeColumnBentoGrid",
        providerVariantId: "tailwindplus.marketing.bento.three-column-bento-grid",
        slots: expect.objectContaining({
          items: expect.objectContaining({ kind: "repeater", status: "required", exposed: true, minItems: 4, maxItems: 4 }),
          itemTitle: expect.objectContaining({ status: "required", exposed: true }),
          itemDescription: expect.objectContaining({ status: "required", exposed: true }),
          itemImage: expect.objectContaining({ status: "optional", exposed: true }),
          itemIcon: expect.objectContaining({ status: "inactive", exposed: false }),
          itemCta: expect.objectContaining({ status: "inactive", exposed: false }),
        }),
      }),
      expect.objectContaining({
        blockType: "contentSection",
        designVariant: "tailwindplus.marketing.content.sticky-product-screenshot",
        legacyDesignVariant: "tailwindPlusContentStickyProductScreenshot",
        providerVariantId: "tailwindplus.marketing.content.sticky-product-screenshot",
        slots: expect.objectContaining({
          features: expect.objectContaining({ kind: "repeater", status: "required", exposed: true, minItems: 3, maxItems: 3 }),
          featureTitle: expect.objectContaining({ status: "required", exposed: true }),
          featureDescription: expect.objectContaining({ status: "required", exposed: true }),
          secondaryTitle: expect.objectContaining({ status: "required", exposed: true }),
          secondaryBody: expect.objectContaining({ status: "required", exposed: true }),
          cta: expect.objectContaining({ status: "inactive", exposed: false }),
        }),
      }),
    ]))
    expect(input.requirements.join("\n")).toContain("approvedDesignVariants")
    expect(input.requirements.join("\n")).toContain("inactive slots")
    expect(input.requirements.join("\n")).toContain("Do not set legacy page-block visual identity fields")
    expect(input.requirements.join("\n")).toContain("settings.chrome")
    expect(input.requirements.join("\n")).toContain("raw HTML")
    expect(input.requirements.join("\n")).toContain("className/classes")
    expect(input.requirements.join("\n")).toContain("Never use tenant-exclusive tenant renderer")
    expect(input.approvedDesignVariants.map((variant) => variant.sourceName)).toEqual(
      expect.arrayContaining(["Tailwind Plus"]),
    )
    expect(new Set(input.approvedDesignVariants.map((variant) => variant.sourceName))).toEqual(
      new Set(["Tailwind Plus"]),
    )
    expect(input.approvedDesignVariants.some((variant) => /amicare/i.test(`${variant.variantId} ${variant.designVariant}`))).toBe(false)
    expect(serializedInput).toMatch(/Tailwind Plus/)
    expect(serializedInput).not.toMatch(/Preline UI|Tailblocks/)
    expect(serializedInput).not.toMatch(/tailwindPlusNewsletterDetails/)
    expect(serializedInput).not.toMatch(/amicareZenHero|amicareCareCards|amicareEditorial|amicareQuoteContact|amicareContactForm|amicareWarmAccordion|amicareStoryCards/)
    expect(serializedInput).not.toMatch(/amicareZenHeroImageBoxesSwiperServicesPortfolioContactCards/)
    expect(serializedInput).not.toMatch(/cms-block--source-(?:amicare)|site-(?:header|footer)--source-(?:amicare)/)
    expect(SITE_SELF_SERVE_CHROME_VARIANTS.map((variant) => variant.variant)).toEqual([
      "default",
      "tailwindplus.marketing.header.with-stacked-flyout-menu",
      "default",
      "default",
      "tailwindplus.marketing.banner.with-button",
    ])
    expect(input.approvedChromeVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ area: "header", variant: "default" }),
        expect.objectContaining({
          area: "header",
          variant: "tailwindplus.marketing.header.with-stacked-flyout-menu",
        }),
        expect.objectContaining({ area: "footer", variant: "default" }),
        expect.objectContaining({ area: "banner", variant: "default" }),
        expect.objectContaining({ area: "banner", variant: "tailwindplus.marketing.banner.with-button" }),
      ]),
    )
    expect(input.approvedChromeVariants).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variant: "amicareZen" }),
      ]),
    )
  })

  it("keeps tenant-exclusive tenant-renderer variants out of self-serve generated site validation", () => {
    const tenantExclusiveBlockVariants = SITE_GENERATION_BLOCK_CATALOG
      .flatMap((entry) => entry.variants.map((variant) => ({ ...variant, blockType: entry.slug })))
      .filter((variant) => variant.scope.kind === "tenant-exclusive")
    const tenantExclusiveChromeVariants = SITE_CHROME_CATALOG
      .filter((variant) => variant.scope.kind === "tenant-exclusive")

    expect(tenantExclusiveBlockVariants.length).toBeGreaterThan(0)
    expect(tenantExclusiveChromeVariants.length).toBeGreaterThan(0)

    const spec = {
      schemaVersion: 1,
      intake: normalizedIntake,
      tenant: { name: "Catalog Governance", slug: "catalog-governance", domain: "catalog-governance.test", status: "provisioning" },
      theme: {
        version: 2,
        appearance: { mode: "light" },
        colors: { schemeId: "blue-professional" },
        fonts: { schemeId: "clear-modern" },
        shape: { schemeId: "soft" },
        density: { schemeId: "comfortable" },
      },
      settings: {
        siteName: "Catalog Governance",
        siteUrl: "https://catalog-governance.test",
        description: "Generated draft.",
        language: "en",
        contactEmail: "hello@example.com",
        navHeader: [{ label: "Home", href: "/" }],
        navFooter: [{ label: "Contact", href: "mailto:hello@example.com" }],
        chrome: {
          header: { variant: "amicareZen" },
          footer: { variant: "amicareZen" },
          banner: { variant: "default", visible: false, message: "Preview ready" },
        },
      },
      pages: [{
        slug: "index",
        title: "Home",
        status: "draft",
        seo: { title: "Home", description: "Generated home." },
        blocks: [{
          blockType: "hero",
          designVariant: "amicareZenHero",
          headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Home" }] },
          subheadline: null,
          pills: [],
          cta: null,
        }],
      }],
      blocks: [{ slug: "hero", label: "Hero" }],
      assets: [],
      generatedAt: "2026-06-27T00:00:00.000Z",
      generator: { name: "test", version: "1.0.0", model: "test" },
    }

    const report = validateSiteGenerationSpecForCms(spec as any, { variantScope: "self-serve" })

    expect(report.valid).toBe(false)
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "tenant_exclusive_block_variant",
      "tenant_exclusive_chrome_variant",
    ]))
  })

  it("rejects structured blocks without active self-serve source-backed variants", () => {
    const spec = {
      schemaVersion: 1,
      intake: normalizedIntake,
      tenant: { name: "Catalog Governance", slug: "catalog-governance", domain: "catalog-governance.test", status: "provisioning" },
      theme: {
        version: 2,
        appearance: { mode: "light" },
        colors: { schemeId: "blue-professional" },
        fonts: { schemeId: "clear-modern" },
        shape: { schemeId: "soft" },
        density: { schemeId: "comfortable" },
      },
      settings: {
        siteName: "Catalog Governance",
        siteUrl: "https://catalog-governance.test",
        description: "Generated draft.",
        language: "en",
        contactEmail: "hello@example.com",
        navHeader: [{ label: "Home", href: "/" }],
        navFooter: [{ label: "Contact", href: "mailto:hello@example.com" }],
        chrome: {
          header: { variant: "tailwindplus.marketing.header.with-stacked-flyout-menu" },
          footer: { variant: "default", tagline: "Structured footer", legalLinks: [] },
          banner: { variant: "default", visible: false, message: "Preview ready" },
        },
      },
      pages: [{
        slug: "index",
        title: "Home",
        status: "draft",
        seo: { title: "Home", description: "Generated home." },
        blocks: [{
          blockType: "faq",
          title: { t: "root", variant: "inline", children: [{ t: "text", v: "Highlights" }] },
          items: [{
            question: { t: "root", variant: "inline", children: [{ t: "text", v: "Question?" }] },
            answer: { t: "root", variant: "block", children: [{ t: "paragraph", children: [{ t: "text", v: "Answer." }] }] },
          }],
        }],
      }],
      blocks: [{ slug: "faq", label: "FAQ" }],
      assets: [],
      generatedAt: "2026-06-27T00:00:00.000Z",
      generator: { name: "test", version: "1.0.0", model: "test" },
    }

    const report = validateSiteGenerationSpecForCms(spec as any, { variantScope: "self-serve" })

    expect(report.valid).toBe(false)
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "unsupported_self_serve_block_type",
      "missing_approved_design_variant",
      "unsupported_self_serve_manifest_block_slug",
    ]))
  })

  it("constrains OpenAI block schemas to active self-serve variants per block type", () => {
    const heroSchema = blockSchemaFor("hero")
    const newsletterSchema = blockSchemaFor("newsletter")
    const bentoGridSchema = blockSchemaFor("bentoGrid")
    const contentSectionSchema = blockSchemaFor("contentSection")
    const schemaBlockTypes = (siteGenerationJsonSchema.properties.pages.items as any)
      .properties.blocks.items.anyOf.map((entry: any) => entry.properties.blockType.const)
    const expectedBlockTypes = [
      "hero",
      "featureList",
      "cta",
      "contactSection",
      "testimonials",
      "pricing",
      "stats",
      "logoCloud",
      "team",
      "newsletter",
      "bentoGrid",
      "contentSection",
      "blogCards",
    ]

    expect(schemaBlockTypes).toEqual(SUPPORTED_SITE_GENERATION_BLOCKS)
    expect(schemaBlockTypes).toEqual(expectedBlockTypes)
    expect(heroSchema.additionalProperties).toBe(false)
    expect(heroSchema.properties).not.toHaveProperty("className")
    expect(heroSchema.properties).not.toHaveProperty("rawHtml")
    expect(heroSchema.properties).not.toHaveProperty("sourceCode")
    expect(heroSchema.properties).not.toHaveProperty("analytics")
    expect(heroSchema.properties).not.toHaveProperty("pills")
    expect(heroSchema.properties).toHaveProperty("cta")
    expect(heroSchema.properties).toHaveProperty("secondary")
    expect(heroSchema.required).toContain("designVariant")
    expect(heroSchema.required).not.toContain("eyebrow")
    expect(heroSchema.required).not.toContain("cta")
    expect(heroSchema.required).not.toContain("secondary")
    expect(heroSchema.required).not.toContain("links")
    expect(heroSchema.required).not.toContain("image")
    expect(heroSchema.required).not.toContain("stats")
    expect(heroSchema.properties.designVariant.enum).toEqual([
      "tailwindplus.marketing.hero.simple-centered",
      "tailwindplus.marketing.hero.with-stats",
    ])
    expect(heroSchema.properties.links.minItems).toBe(4)
    expect(heroSchema.properties.links.maxItems).toBe(4)
    expect(heroSchema.properties.stats.minItems).toBe(4)
    expect(heroSchema.properties.stats.maxItems).toBe(4)
    expect(newsletterSchema.additionalProperties).toBe(false)
    expect(newsletterSchema.properties.designVariant.enum).toEqual(["tailwindplus.marketing.newsletter.side-by-side-with-details"])
    expect(newsletterSchema.properties.benefits.minItems).toBe(2)
    expect(newsletterSchema.properties.benefits.maxItems).toBe(2)
    expect(newsletterSchema.properties.benefits.items.properties).not.toHaveProperty("icon")
    expect(bentoGridSchema.additionalProperties).toBe(false)
    expect(bentoGridSchema.required).toEqual(["blockType", "designVariant", "anchor", "title", "intro", "items"])
    expect(bentoGridSchema.properties.designVariant.enum).toEqual(["tailwindplus.marketing.bento.three-column-bento-grid"])
    expect(bentoGridSchema.properties.items.minItems).toBe(4)
    expect(bentoGridSchema.properties.items.maxItems).toBe(4)
    expect(bentoGridSchema.properties.items.items.properties).not.toHaveProperty("icon")
    expect(bentoGridSchema.properties.items.items.properties).not.toHaveProperty("cta")
    expect(bentoGridSchema.properties).not.toHaveProperty("layout")
    expect(bentoGridSchema.properties).not.toHaveProperty("className")
    expect(contentSectionSchema.additionalProperties).toBe(false)
    expect(contentSectionSchema.required).toEqual(["blockType", "designVariant", "anchor", "eyebrow", "title", "intro", "body", "image", "features", "bridge", "secondaryTitle", "secondaryBody"])
    expect(contentSectionSchema.properties.designVariant.enum).toEqual(["tailwindplus.marketing.content.sticky-product-screenshot"])
    expect(contentSectionSchema.properties.features.minItems).toBe(3)
    expect(contentSectionSchema.properties.features.maxItems).toBe(3)
    expect(contentSectionSchema.properties.features.items.properties).not.toHaveProperty("icon")
    expect(contentSectionSchema.properties).not.toHaveProperty("cta")
    expect(contentSectionSchema.properties).not.toHaveProperty("rawHtml")
    expect(schemaBlockTypes).not.toEqual(expect.arrayContaining(["faq", "processSteps", "comparison"]))
    expect((siteGenerationJsonSchema.properties.blocks.items as any).properties.slug.enum).toEqual(SUPPORTED_SITE_GENERATION_BLOCKS)
  })

  it("constrains OpenAI chrome settings and rejects code-like generated settings", () => {
    const settings = (siteGenerationJsonSchema.properties.settings as any)
    expect(settings.required).toContain("chrome")
    expect(settings.properties.chrome.properties.header.properties.variant.enum).toEqual([
      "default",
      "tailwindplus.marketing.header.with-stacked-flyout-menu",
      null,
    ])
    expect(settings.properties.chrome.properties.footer.properties.variant.enum).toEqual(["default", null])
    expect(settings.properties.chrome.properties.banner.properties.variant.enum).toEqual([
      "default",
      "tailwindplus.marketing.banner.with-button",
      null,
    ])
    expect(settings.properties.chrome.additionalProperties).toBe(false)
    expect(JSON.stringify(siteGenerationJsonSchema)).not.toMatch(/amicareZenHero|amicareCareCards|amicareEditorial|amicareQuoteContact|amicareContactForm|amicareWarmAccordion|amicareStoryCards/)
    expect(JSON.stringify(siteGenerationJsonSchema)).not.toMatch(/amicareZenHeroImageBoxesSwiperServicesPortfolioContactCards/)
    expect(JSON.stringify(siteGenerationJsonSchema)).not.toMatch(/amicareZenIndustrial|cms-block--source-(?:amicare)|site-(?:header|footer)--source-(?:amicare)/)

    const generatedSettings = {
      siteName: "Catalog Governance",
      siteUrl: "https://catalog-governance.test",
      description: "Generated draft.",
      language: "en",
      contactEmail: "hello@example.com",
      navHeader: [{ label: "Home", href: "/" }],
      navFooter: [{ label: "Contact", href: "mailto:hello@example.com" }],
      chrome: {
        header: { variant: "default", cta: { label: "Start", href: "/intake" } },
        footer: { variant: "default", tagline: "Built with structured data.", legalLinks: [] },
        banner: { variant: "default", visible: true, message: "Now booking", link: { label: "Contact", href: "/#contact" } },
      },
    }

    expect(GeneratedSiteSettingsSchema.safeParse(generatedSettings).success).toBe(true)
    expect(
      GeneratedSiteSettingsSchema.safeParse({
        ...generatedSettings,
        chrome: { ...generatedSettings.chrome, header: { ...generatedSettings.chrome.header, variant: "customHeader" } },
      }).success,
    ).toBe(false)
    expect(
      GeneratedSiteSettingsSchema.safeParse({
        ...generatedSettings,
        chrome: { ...generatedSettings.chrome, banner: { ...generatedSettings.chrome.banner, sourceCode: "export const Banner = () => null" } },
      }).success,
    ).toBe(false)
  })

  it("keeps generated specs schema-valid with a new catalog block and chrome", () => {
    const spec = {
      schemaVersion: 1,
      intake: normalizedIntake,
      tenant: { name: "Catalog Governance", slug: "catalog-governance", domain: "catalog-governance.test", status: "provisioning" },
      theme: {
        version: 2,
        appearance: { mode: "light" },
        colors: { schemeId: "blue-professional" },
        fonts: { schemeId: "clear-modern" },
        shape: { schemeId: "soft" },
        density: { schemeId: "comfortable" },
      },
      settings: {
        siteName: "Catalog Governance",
        siteUrl: "https://catalog-governance.test",
        description: "Generated draft.",
        language: "en",
        contactEmail: "hello@example.com",
        navHeader: [{ label: "Home", href: "/" }],
        navFooter: [{ label: "Contact", href: "mailto:hello@example.com" }],
        chrome: {
          header: { variant: "default", cta: { label: "Start", href: "/intake" } },
          footer: { variant: "default", tagline: "Structured footer", legalLinks: [] },
          banner: { variant: "default", visible: true, message: "Limited launch slots", link: { label: "Book", href: "/#contact" } },
        },
      },
      pages: [{
        slug: "index",
        title: "Home",
        status: "draft",
        seo: { title: "Home", description: "Generated home." },
        blocks: [{
          blockType: "pricing",
          designVariant: "tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier",
          title: { t: "root", variant: "inline", children: [{ t: "text", v: "Pricing" }] },
          intro: null,
          plans: [{
            title: { t: "root", variant: "inline", children: [{ t: "text", v: "Starter" }] },
            description: null,
            price: "€499",
            period: "once",
            features: [{ label: { t: "root", variant: "inline", children: [{ t: "text", v: "One page" }] }, included: true }],
            cta: { label: "Start", href: "/intake" },
            badge: null,
            highlighted: false,
          }],
        }],
      }],
      blocks: [{ slug: "pricing", label: "Pricing" }],
      assets: [],
      generatedAt: "2026-06-27T00:00:00.000Z",
      generator: { name: "test", version: "1.0.0", model: "test" },
    }

    expect(SiteGenerationSpecSchema.safeParse(spec).success).toBe(true)
  })

  it("enforces provider-required source-backed content slots", () => {
    const rt = (text: string) => ({ t: "root" as const, variant: "inline" as const, children: [{ t: "text" as const, v: text }] })
    const blockRt = (text: string) => ({
      t: "root" as const,
      variant: "block" as const,
      children: [{ t: "paragraph" as const, children: [{ t: "text" as const, v: text }] }],
    })
    const baseSpec = {
      schemaVersion: 1,
      intake: normalizedIntake,
      tenant: { name: "Catalog Governance", slug: "catalog-governance", domain: "catalog-governance.test", status: "provisioning" },
      theme: {
        version: 2,
        appearance: { mode: "light" },
        colors: { schemeId: "blue-professional" },
        fonts: { schemeId: "clear-modern" },
        shape: { schemeId: "soft" },
        density: { schemeId: "comfortable" },
      },
      settings: {
        siteName: "Catalog Governance",
        siteUrl: "https://catalog-governance.test",
        description: "Generated draft.",
        language: "en",
        contactEmail: "hello@example.com",
        navHeader: [{ label: "Home", href: "/" }],
        navFooter: [{ label: "Contact", href: "mailto:hello@example.com" }],
        chrome: {
          header: { variant: "default", cta: { label: "Start", href: "/intake" } },
          footer: { variant: "default", tagline: "Structured footer", legalLinks: [] },
          banner: { variant: "default", visible: true, message: "Limited launch slots", link: { label: "Book", href: "/#contact" } },
        },
      },
      blocks: [{ slug: "hero", label: "Hero" }],
      assets: [],
      generatedAt: "2026-06-27T00:00:00.000Z",
      generator: { name: "test", version: "1.0.0", model: "test" },
    }
    const heroBlock = {
      blockType: "hero",
      designVariant: "tailwindplus.marketing.hero.with-stats",
      headline: rt("Hero"),
      subheadline: blockRt("Intro"),
      links: [
        { label: "Product", href: "#product" },
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "#pricing" },
        { label: "Contact", href: "#contact" },
      ],
      stats: [
        { value: "10k", label: "Users" },
        { value: "4x", label: "Faster" },
        { value: "99%", label: "Uptime" },
        { value: "24/7", label: "Support" },
      ],
    }
    const validHeroSpec = {
      ...baseSpec,
      pages: [{ slug: "index", title: "Home", status: "draft", seo: { title: "Home", description: "Generated home." }, blocks: [heroBlock] }],
    }

    expect(SiteGenerationSpecSchema.safeParse(validHeroSpec).success).toBe(true)
    expect(SiteGenerationSpecSchema.safeParse({
      ...validHeroSpec,
      pages: [{ ...validHeroSpec.pages[0], blocks: [{ ...heroBlock, links: heroBlock.links.slice(0, 3) }] }],
    }).success).toBe(false)
    expect(SiteGenerationSpecSchema.safeParse({
      ...baseSpec,
      blocks: [{ slug: "contentSection", label: "Content" }],
      pages: [{
        slug: "index",
        title: "Home",
        status: "draft",
        seo: { title: "Home", description: "Generated home." },
        blocks: [{
          blockType: "contentSection",
          designVariant: "tailwindplus.marketing.content.sticky-product-screenshot",
          title: rt("Content"),
          intro: blockRt("Intro"),
          body: blockRt("Body"),
          features: [
            { title: rt("One"), description: blockRt("One") },
            { title: rt("Two"), description: blockRt("Two") },
            { title: rt("Three"), description: blockRt("Three") },
          ],
          secondaryTitle: rt("More"),
          secondaryBody: blockRt("More body"),
        }],
      }],
    }).success).toBe(false)
  })
})
