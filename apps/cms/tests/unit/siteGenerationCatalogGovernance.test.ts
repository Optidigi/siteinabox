import { describe, expect, it } from "vitest"
import { SITE_SOURCE_BACKED_BLOCK_VARIANTS } from "@siteinabox/contracts/block-catalog"
import { buildSiteGenerationModelInput } from "@/lib/ai-generation/siteGenerationInput"
import { SITE_GENERATION_SYSTEM_PROMPT } from "@/lib/ai-generation/prompts/siteGenerationPrompt"
import { siteGenerationJsonSchema } from "@/lib/ai-generation/providers"

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
  })

  it("passes only approved source-backed variants to the model input", () => {
    const input = buildSiteGenerationModelInput(normalizedIntake)
    const approved = SITE_SOURCE_BACKED_BLOCK_VARIANTS.map((variant) => ({
      blockType: variant.slug,
      sectionVariant: variant.sectionVariant,
      sourceName: variant.provenance.sourceName,
      variantId: variant.variantId,
    }))

    expect(input.approvedSectionVariants).toEqual(approved)
    expect(input.requirements.join("\n")).toContain("approvedSectionVariants")
    expect(input.requirements.join("\n")).toContain("raw HTML")
    expect(input.requirements.join("\n")).toContain("className/classes")
  })

  it("constrains OpenAI block schemas to approved section variants per block type", () => {
    const heroSchema = blockSchemaFor("hero")
    const ctaSchema = blockSchemaFor("cta")

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
  })
})
