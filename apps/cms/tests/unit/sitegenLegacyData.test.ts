import { describe, expect, it } from "vitest"
import {
  legacyPlainText,
  normalizeLegacySnapshot,
  normalizeLegacyStoredJson,
} from "@/migrations/sitegenLegacyData"

describe("Sitegen legacy data normalization", () => {
  it("preserves spaces between inline rich-text nodes", () => {
    expect(legacyPlainText({
      t: "root",
      variant: "inline",
      children: [
        { t: "text", v: "Jeugdzorg " },
        { t: "text", v: "met " },
        { t: "text", v: "hart en toewijding." },
      ],
    })).toBe("Jeugdzorg met hart en toewijding.")
  })

  it("maps a legacy hero to a first-party block without provider metadata", () => {
    expect(normalizeLegacyStoredJson({
      blockType: "hero",
      designVariant: "shadcnui-blocks.hero-minimal",
      headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Een heldere boodschap" }] },
      subheadline: { t: "root", variant: "inline", children: [{ t: "text", v: "Met ruimte voor bewijs." }] },
      cta: { label: "Neem contact op", href: "#contact" },
    })).toEqual({
      blockType: "hero",
      variant: "hero-01",
      heading: "Een heldere boodschap",
      body: "Met ruimte voor bewijs.",
      primaryAction: { label: "Neem contact op", href: "#contact" },
    })
  })

  it("maps legacy feature content to services and excludes privacy pages from snapshots", () => {
    const normalized = normalizeLegacySnapshot({
      pages: [
        {
          slug: "home",
          blocks: [{
            blockType: "featureList",
            designVariant: "shadcnui-blocks.feature-list-01",
            title: "Diensten",
            features: [
              { title: "Advies", body: "Een duidelijke route." },
              { title: "Uitvoering", body: "Praktische begeleiding." },
            ],
          }],
        },
        { slug: "privacy-en-cookieverklaring", blocks: [] },
      ],
    }) as { pages: Array<{ slug: string; blocks: unknown[] }> }

    expect(normalized.pages).toHaveLength(1)
    expect(normalized.pages[0]?.blocks[0]).toEqual({
      blockType: "services",
      variant: "services-01",
      heading: "Diensten",
      items: [
        { title: "Advies", body: "Een duidelijke route." },
        { title: "Uitvoering", body: "Praktische begeleiding." },
      ],
    })
  })
})
