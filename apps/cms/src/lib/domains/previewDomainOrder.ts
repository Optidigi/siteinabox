import "server-only"
import type { Payload } from "payload"
import type { SiteGenerationRun } from "@/payload-types"
import {
  createDomainOrderState,
  fixedDomainOrderPriceFromEnv,
  maxDomainProviderPriceFromEnv,
  normalizeDomainOrderState,
  providerPriceWithinCap,
  type DomainRegistrantDetails,
} from "@/lib/domains/orderState"
import { checkOpenProviderDomainAvailability } from "@/lib/domains/openprovider"
import { normalizeDomain } from "@/lib/domains/normalize"

export type PreviewDomainOrderResult = {
  run: SiteGenerationRun
  messageKey:
    | "checkoutDomainAvailable"
    | "checkoutDomainUnavailable"
    | "checkoutDomainPremium"
    | "checkoutDomainCheckFailed"
    | "checkoutDomainTooExpensive"
  domain: string
}

export function selectedDomainForCheckout(run: Pick<SiteGenerationRun, "domainOrder">): string | null {
  const state = normalizeDomainOrderState(run.domainOrder)
  return state.status === "ready_to_register" && state.domain ? state.domain : null
}

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
  const maxProviderPrice = maxDomainProviderPriceFromEnv()
  const availability = await checkOpenProviderDomainAvailability(normalized.domain)
  const now = new Date().toISOString()
  const providerPrice = availability.price
    ? { amount: availability.price.amount, currency: availability.price.currency }
    : null
  const allowedPrice = availability.status === "available" && providerPriceWithinCap(providerPrice, maxProviderPrice)
  const status = allowedPrice
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
    maxProviderPrice,
    registrant: registrant ?? normalizeDomainOrderState(run.domainOrder).registrant,
    reason: availability.internalReason ?? (availability.status === "available" && !allowedPrice ? "domain_cost_above_limit" : null),
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
    messageKey: allowedPrice
      ? "checkoutDomainAvailable"
      : availability.status === "premium"
        ? "checkoutDomainPremium"
        : availability.status === "unavailable"
          ? "checkoutDomainUnavailable"
          : availability.status === "available"
            ? "checkoutDomainTooExpensive"
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
    if (result.messageKey !== "checkoutDomainAvailable") {
      throw new Error(result.messageKey)
    }
    return { run: result.run, domain: result.domain }
  }
  const existingRegistrant = state.registrant
  if (!existingRegistrant && registrant) {
    const result = await checkAndRecordPreviewDomainOrder(payload, run, normalized.domain, registrant)
    return { run: result.run, domain: result.domain }
  }
  return { run, domain: normalized.domain }
}
