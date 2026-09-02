import { describe, expect, it } from "vitest"
import {
  BLOCK_TYPES,
  BlockSchema,
  CTA_VARIANTS,
  HERO_BLOCK_TYPES,
  HERO_VARIANTS,
  HERO_VARIANTS_WITHOUT_REQUIRED_MEDIA,
  SERVICES_VARIANTS,
  SITEGEN_BLOCK_TYPES,
} from "./blocks"
import { APPOINTMENT_VARIANTS } from "./appointments"

const action = { label: "Neem contact op", href: "#contact" }
const serviceHighlights = [
  { title: "Voor woningen", body: "Praktische hulp voor onderhoud.", heroHeading: "Van vraag naar een concrete aanpak", heroBody: "Duidelijke routes om snel te zien waarmee ik kan helpen.", image: "/location.jpg" },
  { title: "Voor werkplekken", body: "Een nette, bruikbare ruimte.", heroHeading: "Een werkplek die prettig blijft werken", heroBody: "Van kleine aanpassing tot zorgvuldig onderhoud.", image: "/workspace.jpg" },
  { title: "Voor kleine bedrijven", body: "Een verzorgd resultaat voor dagelijks gebruik.", heroHeading: "Praktische hulp voor je bedrijf", heroBody: "Duidelijke afspraken voor een verzorgd resultaat.", image: "/office.jpg" },
  { title: "Onderhoud en herstel", body: "Gerichte hulp voor wat aandacht nodig heeft.", heroHeading: "Geef een ruimte weer de aandacht die ze nodig heeft", heroBody: "Gericht herstel en nette afwerking.", image: "/kitchen.jpg" },
] as const

const examples = {
  hero01: { blockType: "hero", variant: "hero-01", heading: "Een helder aanbod", body: "Praktische hulp voor jouw situatie.", primaryAction: action },
  hero02: { blockType: "hero", variant: "hero-02", heading: "Van vraag naar een concrete aanpak", body: "Duidelijke routes om snel te zien waarmee ik kan helpen.", primaryAction: action, image: "/location.jpg", serviceHighlights },
  hero03: { blockType: "hero", variant: "hero-03", heading: "Ruimte die weer prettig werkt", body: "Praktische verbetering met oog voor de details die je dagelijks merkt.", primaryAction: action, image: "/interior.jpg" },
  hero04: { blockType: "hero", variant: "hero-04", heading: "Zorgvuldig werk, duidelijk uitgelegd", body: "Een realistisch beeld van de kwaliteit en aandacht die je kunt verwachten.", primaryAction: action, image: "/project.jpg" },
  hero05: { blockType: "hero", variant: "hero-05", heading: "Een duidelijk plan voor jouw volgende stap", body: "Een heldere eerste stap met een realistisch beeld van het werk.", primaryAction: action, image: "/project.jpg" },
  services: { blockType: "services", variant: "services-01", heading: "Diensten", items: [{ title: "Eén", body: "Uitleg" }, { title: "Twee", body: "Uitleg" }] },
  about: { blockType: "about", heading: "Over", body: "Een persoonlijk verhaal.", highlights: [] },
  process: { blockType: "process", heading: "Werkwijze", steps: [{ title: "Eén", body: "Uitleg" }, { title: "Twee", body: "Uitleg" }] },
  work: { blockType: "work", heading: "Werk", projects: [{ sourceId: "project-1", title: "Project", media: ["/project.jpg"] }] },
  reviews: { blockType: "reviews", heading: "Ervaringen", reviewSourceIds: ["review-1"], items: [{ sourceId: "review-1", quote: "Goed werk.", name: "Sam" }] },
  pricing: { blockType: "pricing", heading: "Tarieven", pricingSourceIds: ["price-1"], offers: [{ sourceId: "price-1", title: "Start", price: "Op aanvraag", features: [] }] },
  faq: { blockType: "faq", heading: "Vragen", items: [{ question: "Vraag?", answer: "Antwoord." }, { question: "Nog één?", answer: "Antwoord." }] },
  cta: { blockType: "cta", variant: "cta-01", heading: "Klaar om te starten?", primaryAction: action },
  contact: { blockType: "contact", heading: "Contact", contactMethods: [{ kind: "email", label: "E-mail", value: "hello@example.test", href: "mailto:hello@example.test" }] },
  appointments: { blockType: "appointments", variant: "appointments-01", presentation: "dialog", heading: "Plan een afspraak" },
} as const

