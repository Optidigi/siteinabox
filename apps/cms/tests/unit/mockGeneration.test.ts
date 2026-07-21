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

  it("fills active media slots and prefers full laptop rows for repeaters", () => {
    const spec = loadMockSiteGenerationSpec(normalized)
    const byVariant = Object.fromEntries(
      spec.pages.flatMap((page) => page.blocks.map((block) => [block.designVariant, block])),
    )

    expect(byVariant["shadcnui-blocks.hero-01"]).not.toHaveProperty("image")
    expect(byVariant["shadcnui-blocks.hero-02"]).toMatchObject({ image: { url: expect.any(String) } })
    expect(byVariant["shadcnui-blocks.hero-05"]).toMatchObject({ image: { url: expect.any(String) } })
    expect(byVariant["shadcnui-blocks.cta-01"]).not.toHaveProperty("backgroundImage")
    expect(byVariant["shadcnui-blocks.cta-02"]).toMatchObject({ backgroundImage: { url: expect.any(String) } })
    expect(byVariant["shadcnui-blocks.cta-05"]).not.toHaveProperty("backgroundImage")

    expect(byVariant["shadcnui-blocks.logo-cloud-01"]).toMatchObject({ logos: expect.any(Array) })
    expect(byVariant["shadcnui-blocks.logo-cloud-01"].logos).toHaveLength(4)
    expect(byVariant["shadcnui-blocks.logo-cloud-02"].logos).toHaveLength(8)
    expect(byVariant["shadcnui-blocks.features-01"].features).toHaveLength(3)
    expect(byVariant["shadcnui-blocks.features-03"].features).toHaveLength(2)
    expect(byVariant["shadcnui-blocks.features-04"].features).toHaveLength(4)
    expect(byVariant["shadcnui-blocks.stats-01"].items).toHaveLength(3)
    expect(byVariant["shadcnui-blocks.stats-02"].items).toHaveLength(4)
    expect(byVariant["shadcnui-blocks.team-01"].members).toHaveLength(4)
    expect(byVariant["shadcnui-blocks.team-03"].members).toHaveLength(3)
    expect(byVariant["shadcnui-blocks.blog-01"].posts).toHaveLength(3)
    expect(byVariant["shadcnui-blocks.testimonials-01"].items).toHaveLength(3)
    expect(byVariant["shadcnui-blocks.pricing-01"].plans).toHaveLength(3)
    expect(byVariant["shadcnui-blocks.carousel-block-01"].images).toHaveLength(5)

    expect(byVariant["shadcnui-blocks.blog-01"].posts.every((post: { image?: unknown }) => Boolean(post.image))).toBe(true)
    expect(byVariant["shadcnui-blocks.team-01"].members.every((member: { image?: unknown }) => Boolean(member.image))).toBe(true)
    expect(byVariant["shadcnui-blocks.testimonials-01"].items.every((item: { avatar?: unknown }) => Boolean(item.avatar))).toBe(true)
    expect(byVariant["shadcnui-blocks.logo-cloud-01"].logos.every((logo: { image?: { url?: string } }) => Boolean(logo.image?.url))).toBe(true)
    expect(byVariant["shadcnui-blocks.logo-cloud-01"].logos.every((logo: { image?: { url?: string } }) => String(logo.image?.url).includes("wordmark.svg"))).toBe(true)
    const logoAssets = (spec.assets ?? []).filter((asset): asset is { filename?: string | null; url?: string | null } =>
      typeof asset === "object" && asset !== null && String(asset.filename ?? "").startsWith("smoke-logo-"),
    )
    expect(logoAssets.length).toBeGreaterThan(0)
    expect(logoAssets.every((asset) => String(asset.url).includes("wordmark.svg"))).toBe(true)
    expect(byVariant["shadcnui-blocks.features-02"].features.every((feature: { image?: unknown }) => Boolean(feature.image))).toBe(true)
    expect(byVariant["shadcnui-blocks.features-03"].features.every((feature: { image?: unknown }) => Boolean(feature.image))).toBe(true)
    expect(byVariant["shadcnui-blocks.features-04"].features.every((feature: { image?: unknown }) => Boolean(feature.image))).toBe(true)
    expect((spec.assets ?? []).every((asset) => typeof asset === "object" && asset !== null && !String(asset.url).includes("siteinabox.nl"))).toBe(true)
    expect(spec.pages.every((page) => {
      const ogImage = page.seo?.ogImage
      return typeof ogImage === "object" && ogImage !== null && Boolean(ogImage.url)
    })).toBe(true)
  })
})
