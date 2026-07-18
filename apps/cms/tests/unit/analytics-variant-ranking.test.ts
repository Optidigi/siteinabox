import { describe, expect, it } from "vitest"
import { rankProviderVariants, type VariantRankingInput } from "@/lib/analytics/variantRanking"

const variant = (overrides: Partial<VariantRankingInput> = {}): VariantRankingInput => ({
  sectionType: "hero",
  providerVariant: "shadcnui-blocks.hero-01",
  views: 80,
  exposedVisitors: 40,
  engagements: 24,
  engagedVisitors: 20,
  interactions: 12,
  interactingVisitors: 10,
  attributedConversions: 2,
  convertingVisitors: 2,
  tenantCount: 2,
  instanceCount: 3,
  ...overrides,
})

describe("provider variant ranking", () => {
  it("withholds a score and rank when cross-instance evidence is insufficient", () => {
    const [row] = rankProviderVariants([variant({ exposedVisitors: 19, instanceCount: 1 })])

    expect(row).toMatchObject({
      confidence: "insufficient",
      score: null,
      rank: null,
      engagementRate: 1,
    })
  })

  it("ranks eligible variants within their section type using unique-visitor outcomes", () => {
    const rows = rankProviderVariants([
      variant({ providerVariant: "hero-a", engagedVisitors: 28, interactingVisitors: 18, convertingVisitors: 4 }),
      variant({ providerVariant: "hero-b", engagedVisitors: 16, interactingVisitors: 7, convertingVisitors: 1 }),
      variant({ sectionType: "faq", providerVariant: "faq-a", engagedVisitors: 22, interactingVisitors: 0, convertingVisitors: 0 }),
    ])

    expect(rows.find((row) => row.providerVariant === "hero-a")).toMatchObject({ rank: 1, confidence: "directional" })
    expect(rows.find((row) => row.providerVariant === "hero-b")).toMatchObject({ rank: 2, confidence: "directional" })
    expect(rows.find((row) => row.providerVariant === "faq-a")).toMatchObject({ rank: null, confidence: "directional" })
  })

  it("marks broad cross-tenant evidence as established", () => {
    const [row] = rankProviderVariants([variant({
      exposedVisitors: 120,
      engagedVisitors: 72,
      interactingVisitors: 36,
      convertingVisitors: 6,
      tenantCount: 3,
      instanceCount: 5,
    })])

    expect(row).toMatchObject({ confidence: "established", rank: null })
    expect(row?.score).toBeGreaterThan(0)
  })

  it("does not let a tiny perfect sample outrank evidence that meets the floor", () => {
    const rows = rankProviderVariants([
      variant({ providerVariant: "tiny", exposedVisitors: 5, engagedVisitors: 5, interactingVisitors: 5, convertingVisitors: 5, instanceCount: 1, tenantCount: 1 }),
      variant({ providerVariant: "eligible", exposedVisitors: 40, engagedVisitors: 20, interactingVisitors: 10, convertingVisitors: 2 }),
    ])

    expect(rows.find((row) => row.providerVariant === "tiny")).toMatchObject({ rank: null, score: null, confidence: "insufficient" })
    expect(rows.find((row) => row.providerVariant === "eligible")).toMatchObject({ rank: null })
  })
})
