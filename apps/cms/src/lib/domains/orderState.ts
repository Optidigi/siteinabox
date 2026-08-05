import "server-only"

export const domainOrderStatuses = [
  "not_started",
  "availability_checked",
  "unavailable",
  "premium",
  "ready_to_register",
  "registration_requested",
  "registered",
  "failed",
] as const

export type DomainOrderStatus = (typeof domainOrderStatuses)[number]

export type DomainOrderState = {
  status: DomainOrderStatus
  domain: string | null
  provider: "openprovider" | null
  fixedPriceAmount: string | null
  fixedPriceCurrency: string | null
  providerPriceAmount: string | null
  providerPriceCurrency: string | null
  providerReference: string | null
  reason: string | null
  checkedAt: string | null
  requestedAt: string | null
  registeredAt: string | null
  updatedAt: string | null
  registrant: DomainRegistrantDetails | null
  ownerHandle: string | null
  adminHandle: string | null
  maxProviderPriceAmount: string | null
  maxProviderPriceCurrency: string | null
  maxOfferPriceAmount: string | null
  maxOfferPriceCurrency: string | null
}

export type FixedDomainOrderPrice = {
  amount: string
  currency: string
}

export type DomainRegistrantDetails = {
  companyName: string | null
  firstName: string
  lastName: string
  email: string
  street: string
  number: string
  suffix: string | null
  zipcode: string
  city: string
  country: string
  state: string | null
  phoneCountryCode: string
  phoneAreaCode: string
  phoneSubscriberNumber: string
  locale: string
  euEligibilityBasis?: "establishment" | "residence" | "citizenship"
  euEligibilityCountry?: string
}

const isDomainOrderStatus = (value: unknown): value is DomainOrderStatus =>
  domainOrderStatuses.includes(value as DomainOrderStatus)

const cleanText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const cleanProvider = (value: unknown): "openprovider" | null =>
  value === "openprovider" ? "openprovider" : null

const readObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null

export function maxDomainProviderPriceFromEnv(env: NodeJS.ProcessEnv = process.env): FixedDomainOrderPrice {
  const amount = cleanText(env.OPENPROVIDER_DOMAIN_MAX_COST_AMOUNT) ?? "10.00"
  const currency = cleanText(env.OPENPROVIDER_DOMAIN_MAX_COST_CURRENCY) ?? "EUR"
  if (!/^\d+\.\d{2}$/.test(amount)) {
    throw new Error("OPENPROVIDER_DOMAIN_MAX_COST_AMOUNT must use decimal format, for example 10.00.")
  }
  return { amount, currency }
}

export function maxDomainOfferPriceFromEnv(env: NodeJS.ProcessEnv = process.env): FixedDomainOrderPrice {
  const amount = cleanText(env.OPENPROVIDER_DOMAIN_MAX_OFFER_AMOUNT) ?? "25.00"
  const currency = cleanText(env.OPENPROVIDER_DOMAIN_MAX_OFFER_CURRENCY) ?? cleanText(env.OPENPROVIDER_DOMAIN_MAX_COST_CURRENCY) ?? "EUR"
  if (!/^\d+\.\d{2}$/.test(amount)) {
    throw new Error("OPENPROVIDER_DOMAIN_MAX_OFFER_AMOUNT must use decimal format, for example 25.00.")
  }
  return { amount, currency }
}

const moneyToCents = (value: FixedDomainOrderPrice): number | null => {
  if (!/^\d+\.\d{2}$/.test(value.amount)) return null
  const cents = Math.round(Number(value.amount) * 100)
  return Number.isFinite(cents) ? cents : null
}

export function compareMoney(a: FixedDomainOrderPrice, b: FixedDomainOrderPrice): number | null {
  if (a.currency !== b.currency) return null
  const aCents = Math.round(Number(a.amount) * 100)
  const bCents = Math.round(Number(b.amount) * 100)
  if (!Number.isFinite(aCents) || !Number.isFinite(bCents)) return null
  return aCents - bCents
}

export function providerPriceWithinCap(providerPrice: FixedDomainOrderPrice | null, maxPrice: FixedDomainOrderPrice): boolean {
  if (!providerPrice) return false
  const comparison = compareMoney(providerPrice, maxPrice)
  return comparison !== null && comparison <= 0
}

import { calculateDomainSurchargeNetMinor, commercialAmountFromNet } from "@siteinabox/contracts/commerce"

export function isDomainPriceSupported(
  domain: string,
  providerPrice: FixedDomainOrderPrice,
): boolean {
  const tld = domain.split(".").pop() ?? ""
  const providerCents = moneyToCents(providerPrice)
  if (providerCents === null) return false
  try {
    const surcharge = calculateDomainSurchargeNetMinor(tld, providerCents)
    if (surcharge === 0 && !providerPriceWithinCap(providerPrice, maxDomainProviderPriceFromEnv())) {
      return false
    }
    return true
  } catch {
    return false
  }
}

export function domainExtraFeeForProviderPrice(
  domain: string,
  providerPrice: FixedDomainOrderPrice | null,
  includedPrice: FixedDomainOrderPrice,
): FixedDomainOrderPrice | null {
  if (!providerPrice || providerPrice.currency !== includedPrice.currency) return null
  const providerCents = moneyToCents(providerPrice)
  if (providerCents === null) return null
  
  const tld = domain.split(".").pop() ?? ""
  try {
    const netSurcharge = calculateDomainSurchargeNetMinor(tld, providerCents)
    if (netSurcharge === 0) return null
    const amount = commercialAmountFromNet(netSurcharge)
    return {
      amount: `${Math.floor(amount.grossAmountMinor / 100)}.${String(amount.grossAmountMinor % 100).padStart(2, "0")}`,
      currency: "EUR",
    }
  } catch {
    return null
  }
}