describe("first-party block contracts", () => {
  it("exposes the owned semantic Sitegen sections", () => {
    expect(HERO_BLOCK_TYPES).toEqual(["hero"])
    expect(HERO_VARIANTS).toHaveLength(5)
    expect(SERVICES_VARIANTS).toEqual(["services-01", "services-02"])
    expect(CTA_VARIANTS).toEqual(["cta-01", "cta-02"])
    expect(APPOINTMENT_VARIANTS).toEqual(["appointments-01"])
    expect(SITEGEN_BLOCK_TYPES).toHaveLength(11)
    expect(BLOCK_TYPES).toEqual([...SITEGEN_BLOCK_TYPES])
  })

  it("accepts one semantic example for every Sitegen block", () => {
    for (const blockType of SITEGEN_BLOCK_TYPES) {
      const example = blockType === "hero" ? examples.hero01 : examples[blockType]
      const result = BlockSchema.safeParse(example)
      expect(result.success, blockType).toBe(true)
    }
  })

  it("allows hero-02 to contain two to four selectable highlights", () => {
    const base = examples.hero02
    expect(BlockSchema.safeParse({ ...base, serviceHighlights: base.serviceHighlights.slice(0, 2) }).success).toBe(true)
    expect(BlockSchema.safeParse({ ...base, serviceHighlights: base.serviceHighlights.slice(0, 3) }).success).toBe(true)
    expect(BlockSchema.safeParse(base).success).toBe(true)
    expect(BlockSchema.safeParse({ ...base, serviceHighlights: [...base.serviceHighlights, base.serviceHighlights[0]] }).success).toBe(false)
    expect(BlockSchema.safeParse({ ...examples.hero01, serviceHighlights: base.serviceHighlights.slice(0, 2) }).success).toBe(false)
  })

  it("rejects unknown variants and retired fields", () => {
    expect(BlockSchema.safeParse({ ...examples.hero01, variant: "centered" }).success).toBe(false)
    expect(BlockSchema.safeParse({ ...examples.hero01, legacyLayout: "old" }).success).toBe(false)
    expect(BlockSchema.safeParse({ ...examples.hero01, eyebrow: "Niet nodig" }).success).toBe(false)
    expect(BlockSchema.safeParse({ ...examples.hero01, image: "/supplied.jpg" }).success).toBe(true)
    expect(BlockSchema.safeParse({ ...examples.services, variant: "services-02" }).success).toBe(true)
    expect(BlockSchema.safeParse({ ...examples.services, variant: "services-99" }).success).toBe(false)
    expect(BlockSchema.safeParse({ ...examples.cta, variant: "cta-99" }).success).toBe(false)
    expect(BlockSchema.safeParse({ ...examples.cta, variant: "cta-02" }).success).toBe(true)
    expect(BlockSchema.safeParse({ ...examples.cta, effect: "dither" }).success).toBe(false)
  })

  it("accepts the closed services icon vocabulary without accepting arbitrary icon keys", () => {
    expect(BlockSchema.safeParse({ ...examples.services, items: examples.services.items.map((item, index) => ({ ...item, icon: index === 0 ? "wrench" : null })) }).success).toBe(true)
    expect(BlockSchema.safeParse({ ...examples.services, items: [{ ...examples.services.items[0], icon: "sparkle" }, examples.services.items[1]] }).success).toBe(false)
  })

  it("allows zero, two, three, or four factual hero highlights, but never a one-item row or unsupported hero field", () => {
    const highlight = { title: "Heldere afspraken", body: "Je weet vooraf wat er gebeurt." }
    expect(BlockSchema.safeParse({ ...examples.hero01, highlights: [] }).success).toBe(true)
    expect(BlockSchema.safeParse({ ...examples.hero01, highlights: [highlight, highlight] }).success).toBe(true)
    expect(BlockSchema.safeParse({ ...examples.hero01, highlights: [highlight, highlight, highlight] }).success).toBe(true)
    expect(BlockSchema.safeParse({ ...examples.hero01, highlights: [highlight, highlight, highlight, highlight] }).success).toBe(true)
    expect(BlockSchema.safeParse({ ...examples.hero01, highlights: [highlight] }).success).toBe(false)
    expect(BlockSchema.safeParse({ ...examples.hero03, highlights: [highlight, highlight] }).success).toBe(false)
  })

  it("requires media only for image-led hero variants", () => {
    for (const variant of HERO_VARIANTS) {
      const example = examples[variant.replace("hero-", "hero") as "hero01" | "hero02" | "hero03" | "hero04" | "hero05"]
      const requiresMedia = !HERO_VARIANTS_WITHOUT_REQUIRED_MEDIA.includes(variant as (typeof HERO_VARIANTS_WITHOUT_REQUIRED_MEDIA)[number])
      const result = BlockSchema.safeParse(requiresMedia ? { ...example, image: undefined } : example)
      expect(result.success, variant).toBe(!requiresMedia)
    }

    expect(BlockSchema.safeParse({ ...examples.hero01, image: "/supplied.jpg" }).success).toBe(true)
  })

  it("requires media for an explicit image background override", () => {
    expect(BlockSchema.safeParse({ ...examples.hero01, backgroundMode: "image" }).success).toBe(false)
    expect(BlockSchema.safeParse({ ...examples.hero01, backgroundMode: "image", image: "/supplied.jpg" }).success).toBe(true)
    expect(BlockSchema.safeParse({ ...examples.cta, backgroundMode: "image" }).success).toBe(false)
    expect(BlockSchema.safeParse({ ...examples.cta, backgroundMode: "image", image: "/supplied.jpg" }).success).toBe(true)
  })
})
