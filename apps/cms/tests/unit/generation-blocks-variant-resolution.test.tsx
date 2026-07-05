import { describe, expect, it } from "vitest"
import {
  canvasSourceVariantClassName,
  canvasSourceVariantDataAttribute,
  resolvedCanvasSourceVariant,
} from "@/components/editor/canvas/CanvasBlockRenderer"
import { resolveBlockVariant } from "@siteinabox/site-renderer"

describe("canvas source variant resolution", () => {
  it("ignores tenant-exclusive source variants outside the Amicare canvas context", () => {
    const block = {
      blockType: "hero",
      designVariant: "amicareZenHero",
    }

    expect(resolvedCanvasSourceVariant(block)).toBeUndefined()
    expect(resolvedCanvasSourceVariant(block, { tenantRendererKey: null })).toBeUndefined()
  })

  it("allows tenant-exclusive source variants for the Amicare canvas context", () => {
    const block = {
      blockType: "hero",
      designVariant: "amicareZenHero",
    }

    expect(resolvedCanvasSourceVariant(block, { tenantRendererKey: "amicare" })?.variant).toBe("amicareZenHero")
    expect(resolveBlockVariant(block, { tenantRendererKey: "amicare" }).variant).toBe("amicareZenHero")
    expect(canvasSourceVariantDataAttribute(block, "amicare")).toBe("amicareZenHero")
  })

  it("keeps native source classes off fallback editable DOM", () => {
    const block = {
      blockType: "hero",
      designVariant: "amicareZenHero",
    }

    expect(canvasSourceVariantClassName(block, "amicare")).toBe("cms-block--source-amicare-zen-hero")
    expect(canvasSourceVariantClassName(block, "amicare", { rendererDom: "canvas-fallback" })).toBe("")
  })

  it("keeps unsupported provider candidates unavailable for generic canvas contexts", () => {
    const block = {
      blockType: "pricing",
      designVariant: "tailwindPlusThreeTiers",
    }

    expect(resolvedCanvasSourceVariant(block)).toBeUndefined()
  })

  it("resolves the active Tailwind Plus pricing provider variant for generic canvas contexts", () => {
    const block = {
      blockType: "pricing",
      designVariant: "tailwindPlusSimpleTiers",
    }

    expect(resolvedCanvasSourceVariant(block)?.variant).toBe("tailwindPlusSimpleTiers")
    expect(resolveBlockVariant(block).rendererClassName).toBe(
      "cms-block--source-tailwindplus-pricing-two-tiers-with-emphasized-right-tier",
    )
  })
})
