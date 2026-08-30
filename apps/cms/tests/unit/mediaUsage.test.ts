import { describe, it, expect } from "vitest"
import { buildMediaUsageMap } from "@/lib/queries/mediaUsageWalker"

import { cast } from "../_helpers/cast"
import type { SiteSetting } from "@/payload-types"
import type { MockDoc } from "../_helpers/mockPayload"
import type { Page } from "@/payload-types"

type MediaUsagePage = Pick<Page, "blocks" | "id" | "title" | "slug" | "seo">
const pagesForUsage = (pages: unknown[]) => cast<MediaUsagePage[]>(pages)
// The walker is the only logic-heavy piece; we feed it page/settings
// fixtures shaped like Payload's depth-1 responses (mix of primitive
// ids and populated upload objects) and assert the resulting map.

describe("buildMediaUsageMap", () => {
  it("records image-led hero block references", () => {
    const pages: unknown[] = [
      {
        id: 1, title: "Home", slug: "home",
        blocks: [{ blockType: "hero", variant: "hero-04", image: 10 }]
      }
    ]
    const map = buildMediaUsageMap(pagesForUsage(pages), null)
    expect(map.get(10)?.pages).toEqual([{ id: 1, title: "Home", slug: "home" }])
    expect(map.get(10)?.settings).toBe(false)
  })

  it("records the optional lead hero background image", () => {
    const pages: unknown[] = [
      {
        id: 11, title: "Lead", slug: "lead",
        blocks: [{ blockType: "hero", image: { id: 15, filename: "lead.jpg" } }],
      },
    ]
    const map = buildMediaUsageMap(pagesForUsage(pages), null)
    expect(map.get(15)?.pages).toEqual([{ id: 11, title: "Lead", slug: "lead" }])
  })

  it("normalizes populated upload objects (depth: 1) to their .id", () => {
    const pages: unknown[] = [
      {
        id: 2, title: "About", slug: "about",
        blocks: [{ blockType: "hero", variant: "hero-04", image: { id: 42, filename: "hero.png" } }]
      }
    ]
    const map = buildMediaUsageMap(pagesForUsage(pages), null)
    expect(map.has(42)).toBe(true)
    expect(map.get(42)?.pages[0]?.id).toBe(2)
  })

  it("walks work.projects[].media[].image", () => {
    const pages: unknown[] = [
      {
        id: 3, title: "Reviews", slug: "reviews",
        blocks: [
          {
            blockType: "work",
            projects: [{
              sourceId: "project-1",
              title: "Project",
              media: [{ image: 100 }, { image: { id: 101 } }],
            }],
          }
        ]
      }
    ]
    const map = buildMediaUsageMap(pagesForUsage(pages), null)
    expect(map.has(100)).toBe(true)
    expect(map.has(101)).toBe(true)
    expect(map.size).toBe(2)
  })

  it("records CTA background image references", () => {
    const pages: unknown[] = [
      {
        id: 6, title: "Wat telt", slug: "wat-telt",
        blocks: [{ blockType: "cta", image: { id: 120, filename: "care.jpg" } }]
      }
    ]
    const map = buildMediaUsageMap(pagesForUsage(pages), null)
    expect(map.get(120)?.pages).toEqual([{ id: 6, title: "Wat telt", slug: "wat-telt" }])
  })

  it("captures seo.ogImage at the top level", () => {
    const pages: unknown[] = [
      { id: 4, title: "Contact", slug: "contact", seo: { ogImage: 7 }, blocks: [] }
    ]
    const map = buildMediaUsageMap(pagesForUsage(pages), null)
    expect(map.get(7)?.pages[0]?.id).toBe(4)
  })

  it("dedupes when the same page references one media id from multiple slots", () => {
    const pages: unknown[] = [
      {
        id: 5, title: "Brand", slug: "brand",
        seo: { ogImage: 99 },
        blocks: [
          { blockType: "hero", variant: "hero-04", image: 99 },
          { blockType: "about", portrait: 99 },
          { blockType: "cta", image: 99 }
        ]
      }
    ]
    const map = buildMediaUsageMap(pagesForUsage(pages), null)
    expect(map.get(99)?.pages).toHaveLength(1)
  })

  it("aggregates references across multiple pages for the same media id", () => {
    const pages: unknown[] = [
      { id: 1, title: "P1", slug: "p1", blocks: [{ blockType: "hero", variant: "hero-04", image: 50 }] },
      { id: 2, title: "P2", slug: "p2", blocks: [{ blockType: "hero", variant: "hero-04", image: 50 }] }
    ]
    const map = buildMediaUsageMap(pagesForUsage(pages), null)
    expect(map.get(50)?.pages).toHaveLength(2)
    expect(map.get(50)?.pages.map((p) => p.id).sort()).toEqual([1, 2])
  })

  it("records settings.branding.logo separately from page refs", () => {
    const pages: MockDoc[] = []
    const settings: MockDoc = { branding: { logo: { id: 200 }, favicon: 201 } }
    const map = buildMediaUsageMap(pagesForUsage(pages), cast<Pick<SiteSetting, "branding">>(settings))
    expect(map.get(200)?.settings).toBe(true)
    expect(map.get(201)?.settings).toBe(true)
    expect(map.get(200)?.pages).toEqual([])
  })

  it("ignores empty pages, missing seo, null blocks gracefully", () => {
    const pages: unknown[] = [
      { id: 1, title: "Empty", slug: null, blocks: null },
      { id: 2, title: "NoSeo", slug: "x", blocks: [] },
      { id: 3, title: "NullBlock", slug: "y", blocks: [{ blockType: "hero" }] }
    ]
    const map = buildMediaUsageMap(pagesForUsage(pages), null)
    expect(map.size).toBe(0)
  })

  it("handles unknown block types without throwing", () => {
    const pages: unknown[] = [
      { id: 1, title: "Mix", slug: "mix",
        blocks: [{ blockType: "future-block", image: 1 }, { blockType: "hero", variant: "hero-04", image: 2 }] }
    ]
    const map = buildMediaUsageMap(pagesForUsage(pages), null)
    expect(map.has(1)).toBe(false) // unknown type — not walked
    expect(map.has(2)).toBe(true)
  })

  it("ignores null/undefined media ids without polluting the map", () => {
    const pages: unknown[] = [
      { id: 1, title: "X", slug: "x",
        seo: { ogImage: null },
        blocks: [{ blockType: "hero", variant: "hero-04", image: undefined }] }
    ]
    const map = buildMediaUsageMap(pagesForUsage(pages), cast({ branding: { logo: null } }))
    expect(map.size).toBe(0)
  })

  it("walks contact and about media slots", () => {
    const pages: unknown[] = [{
      id: 8,
      title: "Contact",
      slug: "contact",
      blocks: [
        { blockType: "about", portrait: { id: 301 } },
        { blockType: "contact", image: 302 },
      ],
    }]
    const map = buildMediaUsageMap(pagesForUsage(pages), null)
    expect(map.get(301)?.pages[0]?.id).toBe(8)
    expect(map.get(302)?.pages[0]?.id).toBe(8)
  })
})
