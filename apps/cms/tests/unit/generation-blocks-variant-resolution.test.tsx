import { describe, expect, it } from "vitest"
import { resolvedCanvasSourceVariant } from "@/components/editor/canvas/CanvasBlockRenderer"

describe("canvas source variant resolution", () => {
  it("ignores tenant-exclusive source variants outside the Amicare canvas context", () => {
    const block = {
      blockType: "hero",
      variant: "amicareZenHero",
      analytics: { sectionVariant: "amicare-zen-hero" },
    }

    expect(resolvedCanvasSourceVariant(block)).toBeUndefined()
    expect(resolvedCanvasSourceVariant(block, { legacyTenant: null })).toBeUndefined()
  })

  it("allows tenant-exclusive source variants for the Amicare canvas context", () => {
    const block = {
      blockType: "hero",
      analytics: { sectionVariant: "amicare-zen-hero" },
    }

    expect(resolvedCanvasSourceVariant(block, { legacyTenant: "amicare" })?.variant).toBe("amicareZenHero")
  })

  it("keeps global source variants available for generic canvas contexts", () => {
    const block = {
      blockType: "pricing",
      analytics: { sectionVariant: "tailwind-plus-simple-pricing" },
    }

    expect(resolvedCanvasSourceVariant(block)?.variant).toBe("tailwindPlusSimpleTiers")
  })
})
