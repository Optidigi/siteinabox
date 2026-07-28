import "server-only"

import crypto from "node:crypto"
import {
  calculateDutchVatMinor,
  calculateDomainSurchargeNetMinor,
  commercialAmountFromNet,
  getCommercialCatalog,
  type CommercialAmount,
  type MigrationClassification,
} from "@siteinabox/contracts/commerce"

export type CheckoutBillingPeriod = "monthly" | "annual"

export type CheckoutQuoteLineItem = {
  code: string
  description: string
  quantity: 1
  netAmountMinor: number
}

export type CheckoutQuote = CommercialAmount & {
  schemaVersion: 2
  catalogVersion: string
  packageCode: string
  billingPeriod: CheckoutBillingPeriod
  lineItems: CheckoutQuoteLineItem[]
  domainIncludedAllowanceNetMinor: number
  providerOperationPriceNetMinor: number
  domainSurchargeNetMinor: number
  migrationServiceFeeNetMinor: number
  migrationClassification: Exclude<MigrationClassification, "complex"> | null
  planPriceNetMinor: number
  vatRateBasisPoints: 2_100
  futureSubscriptionNetMinor: number
  futureSubscriptionVatMinor: number
  futureSubscriptionGrossMinor: number
  selectedDomain: string
  domainMode: "new_registration" | "existing_domain"
  providerQuotedAt: string
  quoteIssuedAt: string
  quoteExpiresAt: string
  profileVersion: number
  draftVersion: string
  domainRenewalExplanation: string
}

export type CheckoutQuoteEnvelope = {
  quote: CheckoutQuote
  token: string
}

export type CheckoutQuoteSet = Record<CheckoutBillingPeriod, CheckoutQuoteEnvelope>

const quoteTtlMs = 15 * 60 * 1_000

export function buildCheckoutQuote(input: {
  billingPeriod: CheckoutBillingPeriod
  providerOperationPriceNetMinor: number
  migrationClassification?: MigrationClassification | null
  selectedDomain: string
  domainMode?: "new_registration" | "existing_domain"
  providerQuotedAt: string
  profileVersion?: number
  draftVersion: string
  now?: Date
}): CheckoutQuote {
  const catalog = getCommercialCatalog()
  if (input.migrationClassification === "complex") {
    throw new Error("Complex migrations require a custom quote and cannot enter ordinary checkout.")
  }
  const subscription = catalog.subscriptions[input.billingPeriod]
  const domainSurchargeNetMinor = calculateDomainSurchargeNetMinor(
    input.providerOperationPriceNetMinor,
  )
  const lineItems: CheckoutQuoteLineItem[] = [{
    code: subscription.code,
    description: input.billingPeriod === "annual"
      ? "Siteinabox jaarabonnement"
      : "Siteinabox maandabonnement",
    quantity: 1,
    netAmountMinor: subscription.netAmountMinor,
  }]
  if (domainSurchargeNetMinor > 0) {
    lineItems.push({
      code: "domain-operation-surcharge",
      description: "Domeintoelage boven inbegrepen domeinbudget",
      quantity: 1,
      netAmountMinor: domainSurchargeNetMinor,
    })
  }
  if (input.migrationClassification === "assisted_standard") {
    lineItems.push({
      code: "migration-assisted-standard-per-domain",
      description: "Standaard begeleide domeinmigratie",
      quantity: 1,
      netAmountMinor: catalog.migrations.assisted_standard.netAmountMinor,
    })
  }
  const amount = commercialAmountFromNet(
    lineItems.reduce((total, item) => total + item.netAmountMinor, 0),
  )
  const now = input.now ?? new Date()
  const futureSubscriptionVatMinor = calculateDutchVatMinor(subscription.netAmountMinor)
  return {
    schemaVersion: 2,
    catalogVersion: catalog.catalogVersion,
    packageCode: subscription.code,
    billingPeriod: input.billingPeriod,
    lineItems,
    domainIncludedAllowanceNetMinor: catalog.domain.includedAllowanceNetMinor,
    providerOperationPriceNetMinor: input.providerOperationPriceNetMinor,
    domainSurchargeNetMinor,
    migrationServiceFeeNetMinor: input.migrationClassification === "assisted_standard"
      ? catalog.migrations.assisted_standard.netAmountMinor
      : 0,
    migrationClassification: input.migrationClassification ?? null,
    planPriceNetMinor: subscription.netAmountMinor,
    vatRateBasisPoints: 2_100,
    futureSubscriptionNetMinor: subscription.netAmountMinor,
    futureSubscriptionVatMinor,
    futureSubscriptionGrossMinor: subscription.netAmountMinor + futureSubscriptionVatMinor,
    selectedDomain: input.selectedDomain,
    domainMode: input.domainMode ?? "new_registration",
    providerQuotedAt: input.providerQuotedAt,
    quoteIssuedAt: now.toISOString(),
    quoteExpiresAt: new Date(now.getTime() + quoteTtlMs).toISOString(),
    profileVersion: input.profileVersion ?? 0,
    draftVersion: input.draftVersion,
    domainRenewalExplanation:
      "Domeinverlenging wordt afzonderlijk gedekt volgens de actuele providerprijs en veilige registrar-cutoff.",
    ...amount,
  }
}

