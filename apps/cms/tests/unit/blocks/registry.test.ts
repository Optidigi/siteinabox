import { describe, expect, it, vi } from "vitest"
import { SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS } from "@siteinabox/contracts/block-catalog"
import { SITE_GENERATION_BLOCK_SLUGS } from "@siteinabox/contracts/site"
import { ALL_BLOCKS, BLOCKS, resolveAllowedBlocks } from "@/blocks/registry"

describe("resolveAllowedBlocks", () => {
  it("keeps every structured block schema available for Payload and existing content", () => {
    expect(ALL_BLOCKS.map((block) => block.slug)).toEqual([...SITE_GENERATION_BLOCK_SLUGS])
  })

  it("exposes only approved source-backed block slugs in the active picker registry", () => {
    const activeSlugs = [...new Set(SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS.map((variant) => variant.slug))]
    expect(new Set(BLOCKS.map((block) => block.slug))).toEqual(new Set(activeSlugs))
    expect(BLOCKS.map((block) => block.slug)).not.toEqual(
      expect.arrayContaining(["faq", "testimonials", "processSteps", "comparison"]),
    )
  })

  it("returns the active registry when declared is undefined", () => {
    const result = resolveAllowedBlocks(BLOCKS, undefined)
    expect(result).toHaveLength(BLOCKS.length)
    expect(result.map((b) => b.slug)).toEqual(BLOCKS.map((b) => b.slug))
  })

  it("returns the active registry when declared is empty array", () => {
    const result = resolveAllowedBlocks(BLOCKS, [])
    expect(result).toHaveLength(BLOCKS.length)
  })

  it("filters + orders by declared slugs", () => {
    const result = resolveAllowedBlocks(BLOCKS, [
      { slug: "featureList" },
      { slug: "hero" },
    ])
    expect(result.map((b) => b.slug)).toEqual(["featureList", "hero"])
  })

  it("skips unknown slugs with a warning, keeps the known ones", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const result = resolveAllowedBlocks(BLOCKS, [
      { slug: "hero" },
      { slug: "not-a-real-block" },
      { slug: "contactSection" },
    ])
    expect(result.map((b) => b.slug)).toEqual(["hero", "contactSection"])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("not-a-real-block"))
    warn.mockRestore()
  })
})
