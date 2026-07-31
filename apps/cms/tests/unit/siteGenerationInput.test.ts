import { describe, expect, it } from "vitest"
import {
  SHADCNUI_BLOCK_VARIANTS,
  SiteGenerationSpecSchema,
  type NormalizedIntake,
} from "@siteinabox/contracts"
import {
  createMockSiteGenerationProvider,
  createSiteGenerationProviderRequest,
} from "@/lib/ai-generation/providers"
import { buildSiteGenerationModelInput } from "@/lib/ai-generation/siteGenerationInput"
import { SITE_GENERATION_PROMPT_VERSION } from "@/lib/ai-generation/prompts/siteGenerationPrompt"

const normalized: NormalizedIntake = {
  businessName: "Provider Smoke",
  tenantSlug: "provider-smoke",
  primaryDomain: "provider-smoke.siteinabox.test",
  siteUrl: "https://provider-smoke.siteinabox.test",
  language: "nl",
  contact: {
    name: "Test Operator",
    email: "visual@example.com",
    phone: "0612345678",
  },
  industry: "Visuele kwaliteitscontrole",
  serviceArea: ["Nederland", "België"],
  goals: ["Controleer iedere provider-variant", "Vergelijk licht, donker en responsief gedrag"],
  requestedPages: [{ slug: "index", title: "Overzicht", purpose: "Provider-overzicht" }],
}

describe("site generation model input", () => {
  it("projects every approved variant with active slots only and unchanged constraints", () => {
    const input = buildSiteGenerationModelInput(normalized)
    expect(input.approvedDesignVariants).toHaveLength(132)
    expect(input.approvedDesignVariants.map((variant) => variant.designVariant)).toEqual(
      SHADCNUI_BLOCK_VARIANTS.map((variant) => variant.id),
    )

    for (const projected of input.approvedDesignVariants) {
      const catalog = SHADCNUI_BLOCK_VARIANTS.find((variant) => variant.id === projected.designVariant)!
      const activeSlots = catalog.activeSlots as Readonly<Record<string, {
        kind: string
        status: string
        repeated: boolean
        minItems?: number
        maxItems?: number
      }>>
      const forbiddenFields = catalog.forbiddenFields as readonly string[]
      expect(Object.keys(projected.slots ?? {})).toEqual(Object.keys(activeSlots))
      expect(new Set(Object.keys(projected.slots ?? {})).size).toBe(Object.keys(projected.slots ?? {}).length)
      expect(Object.keys(projected.slots ?? {}).some((field) => forbiddenFields.includes(field))).toBe(false)
      for (const [field, slot] of Object.entries(projected.slots ?? {})) {
        const catalogSlot = activeSlots[field]!
        expect(slot.status).not.toBe("inactive")
        expect(slot).toMatchObject({
          kind: catalogSlot.kind,
          status: catalogSlot.status,
          repeated: catalogSlot.repeated,
          exposed: true,
        })
        expect(slot.minItems).toBe(catalogSlot.minItems)
        expect(slot.maxItems).toBe(catalogSlot.maxItems)
      }
    }
  })

  it("is deterministic for the new prompt version and smaller than the recorded dense baseline", () => {
    const first = createSiteGenerationProviderRequest(normalized)
    const second = createSiteGenerationProviderRequest(normalized)
    const serialized = JSON.stringify(first.input)
    expect(SITE_GENERATION_PROMPT_VERSION).toBe("site-generation-v2")
    expect(first.inputHash).toBe(second.inputHash)
    expect(serialized).toBe(JSON.stringify(second.input))
    expect(Buffer.byteLength(serialized)).toBeLessThan(305_956)
  })

  it("keeps mock-provider generation contract-valid without external requests", async () => {
    const request = createSiteGenerationProviderRequest(normalized)
    const result = await createMockSiteGenerationProvider().generate(request)
    expect(result.promptVersion).toBe(SITE_GENERATION_PROMPT_VERSION)
    expect(result.inputHash).toBe(request.inputHash)
    expect(SiteGenerationSpecSchema.safeParse(result.spec).success).toBe(true)
  })
})
