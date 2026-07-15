import { describe, expect, it } from "vitest"
import { SHADCNUI_BLOCKS_INVENTORY, SHADCNUI_BLOCK_VARIANTS, SHADCNUI_CHROME_VARIANTS, SHADCNUI_SYSTEM_TEMPLATES } from "@siteinabox/contracts"
import { SITE_SELF_SERVE_CHROME_VARIANTS, SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS } from "@siteinabox/contracts/block-catalog"
import { getProviderBlockDefinition, validateProviderBlockInstance } from "@siteinabox/site-renderer/source-blocks"
import { DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID, getProviderSystemTemplateRenderer } from "@siteinabox/site-renderer/source-templates"

describe("shadcnui-blocks canonical provider catalog", () => {
  it("contains the pinned complete inventory and exclusions", () => {
    expect(SHADCNUI_BLOCKS_INVENTORY.commit).toBe("46c2e50bb538c9bc7a8927979d38bae178ae4452")
    expect(SHADCNUI_BLOCKS_INVENTORY.registry).toBe("registry-radix.json")
    expect(SHADCNUI_BLOCKS_INVENTORY.counts).toEqual({ upstream: 542, public: 148, systemTemplates: 8, excluded: 386 })
    expect(SHADCNUI_BLOCK_VARIANTS).toHaveLength(132)
    expect(SHADCNUI_CHROME_VARIANTS).toHaveLength(16)
    expect(SHADCNUI_SYSTEM_TEMPLATES).toHaveLength(8)
    expect(SHADCNUI_BLOCKS_INVENTORY.exclusions.every((entry) => Boolean(entry.reason))).toBe(true)
  })
  it("derives editor and runtime catalogs from the canonical manifest", () => {
    expect(SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS).toHaveLength(132)
    expect(SITE_SELF_SERVE_CHROME_VARIANTS).toHaveLength(16)
    expect(SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS.every((variant) => variant.variant.startsWith("shadcnui-blocks."))).toBe(true)
  })
  it("records required, optional, inactive and repeated slots", () => {
    const hero = SHADCNUI_BLOCK_VARIANTS.find((variant) => variant.id === "shadcnui-blocks.hero-01")!
    expect(hero.slots.headline.status).toBe("required")
    expect(hero.slots.image.status).toBe("optional")
    expect(hero.slots.features.status).toBe("inactive")
    expect(hero.slots.stats.repeated).toBe(true)
  })
  it("fails closed for missing and unknown variants", () => {
    const block = { blockType: "hero", headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Hello" }] } } as any
    expect(validateProviderBlockInstance(block)[0]?.code).toBe("missing_provider_variant")
    expect(getProviderBlockDefinition({ ...block, designVariant: "shadcnui-blocks.hero-99" })).toBeNull()
  })
  it("uses the imported not-found catalog", () => {
    expect(DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID).toBe("shadcnui-blocks.not-found-01")
    expect(getProviderSystemTemplateRenderer("notFound", DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID)).toBeTypeOf("function")
  })
})
