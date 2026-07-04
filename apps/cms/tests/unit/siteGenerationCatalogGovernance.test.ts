import { describe, expect, it } from "vitest"
import {
  SITE_CHROME_CATALOG,
  SITE_GENERATION_BLOCK_CATALOG,
  SITE_SELF_SERVE_CHROME_VARIANTS,
  SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS,
  SITE_SOURCE_BACKED_BLOCK_VARIANTS,
} from "@siteinabox/contracts/block-catalog"
import { GeneratedSiteSettingsSchema, SiteGenerationSpecSchema } from "@siteinabox/contracts/generation"
import { SITE_BLOCK_SLUGS } from "@siteinabox/contracts/site"
import { buildSiteGenerationModelInput } from "@/lib/ai-generation/siteGenerationInput"
import { SITE_GENERATION_SYSTEM_PROMPT } from "@/lib/ai-generation/prompts/siteGenerationPrompt"
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
    expect(SITE_GENERATION_SYSTEM_PROMPT).toContain("Tailwind Plus, Preline UI, and Tailblocks only")
    expect(SITE_GENERATION_SYSTEM_PROMPT).toContain("Do not use HyperUI or Mamba UI")
    expect(SITE_GENERATION_SYSTEM_PROMPT).toContain("Do not use Amicare tenant-renderer blocks")
  })

  it("passes only active self-serve source-backed variants to the model input", () => {
    const input = buildSiteGenerationModelInput(normalizedIntake)
    const serializedInput = JSON.stringify(input)
    expect(SITE_SOURCE_BACKED_BLOCK_VARIANTS.every((variant) => variant.variant && !variant.variant.includes(":"))).toBe(true)
    const approved = SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS.map((variant) => ({
      blockType: variant.slug,
      sectionVariant: variant.sectionVariant,
      sourceName: variant.provenance.sourceName,
      variantId: variant.variantId,
    }))

    expect(input.approvedSectionVariants).toEqual(approved)
    expect(input.requirements.join("\n")).toContain("approvedSectionVariants")
    expect(input.requirements.join("\n")).toContain("settings.chrome")
    expect(input.requirements.join("\n")).toContain("raw HTML")
    expect(input.requirements.join("\n")).toContain("className/classes")
    expect(input.requirements.join("\n")).toContain("Never use tenant-exclusive Amicare")
    expect(input.approvedSectionVariants.map((variant) => variant.sourceName)).toEqual(
      expect.arrayContaining(["Tailwind Plus", "Preline UI", "Tailblocks"]),
    )
    expect(input.approvedSectionVariants.map((variant) => variant.sourceName)).not.toEqual(
      expect.arrayContaining(["HyperUI", "Mamba UI", "SIAB tenant renderer snapshots"]),
    )
    expect(input.approvedSectionVariants.some((variant) => /amicare/i.test(`${variant.variantId} ${variant.sectionVariant}`))).toBe(false)
    expect(serializedInput).toMatch(/Tailwind Plus|Preline UI|Tailblocks/)
    expect(serializedInput).not.toMatch(/HyperUI|Mamba UI|hyperui|mamba/i)
    expect(serializedInput).not.toMatch(/amicareZenHero|amicareCareCards|amicareEditorial|amicareQuoteContact|amicareContactForm|amicareWarmAccordion|amicareStoryCards/)
    expect(serializedInput).not.toMatch(/amicareZenHeroImageBoxesSwiperServicesPortfolioContactCards/)
    expect(serializedInput).not.toMatch(/cms-block--source-(?:amicare)|site-(?:header|footer)--source-(?:amicare)/)
    expect(SITE_SELF_SERVE_CHROME_VARIANTS.map((variant) => variant.variant)).toEqual(["default", "default", "default"])
    expect(input.approvedChromeVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ area: "header", variant: "default" }),
        expect.objectContaining({ area: "footer", variant: "default" }),
        expect.objectContaining({ area: "banner", variant: "default" }),
      ]),
    )
    expect(input.approvedChromeVariants).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variant: "hyperUiSimple" }),
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
        colors: { accent: "#2563eb", bg: "#ffffff", ink: "#111827", muted: "#6b7280", card: "#f8fafc" },
        fonts: { heading: "Inter", text: "Inter" },
        radius: "8px",
        mode: "light",
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
          variant: "amicareZenHero",
          analytics: { sectionVariant: "amicare-zen-hero" },
          headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Home" }] },
          subheadline: null,
          pills: [],
          cta: null,
          image: null,
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

  it("constrains OpenAI block schemas to active self-serve variants per block type", () => {
    const heroSchema = blockSchemaFor("hero")
    const ctaSchema = blockSchemaFor("cta")
    const schemaBlockTypes = (siteGenerationJsonSchema.properties.pages.items as any)
      .properties.blocks.items.anyOf.map((entry: any) => entry.properties.blockType.const)

    expect(schemaBlockTypes).toEqual(expect.arrayContaining([...SITE_BLOCK_SLUGS]))
    expect(schemaBlockTypes).toHaveLength(SITE_BLOCK_SLUGS.length)
    expect(heroSchema.additionalProperties).toBe(false)
    expect(heroSchema.properties).not.toHaveProperty("className")
    expect(heroSchema.properties).not.toHaveProperty("rawHtml")
    expect(heroSchema.properties).not.toHaveProperty("sourceCode")
    expect(heroSchema.properties.analytics.properties.sectionVariant.enum).toEqual([
      "tailwind-plus-simple-centered",
      null,
    ])
    expect(ctaSchema.properties.analytics.properties.sectionVariant.enum).toEqual([
      "tailblocks-cta-a",
      null,
    ])
    expect(ctaSchema.properties.analytics.properties.sectionVariant.enum).not.toContain("tailwind-plus-simple-centered")
    expect(blockSchemaFor("pricing").properties.analytics.properties.sectionVariant.enum).toEqual([
      "tailwind-plus-simple-pricing",
      null,
    ])
    expect(blockSchemaFor("contactSection").properties.analytics.properties.sectionVariant.enum).toEqual([
      "tailwind-plus-newsletter-details",
      "preline-centered-newsletter",
      null,
    ])
    expect(blockSchemaFor("faq").properties.analytics.properties.sectionVariant).toEqual({ type: ["string", "null"] })
    expect(blockSchemaFor("processSteps").properties.analytics.properties.sectionVariant).toEqual({ type: ["string", "null"] })
    expect(JSON.stringify(siteGenerationJsonSchema)).not.toMatch(/hyperui|mamba/i)
    expect(blockSchemaFor("comparison").properties.analytics.properties.sectionVariant).toEqual({ type: ["string", "null"] })
    expect((siteGenerationJsonSchema.properties.blocks.items as any).properties.slug.enum).toEqual([...SITE_BLOCK_SLUGS])
  })

  it("constrains OpenAI chrome settings and rejects code-like generated settings", () => {
    const settings = (siteGenerationJsonSchema.properties.settings as any)
    expect(settings.required).toContain("chrome")
    expect(settings.properties.chrome.properties.header.properties.variant.enum).toEqual(["default", null])
    expect(settings.properties.chrome.properties.footer.properties.variant.enum).toEqual(["default", null])
    expect(settings.properties.chrome.properties.banner.properties.variant.enum).toEqual(["default", null])
    expect(settings.properties.chrome.additionalProperties).toBe(false)
    expect(JSON.stringify(siteGenerationJsonSchema)).not.toMatch(/hyperUiSimple|HyperUI|Mamba UI|mamba/i)
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
        colors: { accent: "#2563eb", bg: "#ffffff", ink: "#111827", muted: "#6b7280", card: "#f8fafc" },
        fonts: { heading: "Inter", text: "Inter" },
        radius: "8px",
        mode: "light",
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
          variant: "tailwindPlusSimpleTiers",
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
})