export function domainCheckoutPrice(input: {
  domain: string
  basePrice: FixedDomainOrderPrice
  providerPrice: FixedDomainOrderPrice | null
  includedProviderPrice: FixedDomainOrderPrice
}): FixedDomainOrderPrice {
  const extra = domainExtraFeeForProviderPrice(input.domain, input.providerPrice, input.includedProviderPrice)
  if (!extra) return input.basePrice
  if (extra.currency !== input.basePrice.currency) return input.basePrice
  const baseCents = moneyToCents(input.basePrice)
  const extraCents = moneyToCents(extra)
  if (baseCents === null || extraCents === null) return input.basePrice
  const totalCents = baseCents + extraCents
  return {
    amount: `${Math.floor(totalCents / 100)}.${String(totalCents % 100).padStart(2, "0")}`,
    currency: input.basePrice.currency,
  }
}

export function normalizeDomainRegistrantDetails(value: unknown): DomainRegistrantDetails | null {
  const source = readObject(value)
  if (!source) return null
  const required = {
    firstName: cleanText(source.firstName),
    lastName: cleanText(source.lastName),
    email: cleanText(source.email),
    street: cleanText(source.street),
    number: cleanText(source.number),
    zipcode: cleanText(source.zipcode),
    city: cleanText(source.city),
    country: cleanText(source.country),
    phoneCountryCode: cleanText(source.phoneCountryCode),
    phoneAreaCode: cleanText(source.phoneAreaCode),
    phoneSubscriberNumber: cleanText(source.phoneSubscriberNumber),
  }
  if (Object.values(required).some((entry) => !entry)) return null
  return {
    companyName: cleanText(source.companyName),
    firstName: required.firstName!,
    lastName: required.lastName!,
    email: required.email!.toLowerCase(),
    street: required.street!,
    number: required.number!,
    suffix: cleanText(source.suffix),
    zipcode: required.zipcode!,
    city: required.city!,
    country: required.country!.toUpperCase(),
    state: cleanText(source.state),
    phoneCountryCode: required.phoneCountryCode!,
    phoneAreaCode: required.phoneAreaCode!,
    phoneSubscriberNumber: required.phoneSubscriberNumber!,
    locale: cleanText(source.locale) ?? "nl_NL",
    euEligibilityBasis:
      source.euEligibilityBasis === "establishment" ||
      source.euEligibilityBasis === "residence" ||
      source.euEligibilityBasis === "citizenship"
        ? source.euEligibilityBasis
        : undefined,
    euEligibilityCountry:
      cleanText(source.euEligibilityCountry)?.toUpperCase(),
  }
}

export function normalizeDomainOrderState(value: unknown): DomainOrderState {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  return {
    status: isDomainOrderStatus(source.status) ? source.status : "not_started",
    domain: cleanText(source.domain),
    provider: cleanProvider(source.provider),
    fixedPriceAmount: cleanText(source.fixedPriceAmount),
    fixedPriceCurrency: cleanText(source.fixedPriceCurrency),
    providerPriceAmount: cleanText(source.providerPriceAmount),
    providerPriceCurrency: cleanText(source.providerPriceCurrency),
    providerReference: cleanText(source.providerReference),
    reason: cleanText(source.reason),
    checkedAt: cleanText(source.checkedAt),
    requestedAt: cleanText(source.requestedAt),
    registeredAt: cleanText(source.registeredAt),
    updatedAt: cleanText(source.updatedAt),
    registrant: normalizeDomainRegistrantDetails(source.registrant),
    ownerHandle: cleanText(source.ownerHandle),
    adminHandle: cleanText(source.adminHandle),
    maxProviderPriceAmount: cleanText(source.maxProviderPriceAmount),
    maxProviderPriceCurrency: cleanText(source.maxProviderPriceCurrency),
    maxOfferPriceAmount: cleanText(source.maxOfferPriceAmount),
    maxOfferPriceCurrency: cleanText(source.maxOfferPriceCurrency),
  }
}

export function createDomainOrderState(input: {
  status: DomainOrderStatus
  domain: string
  fixedPrice?: FixedDomainOrderPrice | null
  providerPrice?: FixedDomainOrderPrice | null
  providerReference?: string | null
  reason?: string | null
  now?: string
  registrant?: DomainRegistrantDetails | null
  ownerHandle?: string | null
  adminHandle?: string | null
  maxProviderPrice?: FixedDomainOrderPrice | null
  maxOfferPrice?: FixedDomainOrderPrice | null
}): DomainOrderState {
  const now = input.now ?? new Date().toISOString()
  return {
    status: input.status,
    domain: input.domain,
    provider: "openprovider",
    fixedPriceAmount: input.fixedPrice?.amount ?? null,
    fixedPriceCurrency: input.fixedPrice?.currency ?? null,
    providerPriceAmount: input.providerPrice?.amount ?? null,
    providerPriceCurrency: input.providerPrice?.currency ?? null,
    providerReference: cleanText(input.providerReference),
    reason: cleanText(input.reason),
    checkedAt: ["availability_checked", "unavailable", "premium", "ready_to_register"].includes(input.status) ? now : null,
    requestedAt: input.status === "registration_requested" ? now : null,
    registeredAt: input.status === "registered" ? now : null,
    updatedAt: now,
    registrant: input.registrant ?? null,
    ownerHandle: cleanText(input.ownerHandle),
    adminHandle: cleanText(input.adminHandle),
    maxProviderPriceAmount: input.maxProviderPrice?.amount ?? null,
    maxProviderPriceCurrency: input.maxProviderPrice?.currency ?? null,
    maxOfferPriceAmount: input.maxOfferPrice?.amount ?? null,
    maxOfferPriceCurrency: input.maxOfferPrice?.currency ?? null,
  }
}
