export const VARIANT_RANKING_MIN_EXPOSED_VISITORS = 20
export const VARIANT_RANKING_MIN_INSTANCES = 2
export const VARIANT_RANKING_ESTABLISHED_VISITORS = 100
export const VARIANT_RANKING_ESTABLISHED_INSTANCES = 3
export const VARIANT_RANKING_ESTABLISHED_TENANTS = 2

const PRIOR_VISITORS = 20

export type VariantRankingConfidence = "insufficient" | "directional" | "established"

export type VariantRankingInput = {
  sectionType: string
  providerVariant: string
  views: number
  exposedVisitors: number
  engagements: number
  engagedVisitors: number
  interactions: number
  interactingVisitors: number
  attributedConversions: number
  convertingVisitors: number
  tenantCount: number
  instanceCount: number
}

export type VariantRankingMetric = VariantRankingInput & {
  rank: number | null
  score: number | null
  confidence: VariantRankingConfidence
  engagementRate: number
  interactionRate: number
  conversionRate: number
}

const boundedRate = (successes: number, trials: number) =>
  trials > 0 ? Math.min(Math.max(successes, 0), trials) / trials : 0

const smoothedRate = (successes: number, trials: number, priorRate: number) =>
  trials > 0
    ? (Math.min(Math.max(successes, 0), trials) + priorRate * PRIOR_VISITORS) / (trials + PRIOR_VISITORS)
    : priorRate

const confidenceFor = (row: VariantRankingInput): VariantRankingConfidence => {
  if (
    row.exposedVisitors < VARIANT_RANKING_MIN_EXPOSED_VISITORS
    || row.instanceCount < VARIANT_RANKING_MIN_INSTANCES
  ) return "insufficient"

  if (
    row.exposedVisitors >= VARIANT_RANKING_ESTABLISHED_VISITORS
    && row.instanceCount >= VARIANT_RANKING_ESTABLISHED_INSTANCES
    && row.tenantCount >= VARIANT_RANKING_ESTABLISHED_TENANTS
  ) return "established"

  return "directional"
}

export const rankProviderVariants = (input: VariantRankingInput[]): VariantRankingMetric[] => {
  const bySectionType = new Map<string, VariantRankingInput[]>()
  for (const row of input) {
    if (!row.sectionType.trim() || !row.providerVariant.trim() || row.exposedVisitors <= 0) continue
    const peers = bySectionType.get(row.sectionType) ?? []
    peers.push(row)
    bySectionType.set(row.sectionType, peers)
  }
  const ranked: VariantRankingMetric[] = []

  for (const [sectionType, rows] of bySectionType) {
    const totalExposed = rows.reduce((sum, row) => sum + row.exposedVisitors, 0)
    const totalEngaged = rows.reduce((sum, row) => sum + Math.min(row.engagedVisitors, row.exposedVisitors), 0)
    const totalInteracting = rows.reduce((sum, row) => sum + Math.min(row.interactingVisitors, row.exposedVisitors), 0)
    const totalConverting = rows.reduce((sum, row) => sum + Math.min(row.convertingVisitors, row.exposedVisitors), 0)
    const engagementPrior = boundedRate(totalEngaged, totalExposed)
    const interactionPrior = boundedRate(totalInteracting, totalExposed)
    const conversionPrior = boundedRate(totalConverting, totalExposed)
    const weights = [
      { key: "engagement" as const, value: 0.55 },
      ...(totalInteracting > 0 ? [{ key: "interaction" as const, value: 0.30 }] : []),
      ...(totalConverting > 0 ? [{ key: "conversion" as const, value: 0.15 }] : []),
    ]
    const weightTotal = weights.reduce((sum, weight) => sum + weight.value, 0)

    const metrics = rows.map((row): VariantRankingMetric => {
      const confidence = confidenceFor(row)
      const smoothed = {
        engagement: smoothedRate(row.engagedVisitors, row.exposedVisitors, engagementPrior),
        interaction: smoothedRate(row.interactingVisitors, row.exposedVisitors, interactionPrior),
        conversion: smoothedRate(row.convertingVisitors, row.exposedVisitors, conversionPrior),
      }
      const weightedScore = weights.reduce((sum, weight) => sum + smoothed[weight.key] * weight.value, 0) / weightTotal

      return {
        ...row,
        sectionType,
        rank: null,
        score: confidence === "insufficient" ? null : Math.round(weightedScore * 100),
        confidence,
        engagementRate: boundedRate(row.engagedVisitors, row.exposedVisitors),
        interactionRate: boundedRate(row.interactingVisitors, row.exposedVisitors),
        conversionRate: boundedRate(row.convertingVisitors, row.exposedVisitors),
      }
    })

    const eligible = metrics
      .filter((row) => row.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.exposedVisitors - a.exposedVisitors || a.providerVariant.localeCompare(b.providerVariant))
    if (eligible.length >= 2) eligible.forEach((row, index) => { row.rank = index + 1 })

    ranked.push(...metrics.sort((a, b) =>
      (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER)
      || b.exposedVisitors - a.exposedVisitors
      || a.providerVariant.localeCompare(b.providerVariant),
    ))
  }

  return ranked.sort((a, b) =>
    a.sectionType.localeCompare(b.sectionType)
    || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER)
    || b.exposedVisitors - a.exposedVisitors,
  )
}
