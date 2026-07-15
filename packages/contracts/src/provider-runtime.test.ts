import { describe, expect, it } from "vitest"
import { GeneratedBlockSpecSchema } from "./runtime"
import { SITE_GENERATION_BLOCK_SLUGS } from "./site"

const text = (value: string) => ({ t: "root" as const, variant: "block" as const, children: [{ t: "paragraph" as const, children: [{ t: "text" as const, v: value }] }] })

describe("generated provider block contract", () => {
  it("excludes semantic block types without an approved provider catalog", () => {
    expect(SITE_GENERATION_BLOCK_SLUGS).not.toContain("richText")
    expect(SITE_GENERATION_BLOCK_SLUGS).not.toContain("newsletter")
    expect(SITE_GENERATION_BLOCK_SLUGS).not.toContain("bentoGrid")
    expect(GeneratedBlockSpecSchema.safeParse({ blockType: "richText", designVariant: null, body: text("Legacy") }).success).toBe(false)
    expect(GeneratedBlockSpecSchema.safeParse({ blockType: "newsletter", designVariant: null }).success).toBe(false)
    expect(GeneratedBlockSpecSchema.safeParse({ blockType: "bentoGrid", designVariant: null }).success).toBe(false)
  })

  it("requires a known explicit variant and accepts a catalog-backed block", () => {
    const hero = { blockType: "hero", headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Hello" }] } }
    expect(GeneratedBlockSpecSchema.safeParse(hero).success).toBe(false)
    expect(GeneratedBlockSpecSchema.safeParse({ ...hero, designVariant: "shadcnui-blocks.hero-99" }).success).toBe(false)
    expect(GeneratedBlockSpecSchema.safeParse({ ...hero, designVariant: "shadcnui-blocks.hero-01" }).success).toBe(true)
  })
})
