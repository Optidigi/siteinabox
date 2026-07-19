import { describe, it, expect } from "vitest"
import { pageToJson } from "@/lib/projection/pageToJson"
import { asPageSource, jsonBlockAt, jsonBlocks, type JsonBlock } from "../_helpers/pageToJsonFixtures"

function pageJson(input: Record<string, unknown>) {
  return pageToJson(asPageSource(input))
}

describe("pageToJson — all block types", () => {
  it("Hero block round-trips", () => {
    const json = pageJson({
      tenant: "t", title: "T", slug: "t", status: "published",
      updatedAt: "2026-05-05T00:00:00.000Z",
      blocks: [{
        id: "1", blockType: "hero",
        eyebrow: "Eyebrow", headline: "H", subheadline: "S",
        cta: { label: "Go", href: "/go" },
        image: { url: "/u/h.png", filename: "h.png" },
      }],
    })
    expect(jsonBlockAt(json, 0)).toMatchObject({
      blockType: "hero",
      eyebrow: "Eyebrow",
      headline: "H",
      subheadline: "S",
      cta: { label: "Go", href: "/go" },
      image: { url: "/u/h.png", filename: "h.png" },
    })
  })

  it("FeatureList block round-trips", () => {
    const json = pageJson({
      tenant: "t", title: "T", slug: "t", status: "published", updatedAt: "x",
      blocks: [{
        id: "1", blockType: "featureList", title: "Why us", intro: "Because",
        features: [
          { id: "f1", title: "Fast", description: "Very", icon: "zap" },
          { id: "f2", title: "Safe", description: "Yes", icon: "shield" },
        ],
      }],
    })
    expect(jsonBlockAt(json, 0)).toMatchObject({
      blockType: "featureList", title: "Why us", intro: "Because",
      features: [
        { title: "Fast", description: "Very", icon: "zap" },
        { title: "Safe", description: "Yes", icon: "shield" },
      ],
    })
  })

  it("strips nested array-row ids (FAQ items, FeatureList features, ContactSection fields, Testimonials items)", () => {
    const json = pageJson({
      tenant: "t", title: "T", slug: "t", status: "published", updatedAt: "x",
      blocks: [
        { id: "b1", blockType: "faq", title: "Help", items: [
          { id: "row-1", question: "Q1", answer: "A1" },
          { id: "row-2", question: "Q2", answer: "A2" },
        ]},
        { id: "b2", blockType: "featureList", title: "Why", features: [
          { id: "row-3", title: "Fast", description: "v" },
        ]},
        { id: "b3", blockType: "testimonials", title: "L", items: [
          { id: "row-4", quote: "wow", author: "Jane" },
        ]},
        { id: "b4", blockType: "contactSection", title: "Hi", formName: "F", fields: [
          { id: "row-5", name: "email", label: "Email", type: "email", required: true },
        ]},
      ],
    })
    expect(jsonBlocks(json).every((block: JsonBlock) => !("id" in block))).toBe(true)
    expect((jsonBlockAt(json, 0).items as JsonBlock[]).every((item) => !("id" in item))).toBe(true)
    expect((jsonBlockAt(json, 1).features as JsonBlock[]).every((feature) => !("id" in feature))).toBe(true)
    expect((jsonBlockAt(json, 2).items as JsonBlock[]).every((item) => !("id" in item))).toBe(true)
    expect((jsonBlockAt(json, 3).fields as JsonBlock[]).every((field) => !("id" in field))).toBe(true)
    expect((jsonBlockAt(json, 0).items as JsonBlock[])[0]?.question).toBe("Q1")
    expect((jsonBlockAt(json, 3).fields as JsonBlock[])[0]?.required).toBe(true)
  })

  it("drops blockName when null/undefined, keeps when string", () => {
    const json = pageJson({
      tenant: "t", title: "T", slug: "t", status: "published", updatedAt: "x",
      blocks: [
        { id: "b1", blockType: "richText", body: "x", blockName: null },
        { id: "b2", blockType: "richText", body: "y", blockName: undefined },
        { id: "b3", blockType: "richText", body: "z", blockName: "Intro" },
        { id: "b4", blockType: "richText", body: "w" },
      ],
    })
    expect(jsonBlockAt(json, 0)).not.toHaveProperty("blockName")
    expect(jsonBlockAt(json, 1)).not.toHaveProperty("blockName")
    expect(jsonBlockAt(json, 2).blockName).toBe("Intro")
    expect(jsonBlockAt(json, 3)).not.toHaveProperty("blockName")
  })

  it("flattens populated Media relationships (drops id, keeps url/filename/alt/w/h)", () => {
    const json = pageJson({
      tenant: "t", title: "T", slug: "t", status: "published", updatedAt: "x",
      blocks: [
        { id: "b1", blockType: "hero", headline: "H",
          image: { id: 99, url: "/u/h.png", filename: "h.png", alt: "x", width: 10, height: 20 } },
        { id: "b2", blockType: "cta", headline: "Quote",
          backgroundImage: { id: 100, url: "/u/bg.png", filename: "bg.png", alt: "bg", width: 30, height: 40 } },
      ],
    })
    expect(jsonBlockAt(json, 0).image).toEqual({
      url: "/u/h.png", filename: "h.png", alt: "x", width: 10, height: 20,
    })
    expect(jsonBlockAt(json, 1).backgroundImage).toEqual({
      url: "/u/bg.png", filename: "bg.png", alt: "bg", width: 30, height: 40,
    })
  })

  it("Testimonials, FAQ, CTA, RichText, ContactSection round-trip", () => {
    const blocks = [
      { blockType: "testimonials", title: "Love", items: [{ quote: "wow", author: "Jane", role: "CEO" }] },
      { blockType: "faq", title: "Help", items: [{ question: "Q?", answer: "A." }] },
      { blockType: "cta", headline: "Buy", primary: { label: "Buy", href: "/b" } },
      { blockType: "richText", body: "hello" },
      { blockType: "contactSection", title: "Hi", formName: "Contact", fields: [
        { name: "email", label: "Email", type: "email", required: true },
      ]},
    ]
    const json = pageJson({ tenant: "t", title: "T", slug: "t", status: "published", updatedAt: "x", blocks })
    expect(jsonBlocks(json)).toHaveLength(5)
    expect(jsonBlocks(json).every((block) => block.blockType)).toBe(true)
    expect(jsonBlocks(json).every((block) => !("id" in block))).toBe(true)
  })
})
