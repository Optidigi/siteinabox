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
  const amount = cleanText(env.OPENPROVIDER_DOMAIN_MAX_COST_AMOUNT) ?? "7.00"
  const currency = cleanText(env.OPENPROVIDER_DOMAIN_MAX_COST_CURRENCY) ?? "EUR"
  if (!/^\d+\.\d{2}$/.test(amount)) {
    throw new Error("OPENPROVIDER_DOMAIN_MAX_COST_AMOUNT must use decimal format, for example 7.00.")
  }
  return { amount, currency }
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
  }
}

export function fixedDomainOrderPriceFromEnv(env: NodeJS.ProcessEnv = process.env): FixedDomainOrderPrice {
  const amount = cleanText(env.OPENPROVIDER_DOMAIN_FIXED_PRICE_AMOUNT) ?? cleanText(env.MOLLIE_SITE_PAYMENT_AMOUNT)
  const currency = cleanText(env.OPENPROVIDER_DOMAIN_FIXED_PRICE_CURRENCY) ?? cleanText(env.MOLLIE_SITE_PAYMENT_CURRENCY) ?? "EUR"
  if (!amount) throw new Error("MOLLIE_SITE_PAYMENT_AMOUNT is required for domain orders.")
  if (!/^\d+\.\d{2}$/.test(amount)) {
    throw new Error("Domain order price must use decimal format, for example 228.00.")
  }
  return { amount, currency }
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
  }
}
