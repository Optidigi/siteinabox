import "server-only"
import type { Payload } from "payload"
import type { SiteGenerationRun } from "@/payload-types"
import {
  compareMoney,
  createDomainOrderState,
  domainExtraFeeForProviderPrice,
  fixedDomainOrderPriceFromEnv,
  maxDomainProviderPriceFromEnv,
  normalizeDomainOrderState,
  providerPriceWithinCap,
  type FixedDomainOrderPrice,
  type DomainRegistrantDetails,
} from "@/lib/domains/orderState"
import {
  checkOpenProviderDomainAvailability,
  checkOpenProviderDomainsAvailability,
  suggestOpenProviderDomains,
} from "@/lib/domains/openprovider"
import { normalizeDomain } from "@/lib/domains/normalize"
import { previewDomainCandidates } from "@/lib/domains/previewDomainCandidates"

export type PreviewDomainSuggestion = {
  domain: string
  included: boolean
  extraFeeAmount: string | null
  extraFeeCurrency: string | null
}

export type PreviewDomainSuggestionBatch = {
  suggestions: PreviewDomainSuggestion[]
  nextCursor: number
  done: boolean
}

export type PreviewDomainOrderResult = {
  run: SiteGenerationRun
  messageKey:
    | "checkoutDomainAvailable"
    | "checkoutDomainUnavailable"
    | "checkoutDomainPremium"
    | "checkoutDomainCheckFailed"
    | "checkoutDomainAvailableExtraFee"
  domain: string
  included: boolean
  extraFeeAmount: string | null
  extraFeeCurrency: string | null
  suggestions: PreviewDomainSuggestion[]
}

export function selectedDomainForCheckout(run: Pick<SiteGenerationRun, "domainOrder">): string | null {
  const state = normalizeDomainOrderState(run.domainOrder)
  return state.status === "ready_to_register" && state.domain ? state.domain : null
}

const suggestionForAvailability = (
  domain: string,
  providerPrice: FixedDomainOrderPrice | null,
  includedProviderPrice: FixedDomainOrderPrice,
): PreviewDomainSuggestion => {
  const extraFee = domainExtraFeeForProviderPrice(providerPrice, includedProviderPrice)
  return {
    domain,
    included: !extraFee,
    extraFeeAmount: extraFee?.amount ?? null,
    extraFeeCurrency: extraFee?.currency ?? null,
  }
}

export async function suggestAvailablePreviewDomains(
  domain: string,
  includedProviderPrice: ReturnType<typeof maxDomainProviderPriceFromEnv>,
  token?: string,
): Promise<PreviewDomainSuggestion[]> {
  const suggestions: PreviewDomainSuggestion[] = []
  let cursor = 0
  let done = false
  while (!done && suggestions.length < 5) {
    const batch = await suggestAvailablePreviewDomainBatch(domain, includedProviderPrice, token, {
      cursor,
      batchSize: 8,
      existingDomains: suggestions.map((suggestion) => suggestion.domain),
    })
    suggestions.push(...batch.suggestions)
    cursor = batch.nextCursor
    done = batch.done
  }
  return suggestions
}

export async function suggestAvailablePreviewDomainBatch(
  domain: string,
  includedProviderPrice: ReturnType<typeof maxDomainProviderPriceFromEnv>,
  tokenOrOptions?: string | { cursor?: number; batchSize?: number; existingDomains?: string[] },
  maybeOptions?: { cursor?: number; batchSize?: number; existingDomains?: string[] },
): Promise<PreviewDomainSuggestionBatch> {
  const normalized = normalizeDomain(domain)
  const suggestions: PreviewDomainSuggestion[] = []
  const token = typeof tokenOrOptions === "string" ? tokenOrOptions : undefined
  const options = typeof tokenOrOptions === "string" ? maybeOptions : tokenOrOptions ?? maybeOptions
  const existingDomains = new Set(options?.existingDomains ?? [])
  const cursor = Math.max(0, options?.cursor ?? 0)
  const batchSize = Math.max(1, Math.min(options?.batchSize ?? 6, 12))
  if (!normalized.ok) return { suggestions, nextCursor: cursor, done: true }

  try {
    const localCandidates = previewDomainCandidates(domain)
    const didLoadProviderCandidates = cursor >= localCandidates.length
    const providerCandidates = didLoadProviderCandidates
      ? await suggestOpenProviderDomains(domain, token ? { token, limit: 12 } : { limit: 12 })
        .then((providerSuggestions) => providerSuggestions.map((suggestion) => suggestion.domain))
        .catch(() => [])
      : []
    const candidates = [...new Set([...localCandidates, ...providerCandidates])].filter((candidate) => {
      const candidateDomain = normalizeDomain(candidate)
      return candidateDomain.ok &&
        candidateDomain.extension === normalized.extension &&
        candidateDomain.domain !== normalized.domain
    })
    const batchCandidates = candidates.slice(cursor, cursor + batchSize)
    if (batchCandidates.length === 0) {
      return { suggestions, nextCursor: candidates.length, done: true }
    }
    const availabilityResults = await checkOpenProviderDomainsAvailability(
      batchCandidates,
      token ? { token } : undefined,
    )
    for (const availability of availabilityResults) {
      const providerPrice = availability.price
        ? { amount: availability.price.amount, currency: availability.price.currency }
        : null
      if (
        availability.status === "available" &&
        !existingDomains.has(availability.domain) &&
        providerPriceIsUsable(providerPrice, includedProviderPrice)
      ) {
        suggestions.push(suggestionForAvailability(availability.domain, providerPrice, includedProviderPrice))
        existingDomains.add(availability.domain)
      }
      if (suggestions.length >= 5) break
    }
    const nextCursor = cursor + batchCandidates.length
    return { suggestions, nextCursor, done: didLoadProviderCandidates && nextCursor >= candidates.length }
  } catch {
    // Suggestions are optional; the primary domain check result remains authoritative.
    return { suggestions, nextCursor: cursor + batchSize, done: false }
  }
}

