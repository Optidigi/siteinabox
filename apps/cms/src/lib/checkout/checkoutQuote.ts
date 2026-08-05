import "server-only"

import crypto from "node:crypto"
import {
  calculateDutchVatMinor,
  commercialAmountFromNet,
  getCommercialCatalog,
  LEGACY_ASSISTED_MIGRATION_CATALOG_VERSION,
  migrationClassificationAvailableForCheckout,
  type CommercialAmount,
  type MigrationClassification,
  calculateDomainSurchargeNetMinor,
} from "@siteinabox/contracts/commerce"
import type { MigrationSourceMechanism } from "@siteinabox/contracts/domain-migration"
import {
  GTLD_TRANSFER_ELIGIBILITY_DECLARATION_VERSION,
  tldCapabilityAt,
  tldUsesIcannTransferPolicy,
  type TransferRenewalEffect,
} from "@siteinabox/contracts/tld-capabilities"
import { CHECKOUT_QUOTE_SCHEMA_VERSION } from "@/lib/checkout/checkoutQuoteSchema"

export type CheckoutBillingPeriod = "monthly" | "annual"
export { CHECKOUT_QUOTE_SCHEMA_VERSION } from "@/lib/checkout/checkoutQuoteSchema"

export type CheckoutQuoteLineItem = {
  code: string
  description: string
  quantity: 1
  netAmountMinor: number
}

export type CheckoutQuote = CommercialAmount & {
  schemaVersion: typeof CHECKOUT_QUOTE_SCHEMA_VERSION
  catalogVersion: string
  packageCode: string
  billingPeriod: CheckoutBillingPeriod
  lineItems: CheckoutQuoteLineItem[]
  domainIncludedAllowanceNetMinor: number
  providerOperationPriceNetMinor: number
  domainSurchargeNetMinor: number
  migrationServiceFeeNetMinor: number
  migrationClassification: Exclude<MigrationClassification, "complex"> | null
  migrationSourceMechanism: MigrationSourceMechanism | null
  migrationSourceZoneHash: string | null
  migrationPublicEvidenceHash?: string | null
  gtldTransferEligibilityDeclarationVersion?: string | null
  gtldTransferEligibilityDeclarationText?: string | null
  gtldTransferEligibilityAccepted?: boolean
  migrationInputEnvelope: string | null
  migrationSecretKey: string | null
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
  transferRenewalEffect: TransferRenewalEffect | null
  domainRenewalExplanation: string
}

export type CheckoutQuoteEnvelope = {
  quote: CheckoutQuote
  token: string
}

export type CheckoutQuoteSet = Record<CheckoutBillingPeriod, CheckoutQuoteEnvelope>

const quoteTtlMs = 15 * 60 * 1_000

export type CheckoutQuoteInput = {
  catalogVersion?: string
  billingPeriod: CheckoutBillingPeriod
  providerOperationPriceNetMinor: number
  migrationClassification?: MigrationClassification | null
  migrationSourceMechanism?: MigrationSourceMechanism | null
  migrationSourceZoneHash?: string | null
  migrationPublicEvidenceHash?: string | null
  gtldTransferEligibilityDeclarationVersion?: string | null
  gtldTransferEligibilityDeclarationText?: string | null
  gtldTransferEligibilityAccepted?: boolean
  migrationInputEnvelope?: string | null
  migrationSecretKey?: string | null
  selectedDomain: string
  domainMode?: "new_registration" | "existing_domain"
  transferRenewalEffect?: TransferRenewalEffect | null
  providerQuotedAt: string
  profileVersion?: number
  draftVersion: string
  now?: Date
}

