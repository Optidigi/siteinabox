import { describe, expect, it } from "vitest"
import {
  SITE_BLOCK_SLUGS,
  SiteGenerationSpecSchema,
  type NormalizedIntake,
} from "@siteinabox/contracts"
import { validateSiteGenerationSpecForCms } from "@/lib/site-generation/applySiteGenerationSpec"
import { loadMockSiteGenerationSpec } from "@/lib/intake/mockGeneration"

const normalized: NormalizedIntake = {
  businessName: "Studio Noord",
  tenantSlug: "studio-noord",
  primaryDomain: "studio-noord.siteinabox.test",
  siteUrl: "https://studio-noord.siteinabox.test",
  language: "nl",
  contact: { name: "Test Operator", email: "hello@example.test", phone: "0612345678" },
  industry: "Visuele kwaliteitscontrole",
  serviceArea: ["Nederland"],
  goals: ["Maak de volgende stap duidelijk"],
  requestedPages: [{ slug: "index", title: "Overzicht", purpose: "Homepage" }],
}

describe("first-party mock Sitegen fixture", () => {
  it("builds canonical pages accepted by the CMS validator", () => {
    const spec = loadMockSiteGenerationSpec(normalized)
    const parsed = SiteGenerationSpecSchema.safeParse(spec)
    const validation = validateSiteGenerationSpecForCms(spec, { variantScope: "self-serve" })

    expect(parsed.success, parsed.success ? undefined : parsed.error.message).toBe(true)
    expect(validation.valid, validation.valid ? undefined : JSON.stringify(validation.issues)).toBe(true)
    expect(spec.pages).toHaveLength(3)
    expect(spec.pages.every((page) => page.blocks[0]?.blockType === "hero")).toBe(true)
    expect(spec.settings.chrome?.navbar).toMatchObject({ variant: "navbar-01", placement: "hero-overlay" })
    expect(spec.settings.systemTemplates).toBeUndefined()
    expect(spec.settings.navigation).toBeUndefined()
    expect(JSON.stringify(spec)).not.toMatch(/shadcn|legacyVariant/i)
  })

  it("uses only canonical block types in the fixture", () => {
    const spec = loadMockSiteGenerationSpec(normalized)
    const blockTypes = new Set(spec.pages.flatMap((page) => page.blocks.map((block) => block.blockType)))
    expect([...blockTypes].every((blockType) => SITE_BLOCK_SLUGS.includes(blockType))).toBe(true)
    expect(blockTypes).toEqual(new Set(["hero", "services", "about", "process", "faq", "cta", "contact"]))
  })

  it("keeps an invalid fixture limited to tenant identity validation", () => {
    const spec = loadMockSiteGenerationSpec(normalized, "invalid")
    const validation = validateSiteGenerationSpecForCms(spec, { variantScope: "self-serve" })
    expect(validation.valid).toBe(false)
    expect(validation.issues.every((issue) => issue.path?.some((part) => String(part).toLowerCase().includes("slug")))).toBe(true)
  })
})
