import { hookRequest } from "../../_helpers/hookFixtures"
import { describe, expect, it, vi } from "vitest"
import { BACKGROUND_MODE_IDS, SITE_BLOCK_SLUGS } from "@siteinabox/contracts"
import { ALL_BLOCKS, BLOCKS, resolveAllowedBlocks } from "@/blocks/registry"

const validationOptions = (siblingData: Record<string, unknown>) => ({
  blockData: {}, data: {}, path: [], preferences: { fields: {} }, req: hookRequest(), siblingData,
})

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

    if (image?.type !== "upload" || image.hasMany === true || typeof image.relationTo !== "string" || highlights?.type !== "array" || serviceHighlights?.type !== "array") throw new Error("Expected hero upload and array fields")
    const imageValidate = image.validate
    const highlightsValidate = highlights.validate
    const serviceHighlightsValidate = serviceHighlights.validate
    if (typeof imageValidate !== "function" || typeof highlightsValidate !== "function" || typeof serviceHighlightsValidate !== "function") throw new Error("Expected guarded hero fields")

    expect(imageValidate(undefined, { ...image, ...validationOptions({ siblingData: { variant: "hero-05" } }.siblingData) })).not.toBe(true)
    expect(imageValidate(undefined, { ...image, ...validationOptions({ siblingData: { variant: "hero-01", backgroundMode: "image" } }.siblingData) })).not.toBe(true)
    expect(imageValidate(12, { ...image, ...validationOptions({ siblingData: { variant: "hero-05" } }.siblingData) })).toBe(true)
    expect(highlightsValidate([{ title: "Only", body: "One" }], { ...highlights, ...validationOptions({ siblingData: { variant: "hero-01" } }.siblingData) })).not.toBe(true)
    expect(highlightsValidate([{ title: "Value", body: "Useful" }], { ...highlights, ...validationOptions({ siblingData: { variant: "hero-05" } }.siblingData) })).not.toBe(true)
    expect(serviceHighlightsValidate(undefined, { ...serviceHighlights, ...validationOptions({ siblingData: { variant: "hero-02" } }.siblingData) })).not.toBe(true)
    expect(serviceHighlightsValidate([{}, {}], { ...serviceHighlights, ...validationOptions({ siblingData: { variant: "hero-02" } }.siblingData) })).toBe(true)
    expect(serviceHighlightsValidate([{}], { ...serviceHighlights, ...validationOptions({ siblingData: { variant: "hero-01" } }.siblingData) })).not.toBe(true)
  })

  it("requires a media relationship when a CTA explicitly selects image background", () => {
    const cta = ALL_BLOCKS.find((block) => block.slug === "cta")
    const image = cta?.fields.find((field) => "name" in field && field.name === "image")
    expect(image && "validate" in image && typeof image.validate).toBe("function")
    if (image?.type !== "upload" || image.hasMany === true || typeof image.relationTo !== "string") throw new Error("Expected hero upload field")
    const imageValidate = image.validate
    if (typeof imageValidate !== "function") throw new Error("Expected guarded CTA image field")
    expect(imageValidate(undefined, { ...image, ...validationOptions({ siblingData: { backgroundMode: "image" } }.siblingData) })).not.toBe(true)
    expect(imageValidate(12, { ...image, ...validationOptions({ siblingData: { backgroundMode: "image" } }.siblingData) })).toBe(true)
    expect(imageValidate(undefined, { ...image, ...validationOptions({ siblingData: { backgroundMode: "none" } }.siblingData) })).toBe(true)
  })
})
