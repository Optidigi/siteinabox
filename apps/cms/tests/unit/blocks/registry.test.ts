import { describe, expect, it, vi } from "vitest"
import { BACKGROUND_MODE_IDS, SITE_BLOCK_SLUGS } from "@siteinabox/contracts"
import { ALL_BLOCKS, BLOCKS, resolveAllowedBlocks } from "@/blocks/registry"

describe("first-party block registry", () => {
  it("exposes exactly the canonical Payload block slugs", () => {
    expect(ALL_BLOCKS.map((block) => block.slug)).toEqual([...SITE_BLOCK_SLUGS])
    expect(BLOCKS.map((block) => block.slug)).toEqual([...SITE_BLOCK_SLUGS])
  })

  it("returns the full explicit array when no manifest restriction exists", () => {
    expect(resolveAllowedBlocks(BLOCKS, undefined).map((block) => block.slug))
      .toEqual(BLOCKS.map((block) => block.slug))
    expect(resolveAllowedBlocks(BLOCKS, [])).toHaveLength(BLOCKS.length)
  })

  it("filters and orders by declared semantic slugs", () => {
    expect(resolveAllowedBlocks(ALL_BLOCKS, [
      { slug: "services" },
      { slug: "hero" },
    ]).map((block) => block.slug)).toEqual(["services", "hero"])
  })

  it("skips unknown slugs with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(resolveAllowedBlocks(ALL_BLOCKS, [
      { slug: "hero" },
      { slug: "not-a-real-block" },
      { slug: "contact" },
    ]).map((block) => block.slug)).toEqual(["hero", "contact"])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("not-a-real-block"))
    warn.mockRestore()
  })

  it("keeps hero value points optional and bounded to zero, two, three, or four rows", () => {
    const block = ALL_BLOCKS.find((candidate) => candidate.slug === "hero")
    const highlights = block?.fields.find((field) => "name" in field && field.name === "highlights")
    expect(highlights).toMatchObject({ name: "highlights", type: "array", required: false, maxRows: 4 })
    expect(highlights && "validate" in highlights && typeof highlights.validate).toBe("function")
    expect(block?.fields.some((field) => "name" in field && field.name === "serviceHighlights")).toBe(true)
  })

  it("exposes editable media and per-section background choices for effect-capable blocks", () => {
    for (const slug of ["hero", "cta"]) {
      const block = ALL_BLOCKS.find((candidate) => candidate.slug === slug)
      const backgroundMode = block?.fields.find((field) => "name" in field && field.name === "backgroundMode")
      const image = block?.fields.find((field) => "name" in field && field.name === "image")
      expect(backgroundMode).toMatchObject({
        name: "backgroundMode",
        type: "select",
        required: false,
        options: BACKGROUND_MODE_IDS.map((value) => ({ label: value, value })),
      })
      expect(image).toMatchObject({ name: "image", type: "upload", relationTo: "media", required: false })
    }
  })

  it("guards variant-specific hero media and service data at the CMS field boundary", () => {
    const hero = ALL_BLOCKS.find((block) => block.slug === "hero")
    const image = hero?.fields.find((field) => "name" in field && field.name === "image")
    const highlights = hero?.fields.find((field) => "name" in field && field.name === "highlights")
    const serviceHighlights = hero?.fields.find((field) => "name" in field && field.name === "serviceHighlights")
    expect(image && "validate" in image && typeof image.validate).toBe("function")
    expect(highlights && "validate" in highlights && typeof highlights.validate).toBe("function")
    expect(serviceHighlights && "validate" in serviceHighlights && typeof serviceHighlights.validate).toBe("function")

    const imageValidate = image && "validate" in image && image.validate
    const highlightsValidate = highlights && "validate" in highlights && highlights.validate
    const serviceHighlightsValidate = serviceHighlights && "validate" in serviceHighlights && serviceHighlights.validate
    if (typeof imageValidate !== "function" || typeof highlightsValidate !== "function" || typeof serviceHighlightsValidate !== "function") throw new Error("Expected guarded hero fields")

    expect(imageValidate(undefined, { siblingData: { variant: "hero-05" } } as never)).not.toBe(true)
    expect(imageValidate(undefined, { siblingData: { variant: "hero-01", backgroundMode: "image" } } as never)).not.toBe(true)
    expect(imageValidate(12, { siblingData: { variant: "hero-05" } } as never)).toBe(true)
    expect(highlightsValidate([{ title: "Only", body: "One" }], { siblingData: { variant: "hero-01" } } as never)).not.toBe(true)
    expect(highlightsValidate([{ title: "Value", body: "Useful" }], { siblingData: { variant: "hero-05" } } as never)).not.toBe(true)
    expect(serviceHighlightsValidate(undefined, { siblingData: { variant: "hero-02" } } as never)).not.toBe(true)
    expect(serviceHighlightsValidate([{}, {}], { siblingData: { variant: "hero-02" } } as never)).toBe(true)
    expect(serviceHighlightsValidate([{}], { siblingData: { variant: "hero-01" } } as never)).not.toBe(true)
  })

  it("requires a media relationship when a CTA explicitly selects image background", () => {
    const cta = ALL_BLOCKS.find((block) => block.slug === "cta")
    const image = cta?.fields.find((field) => "name" in field && field.name === "image")
    expect(image && "validate" in image && typeof image.validate).toBe("function")
    const imageValidate = image && "validate" in image && image.validate
    if (typeof imageValidate !== "function") throw new Error("Expected guarded CTA image field")
    expect(imageValidate(undefined, { siblingData: { backgroundMode: "image" } } as never)).not.toBe(true)
    expect(imageValidate(12, { siblingData: { backgroundMode: "image" } } as never)).toBe(true)
    expect(imageValidate(undefined, { siblingData: { backgroundMode: "none" } } as never)).toBe(true)
  })
})
