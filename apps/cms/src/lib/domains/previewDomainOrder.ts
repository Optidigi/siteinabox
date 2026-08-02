import "server-only"
import {
  getTldCapabilityForProductionOperation,
  tldCapabilityAt,
  validateTldRegistrationLabel,
} from "@siteinabox/contracts/tld-capabilities"
import type { Payload } from "payload"
import type { SiteGenerationRun } from "@/payload-types"
import {
  compareMoney,
  createDomainOrderState,
  domainExtraFeeForProviderPrice,
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
  type OpenProviderAvailabilityResult,
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
    | "checkoutDomainReleasePending"
    | "checkoutDomainAvailableExtraFee"
  domain: string
  included: boolean
  extraFeeAmount: string | null
  extraFeeCurrency: string | null
  providerPriceAmount: string | null
  providerPriceCurrency: string | null
  providerQuotedAt: string
  productionOperationEnabled: boolean
  suggestions: PreviewDomainSuggestion[]
}

/**
 * The checkout requests a deliberately small, server-derived candidate set.
 * Keep this below the provider's documented maximum so this helper cannot turn
 * an authenticated checkout request into an unbounded availability probe.
 */
export const MAX_PREVIEW_DOMAIN_ORDER_BATCH_SIZE = 15

export type PreviewDomainOrderCheckOptions = {
  includedProviderPrice?: FixedDomainOrderPrice
  capabilityEffectiveAt?: string | Date
  requireProductionCapability?: boolean
  /** Only the payment/commit check may bypass presentation availability cache. */
  forceFresh?: boolean
}

type NormalizedPreviewDomainOrderCandidate = {
  domain: string
  name: string
  extension: string
  productionCapability: ReturnType<typeof getTldCapabilityForProductionOperation>
}

