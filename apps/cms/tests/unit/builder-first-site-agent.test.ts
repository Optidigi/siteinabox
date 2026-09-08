import { beforeEach, describe, expect, it, vi } from "vitest"
import { CONTACT_CHOICES, defaultBuilderMessages } from "@/lib/builder/thread"

const generateMock = vi.hoisted(() => vi.fn())
const generatePreviewMock = vi.hoisted(() => vi.fn())

vi.mock("@mastra/core/agent", () => ({
  Agent: class {
    generate = generateMock
  },
}))

vi.mock("@/lib/builder/generatePreview", () => ({
  generatePreview: generatePreviewMock,
}))

describe("runFirstSiteTurn", () => {
  beforeEach(() => {
    generateMock.mockReset()
    generatePreviewMock.mockReset()
  })

  it("starts without a stored greeting bubble or contact chips", () => {
    expect(defaultBuilderMessages()).toEqual([])
    expect(defaultBuilderMessages()[0]?.choices).toBeUndefined()
    expect(CONTACT_CHOICES.length).toBeGreaterThan(1)
  })

  it("always lets the talking agent run instead of generating from a regex gate", async () => {
    generateMock.mockResolvedValue({
      text: "Ik zet een eerste homepage klaar in terracotta, zacht en duidelijk.",
    })
    const { runFirstSiteTurn } = await import("@/lib/builder/firstSiteAgent")
    const result = await runFirstSiteTurn({
      payload: {} as never,
      message: "Ik ben kapper in Tilburg en doe knippen, kleur en baard. Bezoekers kunnen een afspraak maken.",
      previous: null,
      contact: { name: "Anna", email: "anna@example.com", phone: "0612345678" },
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
    })
    expect(generateMock).toHaveBeenCalled()
    expect(generatePreviewMock).not.toHaveBeenCalled()
    expect(result.clientSlug).toBeUndefined()
    expect(result.status).toBe("needs_brief")
    expect(result.text).toMatch(/terracotta/i)
  })

  it("offers contact chips only when that is the question just asked", async () => {
    generateMock.mockResolvedValue({
      text: "Hoe nemen bezoekers contact op?",
    })
    const { runFirstSiteTurn } = await import("@/lib/builder/firstSiteAgent")
    const result = await runFirstSiteTurn({
      payload: {} as never,
      message: "Ik ben kapper in Tilburg en doe knippen, kleur en baard.",
      previous: null,
      contact: { name: "Anna", email: "anna@example.com", phone: "0612345678" },
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
    })
    expect(generatePreviewMock).not.toHaveBeenCalled()
    expect(result.choices?.some((choice) => choice.id === "phone")).toBe(true)
  })

  it("does not attach contact chips when the model asked several things at once", async () => {
    generateMock.mockResolvedValue({
      text: "Wat is je bedrijfsnaam, welke diensten bied je, en hoe nemen bezoekers contact op? Bellen of WhatsApp?",
    })
    const { runFirstSiteTurn } = await import("@/lib/builder/firstSiteAgent")
    const result = await runFirstSiteTurn({
      payload: {} as never,
      message: "ik ben speciaal",
      previous: null,
      contact: { name: "Ada", email: "ada@example.com", phone: "" },
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
    })
    expect(result.facts?.businessName).toBe("Nieuw bedrijf")
    expect(result.choices ?? []).toEqual([])
  })

  it("does not replace a short model reply with a false plaats-diensten script", async () => {
    generateMock.mockResolvedValue({ text: "" })
    const { runFirstSiteTurn } = await import("@/lib/builder/firstSiteAgent")
    const result = await runFirstSiteTurn({
      payload: {} as never,
      message: "Heel Nederland, handjobs en blowjobs",
      previous: null,
      recentMessages: [{
        role: "assistant",
        text: "Hoe nemen bezoekers contact op?",
        choices: CONTACT_CHOICES,
      }],
      contact: { name: "Ada", email: "ada@example.com", phone: "" },
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
    })
    expect(result.text).not.toMatch(/plaats je werkt en welke twee diensten/i)
    expect(result.facts?.businessName).not.toMatch(/bellen|whatsapp/i)
    expect(result.facts?.region).toBe("Heel Nederland")
    expect(result.facts?.offers.map((offer) => offer.value)).toEqual(["Handjobs", "Blowjobs"])
  })
})
