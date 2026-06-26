import { describe, expect, it } from "vitest"
import type { SiteBlockCatalogVariant } from "@siteinabox/contracts/block-catalog"
import {
  APPROVED_V1_MARKETING_CAPABILITY_COVERAGE,
  DEFERRED_SOURCE_BLOCK_CANDIDATES,
  DEFERRED_V1_MARKETING_BLOCKS,
  isApprovedSourceBackedVariant,
  REQUIRED_V1_MARKETING_BLOCKS,
  SITE_BLOCK_CATALOG,
  SITE_BLOCK_CATALOG_BY_SLUG,
  SITE_BLOCK_REFERENCE_SOURCES,
  SITE_GENERATION_BLOCK_CATALOG,
  SITE_GENERATION_BLOCK_CATALOG_BY_SLUG,
  SITE_SOURCE_BACKED_BLOCK_VARIANTS,
} from "@siteinabox/contracts/block-catalog"
import { BlockSchema, GeneratedBlockSpecSchema } from "@siteinabox/contracts/generation"
import type { GeneratedBlockSpec } from "@siteinabox/contracts/generation"
import { tenantSiteGenerationSpecs } from "@siteinabox/contracts/fixtures/tenants"
import { SITE_BLOCK_SLUGS, SITE_GENERATION_BLOCK_SLUGS, SITE_PARITY_BLOCK_SLUGS } from "@siteinabox/contracts/site"
import { v1FixturePage } from "@siteinabox/site-renderer"

const inlineRoot = (text: string) => ({
  t: "root" as const,
  variant: "inline" as const,
  children: [{ t: "text" as const, v: text }],
})

const blockRoot = (text: string) => ({
  t: "root" as const,
  variant: "block" as const,
  children: [{ t: "paragraph" as const, children: [{ t: "text" as const, v: text }] }],
})

