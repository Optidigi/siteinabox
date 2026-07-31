import type { MigrationSourceMechanism } from "@siteinabox/contracts/domain-migration"

import type { CustomerBillingAgreementView } from "@/lib/billing/customerBillingAgreement"
import type { CheckoutProfileView } from "@/lib/checkout/checkoutProfile"
import type { CheckoutQuoteSet } from "@/lib/checkout/checkoutQuote"
import type { CustomerMigrationStatus } from "@/lib/domains/migrationStatus"
import type { CustomerProvisioningStatus } from "@/lib/domains/provisioningStatus"

export type PreviewCheckoutDomainOption = {
  domain: string
  included: boolean
  extraFeeAmount: string | null
  extraFeeCurrency: string | null
  extraFeeLabel?: string | null
}

export type PreviewCheckoutActionState = {
  ok: boolean
  message: string
  status?: "idle" | "preflight_complete" | "release_pending" | "available" | "available_extra" | "unavailable" | "premium" | "invalid" | "service_error" | "payment_error" | "payment_pending" | "payment_complete" | "redirecting" | "profile_conflict" | "version_conflict"
  checkoutUrl?: string
  domain?: string
  included?: boolean
  extraFeeAmount?: string | null
  extraFeeCurrency?: string | null
  extraFeeLabel?: string | null
  totalPriceLabel?: string | null
  domainSurchargeNetMinor?: number
  quotes?: CheckoutQuoteSet
  requestToken?: string
  currentProfile?: CheckoutProfileView
  suggestions?: PreviewCheckoutDomainOption[]
  domainMode?: "new_registration" | "existing_domain"
  migrationReadiness?: "ready_automatic" | "unsupported"
  migrationClassification?: "automatic" | null
  migrationSourceMechanism?: MigrationSourceMechanism | null
  migrationPreflightOnly?: boolean
  migrationReleaseBlocked?: boolean
  migrationPublicEvidence?: {
    checkedAt: string
    authoritativeNameservers: string[]
    dnssecDsPresent: boolean
    dnssecDsRecords: string[]
    dnssecDsTtl: number | null
    probableDnsProvider: string | null
    registrar: string | null
    registryStatuses?: string[]
    registeredAt?: string | null
    lastTransferredAt?: string | null
    registryExpiryAt?: string | null
    registryTransferEvidence?: "confirmed" | "unavailable"
    transferBlockers?: string[]
    supplementalOnly: true
  } | null
}

export type PreviewCheckoutProfileActionState = {
  ok: boolean
  message: string
  status?: "idle" | "saved" | "conflict" | "invalid"
  requestToken?: string
  profile?: CheckoutProfileView
  currentProfile?: CheckoutProfileView
  fieldErrors?: Record<string, string>
  quotes?: CheckoutQuoteSet
}

export type PreviewCheckoutSuggestionsState = {
  ok: boolean
  domain?: string
  suggestions?: PreviewCheckoutDomainOption[]
  cursor?: number
  done?: boolean
}

export type MigrationCustomerActionState = {
  ok: boolean
  status:
    | "idle"
    | "saved"
    | "invalid_input"
    | "refresh_required"
    | "retryable_service_error"
  message: string
}

export type PreviewCheckoutCancellationState = {
  ok: boolean
  status: "idle" | "scheduled" | "unavailable" | "failed"
  message: string
  agreement?: CustomerBillingAgreementView | null
}

export type PreviewCheckoutLiveStatus = {
  paymentStatus: string
  migrationStatus: CustomerMigrationStatus | null
  provisioningStatus: CustomerProvisioningStatus | null
  billingAgreement: CustomerBillingAgreementView | null
}
