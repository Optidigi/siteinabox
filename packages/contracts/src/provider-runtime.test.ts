import { describe, expect, it } from "vitest"
import { SHADCNUI_BLOCK_VARIANTS } from "./generated/shadcnui-blocks"
import { validateProviderBlockInstance } from "./provider"
import { BlockSchema, GeneratedBlockSpecSchema } from "./runtime"
import { SITE_GENERATION_BLOCK_SLUGS, type Block } from "./site"

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

  it("rejects every catalog-forbidden field through standalone provider validation", () => {
    for (const variant of SHADCNUI_BLOCK_VARIANTS) {
      for (const field of variant.forbiddenFields) {
        const block = {
          blockType: variant.blockType,
          designVariant: variant.id,
          [field]: "forbidden",
        } as unknown as Block
        expect(
          validateProviderBlockInstance(block).some((issue) =>
            issue.code === "inactive_slot_value" && issue.path[0] === field,
          ),
          `${variant.id}.${field}`,
        ).toBe(true)
      }
    }
  })

  it("keeps strict unknown-field and wrong-block-type rejection", () => {
    const hero = {
      blockType: "hero",
      designVariant: "shadcnui-blocks.hero-01",
      headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Hello" }] },
    }
    expect(BlockSchema.safeParse({ ...hero, unknownField: "nope" }).success).toBe(false)
    expect(validateProviderBlockInstance({
      ...hero,
      blockType: "featureList",
      features: [{ title: text("Feature") }],
    } as unknown as Block).map((issue) => issue.code)).toContain("unresolved_provider_variant")
  })

  it("keeps shared wrapper behavior and standalone array limits", () => {
    const hero = {
      blockType: "hero",
      designVariant: "shadcnui-blocks.hero-01",
      headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Hello" }] },
    } as const
    expect(validateProviderBlockInstance(hero as unknown as Block)).toEqual([])
    expect(BlockSchema.safeParse(hero).success).toBe(true)
    expect(validateProviderBlockInstance({ ...hero, designVariant: " shadcnui-blocks.hero-01 " } as unknown as Block)).toEqual([])
    expect(BlockSchema.safeParse({ ...hero, designVariant: " shadcnui-blocks.hero-01 " }).success).toBe(false)

    const missing = { ...hero, headline: null }
    expect(validateProviderBlockInstance(missing as unknown as Block).map((issue) => issue.code)).toContain("missing_required_slot")
    expect(BlockSchema.safeParse(missing).success).toBe(false)

    const inactive = { ...hero, image: { url: "/hero.jpg", alt: "Hero" } }
    expect(validateProviderBlockInstance(inactive as unknown as Block).map((issue) => issue.code)).toContain("inactive_slot_value")
    expect(BlockSchema.safeParse(inactive).success).toBe(false)

    for (const empty of [null, " ", []]) {
      const candidate = { ...hero, trustLabel: empty }
      expect(validateProviderBlockInstance(candidate as unknown as Block).map((issue) => issue.code)).not.toContain("inactive_slot_value")
    }

    const logo = (count: number, withMedia = true) => ({
      blockType: "logoCloud",
      designVariant: "shadcnui-blocks.logo-cloud-01",
      logos: Array.from({ length: count }, (_, index) => ({
        name: `Logo ${index}`,
        ...(withMedia ? { image: { url: `/logo-${index}.svg`, alt: `Logo ${index}` } } : {}),
      })),
    })
    expect(validateProviderBlockInstance(logo(0) as unknown as Block).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["missing_required_slot", "slot_count_out_of_range"]),
    )
    expect(validateProviderBlockInstance(logo(4) as unknown as Block)).toEqual([])
    expect(BlockSchema.safeParse(logo(4)).success).toBe(true)
    expect(validateProviderBlockInstance(logo(5) as unknown as Block).map((issue) => issue.code)).toContain("slot_count_out_of_range")
    expect(BlockSchema.safeParse(logo(5)).success).toBe(true)
    expect(validateProviderBlockInstance(logo(1, false) as unknown as Block).map((issue) => issue.code)).toContain("missing_required_media")
    expect(BlockSchema.safeParse(logo(1, false)).success).toBe(false)
  })
})
