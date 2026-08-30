import { describe, expect, it } from "vitest"
import { BlockSchema } from "@siteinabox/contracts"
import { pageToJson } from "@/lib/projection/pageToJson"
import { asPageSource, jsonBlockAt, jsonBlocks } from "../_helpers/pageToJsonFixtures"

const pageJson = (blocks: unknown[]) => pageToJson(asPageSource({
  tenant: "tenant1",
  title: "Pagina",
  slug: "pagina",
  status: "published",
  blocks,
  updatedAt: "2026-05-05T10:00:00.000Z",
}))

describe("pageToJson — owned block data", () => {
  it("round-trips one representative block from every semantic family", () => {
    const json = pageJson([
      { blockType: "hero", variant: "hero-01", heading: "H", body: "B", primaryAction: { label: "Start", href: "/start" } },
      { blockType: "services", variant: "services-01", heading: "Diensten", items: [{ title: "Advies", body: "Uitleg" }, { title: "Uitvoering", body: "Werk" }] },
      { blockType: "about", heading: "Over mij", body: "Persoonlijk" },
      { blockType: "process", heading: "Werkwijze", steps: [{ title: "Start", body: "Vraag" }, { title: "Resultaat", body: "Oplevering" }] },
      { blockType: "work", heading: "Werk", projects: [{ sourceId: "project-1", title: "Project", media: [] }] },
      { blockType: "reviews", heading: "Ervaringen", reviewSourceIds: ["review-1"], items: [{ sourceId: "review-1", quote: "Fijn geholpen.", name: "Klant" }] },
      { blockType: "pricing", heading: "Tarief", pricingSourceIds: ["price-1"], offers: [{ sourceId: "price-1", title: "Advies", price: "€ 95", features: [] }] },
      { blockType: "faq", heading: "Vragen", items: [{ question: "Q", answer: "A" }, { question: "Q2", answer: "A2" }] },
      { blockType: "cta", variant: "cta-01", heading: "Contact", primaryAction: { label: "Mail", href: "mailto:hello@example.test" } },
      { blockType: "contact", heading: "Neem contact op", contactMethods: [{ kind: "email", label: "E-mail", value: "hello@example.test", href: "mailto:hello@example.test" }] },
    ])

    expect(jsonBlocks(json)).toHaveLength(10)
    for (const block of jsonBlocks(json)) {
      expect(BlockSchema.safeParse(block).success).toBe(true)
    }
  })

  it("removes unsafe action hrefs without creating a safe substitute", () => {
    const json = pageJson([{ blockType: "cta", heading: "Contact", primaryAction: { label: "Bad", href: "javascript:alert(1)" } }])
    expect(jsonBlockAt(json, 0).primaryAction).toEqual({ label: "Bad" })
  })

  it("preserves a per-block background mode through the CMS projection", () => {
    const json = pageJson([{
      blockType: "hero",
      variant: "hero-01",
      heading: "Een helder aanbod",
      body: "Praktische hulp voor jouw situatie.",
      primaryAction: { label: "Contact", href: "#contact" },
      backgroundMode: "none",
    }])

    expect(jsonBlockAt(json, 0).backgroundMode).toBe("none")
    expect(BlockSchema.safeParse(jsonBlockAt(json, 0)).success).toBe(true)
  })

  it("removes Payload empty optional groups and stale variant-owned rows", () => {
    const json = pageJson([
      {
        blockType: "hero",
        variant: "hero-05",
        heading: "Een helder begin",
        body: "Praktische hulp voor de volgende stap.",
        primaryAction: { label: "Neem contact op", href: "#contact" },
        image: "/hero.jpg",
        highlights: [],
        serviceHighlights: [],
      },
      {
        blockType: "services",
        variant: "services-01",
        heading: "Diensten",
        items: [
          { title: "Advies", body: "Duidelijke uitleg.", action: { label: null, href: null } },
          { title: "Uitvoering", body: "Zorgvuldig uitgevoerd.", action: null },
        ],
      },
      {
        blockType: "contact",
        heading: "Contact",
        contactMethods: [{ kind: "email", label: "E-mail", value: "hello@example.test" }],
        bookingAction: { label: null, href: null },
      },
    ])

    const [hero, services, contact] = jsonBlocks(json)
    if (!hero || !services || !contact) throw new Error("Expected projected blocks")
    expect(hero).not.toHaveProperty("highlights")
    expect(hero).not.toHaveProperty("serviceHighlights")
    expect((services.items as Array<Record<string, unknown>>).every((item) => !Object.prototype.hasOwnProperty.call(item, "action"))).toBe(true)
    expect(contact).not.toHaveProperty("bookingAction")
    for (const block of [hero, services, contact]) expect(BlockSchema.safeParse(block).success).toBe(true)
  })

  it("projects Payload row storage into the canonical evidence and media shapes", () => {
    const json = pageJson([
      {
        blockType: "work",
        heading: "Werk",
        projects: [{ sourceId: "project-1", title: "Project", media: [{ id: 11, image: 42 }] }],
      },
      {
        blockType: "reviews",
        heading: "Ervaringen",
        reviewSourceIds: [{ id: 12, sourceId: "review-1" }],
        items: [{ id: 13, sourceId: "review-1", quote: "Goed.", name: "Sam" }],
      },
      {
        blockType: "pricing",
        heading: "Tarieven",
        pricingSourceIds: [{ id: 14, sourceId: "price-1" }],
        offers: [{ id: 15, sourceId: "price-1", title: "Start", price: "€ 95", features: [{ id: 16, value: "Duidelijk voorstel" }] }],
      },
    ])

    const [work, reviews, pricing] = jsonBlocks(json)
    if (!work || !reviews || !pricing) throw new Error("Expected projected evidence blocks")
    const workProjects = work.projects as Array<Record<string, unknown>>
    const pricingOffers = pricing.offers as Array<Record<string, unknown>>
    const firstWorkProject = workProjects[0]
    const firstPricingOffer = pricingOffers[0]
    if (!firstWorkProject || !firstPricingOffer) throw new Error("Expected projected rows")
    expect(firstWorkProject.media as unknown[]).toEqual([42])
    expect(reviews.reviewSourceIds).toEqual(["review-1"])
    expect(pricing.pricingSourceIds).toEqual(["price-1"])
    expect(firstPricingOffer.features).toEqual(["Duidelijk voorstel"])
    for (const block of [work, reviews, pricing]) expect(BlockSchema.safeParse(block).success).toBe(true)
  })
})
