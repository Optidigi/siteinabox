import "server-only"
import { productionTldCapabilitiesAt } from "@siteinabox/contracts/tld-capabilities"
import type { SiteGenerationRun } from "@/payload-types"
import { checkPreviewDomainOrders } from "@/lib/domains/previewDomainOrder"

export type PreviewDomainSearchMode = "primary" | "more"

export type PreviewDomainDiscoveryResult = {
  domain: string
  availability: "available" | "unavailable" | "premium" | "unknown" | "unsupported"
  purchasable: boolean
  included: boolean
  extraFee: { amount: string; currency: string } | null
  checkedAt: string
}

const primaryExtensions = ["nl", "com", "info", "org", "eu"]
const moreExtensions = ["net", "be", "de", "online", "shop"]
const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

const normalizeSearchName = (value: string): { name: string; exact: string | null } | null => {
  const canonical = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/\.$/, "")
  if (!canonical || canonical.length > 253) return null
  const labels = canonical.split(".")
  if (!labels.every((label) => labelPattern.test(label))) return null
  if (labels.length === 1) return { name: labels[0]!, exact: null }
  if (!/[a-z]/.test(labels.at(-1) ?? "")) return null
  return { name: labels.slice(0, -1).join("."), exact: canonical }
}

/** Server-owned, bounded policy; clients submit a query and phase, never domains. */
export const previewDomainSearchCandidates = (query: string, mode: PreviewDomainSearchMode): string[] => {
  const normalized = normalizeSearchName(query)
  if (!normalized) return []
  const enabled = new Set(productionTldCapabilitiesAt("registration").map((capability) => capability.tld))
  const extensions = (mode === "primary" ? primaryExtensions : moreExtensions).filter((extension) => enabled.has(extension))
  return [...new Set([
    ...(mode === "primary" && normalized.exact ? [normalized.exact] : []),
    ...extensions.map((extension) => `${normalized.name}.${extension}`),
  ])]
}

export async function searchPreviewDomains(input: {
  run: SiteGenerationRun
  query: string
  mode: PreviewDomainSearchMode
  signal?: AbortSignal
}): Promise<{ results: PreviewDomainDiscoveryResult[]; hasMore: boolean }> {
  const candidates = previewDomainSearchCandidates(input.query, input.mode)
  if (candidates.length === 0) return { results: [], hasMore: false }
  const results = await checkPreviewDomainOrders(input.run, candidates, null, {
    // Discovery deliberately has no profile, quote, localized text, or writes.
    requireProductionCapability: false,
    allowUnconfiguredTldCapability: false,
    signal: input.signal,
  })
  return {
    results: results.map((result) => {
      const purchasable = result.productionOperationEnabled && (
        result.messageKey === "checkoutDomainAvailable" ||
        result.messageKey === "checkoutDomainAvailableExtraFee"
      )
      return {
        domain: result.domain,
        availability: result.messageKey === "checkoutDomainUnavailable"
          ? "unavailable"
          : result.messageKey === "checkoutDomainPremium"
            ? "premium"
            : result.messageKey === "checkoutDomainReleasePending"
              ? "unsupported"
              : purchasable
                ? "available"
                : "unknown",
        purchasable,
        included: result.included,
        extraFee: result.extraFeeAmount && result.extraFeeCurrency
          ? { amount: result.extraFeeAmount, currency: result.extraFeeCurrency }
          : null,
        checkedAt: result.providerQuotedAt,
      }
    }),
    hasMore: input.mode === "primary" && previewDomainSearchCandidates(input.query, "more").length > 0,
  }
}