const providerPriceIsUsable = (
  providerPrice: FixedDomainOrderPrice | null,
  includedProviderPrice: FixedDomainOrderPrice,
): boolean => providerPrice !== null && compareMoney(providerPrice, includedProviderPrice) !== null

export async function checkAndRecordPreviewDomainOrder(
  payload: Payload,
  run: SiteGenerationRun,
  domainInput: string,
  registrant?: DomainRegistrantDetails | null,
  options?: { record?: boolean },
): Promise<PreviewDomainOrderResult> {
  const normalized = normalizeDomain(domainInput)
  if (!normalized.ok) {
    throw new Error(`Invalid domain: ${normalized.reason}`)
  }

  const fixedPrice = fixedDomainOrderPriceFromEnv()
  const includedProviderPrice = maxDomainProviderPriceFromEnv()
  const availability = await checkOpenProviderDomainAvailability(normalized.domain)
  const now = new Date().toISOString()
  const providerPrice = availability.price
    ? { amount: availability.price.amount, currency: availability.price.currency }
    : null
  const priceUsable = availability.status === "available" && providerPriceIsUsable(providerPrice, includedProviderPrice)
  const includedPrice = availability.status === "available" && providerPriceWithinCap(providerPrice, includedProviderPrice)
  const extraFee = domainExtraFeeForProviderPrice(providerPrice, includedProviderPrice)
  const status = priceUsable
    ? "ready_to_register"
    : availability.status === "premium"
      ? "premium"
      : availability.status === "unavailable"
        ? "unavailable"
        : "failed"
  const domainOrder = createDomainOrderState({
    status,
    domain: normalized.domain,
    fixedPrice,
    providerPrice,
    maxProviderPrice: includedProviderPrice,
    registrant: registrant ?? normalizeDomainOrderState(run.domainOrder).registrant,
    reason: availability.internalReason
      ?? (availability.status === "available" && !priceUsable
        ? "provider_price_unavailable"
        : availability.status === "available" && !includedPrice
          ? "domain_cost_above_limit"
          : null),
    now,
  })

  const updated = options?.record === false
    ? run
    : await payload.update({
      collection: "site-generation-runs",
      id: run.id,
      data: { domainOrder },
      depth: 0,
      overrideAccess: true,
    }) as SiteGenerationRun

  return {
    run: updated,
    domain: normalized.domain,
    included: includedPrice,
    extraFeeAmount: extraFee?.amount ?? null,
    extraFeeCurrency: extraFee?.currency ?? null,
    suggestions: [],
    messageKey: includedPrice
      ? "checkoutDomainAvailable"
      : priceUsable
        ? "checkoutDomainAvailableExtraFee"
      : availability.status === "premium"
        ? "checkoutDomainPremium"
        : availability.status === "unavailable"
          ? "checkoutDomainUnavailable"
          : "checkoutDomainCheckFailed",
  }
}

export async function requireReadyPreviewDomainOrder(
  payload: Payload,
  run: SiteGenerationRun,
  domainInput: string,
  registrant?: DomainRegistrantDetails | null,
): Promise<{ run: SiteGenerationRun; domain: string }> {
  const normalized = normalizeDomain(domainInput)
  if (!normalized.ok) throw new Error(`Invalid domain: ${normalized.reason}`)
  const state = normalizeDomainOrderState(run.domainOrder)
  const result = await checkAndRecordPreviewDomainOrder(payload, run, normalized.domain, registrant)
  if (result.messageKey !== "checkoutDomainAvailable" && result.messageKey !== "checkoutDomainAvailableExtraFee") {
    throw new Error(result.messageKey)
  }
  if (state.status !== "ready_to_register" || state.domain !== normalized.domain) {
    return { run: result.run, domain: result.domain }
  }
  return { run: result.run, domain: normalized.domain }
}