const quoteSignature = (encoded: string, secret: string): string =>
  crypto.createHmac("sha256", secret).update(encoded).digest("base64url")

export function sealCheckoutQuote(quote: CheckoutQuote, secret: string): CheckoutQuoteEnvelope {
  if (!secret) throw new Error("Checkout quote signing secret is required.")
  const encoded = Buffer.from(JSON.stringify(quote)).toString("base64url")
  return {
    quote,
    token: `${encoded}.${quoteSignature(encoded, secret)}`,
  }
}

export function openCheckoutQuote(
  token: string,
  secret: string,
  now = new Date(),
): CheckoutQuote {
  if (!secret) throw new Error("Checkout quote signing secret is required.")
  const [encoded, received, extra] = token.split(".")
  if (!encoded || !received || extra) throw new Error("Checkout quote token is malformed.")
  const expected = quoteSignature(encoded, secret)
  const expectedBytes = Buffer.from(expected)
  const receivedBytes = Buffer.from(received)
  if (
    expectedBytes.length !== receivedBytes.length ||
    !crypto.timingSafeEqual(expectedBytes, receivedBytes)
  ) {
    throw new Error("Checkout quote token is invalid.")
  }
  const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CheckoutQuote
  if (
    parsed.schemaVersion !== 2 ||
    parsed.currency !== "EUR" ||
    !parsed.selectedDomain ||
    !["monthly", "annual"].includes(parsed.billingPeriod) ||
    !Number.isSafeInteger(parsed.grossAmountMinor)
  ) {
    throw new Error("Checkout quote token has invalid evidence.")
  }
  const expiresAt = Date.parse(parsed.quoteExpiresAt)
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    throw new Error("Checkout quote has expired.")
  }
  return parsed
}

export function sameCommercialCheckoutQuote(
  accepted: CheckoutQuote,
  current: CheckoutQuote,
): boolean {
  const fields = [
    "catalogVersion",
    "packageCode",
    "billingPeriod",
    "currency",
    "planPriceNetMinor",
    "providerOperationPriceNetMinor",
    "domainIncludedAllowanceNetMinor",
    "domainSurchargeNetMinor",
    "migrationServiceFeeNetMinor",
    "netAmountMinor",
    "vatAmountMinor",
    "grossAmountMinor",
    "futureSubscriptionNetMinor",
    "futureSubscriptionVatMinor",
    "futureSubscriptionGrossMinor",
    "selectedDomain",
    "domainMode",
  ] as const
  return fields.every((field) => accepted[field] === current[field])
}

export function decimalMoneyToMinor(value: string | null | undefined): number {
  if (!value || !/^\d+\.\d{2}$/.test(value)) {
    throw new Error("Provider price must use a decimal amount with two digits.")
  }
  const [whole, fraction] = value.split(".")
  const minor = Number(whole) * 100 + Number(fraction)
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new Error("Provider price must be a non-negative safe minor amount.")
  }
  return minor
}
