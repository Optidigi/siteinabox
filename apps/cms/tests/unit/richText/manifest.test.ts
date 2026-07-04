import { describe, expect, it } from "vitest"
import { manifestSchema } from "@/lib/richText/manifest"

const base = {
  version: 1 as const,
  inlineMarks: { bold: true, italic: true },
  blockTypes: { paragraph: true as const, heading: { levels: [2, 3] } },
}

describe("manifestSchema — colorTokens", () => {
  it("accepts well-formed colorTokens with cssVar", () => {
    const r = manifestSchema.safeParse({
      ...base,
      colorTokens: [{ id: "accent", label: "Accent", cssVar: "--color-accent" }],
    })
    expect(r.success).toBe(true)
  })

  it("rejects cssVar that doesn't start with --", () => {
    const r = manifestSchema.safeParse({
      ...base,
      colorTokens: [{ id: "accent", label: "Accent", cssVar: "color-accent" }],
    })
    expect(r.success).toBe(false)
  })

  it("rejects duplicate colorToken ids", () => {
    const r = manifestSchema.safeParse({
      ...base,
      colorTokens: [
        { id: "accent", label: "A", cssVar: "--color-accent" },
        { id: "accent", label: "B", cssVar: "--color-other" },
      ],
    })
    expect(r.success).toBe(false)
  })

  it("rejects reserved color id", () => {
    const r = manifestSchema.safeParse({
      ...base,
      colorTokens: [{ id: "b", label: "Bad", cssVar: "--color-bad" }],
    })
    expect(r.success).toBe(false)
  })
})

describe("manifestSchema — fontFamilies", () => {
  it("accepts omitted fontFamilies", () => {
    const r = manifestSchema.safeParse(base)
    expect(r.success).toBe(true)
  })

  it("accepts well-formed fontFamilies with cssVar", () => {
    const r = manifestSchema.safeParse({
      ...base,
      fontFamilies: [{ id: "script", label: "Script font", cssVar: "--font-script" }],
    })
    expect(r.success).toBe(true)
  })

  it("rejects font cssVar that doesn't start with --", () => {
    const r = manifestSchema.safeParse({
      ...base,
      fontFamilies: [{ id: "script", label: "Script font", cssVar: "font-script" }],
    })
    expect(r.success).toBe(false)
  })

  it("rejects duplicate fontFamily ids", () => {
    const r = manifestSchema.safeParse({
      ...base,
      fontFamilies: [
        { id: "title", label: "A", cssVar: "--font-title" },
        { id: "title", label: "B", cssVar: "--font-heading" },
      ],
    })
    expect(r.success).toBe(false)
  })

  it("rejects reserved fontFamily id", () => {
    const r = manifestSchema.safeParse({
      ...base,
      fontFamilies: [{ id: "code", label: "Bad", cssVar: "--font-code" }],
    })
    expect(r.success).toBe(false)
  })
})

describe("manifestSchema — typeStyles", () => {
  it("accepts inline typeStyle", () => {
    const r = manifestSchema.safeParse({
      ...base,
      typeStyles: [{ id: "hart-underline", label: "Hart underline", appliesTo: "inline" }],
    })
    expect(r.success).toBe(true)
  })

  it("accepts heading-scoped typeStyle with description and sampleClass", () => {
    const r = manifestSchema.safeParse({
      ...base,
      typeStyles: [{
        id: "hero-eyebrow", label: "Hero eyebrow", appliesTo: "heading",
        sampleClass: "rt-type-hero-eyebrow", description: "Centered rotated kicker.",
      }],
    })
    expect(r.success).toBe(true)
  })

  it("rejects appliesTo outside the enum", () => {
    const r = manifestSchema.safeParse({
      ...base,
      typeStyles: [{ id: "foo", label: "Foo", appliesTo: "block" as any }],
    })
    expect(r.success).toBe(false)
  })

  it("rejects duplicate typeStyle ids", () => {
    const r = manifestSchema.safeParse({
      ...base,
      typeStyles: [
        { id: "foo", label: "A", appliesTo: "inline" },
        { id: "foo", label: "B", appliesTo: "heading" },
      ],
    })
    expect(r.success).toBe(false)
  })

  it("rejects reserved typeStyle id", () => {
    const r = manifestSchema.safeParse({
      ...base,
      typeStyles: [{ id: "h2", label: "Bad", appliesTo: "heading" }],
    })
    expect(r.success).toBe(false)
  })
})

describe("manifestSchema — blocks[]", () => {
  const baseManifest = {
    version: 1 as const,
    inlineMarks: { bold: true, italic: true },
    blockTypes: { paragraph: true as const, heading: { levels: [2, 3] as (2 | 3 | 4)[] } },
  }

  it("accepts manifest without blocks so callers can apply their active registry fallback", () => {
    expect(manifestSchema.safeParse(baseManifest).success).toBe(true)
  })

  it("accepts blocks[] with slug + optional label + optional defaultAnchor", () => {
    const result = manifestSchema.safeParse({
      ...baseManifest,
      blocks: [
        { slug: "hero" },
        { slug: "featurelist", label: "Our Services", defaultAnchor: "services" },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("accepts blocks[] with site-declared editor fields", () => {
    const result = manifestSchema.safeParse({
      ...baseManifest,
      blocks: [
        {
          slug: "hero",
          label: "Compact hero",
          fields: [
            { name: "title", label: "Title", kind: "text", role: "heading" },
            { name: "body", label: "Body", kind: "richtext", variant: "block", role: "text" },
            { name: "backgroundImage", label: "Background", kind: "image" },
            {
              name: "items",
              label: "Items",
              kind: "array",
              itemFields: [
                { name: "label", label: "Label", kind: "text" },
                { name: "featured", label: "Featured", kind: "checkbox" },
              ],
            },
          ],
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid block editor field metadata", () => {
    const result = manifestSchema.safeParse({
      ...baseManifest,
      blocks: [
        {
          slug: "hero",
          fields: [
            { name: "body", label: "Body", kind: "richtext" },
          ],
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it("rejects duplicate block editor field names", () => {
    const result = manifestSchema.safeParse({
      ...baseManifest,
      blocks: [
        {
          slug: "hero",
          fields: [
            { name: "title", kind: "text" },
            { name: "title", kind: "text" },
          ],
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it("rejects blocks[] with empty slug", () => {
    const result = manifestSchema.safeParse({
      ...baseManifest,
      blocks: [{ slug: "" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects blocks[] with duplicate slugs", () => {
    const result = manifestSchema.safeParse({
      ...baseManifest,
      blocks: [{ slug: "hero" }, { slug: "hero" }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("duplicate"))).toBe(true)
    }
  })

  it("rejects empty blocks[] array", () => {
    const result = manifestSchema.safeParse({ ...baseManifest, blocks: [] })
    expect(result.success).toBe(false)
  })
})
