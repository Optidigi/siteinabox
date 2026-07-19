import { describe, it, expect } from "vitest"
import { pageToJson } from "@/lib/projection/pageToJson"
import { validateProviderBlockInstance } from "@siteinabox/contracts"

describe("pageToJson", () => {
  it("flattens a basic Hero+CTA page", () => {
    const doc: any = {
      id: "page1", tenant: "ten1", title: "Home", slug: "home", status: "published",
      blocks: [
        { id: "b1", blockType: "hero", headline: "Welcome", subheadline: "Sub",
          cta: { label: "Go", href: "/go" }, image: { url: "/uploads/hero.png", filename: "hero.png" } },
        { id: "b2", blockType: "cta", headline: "Buy now", primary: { label: "Buy", href: "/buy" } }
      ],
      seo: { title: "Home | Site", description: "Welcome page",
             ogImage: { url: "/uploads/og.png", filename: "og.png" } },
      updatedAt: "2026-05-05T10:00:00.000Z"
    }
    const json = pageToJson(doc)
    expect(json.title).toBe("Home")
    expect(json.slug).toBe("home")
    expect(json.blocks).toHaveLength(2)
    expect(json.blocks[0]).toMatchObject({
      blockType: "hero",
      headline: "Welcome",
      cta: { label: "Go", href: "/go" }
    })
    expect(json.blocks[0].image).toMatchObject({ url: "/uploads/hero.png", filename: "hero.png" })
  })

  it("strips ids and tenant", () => {
    const doc: any = { id: "x", tenant: "t", title: "t", slug: "s", status: "published",
      blocks: [{ id: "ignored", blockType: "richText", body: "hi" }] }
    const json = pageToJson(doc)
    expect(json).not.toHaveProperty("id")
    expect(json).not.toHaveProperty("tenant")
    expect(json.blocks[0]).not.toHaveProperty("id")
  })

  it("handles empty blocks", () => {
    const doc: any = { id: "x", tenant: "t", title: "Empty", slug: "empty", status: "published" }
    const json = pageToJson(doc)
    expect(json.blocks).toEqual([])
  })

  it("removes empty Payload CTA groups but preserves meaningful unsupported content for strict validation", () => {
    const base = {
      id: "amicare-index",
      title: "Home",
      slug: "index",
      updatedAt: "2026-07-19T00:00:00.000Z",
    }
    const canonical = pageToJson({
      ...base,
      blocks: [{
        blockType: "cta",
        designVariant: "shadcnui-blocks.cta-03",
        headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Contact" }] },
        primary: { label: "Neem contact op", href: "#contact" },
        secondary: { label: null, href: null },
      }],
    })

    expect(canonical.blocks[0]).not.toHaveProperty("secondary")
    expect(validateProviderBlockInstance(canonical.blocks[0] as any)).toEqual([])

    const invalid = pageToJson({
      ...base,
      blocks: [{
        blockType: "cta",
        designVariant: "shadcnui-blocks.cta-03",
        headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Contact" }] },
        secondary: { label: "Meaningful", href: "/meaningful" },
      }],
    })
    expect(invalid.blocks[0].secondary).toEqual({ label: "Meaningful", href: "/meaningful" })
    expect(validateProviderBlockInstance(invalid.blocks[0] as any).map((issue) => issue.code)).toContain("inactive_slot_value")
  })
})
