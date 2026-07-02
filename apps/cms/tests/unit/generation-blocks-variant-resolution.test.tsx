import { describe, expect, it } from "vitest"
import { resolvedSourceVariant } from "@/components/editor/canvas/blocks/GenerationBlocks"

describe("GenerationBlocks resolvedSourceVariant", () => {
  it("ignores tenant-exclusive source variants outside the Amicare canvas context", () => {
    const block = {
      blockType: "hero",
      variant: "amicareZenHero",
      analytics: { sectionVariant: "amicare-zen-hero" },
    }

    expect(resolvedSourceVariant(block)).toBeUndefined()
    expect(resolvedSourceVariant(block, { legacyTenant: null })).toBeUndefined()
  })

  it("allows tenant-exclusive source variants for the Amicare canvas context", () => {
    const block = {
      blockType: "hero",
      analytics: { sectionVariant: "amicare-zen-hero" },
    }

    expect(resolvedSourceVariant(block, { legacyTenant: "amicare" })?.variant).toBe("amicareZenHero")
  })

  it("keeps global source variants available for generic canvas contexts", () => {
    const block = {
      blockType: "pricing",
      analytics: { sectionVariant: "tailwind-plus-simple-pricing" },
    }

    expect(resolvedSourceVariant(block)?.variant).toBe("tailwindPlusSimpleTiers")
  })
})