describe("renderer block catalog", () => {
  it("catalogs every currently supported renderer block", () => {
    expect(SITE_BLOCK_CATALOG.map((entry) => entry.slug)).toEqual(expect.arrayContaining([...SITE_BLOCK_SLUGS]))
    expect(SITE_BLOCK_CATALOG).toHaveLength(SITE_BLOCK_SLUGS.length)

    for (const slug of SITE_BLOCK_SLUGS) {
      const entry = SITE_BLOCK_CATALOG_BY_SLUG[slug]
      expect(entry.slug).toBe(slug)
      expect(entry.status).toBe("approved")
      expect(entry.contractType).toMatch(/Block$/)
      expect(entry.runtimeValidationTarget).toContain("validateSiteGenerationSpecForCms")
      expect(entry.cmsEditableFields.length).toBeGreaterThan(0)
      expect(entry.renderer.package).toBe("@siteinabox/site-renderer")
      expect(entry.renderer.component).toMatch(/Renderer$/)
      expect(entry.themeBehavior.length).toBeGreaterThan(0)
      expect(entry.fixtureCoverage.length).toBeGreaterThan(0)
      expect(entry.variants.length).toBeGreaterThan(0)
      expect(entry.variants.every((variant) => variant.provenance)).toBe(true)
      expect(entry.variants.every((variant) => variant.rendererSupportStatus === "supported")).toBe(true)
    }
  })

  it("separates parity generation contracts from currently supported renderer blocks", () => {
    expect(SITE_GENERATION_BLOCK_CATALOG.map((entry) => entry.slug)).toEqual(
      expect.arrayContaining([...SITE_GENERATION_BLOCK_SLUGS]),
    )
    expect(SITE_GENERATION_BLOCK_CATALOG).toHaveLength(SITE_GENERATION_BLOCK_SLUGS.length)
    expect(SITE_BLOCK_CATALOG.map((entry) => entry.slug)).not.toEqual(
      expect.arrayContaining([...SITE_PARITY_BLOCK_SLUGS]),
    )

    for (const slug of SITE_PARITY_BLOCK_SLUGS) {
      const entry = SITE_GENERATION_BLOCK_CATALOG_BY_SLUG[slug]
      expect(entry.slug).toBe(slug)
      expect(entry.renderer.component).toMatch(/Renderer$/)
      expect(entry.variants.length).toBeGreaterThan(0)
      expect(entry.variants.every((variant) => variant.rendererSupportStatus === "deferred")).toBe(true)
      expect(entry.variants.every((variant) => variant.provenance.sourceName === "SIAB legacy tenant snapshot")).toBe(true)
      expect(entry.variants.every((variant) => variant.provenance.visualExactnessStatus === "needs-browser-comparison")).toBe(true)
    }

    const parityVariantIds = new Set(
      SITE_PARITY_BLOCK_SLUGS.flatMap((slug) => SITE_GENERATION_BLOCK_CATALOG_BY_SLUG[slug].variants.map((variant) => variant.id)),
    )
    expect(SITE_SOURCE_BACKED_BLOCK_VARIANTS.some((variant) => parityVariantIds.has(variant.variantId))).toBe(false)
  })

  it("accepts structured parity blocks only as generated snapshot data until renderer support lands", () => {
    const parityBlock: GeneratedBlockSpec = {
      blockType: "beforeAfterGallery",
      analytics: { sectionVariant: "amblast-portfolio-comparisons" },
      anchor: "portfolio",
      title: inlineRoot("Voor en na"),
      intro: blockRoot("Portfolio vergelijking."),
      pairs: [
        {
          before: { url: "/uploads/portfolio/before.jpg" },
          after: { url: "/uploads/portfolio/after.jpg" },
          beforeLabel: "Voor",
          afterLabel: "Na",
          caption: blockRoot("Olievlek verwijderd."),
          initialRatio: 0.5,
          orientation: "horizontal",
        },
      ],
    }

    expect(GeneratedBlockSpecSchema.safeParse(parityBlock).success).toBe(true)
    expect(BlockSchema.safeParse(parityBlock).success).toBe(false)
    expect(
      GeneratedBlockSpecSchema.safeParse({
        ...parityBlock,
        rawHtml: "<section>not allowed</section>",
      }).success,
    ).toBe(false)
    expect(
      GeneratedBlockSpecSchema.safeParse({
        ...parityBlock,
        analytics: { sectionVariant: "tailblocks-cta-a" },
      }).success,
    ).toBe(false)
  })

  it("records vetted source status and keeps unavailable sources blocked", () => {
    expect(SITE_BLOCK_REFERENCE_SOURCES.tailwindPlusMarketing.availability).toBe("mixed")
    expect(SITE_BLOCK_REFERENCE_SOURCES.tailwindPlusMarketing.licenseStatus).toContain("Operator approval")
    expect(SITE_BLOCK_REFERENCE_SOURCES.tailblocks.availability).toBe("free")
    expect(SITE_BLOCK_REFERENCE_SOURCES.mambaUi.availability).toBe("free")
    expect(SITE_BLOCK_REFERENCE_SOURCES.hyperUi.availability).toBe("free")
    expect(SITE_BLOCK_REFERENCE_SOURCES.preline.availability).toBe("mixed")
    expect(SITE_BLOCK_REFERENCE_SOURCES.preline.notes).toContain("Free")
    expect(SITE_BLOCK_REFERENCE_SOURCES.preline.notes).toContain("Pro")
    expect(SITE_BLOCK_REFERENCE_SOURCES.tailgrids.availability).toBe("unavailable")
    expect(SITE_BLOCK_REFERENCE_SOURCES.tailgrids.notes).toContain("Not approved")
  })

  it("separates missing first-catalog marketing needs from approved canonical blocks", () => {
    expect(REQUIRED_V1_MARKETING_BLOCKS).toEqual(expect.arrayContaining([...SITE_BLOCK_SLUGS]))
    expect(APPROVED_V1_MARKETING_CAPABILITY_COVERAGE).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: "newsletter",
          blockSlug: "contactSection",
          variantId: "contactSection:tailwindPlusNewsletterDetails",
        }),
      ]),
    )
    expect(DEFERRED_V1_MARKETING_BLOCKS).toEqual([
      "pricing",
      "stats",
      "logoCloud",
      "gallery",
      "team",
      "blogCards",
      "processSteps",
      "comparison",
    ])
    expect(DEFERRED_V1_MARKETING_BLOCKS).not.toContain("newsletter")
  })

  it("has exact-source provenance for implemented source-backed variants", () => {
    expect(SITE_SOURCE_BACKED_BLOCK_VARIANTS.map((variant) => variant.slug)).toEqual(expect.arrayContaining([...SITE_BLOCK_SLUGS]))

    for (const variant of SITE_SOURCE_BACKED_BLOCK_VARIANTS) {
      expect(variant.sectionVariant, `${variant.variantId} missing sectionVariant`).toBeTruthy()
      expect(variant.rendererClassName, `${variant.variantId} missing rendererClassName`).toMatch(/^cms-block--source-/)
      expect(variant.provenance.url, `${variant.variantId} missing source URL`).toMatch(/^https:\/\//)
      expect(variant.provenance.upstreamBlockName, `${variant.variantId} missing upstream block name`).toBeTruthy()
      expect(variant.provenance.sourceAccessType, `${variant.variantId} missing source access type`).toMatch(
        /^(public-page-payload|public-page-copy|public-github-source)$/,
      )
      expect(variant.provenance.sourceAccess, `${variant.variantId} missing source access`).toBeTruthy()
      expect(["exact-source", "adapted-exact-style"]).toContain(variant.provenance.implementation)
      expect(variant.provenance.approvalStatus, `${variant.variantId} is not approved`).toBe("approved")
      expect(variant.provenance.sourceAvailability, `${variant.variantId} is not free/public`).toBe("free-public")
      expect(variant.provenance.licenseCompatibility, `${variant.variantId} is not license-compatible`).toBe("compatible")
      expect(variant.provenance.licenseStatus).not.toContain("disallows")
      expect(variant.provenance.retrieval, `${variant.variantId} missing retrieval process`).toBeTruthy()
      expect(variant.provenance.verifiedAt, `${variant.variantId} missing verification date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(variant.provenance.visualExactnessStatus, `${variant.variantId} missing visual exactness status`).toMatch(
        /^reviewed-(adapted-exact-style|exact-source)$/,
      )
      expect(variant.provenance.visualSourceNotes, `${variant.variantId} missing visual source notes`).toBeTruthy()
    }

    expect(SITE_SOURCE_BACKED_BLOCK_VARIANTS.some((variant) => variant.provenance.sourceName === "Tailwind Plus")).toBe(true)
    expect(SITE_SOURCE_BACKED_BLOCK_VARIANTS.some((variant) => variant.provenance.sourceName === "Tailblocks")).toBe(true)
    expect(SITE_SOURCE_BACKED_BLOCK_VARIANTS.some((variant) => variant.provenance.sourceName === "Mamba UI")).toBe(true)
    expect(SITE_SOURCE_BACKED_BLOCK_VARIANTS.some((variant) => variant.provenance.sourceName === "HyperUI")).toBe(true)
    expect(SITE_SOURCE_BACKED_BLOCK_VARIANTS.some((variant) => variant.provenance.sourceName === "Preline UI")).toBe(true)
    expect(DEFERRED_SOURCE_BLOCK_CANDIDATES).toHaveLength(0)
  })

  it("blocks paid, locked, unavailable, license-incompatible, and visually unaudited source variants", () => {
    const catalogVariants = SITE_BLOCK_CATALOG.flatMap((entry) => [...entry.variants]) as SiteBlockCatalogVariant[]
    const approved = catalogVariants.find(isApprovedSourceBackedVariant)
    expect(approved).toBeTruthy()

    const blockedCases = [
      { sourceAvailability: "paid" as const },
      { sourceAvailability: "locked" as const },
      { sourceAvailability: "unavailable" as const },
      { sourceAvailability: "operator-archive-required" as const },
      { sourceAvailability: "license-incompatible" as const },
      { licenseCompatibility: "incompatible" as const },
      { approvalStatus: "blocked" as const },
      { approvalStatus: "deferred" as const },
      { sourceAccessType: "operator-provided-archive" as const },
      { sourceAccessType: "deferred" as const },
      { visualExactnessStatus: "needs-browser-comparison" as const },
      { visualExactnessStatus: "blocked" as const },
      { rendererSupportStatus: "deferred" as const },
      { rendererSupportStatus: "unsupported" as const },
      { retrieval: "" },
      { visualSourceNotes: "" },
    ]

    for (const patch of blockedCases) {
      const candidate = {
        ...approved!,
        ...("rendererSupportStatus" in patch ? { rendererSupportStatus: patch.rendererSupportStatus } : {}),
        provenance: {
          ...approved!.provenance,
          ...patch,
        },
      }
      expect(isApprovedSourceBackedVariant(candidate), JSON.stringify(patch)).toBe(false)
    }
  })

  it("has fixture coverage for every catalog entry", () => {
    const fixtureBlockTypes = new Set([
      ...v1FixturePage.blocks.map((block) => block.blockType),
      ...tenantSiteGenerationSpecs.flatMap((spec) =>
        spec.pages.flatMap((page) => page.blocks.map((block) => block.blockType)),
      ),
    ])

    for (const entry of SITE_BLOCK_CATALOG) {
      expect(fixtureBlockTypes.has(entry.slug), `${entry.slug} missing fixture coverage`).toBe(true)
    }
  })

  it("exercises every source-backed renderer variant in the renderer fixture", () => {
    const fixtureVariants = new Set(
      v1FixturePage.blocks
        .map((block) => block.analytics?.sectionVariant)
        .filter((variant): variant is string => typeof variant === "string"),
    )

    for (const variant of SITE_SOURCE_BACKED_BLOCK_VARIANTS) {
      expect(fixtureVariants.has(variant.sectionVariant!), `${variant.sectionVariant} missing fixture coverage`).toBe(true)
    }
  })
})
