import "server-only"

import type { Payload } from "payload"
import type { Order } from "@/payload-types"
import {
  buildCheckoutQuote,
  sameCommercialCheckoutQuote,
  sealCheckoutQuote,
  type CheckoutQuote,
  type CheckoutQuoteSet,
} from "@/lib/checkout/checkoutQuote"
import {
  attachMigrationCheckoutSecret,
  openAttachedMigrationCheckoutSecret,
} from "@/lib/domains/migrationCheckoutSecret"

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

const stableStringify = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }
  const source = value as Record<string, unknown>
  return `{${Object.keys(source).sort().map(
    (key) => `${JSON.stringify(key)}:${stableStringify(source[key])}`,
  ).join(",")}}`
}

export const sameAcceptedCheckoutAuthority = (
  left: CheckoutQuote,
  right: CheckoutQuote,
): boolean => {
  const nonvolatile = (quote: CheckoutQuote) =>
    Object.fromEntries(Object.entries(quote).filter(
      ([key]) =>
        key !== "quoteIssuedAt" &&
        key !== "quoteExpiresAt" &&
        key !== "migrationInputEnvelope",
    ))
  return stableStringify(nonvolatile(left)) ===
    stableStringify(nonvolatile(right))
}

const text = (source: Record<string, unknown>, key: string): string => {
  const value = source[key]
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Accepted checkout evidence is missing ${key}.`)
  }
  return value
}

const integer = (source: Record<string, unknown>, key: string): number => {
  const value = source[key]
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`Accepted checkout evidence has invalid ${key}.`)
  }
  return Number(value)
}

const resumeQuote = (
  order: Order,
  now: Date,
): CheckoutQuote => {
  const evidence = record(order.quoteEvidence)
  if (
    !evidence ||
    evidence.schemaVersion !== 3 ||
    !["monthly", "annual"].includes(String(order.billingPeriod)) ||
    order.currency !== "EUR"
  ) {
    throw new Error("Accepted checkout order has no resumable quote authority.")
  }
  const domainMode = evidence.domainMode
  if (domainMode !== "new_registration" && domainMode !== "existing_domain") {
    throw new Error("Accepted checkout order has an invalid domain mode.")
  }
  const migration = record(evidence.migration)
  const migrationClassification = migration?.classification === "automatic" ||
    migration?.classification === "assisted_standard"
    ? migration.classification
    : null
  const migrationSourceZoneHash = typeof migration?.sourceZoneHash === "string"
    ? migration.sourceZoneHash
    : null
  const migrationSourceMechanism =
    migration?.sourceMechanism === "customer_authorized_provider_export_v1" ||
      migration?.sourceMechanism === "cloudflare_api_v1" ||
      migration?.sourceMechanism === "authorized_axfr_v1" ||
      migration?.sourceMechanism === "validated_provider_export_v1"
      ? migration.sourceMechanism
      : null
  const migrationInputEnvelope = null
  const storedLineItems = Array.isArray(order.netLineItems)
    ? order.netLineItems
    : []
  const lineItems = storedLineItems.flatMap((line) => {
        const item = record(line)
        if (
          typeof item?.code !== "string" ||
          typeof item.description !== "string" ||
          item.quantity !== 1 ||
          !Number.isSafeInteger(item.netAmountMinor)
        ) {
          return []
        }
        return [{
          code: item.code,
          description: item.description,
          quantity: 1 as const,
          netAmountMinor: Number(item.netAmountMinor),
        }]
      })
  if (lineItems.length !== storedLineItems.length) {
    throw new Error("Accepted checkout order has invalid line-item evidence.")
  }
  const quote: CheckoutQuote = {
    schemaVersion: 3,
    catalogVersion: text(evidence, "catalogVersion"),
    packageCode: String(order.packageCode),
    billingPeriod: order.billingPeriod as "monthly" | "annual",
    lineItems,
    domainIncludedAllowanceNetMinor:
      integer(evidence, "domainIncludedAllowanceNetMinor"),
    providerOperationPriceNetMinor:
      integer(evidence, "providerOperationPriceNetMinor"),
    domainSurchargeNetMinor: integer(evidence, "domainSurchargeNetMinor"),
    migrationServiceFeeNetMinor:
      integer(evidence, "migrationServiceFeeNetMinor"),
    migrationClassification,
    migrationSourceMechanism,
    migrationSourceZoneHash,
    migrationInputEnvelope,
    migrationSecretKey: typeof migration?.checkoutSecretKey === "string"
      ? migration.checkoutSecretKey
      : null,
    planPriceNetMinor: integer(evidence, "planPriceNetMinor"),
    vatRateBasisPoints: 2_100,
    futureSubscriptionNetMinor:
      integer(evidence, "futureSubscriptionNetMinor"),
    futureSubscriptionVatMinor:
      integer(evidence, "futureSubscriptionVatMinor"),
    futureSubscriptionGrossMinor:
      integer(evidence, "futureSubscriptionGrossMinor"),
    selectedDomain: text(evidence, "selectedDomain"),
    domainMode,
    providerQuotedAt: text(evidence, "providerQuotedAt"),
    quoteIssuedAt: now.toISOString(),
    quoteExpiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    profileVersion: integer(evidence, "profileVersion"),
    draftVersion: text(evidence, "draftVersion"),
    domainRenewalExplanation: text(evidence, "domainRenewalExplanation"),
    currency: "EUR",
    netAmountMinor: integer(evidence, "subtotalNetMinor"),
    vatAmountMinor: integer(evidence, "vatAmountMinor"),
    grossAmountMinor: integer(evidence, "grossPayableNowMinor"),
  }
  const recalculated = buildCheckoutQuote({
    catalogVersion: quote.catalogVersion,
    billingPeriod: quote.billingPeriod,
    providerOperationPriceNetMinor: quote.providerOperationPriceNetMinor,
    migrationClassification: quote.migrationClassification,
    migrationSourceMechanism: quote.migrationSourceMechanism,
    migrationSourceZoneHash: quote.migrationSourceZoneHash,
    migrationInputEnvelope: quote.migrationInputEnvelope,
    migrationSecretKey: quote.migrationSecretKey,
    selectedDomain: quote.selectedDomain,
    domainMode: quote.domainMode,
    providerQuotedAt: quote.providerQuotedAt,
    profileVersion: quote.profileVersion,
    draftVersion: quote.draftVersion,
    now,
  })
  if (
    !sameCommercialCheckoutQuote(quote, recalculated) ||
    quote.lineItems.length !== recalculated.lineItems.length ||
    quote.lineItems.some((line, index) => {
      const current = recalculated.lineItems[index]
      return !current ||
        line.code !== current.code ||
        line.quantity !== current.quantity ||
        line.netAmountMinor !== current.netAmountMinor
    })
  ) {
    throw new Error("Accepted checkout order no longer matches its catalog authority.")
  }
  return quote
}

export type AcceptedCheckoutResume = {
  orderId: string | number
  domain: string
  billingPeriod: "monthly" | "annual"
  quotes: CheckoutQuoteSet
  requiresMigrationRecollection: boolean
  tldCapabilityVersion: string | null
}

export async function loadAcceptedCheckoutResume(
  payload: Payload,
  input: {
    generationRunId: string | number
    customerEmail: string
    signingSecret: string
    now?: Date
  },
): Promise<AcceptedCheckoutResume | null> {
  const customerEmail = input.customerEmail.trim().toLowerCase()
  if (!customerEmail || !input.signingSecret) return null
  const result = await payload.find({
    collection: "orders",
    where: {
      and: [
        { generationRun: { equals: input.generationRunId } },
        { orderKind: { equals: "initial_subscription" } },
        { customerEmail: { equals: customerEmail } },
      ],
    },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (result.docs.length !== 1) return null
  const order = result.docs[0] as Order
  if (
    !["pending", "open", "failed", "cancelled", "expired"].includes(
      order.paymentStatus,
    ) ||
    order.state === "fulfilled" ||
    order.state === "cancelled"
  ) {
    return null
  }
  const quote = resumeQuote(order, input.now ?? new Date())
  const quoteEvidence = record(order.quoteEvidence)
  const tldCapability = record(quoteEvidence?.tldCapability)
  const tldCapabilityVersion = typeof tldCapability?.capabilityVersion === "string"
    ? tldCapability.capabilityVersion
    : null
  if (
    quote.domainMode === "existing_domain" &&
    (
      !tldCapabilityVersion ||
      tldCapability?.tld !== quote.selectedDomain.split(".").at(-1)?.toLowerCase()
    )
  ) {
    throw new Error(
      "Accepted existing-domain order is missing frozen TLD capability evidence.",
    )
  }
  let requiresMigrationRecollection = false
  if (quote.domainMode === "existing_domain") {
    try {
      // Recover the narrow crash window after immutable order creation and
      // before the pending secret was attached. The order lookup above proves
      // the customer/run authority before this idempotent claim.
      await attachMigrationCheckoutSecret(payload, {
        secretKey: quote.migrationSecretKey!,
        orderId: order.id,
        generationRunId: input.generationRunId,
        domain: quote.selectedDomain,
        sourceZoneHash: quote.migrationSourceZoneHash!,
        now: input.now,
      })
      await openAttachedMigrationCheckoutSecret(payload, {
        secretKey: quote.migrationSecretKey!,
        orderId: order.id,
        generationRunId: input.generationRunId,
        domain: quote.selectedDomain,
        sourceZoneHash: quote.migrationSourceZoneHash!,
        now: input.now,
      })
    } catch {
      requiresMigrationRecollection = true
    }
  }
  const envelope = sealCheckoutQuote(quote, input.signingSecret)
  return {
    orderId: order.id,
    domain: quote.selectedDomain,
    billingPeriod: quote.billingPeriod,
    quotes: {
      monthly: envelope,
      annual: envelope,
    },
    requiresMigrationRecollection,
    tldCapabilityVersion,
  }
}
