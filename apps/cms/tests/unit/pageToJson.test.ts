import { describe, expect, it } from "vitest"
import { pageToJson } from "@/lib/projection/pageToJson"
import { asPageSource, jsonBlockAt, jsonBlocks } from "../_helpers/pageToJsonFixtures"

describe("pageToJson", () => {
  it("projects canonical hero and CTA content with semantic analytics", () => {
    const json = pageToJson(asPageSource({
      id: "page1",
      tenant: "tenant1",
      title: "Home",
      slug: "home",
      status: "published",
      blocks: [
        {
          id: "hero1",
          blockType: "hero",
          heading: "Welkom",
          body: "Heldere hulp.",
          primaryAction: { label: "Neem contact op", href: "/contact" },
        },
        {
          id: "cta1",
          blockType: "cta",
          variant: "cta-01",
          heading: "Klaar voor de volgende stap?",
          primaryAction: { label: "Plan een gesprek", href: "/contact" },
          secondaryAction: { label: null, href: null },
        },
      ],
      updatedAt: "2026-05-05T10:00:00.000Z",
    }))

    expect(json.title).toBe("Home")
    expect(json.slug).toBe("home")
    expect(jsonBlocks(json)).toHaveLength(2)
    expect(jsonBlockAt(json, 0)).toMatchObject({
      blockType: "hero",
      heading: "Welkom",
      primaryAction: { label: "Neem contact op", href: "/contact" },
      analytics: { sectionType: "hero", variant: null },
    })
    expect(jsonBlockAt(json, 0)).not.toHaveProperty("image")
    expect(jsonBlockAt(json, 1)).not.toHaveProperty("secondaryAction")
  })

  it("strips document and array-row ids while retaining media metadata", () => {
    const json = pageToJson(asPageSource({
      id: "page1",
      tenant: "tenant1",
      title: "Diensten",
      slug: "diensten",
      status: "published",
      blocks: [{
        id: "services1",
        blockType: "services",
        variant: "services-01",
        heading: "Diensten",
        items: [{ id: "row1", title: "Advies", body: "Duidelijke uitleg." }, { id: "row2", title: "Uitvoering", body: "Zorgvuldig uitgevoerd." }],
      }],
      updatedAt: "2026-05-05T10:00:00.000Z",
    }))
    expect(json).not.toHaveProperty("id")
    expect(json).not.toHaveProperty("tenant")
    expect(jsonBlockAt(json, 0)).not.toHaveProperty("id")
    expect((jsonBlockAt(json, 0).items as Array<Record<string, unknown>>)[0]).not.toHaveProperty("id")
  })

  it("projects empty pages without inventing blocks", () => {
    const json = pageToJson(asPageSource({
      id: "page1",
      tenant: "tenant1",
      title: "Leeg",
      slug: "leeg",
      status: "draft",
      blocks: [],
      updatedAt: "2026-05-05T10:00:00.000Z",
    }))
    expect(jsonBlocks(json)).toEqual([])
  })
})