export function buildCheckoutQuote(input: CheckoutQuoteInput): CheckoutQuote {
  const catalog = getCommercialCatalog(input.catalogVersion)
  if (
    input.migrationClassification &&
    !migrationClassificationAvailableForCheckout(
      input.migrationClassification,
      catalog.catalogVersion,
    )
  ) {
    throw new Error("This migration classification is unavailable in ordinary checkout.")
  }
  if (input.migrationClassification === "complex") {
    throw new Error("Complex migrations are unavailable in ordinary checkout.")
  }
  const migrationSourceMechanism = input.migrationSourceMechanism ??
    (
      catalog.catalogVersion === LEGACY_ASSISTED_MIGRATION_CATALOG_VERSION &&
        input.migrationClassification
        ? "customer_authorized_provider_export_v1"
        : null
    )
  const domainMode = input.domainMode ?? "new_registration"
  const tld = input.selectedDomain.split(".").at(-1)?.toLowerCase() ?? ""
  const domainSurchargeNetMinor = input.domainMode !== "existing_domain"
    ? calculateDomainSurchargeNetMinor(tld, input.providerOperationPriceNetMinor, catalog.catalogVersion)
    : 0
  const transferRenewalEffect = domainMode === "existing_domain"
    ? input.transferRenewalEffect ??
      tldCapabilityAt(tld, new Date(input.providerQuotedAt))?.transfer.renewalEffect ??
      null
    : null
  if (domainMode === "existing_domain" && !transferRenewalEffect) {
    throw new Error("Existing-domain checkout requires governed transfer-renewal evidence.")
  }
  if (domainMode === "new_registration" && input.transferRenewalEffect != null) {
    throw new Error("New-domain checkout cannot contain transfer-renewal evidence.")
  }
  if (
    domainMode === "existing_domain" &&
    (
      !input.migrationClassification ||
      !migrationSourceMechanism ||
      !/^[a-f0-9]{64}$/.test(input.migrationSourceZoneHash ?? "") ||
      !/^[a-f0-9]{64}$/.test(input.migrationPublicEvidenceHash ?? "") ||
      (
        !input.migrationInputEnvelope &&
        !input.migrationSecretKey
      )
    )
  ) {
    throw new Error("Existing-domain checkout requires frozen migration input evidence.")
  }
  const gtldDeclarationRequired =
    domainMode === "existing_domain" && tldUsesIcannTransferPolicy(tld)
  if (
    gtldDeclarationRequired &&
    (
      input.gtldTransferEligibilityDeclarationVersion !==
        GTLD_TRANSFER_ELIGIBILITY_DECLARATION_VERSION ||
      !input.gtldTransferEligibilityDeclarationText?.trim() ||
      input.gtldTransferEligibilityAccepted !== true
    )
  ) {
    throw new Error(
      "gTLD transfer checkout requires immutable eligibility acceptance evidence.",
    )
  }
  if (
    !gtldDeclarationRequired &&
    (
      input.gtldTransferEligibilityDeclarationVersion ||
      input.gtldTransferEligibilityDeclarationText ||
      input.gtldTransferEligibilityAccepted
    )
  ) {
    throw new Error(
      "Transfer eligibility declaration evidence is not applicable to this order.",
    )
  }
  if (
    domainMode === "new_registration" &&
    (
      input.migrationClassification ||
      migrationSourceMechanism ||
      input.migrationSourceZoneHash ||
      input.migrationPublicEvidenceHash ||
      input.migrationInputEnvelope ||
      input.migrationSecretKey
    )
  ) {
    throw new Error("New-domain checkout cannot contain migration input evidence.")
  }
  const subscription = catalog.subscriptions[input.billingPeriod]

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
    schemaVersion: CHECKOUT_QUOTE_SCHEMA_VERSION,
    catalogVersion: catalog.catalogVersion,
    packageCode: subscription.code,
    billingPeriod: input.billingPeriod,
    lineItems,
    domainIncludedAllowanceNetMinor: 0,
    providerOperationPriceNetMinor: input.providerOperationPriceNetMinor,
    domainSurchargeNetMinor,
    migrationServiceFeeNetMinor: input.migrationClassification === "assisted_standard"
      ? catalog.migrations.assisted_standard.netAmountMinor
      : 0,
    migrationClassification: input.migrationClassification ?? null,
    migrationSourceMechanism,
    migrationSourceZoneHash: input.migrationSourceZoneHash ?? null,
    migrationPublicEvidenceHash: input.migrationPublicEvidenceHash ?? null,
    gtldTransferEligibilityDeclarationVersion:
      input.gtldTransferEligibilityDeclarationVersion ?? null,
    gtldTransferEligibilityDeclarationText:
      input.gtldTransferEligibilityDeclarationText ?? null,
    gtldTransferEligibilityAccepted:
      input.gtldTransferEligibilityAccepted === true,
    migrationInputEnvelope: input.migrationInputEnvelope ?? null,
    migrationSecretKey: input.migrationSecretKey ?? null,
    planPriceNetMinor: subscription.netAmountMinor,
    vatRateBasisPoints: 2_100,
    futureSubscriptionNetMinor: subscription.netAmountMinor,
    futureSubscriptionVatMinor,
    futureSubscriptionGrossMinor: subscription.netAmountMinor + futureSubscriptionVatMinor,
    selectedDomain: input.selectedDomain,
    domainMode,
    providerQuotedAt: input.providerQuotedAt,
    quoteIssuedAt: now.toISOString(),
    quoteExpiresAt: new Date(now.getTime() + quoteTtlMs).toISOString(),
    profileVersion: input.profileVersion ?? 0,
    draftVersion: input.draftVersion,
    transferRenewalEffect,
    domainRenewalExplanation: transferRenewalEffect === "unchanged"
      ? "De domeintransfer wijzigt de huidige verlengdatum niet. Toekomstige verlenging wordt afzonderlijk gedekt volgens de actuele providerprijs en veilige registrar-cutoff."
      : transferRenewalEffect === "extends_one_year"
        ? "De domeintransfer verlengt de registratie met één jaar. Een latere verlenging wordt afzonderlijk gedekt volgens de actuele providerprijs en veilige registrar-cutoff."
        : transferRenewalEffect === "restarts_from_transfer_date"
          ? "De domeintransfer start een nieuwe registratieperiode vanaf de transferdatum. Een latere verlenging wordt afzonderlijk gedekt volgens de actuele providerprijs en veilige registrar-cutoff."
          : transferRenewalEffect === "provider_determined"
            ? "De provider bepaalt het effect van de domeintransfer op de verlengdatum; dit wordt na de transfer gecontroleerd. Toekomstige verlenging wordt afzonderlijk gedekt volgens de actuele providerprijs en veilige registrar-cutoff."
            : "Domeinverlenging wordt afzonderlijk gedekt volgens de actuele providerprijs en veilige registrar-cutoff.",
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

export function issueCheckoutQuoteSet(
  input: Omit<CheckoutQuoteInput, "billingPeriod">,
  secret: string,
): CheckoutQuoteSet {
  const issue = (billingPeriod: CheckoutBillingPeriod) =>
    sealCheckoutQuote(buildCheckoutQuote({ ...input, billingPeriod }), secret)
  return {
    monthly: issue("monthly"),
    annual: issue("annual"),
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
    parsed.schemaVersion !== CHECKOUT_QUOTE_SCHEMA_VERSION ||
    parsed.currency !== "EUR" ||
    !parsed.selectedDomain ||
    !["monthly", "annual"].includes(parsed.billingPeriod) ||
    !["new_registration", "existing_domain"].includes(parsed.domainMode) ||
    (
      parsed.domainMode === "new_registration"
        ? parsed.transferRenewalEffect !== null
        : ![
            "unchanged",
            "extends_one_year",
            "restarts_from_transfer_date",
            "provider_determined",
          ].includes(parsed.transferRenewalEffect ?? "")
    ) ||
    !Number.isSafeInteger(parsed.grossAmountMinor)
  ) {
    throw new Error("Checkout quote token has invalid evidence.")
  }
  if (
    parsed.domainMode === "existing_domain" &&
    (
      !parsed.migrationClassification ||
      !parsed.migrationSourceMechanism ||
      !/^[a-f0-9]{64}$/.test(parsed.migrationSourceZoneHash ?? "") ||
      !/^[a-f0-9]{64}$/.test(parsed.migrationPublicEvidenceHash ?? "") ||
      (
        !parsed.migrationInputEnvelope &&
        !parsed.migrationSecretKey
      )
    )
  ) {
    throw new Error("Checkout quote token has incomplete migration evidence.")
  }
  const parsedTld = parsed.selectedDomain.split(".").at(-1)?.toLowerCase() ?? ""
  if (
    parsed.domainMode === "existing_domain" &&
    tldUsesIcannTransferPolicy(parsedTld) &&
    (
      parsed.gtldTransferEligibilityDeclarationVersion !==
        GTLD_TRANSFER_ELIGIBILITY_DECLARATION_VERSION ||
      !parsed.gtldTransferEligibilityDeclarationText?.trim() ||
      parsed.gtldTransferEligibilityAccepted !== true
    )
  ) {
    throw new Error("Checkout quote token has incomplete gTLD acceptance evidence.")
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
    "migrationClassification",
    "migrationSourceMechanism",
    "migrationSourceZoneHash",
    "migrationPublicEvidenceHash",
    "gtldTransferEligibilityDeclarationVersion",
    "gtldTransferEligibilityDeclarationText",
    "gtldTransferEligibilityAccepted",
    "migrationSecretKey",
    "netAmountMinor",
    "vatAmountMinor",
    "grossAmountMinor",
    "futureSubscriptionNetMinor",
    "futureSubscriptionVatMinor",
    "futureSubscriptionGrossMinor",
    "selectedDomain",
    "domainMode",
    "transferRenewalEffect",
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
