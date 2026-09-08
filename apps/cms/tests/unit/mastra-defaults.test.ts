import { describe, expect, it } from "vitest"
import {
  defaultMastraChatReasoningEffort,
  defaultMastraMaintainReasoningEffort,
  defaultMastraModelId,
  defaultMastraReasoningEffort,
  parseMastraJsonObject,
} from "@/lib/ai-generation/mastraProvider"
import { coerceSitegenModelJson } from "@/lib/sitegen/coerceModelJson"
import { SitegenOutputSchema } from "@/lib/sitegen/output-schema"

describe("mastra defaults", () => {
  it("uses OpenAI Luna at high reasoning for sitegen, medium for maintain, medium for first-site chat", () => {
    expect(defaultMastraModelId({})).toBe("openai/gpt-5.6-luna")
    expect(defaultMastraReasoningEffort({})).toBe("high")
    expect(defaultMastraMaintainReasoningEffort({})).toBe("medium")
    expect(defaultMastraChatReasoningEffort({})).toBe("medium")
  })

  it("reads model and effort from env", () => {
    expect(defaultMastraModelId({ SITE_GENERATION_MASTRA_MODEL: "openai/gpt-5.6-sol" })).toBe(
      "openai/gpt-5.6-sol",
    )
    expect(defaultMastraReasoningEffort({ SITE_GENERATION_MASTRA_REASONING_EFFORT: "medium" })).toBe(
      "medium",
    )
    expect(defaultMastraMaintainReasoningEffort({ SITE_GENERATION_MASTRA_MAINTAIN_REASONING_EFFORT: "high" })).toBe(
      "high",
    )
  })

  it("parses JSON from fenced model text", () => {
    expect(parseMastraJsonObject({ text: '```json\n{"pages":[]}\n```' })).toEqual({ pages: [] })
  })
})

describe("coerceSitegenModelJson", () => {
  it("drops extra ids, defaults bad chrome, and strips non-catalog sections", () => {
    const coerced = coerceSitegenModelJson({
      id: "root",
      navbar: { id: "nav", variant: "navbar-99", placement: "floating" },
      footer: { variant: "footer-09" },
      pages: [{
        slug: "index",
        title: "Home",
        sections: [
          { id: "h", blockType: "hero", variant: "hero-01", heading: "A", body: "B", primaryAction: { label: "X", href: "#" }, secondaryAction: null, mediaId: null },
          { blockType: "faq", heading: "FAQ", items: [] },
        ],
      }],
    }) as { navbar: { variant: string; placement: string }; footer: { variant: string }; pages: Array<{ sections: Array<{ blockType: string; id?: string }> }> }
    expect(coerced.navbar).toEqual({ variant: "navbar-01", placement: "sticky" })
    expect(coerced.footer).toEqual({ variant: "footer-01" })
    expect(coerced.pages[0]?.sections.map((section) => section.blockType)).toEqual(["hero"])
    expect(coerced.pages[0]?.sections[0]).not.toHaveProperty("id")
    expect((coerced.pages[0]?.sections[0] as unknown as { primaryAction: { href: string } }).primaryAction.href).toBe("#contact")
  })

  it("fills Luna shape noise so SitegenOutputSchema can parse", () => {
    const parsed = SitegenOutputSchema.parse(coerceSitegenModelJson({
      navbar: { variant: "navbar-99", id: "nav" },
      footer: { variant: "footer-09" },
      pages: [{
        slug: "index",
        sections: [
          {
            blockType: "hero",
            eyebrow: "Hoi",
            heading: "Brandweer",
            highlights: ["snel", { title: "lokaal", description: "in de buurt" }, "persoonlijk"],
            primaryAction: { label: "Bel", type: "phone" },
            actions: [{ label: "x" }],
          },
          {
            blockType: "services",
            heading: "Aanbod",
            body: "niet toegestaan",
            items: [
              { title: "Dildos", description: "Verkoop" },
              { title: "Advies" },
            ],
          },
          {
            blockType: "cta",
            heading: "Bel",
            primaryAction: { label: "Bel", type: "phone" },
          },
        ],
      }],
    }))
    const hero = parsed.pages[0]?.sections[0]
    expect(hero?.blockType).toBe("hero")
    if (hero?.blockType === "hero") {
      expect(hero.primaryAction.href).toBe("#contact")
      expect(hero.secondaryAction).toBeNull()
      expect(hero.mediaId).toBeNull()
      expect(hero.highlights?.length).toBeGreaterThanOrEqual(2)
    }
    const cta = parsed.pages[0]?.sections.find((section) => section.blockType === "cta")
    if (cta?.blockType === "cta") {
      expect(cta.primaryAction.href).toBe("#contact")
    }
  })

  it("rewrites illegal action hrefs including whatsapp: and empty tel:", () => {
    const coerced = coerceSitegenModelJson({
      pages: [{
        slug: "index",
        sections: [
          { blockType: "hero", heading: "H", body: "B", primaryAction: { label: "Bel", href: "tel:" } },
          { blockType: "cta", heading: "C", primaryAction: { label: "WA", href: "whatsapp:0612345678" } },
        ],
      }],
    }) as { pages: Array<{ sections: Array<{ primaryAction: { href: string } }> }> }
    expect(coerced.pages[0]?.sections[0]?.primaryAction.href).toBe("#contact")
    expect(coerced.pages[0]?.sections[1]?.primaryAction.href).toBe("#contact")
  })
})
