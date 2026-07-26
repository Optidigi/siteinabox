import {
  calculateDomainSurchargeNetMinor,
  commercialAmountFromNet,
  getCommercialCatalog,
  type CommercialAmount,
} from "@siteinabox/contracts/commerce"

export type CheckoutBillingPeriod = "monthly" | "annual"

export type CheckoutQuoteLineItem = {
  code: string
  description: string
  quantity: 1
  netAmountMinor: number
}

export type CheckoutQuote = CommercialAmount & {
  catalogVersion: string
  packageCode: string
  billingPeriod: CheckoutBillingPeriod
  lineItems: CheckoutQuoteLineItem[]
  domainIncludedAllowanceNetMinor: number
  providerOperationPriceNetMinor: number
  domainSurchargeNetMinor: number
}

export function buildCheckoutQuote(input: {
  billingPeriod: CheckoutBillingPeriod
  providerOperationPriceNetMinor: number
}): CheckoutQuote {
  const catalog = getCommercialCatalog()
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
  const amount = commercialAmountFromNet(
    lineItems.reduce((total, item) => total + item.netAmountMinor, 0),
  )
  return {
    catalogVersion: catalog.catalogVersion,
    packageCode: subscription.code,
    billingPeriod: input.billingPeriod,
    lineItems,
    domainIncludedAllowanceNetMinor: catalog.domain.includedAllowanceNetMinor,
    providerOperationPriceNetMinor: input.providerOperationPriceNetMinor,
    domainSurchargeNetMinor,
    ...amount,
  }
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
