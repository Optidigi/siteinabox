import { describe, expect, it } from "vitest"
import {
  SHADCNUI_BLOCK_VARIANTS,
  SiteGenerationSpecSchema,
  type NormalizedIntake,
} from "@siteinabox/contracts"
import { validateSiteGenerationSpecForCms } from "@/lib/site-generation/applySiteGenerationSpec"
import { loadMockSiteGenerationSpec } from "@/lib/intake/mockGeneration"

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

describe("mock shadcnui-blocks five-page smoke site", () => {
  it("builds five contract-valid landing pages from the canonical provider catalog", () => {
    const spec = loadMockSiteGenerationSpec(normalized)
    const parsed = SiteGenerationSpecSchema.safeParse(spec)
    const cmsValidation = validateSiteGenerationSpecForCms(spec, { variantScope: "self-serve" })

    expect(parsed.success, parsed.success ? undefined : parsed.error.message).toBe(true)
    expect(cmsValidation).toEqual({ valid: true, issues: [] })
    expect(spec.pages).toHaveLength(5)
    expect(spec.pages.map((page) => page.slug)).toEqual([
      "index",
      "diensten",
      "werkwijze",
      "ervaringen",
      "contact",
    ])
    expect(spec.pages.every((page) => page.blocks[0]?.blockType === "hero")).toBe(true)
    expect(spec.pages.every((page) => page.blocks.length === 7)).toBe(true)
    expect(spec.settings.navHeader).toHaveLength(5)
    expect(spec.settings.navFooter).toHaveLength(5)
    expect(spec.theme.appearance.mode).toBe("system")
    expect(spec.theme).toMatchObject({ colors: { schemeId: "monochrome" }, fonts: { schemeId: "clear-modern" }, shape: { schemeId: "soft" } })
    expect(spec.settings.chrome?.banner?.variant).toBe("shadcnui-blocks.banner-01")
  })

  it("uses a different approved provider variant for every section", () => {
    const spec = loadMockSiteGenerationSpec(normalized)
    const fixtureVariants = spec.pages.flatMap((page) =>
      page.blocks.map((block) => `${block.blockType}:${block.designVariant}`),
    )
    const catalogVariants = SHADCNUI_BLOCK_VARIANTS.map((variant) =>
      `${variant.blockType}:${variant.id}`,
    )

    expect(fixtureVariants).toHaveLength(35)
    expect(new Set(fixtureVariants).size).toBe(fixtureVariants.length)
    expect(fixtureVariants.every((variant) => catalogVariants.includes(variant))).toBe(true)
    expect(new Set(spec.pages.flatMap((page) => page.blocks.map((block) => block.blockType))).size).toBe(13)
    expect(fixtureVariants.every((variant) => variant.includes(":shadcnui-blocks."))).toBe(true)
  })

  it("keeps the invalid fixture limited to the deliberate tenant-slug failure", () => {
    const spec = loadMockSiteGenerationSpec(normalized, "invalid")
    const validation = validateSiteGenerationSpecForCms(spec, { variantScope: "self-serve" })

    expect(validation.valid).toBe(false)
    expect(validation.issues.map((issue) => issue.code).sort()).toEqual([
      "invalid_contract_shape",
      "invalid_tenant_slug",
      "tenant_slug_mismatch",
    ])
    expect(validation.issues.every((issue) =>
      issue.path?.some((segment) => String(segment).toLowerCase().includes("slug")),
    )).toBe(true)
  })
})
