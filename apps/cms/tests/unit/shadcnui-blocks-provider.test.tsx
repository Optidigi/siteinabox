import { describe, expect, it } from "vitest"
import type { Block } from "@siteinabox/contracts/site"
import { cast, asMockDoc } from "../_helpers/cast"
import { SHADCNUI_PROVIDER, SHADCNUI_BLOCK_VARIANTS, SHADCNUI_CHROME_VARIANTS, SHADCNUI_SYSTEM_TEMPLATES } from "@siteinabox/contracts"
import { SITE_SELF_SERVE_CHROME_VARIANTS, SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS } from "@siteinabox/contracts/block-catalog"
import { getProviderBlockVariant, validateProviderBlockInstance } from "@siteinabox/contracts"
import { DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID, getProviderSystemTemplateRenderer } from "@siteinabox/site-renderer/source-templates"
import { siteGenerationJsonSchema } from "@/lib/ai-generation/providers"

describe("shadcnui-blocks canonical provider catalog", () => {
  it("contains the pinned complete inventory and exclusions", () => {
    expect(SHADCNUI_PROVIDER.commit).toBe("46c2e50bb538c9bc7a8927979d38bae178ae4452")
    expect(SHADCNUI_PROVIDER.registry).toBe("registry-radix.json")
    expect(SHADCNUI_PROVIDER.counts).toEqual({ upstream: 542, public: 148, systemTemplates: 8, excluded: 386 })
    expect(SHADCNUI_BLOCK_VARIANTS).toHaveLength(132)
    expect(SHADCNUI_CHROME_VARIANTS).toHaveLength(16)
    expect(SHADCNUI_SYSTEM_TEMPLATES).toHaveLength(8)
  })
  it("derives editor and runtime catalogs from the canonical manifest", () => {
    expect(SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS).toHaveLength(132)
    expect(SITE_SELF_SERVE_CHROME_VARIANTS).toHaveLength(16)
    expect(SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS.every((variant) => variant.variant.startsWith("shadcnui-blocks."))).toBe(true)
  })
  it("records required, optional, inactive and repeated slots", () => {
    const hero = SHADCNUI_BLOCK_VARIANTS.find((variant) => variant.id === "shadcnui-blocks.hero-01")!
    const heroWithLogos = SHADCNUI_BLOCK_VARIANTS.find((variant) => variant.id === "shadcnui-blocks.hero-08")!
    expect(hero.slots.headline.status).toBe("required")
    expect(hero.slots.image.status).toBe("inactive")
    expect(hero.slots.features.status).toBe("inactive")
    expect(heroWithLogos.slots.logos.repeated).toBe(true)
  })
  it("fails closed for missing and unknown variants", () => {
    const block = cast<Block>({ blockType: "hero", headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Hello" }] } })
    expect(validateProviderBlockInstance(block)[0]?.code).toBe("missing_provider_variant")
    expect(getProviderBlockVariant(cast<Pick<Block, "blockType" | "designVariant">>({ ...block, designVariant: "shadcnui-blocks.hero-99" }))).toBeNull()
  })
  it("uses the imported not-found catalog", () => {
    expect(DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID).toBe("shadcnui-blocks.not-found-01")
    expect(getProviderSystemTemplateRenderer("notFound", DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID)).toBeTypeOf("function")
  })
  it("compiles strict AI output branches from each variant slot manifest", () => {
    const branches = cast<Array<Record<string, unknown>>>((siteGenerationJsonSchema.properties.pages.items.properties.blocks.items as Record<string, unknown>).anyOf)
    expect(branches).toHaveLength(132)
    for (const branch of branches) {
      const props = asMockDoc(branch.properties)
      const required = cast<string[]>(branch.required)
      expect(asMockDoc(props.designVariant).const).toMatch(/^shadcnui-blocks\./)
      expect(new Set(required)).toEqual(new Set(Object.keys(props)))
      const variant = SHADCNUI_BLOCK_VARIANTS.find((entry) => entry.id === asMockDoc(props.designVariant).const)!
      const exposed = Object.keys(props).filter((field) => !["blockType", "designVariant", "anchor"].includes(field))
      expect(exposed.sort()).toEqual(Object.entries(variant.slots).filter(([, slot]) => slot.status !== "inactive").map(([field]) => field).sort())
    }
  })
})
