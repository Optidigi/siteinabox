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
  loginOpenProvider,
  suggestOpenProviderDomains,
} from "@/lib/domains/openprovider"
import { normalizeDomain } from "@/lib/domains/normalize"

export type PreviewDomainSuggestion = {
  domain: string
  included: boolean
  extraFeeAmount: string | null
  extraFeeCurrency: string | null
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

const suggestionSuffixes = ["site", "online", "web", "studio", "hq", "groep"]
const splitSuffixes = ["web", "site", "online", "studio", "zorg", "care", "groep", "hq"]

const suggestionCandidates = (domain: string): string[] => {
  const normalized = normalizeDomain(domain)
  if (!normalized.ok) return []
  const [name, extension] = [normalized.name, normalized.extension]
  const compactName = name.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  if (!compactName) return []

  const candidates = new Set<string>()
  for (const suffix of splitSuffixes) {
    if (compactName.endsWith(suffix) && compactName.length > suffix.length + 2) {
      candidates.add(`${compactName.slice(0, -suffix.length)}-${suffix}.${extension}`)
    }
  }
  for (const suffix of suggestionSuffixes) {
    candidates.add(`${compactName}${suffix}.${extension}`)
    candidates.add(`${compactName}-${suffix}.${extension}`)
  }
  return [...candidates].filter((candidate) => candidate !== normalized.domain).slice(0, 16)
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

async function suggestAvailableDomains(
  domain: string,
  includedProviderPrice: ReturnType<typeof maxDomainProviderPriceFromEnv>,
  token: string,
): Promise<PreviewDomainSuggestion[]> {
  const normalized = normalizeDomain(domain)
  const suggestions: PreviewDomainSuggestion[] = []
  const checkedCandidates = new Set<string>()
  const appendAvailableCandidates = async (candidates: string[]): Promise<void> => {
    const uncheckedCandidates = candidates.filter((candidate) => {
      if (checkedCandidates.has(candidate)) return false
      checkedCandidates.add(candidate)
      return true
    })
    if (uncheckedCandidates.length === 0 || suggestions.length >= 5) return
    const availabilityResults = await checkOpenProviderDomainsAvailability(uncheckedCandidates, { token })
    for (const availability of availabilityResults) {
      const providerPrice = availability.price
        ? { amount: availability.price.amount, currency: availability.price.currency }
        : null
      if (availability.status === "available" && providerPriceIsUsable(providerPrice, includedProviderPrice)) {
        suggestions.push(suggestionForAvailability(availability.domain, providerPrice, includedProviderPrice))
      }
      if (suggestions.length >= 5) break
    }
  }

  try {
    const providerCandidatesPromise = suggestOpenProviderDomains(domain, { token, limit: 12 })
      .then((providerSuggestions) => providerSuggestions.map((suggestion) => suggestion.domain))
      .catch(() => [])

    await appendAvailableCandidates(suggestionCandidates(domain))
    if (suggestions.length >= 5) return suggestions

    const providerCandidates = await providerCandidatesPromise
    await appendAvailableCandidates(providerCandidates.filter((candidate) => {
      const candidateDomain = normalizeDomain(candidate)
      return candidateDomain.ok && normalized.ok && candidateDomain.extension === normalized.extension
    }))
    return suggestions
  } catch {
    // Suggestions are optional; the primary domain check result remains authoritative.
    return suggestions
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
): Promise<PreviewDomainOrderResult> {
  const normalized = normalizeDomain(domainInput)
  if (!normalized.ok) {
    throw new Error(`Invalid domain: ${normalized.reason}`)
  }

  const fixedPrice = fixedDomainOrderPriceFromEnv()
  const includedProviderPrice = maxDomainProviderPriceFromEnv()
  const token = await loginOpenProvider()
  const availability = await checkOpenProviderDomainAvailability(normalized.domain, { token })
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

  const updated = await payload.update({
    collection: "site-generation-runs",
    id: run.id,
    data: { domainOrder } as any,
    depth: 0,
    overrideAccess: true,
  }) as SiteGenerationRun

  return {
    run: updated,
    domain: normalized.domain,
    included: includedPrice,
    extraFeeAmount: extraFee?.amount ?? null,
    extraFeeCurrency: extraFee?.currency ?? null,
    suggestions: priceUsable ? [] : await suggestAvailableDomains(normalized.domain, includedProviderPrice, token),
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
  if (state.status !== "ready_to_register" || state.domain !== normalized.domain) {
    const result = await checkAndRecordPreviewDomainOrder(payload, run, normalized.domain, registrant)
    if (result.messageKey !== "checkoutDomainAvailable" && result.messageKey !== "checkoutDomainAvailableExtraFee") {
      throw new Error(result.messageKey)
    }
    return { run: result.run, domain: result.domain }
  }
  const existingRegistrant = state.registrant
  if (registrant && JSON.stringify(existingRegistrant) !== JSON.stringify(registrant)) {
    const updated = await payload.update({
      collection: "site-generation-runs",
      id: run.id,
      data: {
        domainOrder: {
          ...state,
          registrant,
          updatedAt: new Date().toISOString(),
        },
      } as any,
      depth: 0,
      overrideAccess: true,
    }) as SiteGenerationRun
    return { run: updated, domain: normalized.domain }
  }
  return { run, domain: normalized.domain }
}