type PreviewDomainOrderMapping = {
  domainOrder: ReturnType<typeof createDomainOrderState>
  result: Omit<PreviewDomainOrderResult, "run">
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
  tokenOrOptions?: string | {
    cursor?: number
    batchSize?: number
    existingDomains?: string[]
    capabilityEffectiveAt?: string | Date
  },
  maybeOptions?: {
    cursor?: number
    batchSize?: number
    existingDomains?: string[]
    capabilityEffectiveAt?: string | Date
  },
): Promise<PreviewDomainSuggestionBatch> {
  const normalized = normalizeDomain(domain)
  const suggestions: PreviewDomainSuggestion[] = []
  const token = typeof tokenOrOptions === "string" ? tokenOrOptions : undefined
  const options = typeof tokenOrOptions === "string" ? maybeOptions : tokenOrOptions ?? maybeOptions
  const existingDomains = new Set(options?.existingDomains ?? [])
  const cursor = Math.max(0, options?.cursor ?? 0)
  const batchSize = Math.max(1, Math.min(options?.batchSize ?? 6, 12))
  if (!normalized.ok) return { suggestions, nextCursor: cursor, done: true }
  const capability = getTldCapabilityForProductionOperation(
    normalized.extension,
    "registration",
    options?.capabilityEffectiveAt,
  )
  if (!capability || !validateTldRegistrationLabel(capability, normalized.name)) {
    return { suggestions, nextCursor: cursor, done: true }
  }

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

const normalizePreviewDomainOrderCandidate = (
  domainInput: string,
  options?: PreviewDomainOrderCheckOptions,
): NormalizedPreviewDomainOrderCandidate => {
  const normalized = normalizeDomain(domainInput)
  if (!normalized.ok) {
    throw new Error(`Invalid domain: ${normalized.reason}`)
  }
  const productionCapability = getTldCapabilityForProductionOperation(
    normalized.extension,
    "registration",
    options?.capabilityEffectiveAt,
  )
  const capability = options?.requireProductionCapability === false
    ? tldCapabilityAt(normalized.extension, options?.capabilityEffectiveAt) ?? productionCapability
    : productionCapability
  if (!capability) {
    throw new Error(`TLD .${normalized.extension} is not enabled for checkout.`)
  }
  if (!validateTldRegistrationLabel(capability, normalized.name)) {
    throw new Error(`Domain label is not supported for .${normalized.extension}.`)
  }
  return {
    domain: normalized.domain,
    name: normalized.name,
    extension: normalized.extension,
    productionCapability,
  }
}

const previewDomainOrderMapping = (
  run: SiteGenerationRun,
  candidate: NormalizedPreviewDomainOrderCandidate,
  availability: OpenProviderAvailabilityResult,
  registrant: DomainRegistrantDetails | null | undefined,
  options?: PreviewDomainOrderCheckOptions,
): PreviewDomainOrderMapping => {
  const includedProviderPrice = options?.includedProviderPrice ?? maxDomainProviderPriceFromEnv()
  const now = new Date().toISOString()
  const providerPrice = availability.price
    ? { amount: availability.price.amount, currency: availability.price.currency }
    : null
  const priceUsable = availability.status === "available" && providerPriceIsUsable(providerPrice, includedProviderPrice)
  const includedPrice = availability.status === "available" && providerPriceWithinCap(providerPrice, includedProviderPrice)
  const extraFee = domainExtraFeeForProviderPrice(providerPrice, includedProviderPrice)
  const productionOperationEnabled = candidate.productionCapability !== null
  const status = priceUsable && productionOperationEnabled
    ? "ready_to_register"
    : availability.status === "premium"
      ? "premium"
      : availability.status === "unavailable"
        ? "unavailable"
        : "failed"
  const domainOrder = createDomainOrderState({
    status,
    domain: candidate.domain,
    // The accepted server quote is the sole customer-price authority. Domain
    // order state retains provider evidence only; it must not depend on a
    // process-wide fixed checkout amount.
    fixedPrice: null,
    providerPrice,
    maxProviderPrice: includedProviderPrice,
    registrant: registrant ?? normalizeDomainOrderState(run.domainOrder).registrant,
    reason: availability.internalReason
      ?? (availability.status === "available" && !productionOperationEnabled
        ? "registration_release_pending"
        : availability.status === "available" && !priceUsable
          ? "provider_price_unavailable"
          : availability.status === "available" && !includedPrice
            ? "domain_cost_above_limit"
            : null),
    now,
  })
  return {
    domainOrder,
    result: {
      domain: candidate.domain,
      included: includedPrice,
      extraFeeAmount: extraFee?.amount ?? null,
      extraFeeCurrency: extraFee?.currency ?? null,
      providerPriceAmount: providerPrice?.amount ?? null,
      providerPriceCurrency: providerPrice?.currency ?? null,
      providerQuotedAt: now,
      productionOperationEnabled,
      suggestions: [],
      messageKey: availability.status === "available" && priceUsable && !productionOperationEnabled
        ? "checkoutDomainReleasePending"
        : includedPrice
          ? "checkoutDomainAvailable"
          : priceUsable
            ? "checkoutDomainAvailableExtraFee"
            : availability.status === "premium"
              ? "checkoutDomainPremium"
              : availability.status === "unavailable"
                ? "checkoutDomainUnavailable"
                : "checkoutDomainCheckFailed",
    },
  }
}

/**
 * Check a bounded set of checkout candidates without changing the persisted
 * domain-order state. The caller must derive candidates from the customer
 * input and its approved phase; this helper only validates and deduplicates
 * them before issuing one provider batch request.
 */
export async function checkPreviewDomainOrders(
  run: SiteGenerationRun,
  domainInputs: string[],
  registrant?: DomainRegistrantDetails | null,
  options?: PreviewDomainOrderCheckOptions,
): Promise<PreviewDomainOrderResult[]> {
  const candidatesByDomain = new Map<string, NormalizedPreviewDomainOrderCandidate>()
  for (const domainInput of domainInputs) {
    const candidate = normalizePreviewDomainOrderCandidate(domainInput, options)
    candidatesByDomain.set(candidate.domain, candidate)
  }
  const candidates = [...candidatesByDomain.values()]
  if (candidates.length > MAX_PREVIEW_DOMAIN_ORDER_BATCH_SIZE) {
    throw new Error(`Checkout domain batch exceeds ${MAX_PREVIEW_DOMAIN_ORDER_BATCH_SIZE} domains.`)
  }
  if (candidates.length === 0) return []

  const candidateDomains = candidates.map((candidate) => candidate.domain)
  const availabilityResults = options?.forceFresh
    ? await checkOpenProviderDomainsAvailability(candidateDomains, { forceFresh: true })
    : await checkOpenProviderDomainsAvailability(candidateDomains)
  const availabilityByDomain = new Map<string, OpenProviderAvailabilityResult>()
  for (const availability of availabilityResults) {
    const normalized = normalizeDomain(availability.domain)
    if (normalized.ok) availabilityByDomain.set(normalized.domain, availability)
  }

  return candidates.map((candidate) => {
    const availability = availabilityByDomain.get(candidate.domain)
    if (!availability) {
      throw new Error(`OpenProvider returned no availability result for ${candidate.domain}.`)
    }
    const mapping = previewDomainOrderMapping(run, candidate, availability, registrant, options)
    return { run, ...mapping.result }
  })
}

export async function checkAndRecordPreviewDomainOrder(
  payload: Payload,
  run: SiteGenerationRun,
  domainInput: string,
  registrant?: DomainRegistrantDetails | null,
  options?: PreviewDomainOrderCheckOptions & {
    record?: boolean
  },
): Promise<PreviewDomainOrderResult> {
  const candidate = normalizePreviewDomainOrderCandidate(domainInput, options)
  const availability = options?.forceFresh
    ? await checkOpenProviderDomainAvailability(candidate.domain, { forceFresh: true })
    : await checkOpenProviderDomainAvailability(candidate.domain)
  const mapping = previewDomainOrderMapping(run, candidate, availability, registrant, options)

  const updated = options?.record === false
    ? run
    : await payload.update({
      collection: "site-generation-runs",
      id: run.id,
      data: { domainOrder: mapping.domainOrder },
      depth: 0,
      overrideAccess: true,
    }) as SiteGenerationRun

  return {
    run: updated,
    ...mapping.result,
  }
}

export async function requireReadyPreviewDomainOrder(
  payload: Payload,
  run: SiteGenerationRun,
  domainInput: string,
  registrant?: DomainRegistrantDetails | null,
  options?: { includedProviderPrice?: FixedDomainOrderPrice },
): Promise<{ run: SiteGenerationRun; domain: string }> {
  const normalized = normalizeDomain(domainInput)
  if (!normalized.ok) throw new Error(`Invalid domain: ${normalized.reason}`)
  const state = normalizeDomainOrderState(run.domainOrder)
  const result = await checkAndRecordPreviewDomainOrder(
    payload,
    run,
    normalized.domain,
    registrant,
    {
      ...options,
      requireProductionCapability: true,
      forceFresh: true,
    },
  )
  if (result.messageKey !== "checkoutDomainAvailable" && result.messageKey !== "checkoutDomainAvailableExtraFee") {
    throw new Error(result.messageKey)
  }
  if (state.status !== "ready_to_register" || state.domain !== normalized.domain) {
    return { run: result.run, domain: result.domain }
  }
  return { run: result.run, domain: normalized.domain }
}
