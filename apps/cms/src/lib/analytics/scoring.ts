import "server-only"
import type { Page, SiteSetting } from "@/payload-types"
import type { WebVitalMetric } from "./queries"

export type WebVitalName = "CLS" | "FCP" | "INP" | "LCP"
export type MetricRating = "good" | "needs-improvement" | "poor"

export type WebVitalDefinition = {
  name: WebVitalName
  label: string
  unit: "ms" | "score"
  good: number
  poor: number
  lowerIsBetter: true
  meaning: string
}

export const WEB_VITAL_DEFINITIONS: Record<WebVitalName, WebVitalDefinition> = {
  FCP: {
    name: "FCP",
    label: "First Contentful Paint",
    unit: "ms",
    good: 1800,
    poor: 3000,
    lowerIsBetter: true,
    meaning: "How quickly the first visible content appears.",
  },
  LCP: {
    name: "LCP",
    label: "Largest Contentful Paint",
    unit: "ms",
    good: 2500,
    poor: 4000,
    lowerIsBetter: true,
    meaning: "How quickly the main visible content finishes loading.",
  },
  INP: {
    name: "INP",
    label: "Interaction to Next Paint",
    unit: "ms",
    good: 200,
    poor: 500,
    lowerIsBetter: true,
    meaning: "How quickly the page reacts to user input.",
  },
  CLS: {
    name: "CLS",
    label: "Cumulative Layout Shift",
    unit: "score",
    good: 0.1,
    poor: 0.25,
    lowerIsBetter: true,
    meaning: "How visually stable the page is while loading and changing.",
  },
}

export const WEB_VITAL_NAMES: WebVitalName[] = ["LCP", "INP", "CLS", "FCP"]

export const webVitalRating = (name: string, value: number): MetricRating | null => {
  const definition = WEB_VITAL_DEFINITIONS[name as WebVitalName]
  if (!definition || !Number.isFinite(value)) return null
  if (value <= definition.good) return "good"
  if (value <= definition.poor) return "needs-improvement"
  return "poor"
}

export const webVitalScore = (name: string, value: number) => {
  const definition = WEB_VITAL_DEFINITIONS[name as WebVitalName]
  if (!definition || !Number.isFinite(value)) return 0
  if (value <= definition.good) return 100
  if (value >= definition.poor) return 0
  return Math.round(100 - ((value - definition.good) / (definition.poor - definition.good)) * 50)
}

export type SiteQualityCheck = {
  key: string
  label: string
  passed: boolean
  weight: number
  hint: string
}

