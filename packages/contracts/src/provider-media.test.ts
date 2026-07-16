import { describe, expect, it } from "vitest"
import { validateProviderBlockInstance } from "./provider"
import { BlockSchema } from "./runtime"
import type { Block } from "./site"

const block = (image?: { url: string; alt: string }): Block => ({
  blockType: "logoCloud",
  designVariant: "shadcnui-blocks.logo-cloud-01",
  logos: [{ name: "Example", image }],
})

describe("provider logo media", () => {
  it("fails closed when a selected logo-cloud variant has no logo image", () => {
    expect(validateProviderBlockInstance(block()).map((issue) => issue.code)).toContain("missing_required_media")
    expect(BlockSchema.safeParse(block()).success).toBe(false)
  })

  it("accepts resolved CMS logo media", () => {
    const value = block({ url: "/api/media/file/example.svg", alt: "Example" })
    expect(validateProviderBlockInstance(value)).toEqual([])
    expect(BlockSchema.safeParse(value).success).toBe(true)
  })
})
