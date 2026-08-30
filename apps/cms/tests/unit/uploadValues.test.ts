import { describe, expect, it } from "vitest"
import { normalizePageBlockUploadIds, normalizeUploadId } from "@/lib/uploadValues"

describe("normalizeUploadId", () => {
  it("normalizes populated upload objects to ids", () => {
    expect(normalizeUploadId({ id: 12, alt: "Hero" })).toBe(12)
    expect(normalizeUploadId({ id: "abc", alt: "Hero" })).toBe("abc")
  })

  it("keeps primitive ids and nullish values in Payload upload shape", () => {
    expect(normalizeUploadId(12)).toBe(12)
    expect(normalizeUploadId("abc")).toBe("abc")
    expect(normalizeUploadId(null)).toBeNull()
    expect(normalizeUploadId(undefined)).toBeNull()
  })

  it("rejects populated objects without usable ids as empty uploads", () => {
    expect(normalizeUploadId({ alt: "missing id" })).toBeNull()
    expect(normalizeUploadId({ id: {} })).toBeNull()
  })
})

describe("normalizePageBlockUploadIds", () => {
  it("normalizes known page block upload fields without rewriting row ids", () => {
    const blocks = [
      {
        id: "hero-row",
        blockType: "hero",
        blockName: "Hero",
        image: { id: 1, alt: "Hero image" },
        title: { root: { children: [] } },
      },
      {
        id: "cta-row",
        blockType: "cta",
        image: { id: "media-cta", alt: "CTA image" },
        primaryAction: { label: "Call", href: "/contact" },
      },
      {
        id: "work-row",
        blockType: "work",
        projects: [
          { id: "project-a", sourceId: "project-a", title: "A", media: [{ id: "media-work", image: { id: 3, alt: "Project" } }] },
        ],
      },
    ]

    expect(normalizePageBlockUploadIds(blocks)).toEqual([
      {
        id: "hero-row",
        blockType: "hero",
        blockName: "Hero",
        image: 1,
        title: { root: { children: [] } },
      },
      {
        id: "cta-row",
        blockType: "cta",
        image: "media-cta",
        primaryAction: { label: "Call", href: "/contact" },
      },
      {
        id: "work-row",
        blockType: "work",
        projects: [
          { id: "project-a", sourceId: "project-a", title: "A", media: [{ id: "media-work", image: 3 }] },
        ],
      },
    ])
  })

  it("does not normalize unrelated objects or unknown block fields", () => {
    const blocks = [
      { id: "unknown", blockType: "custom", image: { id: 9, alt: "Keep populated" } },
      { id: "content", blockType: "content", body: { root: { children: [{ id: "node-id" }] } } },
    ]

    expect(normalizePageBlockUploadIds(blocks)).toEqual(blocks)
  })

  it("normalizes stale empty CTA hrefs that would fail Payload validation", () => {
    expect(normalizePageBlockUploadIds([
      {
        id: "cta-row",
        blockType: "cta",
        primaryAction: { label: "Contact", href: "#" },
        secondaryAction: { label: "Valid", href: "#contact" },
      },
    ])).toEqual([
      {
        id: "cta-row",
        blockType: "cta",
        primaryAction: { label: "Contact", href: null },
        secondaryAction: { label: "Valid", href: "#contact" },
      },
    ])
  })

  it("returns non-array values unchanged", () => {
    const value = { blockType: "cta", image: { id: 1 } }

    expect(normalizePageBlockUploadIds(value)).toBe(value)
  })
})