export type SiteQualityScore = {
  available: boolean
  score: number | null
  passed: number
  total: number
  checks: SiteQualityCheck[]
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : ""
const hasText = (value: unknown) => text(value).length > 0
const hasUpload = (value: unknown) => {
  if (typeof value === "number") return true
  if (typeof value === "string") return value.trim() !== ""
  return !!(value && typeof value === "object" && "id" in value)
}

export const scoreSiteQuality = ({
  settings,
  pages,
}: {
  settings: SiteSetting | null
  pages: Page[]
}): SiteQualityScore => {
  if (!settings && pages.length === 0) {
    return { available: false, score: null, passed: 0, total: 0, checks: [] }
  }

  const publishedPages = pages.filter((page) => page?.status === "published")
  const homePage = publishedPages.find((page) => page?.slug === "home") ?? publishedPages[0] ?? null
  const pagesWithSeoTitle = publishedPages.filter((page) => hasText(page?.seo?.title)).length
  const pagesWithSeoDescription = publishedPages.filter((page) => hasText(page?.seo?.description)).length
  const pagesWithOgImage = publishedPages.filter((page) => hasUpload(page?.seo?.ogImage)).length
  const allPublishedHaveSeoTitles = publishedPages.length > 0 && pagesWithSeoTitle === publishedPages.length
  const allPublishedHaveSeoDescriptions = publishedPages.length > 0 && pagesWithSeoDescription === publishedPages.length

  const checks: SiteQualityCheck[] = [
    {
      key: "site-name",
      label: "Site name",
      passed: hasText(settings?.siteName),
      weight: 8,
      hint: "Set the public site name in Settings.",
    },
    {
      key: "site-url",
      label: "Canonical site URL",
      passed: /^https?:\/\//.test(text(settings?.siteUrl)),
      weight: 8,
      hint: "Set a full public URL so generated metadata can use canonical links.",
    },
    {
      key: "site-description",
      label: "Site description",
      passed: hasText(settings?.description),
      weight: 8,
      hint: "Add a concise site description for metadata and fallback summaries.",
    },
    {
      key: "language",
      label: "Site language",
      passed: /^[a-z]{2}(-[A-Z]{2})?$/.test(text(settings?.language || "en")),
      weight: 5,
      hint: "Use a valid language code such as nl or en.",
    },
    {
      key: "favicon",
      label: "Favicon",
      passed: hasUpload(settings?.branding?.favicon),
      weight: 5,
      hint: "Upload a favicon for browser tabs and bookmarks.",
    },
    {
      key: "logo",
      label: "Logo",
      passed: hasUpload(settings?.branding?.logo) || hasUpload(settings?.chrome?.header?.logo),
      weight: 5,
      hint: "Upload a brand or header logo.",
    },
    {
      key: "published-home",
      label: "Published home page",
      passed: !!homePage,
      weight: 12,
      hint: "Publish a home page.",
    },
    {
      key: "page-seo-titles",
      label: "Page SEO titles",
      passed: allPublishedHaveSeoTitles,
      weight: 14,
      hint: "Give every published page an SEO title.",
    },
    {
      key: "page-meta-descriptions",
      label: "Page meta descriptions",
      passed: allPublishedHaveSeoDescriptions,
      weight: 14,
      hint: "Give every published page a meta description.",
    },
    {
      key: "open-graph-images",
      label: "Open Graph images",
      passed: publishedPages.length > 0 && pagesWithOgImage > 0,
      weight: 7,
      hint: "Add at least one page sharing image.",
    },
    {
      key: "navigation",
      label: "Header or footer navigation",
      passed: (settings?.navHeader?.length ?? 0) > 0 || (settings?.navFooter?.length ?? 0) > 0,
      weight: 7,
      hint: "Add header or footer navigation links.",
    },
    {
      key: "contact",
      label: "Contact signal",
      passed: hasText(settings?.contactEmail) || hasText(settings?.contact?.phone) || hasText(settings?.contact?.address),
      weight: 7,
      hint: "Add at least one contact detail when the site supports it.",
    },
  ]

  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0)
  const passedWeight = checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0)
  const passed = checks.filter((check) => check.passed).length

  return {
    available: true,
    score: totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : null,
    passed,
    total: checks.length,
    checks,
  }
}

export const combineSiteScore = ({
  webVitals,
  siteQuality,
}: {
  webVitals: WebVitalMetric[]
  siteQuality: SiteQualityScore
}) => {
  const scoredVitals = webVitals.filter((row) => row.samples > 0)
  const fieldPerformanceScore = scoredVitals.length > 0
    ? Math.round(scoredVitals.reduce((sum, row) => sum + row.score, 0) / scoredVitals.length)
    : null
  const siteQualityScore = siteQuality.score

  if (fieldPerformanceScore == null && siteQualityScore == null) return null
  if (fieldPerformanceScore == null) return siteQualityScore
  if (siteQualityScore == null) return fieldPerformanceScore
  return Math.round((fieldPerformanceScore * 0.6) + (siteQualityScore * 0.4))
}

export const getSiteQualityScore = async (tenantId: string | number | null | undefined): Promise<SiteQualityScore> => {
  if (tenantId == null || String(tenantId).trim() === "") {
    return { available: false, score: null, passed: 0, total: 0, checks: [] }
  }
  const [{ getPayload }, { default: config }] = await Promise.all([
    import("payload"),
    import("@/payload.config"),
  ])
  const payload = await getPayload({ config })
  const where = { tenant: { equals: tenantId } }
  const [settingsResult, pagesResult] = await Promise.all([
    payload.find({ collection: "site-settings", where, limit: 1, depth: 1, overrideAccess: true }),
    payload.find({ collection: "pages", where, limit: 100, depth: 1, overrideAccess: true }),
  ])

  return scoreSiteQuality({
    settings: settingsResult.docs[0] ?? null,
    pages: pagesResult.docs,
  })
}
