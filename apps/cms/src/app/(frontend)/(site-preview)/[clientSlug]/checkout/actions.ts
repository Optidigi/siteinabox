"use server"

import crypto from "node:crypto"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { getLocale, getTranslations } from "next-intl/server"
import {
  BUSINESS_USE_DECLARATION_VERSION,
  getCurrentLegalDocument,
} from "@siteinabox/legal-content"
import {
  COMMERCIAL_CATALOG,
  COMMERCIAL_CATALOG_VERSION,
} from "@siteinabox/contracts/commerce"
import {
  GTLD_TRANSFER_ELIGIBILITY_DECLARATION_VERSION,
  getTldCapabilityForProductionOperation,
  isEuRegistryEligibilityCountry,
  tldCapabilityAt,
} from "@siteinabox/contracts/tld-capabilities"
import type { CheckoutProfile } from "@/payload-types"
import {
  checkoutProfileDraftFromFormData,
  checkoutProfileView,
  domainRegistrantFromCheckoutProfile,
  loadLatestCheckoutProfile,
  saveCheckoutProfileVersion,
} from "@/lib/checkout/checkoutProfile"
import {
  buildCheckoutQuote,
  decimalMoneyToMinor,
  openCheckoutQuote,
  sameCommercialCheckoutQuote,
  sealCheckoutQuote,
  type CheckoutBillingPeriod,
  type CheckoutQuoteSet,
} from "@/lib/checkout/checkoutQuote"
import {
  loadAcceptedCheckoutResume,
  sameAcceptedCheckoutAuthority,
} from "@/lib/checkout/acceptedCheckoutResume"
import { checkAndRecordPreviewDomainOrder, requireReadyPreviewDomainOrder, suggestAvailablePreviewDomainBatch } from "@/lib/domains/previewDomainOrder"
import {
  assessExistingDomainMigrationInput,
  automaticMigrationSourceEnabled,
  existingDomainPublicEvidenceHash,
  existingDomainMigrationCheckoutEnabled,
  gtldTransferEligibilityDeclarationRequired,
  inspectExistingDomainPublicEvidence,
  type ExistingDomainPublicEvidence,
} from "@/lib/domains/migrationCheckout"
import {
  getOpenProviderDomainTransferPrice,
} from "@/lib/domains/openprovider"
import { acquireAuthorizedAxfr } from "@/lib/domains/migrationSources/axfr"
import type { AcquiredMigrationSource } from "@/lib/domains/migrationSources/types"
import {
  attachCloudflareSourceAuthorization,
  loadCloudflareSourceAuthorization,
  type CloudflareSourceAuthorizationRecord,
} from "@/lib/domains/cloudflareSourceOAuth"
import {
  acquireValidatedProviderExport,
} from "@/lib/domains/migrationSources/providerExport"
import type { MigrationSourceMechanism } from "@siteinabox/contracts/domain-migration"
import {
  buildAutomaticSourceRefreshAuthority,
  openCheckoutMigrationInput,
} from "@/lib/domains/migrationSecrets"
import {
  attachMigrationCheckoutSecret,
  migrationCheckoutSecretKey,
  openAttachedMigrationCheckoutSecret,
  persistMigrationCheckoutSecret,
  replaceExpiredAttachedMigrationCheckoutSecret,
} from "@/lib/domains/migrationCheckoutSecret"
import { commerceProviderReadsAllowed } from "@/lib/commerce/releaseGate"
import {
  normalizeDomainOrderState,
  type FixedDomainOrderPrice,
} from "@/lib/domains/orderState"
import { normalizeDomain } from "@/lib/domains/normalize"
import { createOrderAndAcceptanceEvidence, createSiteApprovalEvidence } from "@/lib/legal/checkoutEvidence"
import { satisfyRequirementsFromTransaction } from "@/lib/legal/customerRequirements"
import { createMollieCheckoutForGenerationRun } from "@/lib/payments/molliePayments"
import { MollieApiError } from "@/lib/payments/mollieAdapter"
import { normalizeGenerationRunPaymentState } from "@/lib/payments/generationRunPayment"
import { logPreviewCheckoutTiming, startPreviewCheckoutTimer } from "@/lib/preview/domainCheckoutTiming"
import {
  requirePreviewCheckoutActorContext,
  requirePreviewCheckoutContext,
} from "./previewCheckoutContext"
import { PREVIEW_HOST } from "@/lib/preview/previewHost"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import {
  acquireAutomaticMigrationInputs,
  DomainMigrationCustomerInputError,
  replaceMigrationSourceRefreshAuthority,
  replaceMigrationTransferAuthorization,
} from "@/lib/domains/migration"
import { domainMigrationSourceAuthorityHash } from
  "@/lib/domains/migrationEvidence"
import {
  loadCustomerBillingAgreement,
  type CustomerBillingAgreementView,
} from "@/lib/billing/customerBillingAgreement"
import { scheduleCancellationAtPeriodEnd } from "@/lib/billing/billingLifecycle"
import {
  loadCustomerMigrationStatus,
} from "@/lib/domains/migrationStatus"
import {
  loadCustomerProvisioningStatus,
} from "@/lib/domains/provisioningStatus"
import type {
  MigrationCustomerActionState,
  PreviewCheckoutActionState,
  PreviewCheckoutCancellationState,
  PreviewCheckoutDomainOption,
  PreviewCheckoutLiveStatus,
  PreviewCheckoutProfileActionState,
  PreviewCheckoutSuggestionsState,
} from "@/lib/checkout/previewCheckoutContract"

export type {
  MigrationCustomerActionState,
  PreviewCheckoutActionState,
  PreviewCheckoutCancellationState,
  PreviewCheckoutDomainOption,
  PreviewCheckoutLiveStatus,
  PreviewCheckoutProfileActionState,
  PreviewCheckoutSuggestionsState,
} from "@/lib/checkout/previewCheckoutContract"

function migrationAssessmentMessage(
  t: Awaited<ReturnType<typeof getTranslations>>,
  assessment: ReturnType<typeof assessExistingDomainMigrationInput>,
): string {
  return t(`checkoutMigrationAssessment_${assessment.reason}`, {
    tld: `.${assessment.domain.split(".").at(-1) ?? ""}`,
  })
}

const formatMoney = (locale: string, price: FixedDomainOrderPrice | null): string | null => {
  if (!price) return null
  const amount = Number(price.amount)
  if (!Number.isFinite(amount)) return `${price.currency} ${price.amount}`
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: price.currency,
  }).format(amount)
}

const catalogDomainAllowance = (): FixedDomainOrderPrice => ({
  amount: (COMMERCIAL_CATALOG.domain.includedAllowanceNetMinor / 100).toFixed(2),
  currency: COMMERCIAL_CATALOG.currency,
})

const checkoutQuoteSigningSecret = (): string => {
  const secret = process.env.PAYLOAD_SECRET?.trim()
  if (!secret) throw new Error("PAYLOAD_SECRET is required to issue checkout quotes.")
  return secret
}

const issueCheckoutQuoteSet = (input: {
  domain: string
  providerPriceNetMinor: number
  providerQuotedAt: string
  profileVersion: number
  draftVersion: string
  domainMode?: "new_registration" | "existing_domain"
  migrationClassification?: "automatic" | "assisted_standard" | null
  migrationSourceMechanism?: MigrationSourceMechanism | null
  migrationSourceZoneHash?: string | null
  migrationPublicEvidenceHash?: string | null
  gtldTransferEligibilityDeclarationVersion?: string | null
  gtldTransferEligibilityDeclarationText?: string | null
  gtldTransferEligibilityAccepted?: boolean
  migrationInputEnvelope?: string | null
  migrationSecretKey?: string | null
  now?: Date
}): CheckoutQuoteSet => {
  const secret = checkoutQuoteSigningSecret()
  const issue = (billingPeriod: CheckoutBillingPeriod) =>
    sealCheckoutQuote(buildCheckoutQuote({
      billingPeriod,
      providerOperationPriceNetMinor: input.providerPriceNetMinor,
      selectedDomain: input.domain,
      providerQuotedAt: input.providerQuotedAt,
      profileVersion: input.profileVersion,
      draftVersion: input.draftVersion,
      domainMode: input.domainMode,
      migrationClassification: input.migrationClassification,
      migrationSourceMechanism: input.migrationSourceMechanism,
      migrationSourceZoneHash: input.migrationSourceZoneHash,
      migrationPublicEvidenceHash: input.migrationPublicEvidenceHash,
      gtldTransferEligibilityDeclarationVersion:
        input.gtldTransferEligibilityDeclarationVersion,
      gtldTransferEligibilityDeclarationText:
        input.gtldTransferEligibilityDeclarationText,
      gtldTransferEligibilityAccepted:
        input.gtldTransferEligibilityAccepted,
      migrationInputEnvelope: input.migrationInputEnvelope,
      migrationSecretKey: input.migrationSecretKey,
      now: input.now,
    }), secret)
  return {
    monthly: issue("monthly"),
    annual: issue("annual"),
  }
}

const safeCheckoutErrorMessage = (
  error: unknown,
  t: Awaited<ReturnType<typeof getTranslations>>,
  domain: string,
): string => {
  if (!(error instanceof Error)) return t("checkoutDomainCheckFailed", { domain })
  if (error.message.startsWith("Invalid domain")) return t("checkoutDomainInvalid")
  const checkoutErrorKeys = new Set([
    "checkoutDomainUnavailable",
    "checkoutDomainPremium",
    "checkoutDomainCheckFailed",
  ])
  if (checkoutErrorKeys.has(error.message)) {
    return t(error.message as "checkoutDomainUnavailable" | "checkoutDomainPremium" | "checkoutDomainCheckFailed", { domain })
  }
  console.error("Preview checkout operation failed", {
    operation: "domain_check",
    code: "unexpected_failure",
  })
  return t("checkoutDomainServiceUnavailable")
}

const domainStatusFromMessageKey = (
  messageKey: Awaited<ReturnType<typeof checkAndRecordPreviewDomainOrder>>["messageKey"],
): NonNullable<PreviewCheckoutActionState["status"]> => {
  if (messageKey === "checkoutDomainAvailable") return "available"
  if (messageKey === "checkoutDomainAvailableExtraFee") return "available_extra"
  if (messageKey === "checkoutDomainReleasePending") return "release_pending"
  if (messageKey === "checkoutDomainUnavailable") return "unavailable"
  if (messageKey === "checkoutDomainPremium") return "premium"
  return "service_error"
}

const domainErrorStatus = (error: unknown): NonNullable<PreviewCheckoutActionState["status"]> => {
  if (!(error instanceof Error)) return "service_error"
  if (error.message.startsWith("Invalid domain")) return "invalid"
  if (error.message === "checkoutDomainUnavailable") return "unavailable"
  if (error.message === "checkoutDomainPremium") return "premium"
  return "service_error"
}

const readCompleteZoneExport = async (formData: FormData): Promise<unknown> => {
  const value = formData.get("zoneExport")
  const text = value instanceof File
    ? await value.text()
    : String(value ?? "")
  if (!text.trim()) throw new Error("A complete zone export is required.")
  if (Buffer.byteLength(text, "utf8") > 256 * 1_024) {
    throw new Error("The complete zone export exceeds 256 KiB.")
  }
  return JSON.parse(text)
}

const acquireAutomaticMigrationSourceFromForm = async (
  domain: string,
  sourceMethod: MigrationSourceMechanism,
  formData: FormData,
  publicEvidence: Awaited<
    ReturnType<typeof inspectExistingDomainPublicEvidence>
  >,
  authority?: {
    context: Awaited<ReturnType<typeof requirePreviewCheckoutContext>>
  },
): Promise<
  AcquiredMigrationSource & {
  oauthAuthorization?: CloudflareSourceAuthorizationRecord
  }
> => {
  if (!commerceProviderReadsAllowed()) {
    throw new Error("Migration source reads are blocked by the commerce release gate.")
  }
  if (sourceMethod === "cloudflare_api_v1") {
    const authorizationKey = String(
      formData.get("cloudflareSourceAuthorization") ?? "",
    ).trim()
    if (authorizationKey) {
      if (!authority) {
        throw new Error("Cloudflare OAuth context is required.")
      }
      const authorization = await loadCloudflareSourceAuthorization(
        authority.context.payload,
        {
          authorizationKey,
          generationRunId: authority.context.run.id,
          tenantId: authority.context.tenant.id,
          clientSlug: authority.context.clientSlug,
          customerEmail: authority.context.customerEmail,
          domain,
        },
      )
      return {
        ...authorization.source,
        oauthAuthorization: authorization.record,
      }
    }
    throw new Error("Cloudflare OAuth authorization is required.")
  }
  if (sourceMethod === "authorized_axfr_v1") {
    return acquireAuthorizedAxfr({
      domain,
      nameserver: String(formData.get("axfrNameserver") ?? ""),
      tsigName: String(formData.get("axfrTsigName") ?? "") || null,
      tsigSecret: String(formData.get("axfrTsigSecret") ?? "") || null,
      publicEvidence,
    })
  }
  if (sourceMethod === "validated_provider_export_v1") {
    const upload = formData.get("zoneExport")
    if (
      !(upload instanceof File) ||
      upload.size <= 0 ||
      upload.size > 256 * 1_024
    ) {
      throw new Error("A bounded BIND zone export is required.")
    }
    return acquireValidatedProviderExport({
      domain,
      provider: String(formData.get("sourceProviderName") ?? ""),
      bindText: await upload.text(),
      publicEvidence,
    })
  }
  throw new Error("The selected automatic DNS source is unsupported.")
}

async function checkExistingDomainMigration(
  context: Awaited<ReturnType<typeof requirePreviewCheckoutContext>>,
  domain: string,
  formData: FormData,
  requestToken: string | undefined,
  t: Awaited<ReturnType<typeof getTranslations>>,
): Promise<PreviewCheckoutActionState> {
  const normalized = normalizeDomain(domain)
  if (!normalized.ok) {
    return {
      ok: false,
      status: "invalid",
      domain,
      domainMode: "existing_domain",
      migrationReadiness: "unsupported",
      message: t("checkoutDomainInvalid"),
      requestToken,
    }
  }
  const migrationCheckoutEnabled =
    commerceProviderReadsAllowed() &&
    existingDomainMigrationCheckoutEnabled()
  const sourceMethod = String(formData.get("migrationSourceMethod") ?? "").trim()
  if (!migrationCheckoutEnabled || !sourceMethod) {
    try {
      const publicEvidence = await inspectExistingDomainPublicEvidence(
        normalized.domain,
      )
      const transferBlocked = (publicEvidence.transferBlockers?.length ?? 0) > 0
      const productionCapability = getTldCapabilityForProductionOperation(
        normalized.extension,
        "incoming_transfer",
      )
      const releaseBlocked = productionCapability === null
      return {
        ok: !transferBlocked && !releaseBlocked,
        status: "preflight_complete",
        domain: normalized.domain,
        domainMode: "existing_domain",
        migrationReadiness: "unsupported",
        migrationClassification: null,
        migrationPublicEvidence: publicEvidence,
        migrationPreflightOnly: true,
        migrationReleaseBlocked: releaseBlocked,
        message:
          transferBlocked
            ? t("checkoutMigrationTransferBlocked")
            : releaseBlocked
              ? t(
                  tldCapabilityAt(normalized.extension)
                    ? "checkoutMigrationTldReleasePending"
                    : "checkoutMigrationTldUnsupported",
                  { tld: `.${normalized.extension}` },
                )
            : migrationCheckoutEnabled
            ? t("checkoutMigrationPublicPreflightSourceRequired")
            : t("checkoutMigrationPublicPreflightReleasePending"),
        requestToken,
      }
    } catch {
      return {
        ok: false,
        status: "service_error",
        domain: normalized.domain,
        domainMode: "existing_domain",
        migrationReadiness: "unsupported",
        migrationPreflightOnly: true,
        message: t("checkoutMigrationPublicPreflightFailed"),
        requestToken,
      }
    }
  }
  let publicEvidence: Awaited<
    ReturnType<typeof inspectExistingDomainPublicEvidence>
  >
  try {
    publicEvidence = await inspectExistingDomainPublicEvidence(domain)
  } catch {
    return {
      ok: false,
      status: "service_error",
      domain: normalized.domain,
      domainMode: "existing_domain",
      migrationReadiness: "unsupported",
      migrationPreflightOnly: true,
      message: t("checkoutMigrationPublicEvidenceRefreshFailed"),
      requestToken,
    }
  }
  if ((publicEvidence.transferBlockers?.length ?? 0) > 0) {
    return {
      ok: false,
      status: "preflight_complete",
      domain: normalized.domain,
      domainMode: "existing_domain",
      migrationReadiness: "unsupported",
      migrationClassification: null,
      migrationPublicEvidence: publicEvidence,
      migrationPreflightOnly: true,
      message: t("checkoutMigrationTransferBlocked"),
      requestToken,
    }
  }
  const productionCapability = getTldCapabilityForProductionOperation(
    normalized.extension,
    "incoming_transfer",
  )
  if (!productionCapability) {
    return {
      ok: false,
      status: "preflight_complete",
      domain: normalized.domain,
      domainMode: "existing_domain",
      migrationReadiness: "unsupported",
      migrationClassification: null,
      migrationPublicEvidence: publicEvidence,
      migrationPreflightOnly: true,
      message: t(
        tldCapabilityAt(normalized.extension)
          ? "checkoutMigrationTldReleasePending"
          : "checkoutMigrationTldUnsupported",
        { tld: `.${normalized.extension}` },
      ),
      requestToken,
    }
  }
  if (
    gtldTransferEligibilityDeclarationRequired(normalized.extension) &&
    formData.get("gtldTransferEligibility") !== "accepted"
  ) {
    return {
      ok: false,
      status: "invalid",
      domain: normalized.domain,
      domainMode: "existing_domain",
      migrationReadiness: "unsupported",
      migrationClassification: null,
      migrationPublicEvidence: publicEvidence,
      migrationPreflightOnly: true,
      message: t("checkoutMigrationGtldEligibilityRequired"),
      requestToken,
    }
  }
  try {
    if (
      ![
        "cloudflare_api_v1",
        "authorized_axfr_v1",
        "validated_provider_export_v1",
      ].includes(sourceMethod) ||
      !automaticMigrationSourceEnabled(sourceMethod as MigrationSourceMechanism)
    ) {
      return {
        ok: false,
        status: "invalid",
        domain: normalized.domain,
        domainMode: "existing_domain",
        migrationReadiness: "unsupported",
        migrationClassification: null,
        migrationSourceMechanism: sourceMethod as MigrationSourceMechanism,
        migrationPublicEvidence: publicEvidence,
        migrationPreflightOnly: true,
        message: t("checkoutMigrationSourceUnsupported"),
        requestToken,
      }
    }
    const acquiredSource = await acquireAutomaticMigrationSourceFromForm(
      domain,
      sourceMethod as Exclude<
        MigrationSourceMechanism,
        "customer_authorized_provider_export_v1"
      >,
      formData,
      publicEvidence,
      { context },
    )
    const assessment = assessExistingDomainMigrationInput({
      generationRunId: context.run.id,
      domain,
      zoneExport: acquiredSource.zone,
      transferCode: String(formData.get("transferCode") ?? ""),
      transferAuthorizationAccepted:
        formData.get("transferAuthorization") === "accepted",
      gtldTransferEligibilityAccepted:
        formData.get("gtldTransferEligibility") === "accepted",
      requestedAssistance: false,
      publicEvidence,
      acquiredSource,
    })
    if (
      !assessment.classification ||
      !assessment.sourceZoneHash ||
      !assessment.encryptedInput
    ) {
      return {
        ok: false,
        status: "invalid",
        domain: assessment.domain,
        domainMode: "existing_domain",
        migrationReadiness: assessment.readiness,
        migrationClassification: null,
        migrationSourceMechanism: acquiredSource.mechanism,
        migrationPublicEvidence: assessment.publicEvidence,
        migrationPreflightOnly: true,
        message: migrationAssessmentMessage(t, assessment),
        requestToken,
      }
    }
    const providerPrice = await getOpenProviderDomainTransferPrice(assessment.domain)
    if (providerPrice.currency !== COMMERCIAL_CATALOG.currency || providerPrice.premium) {
      return {
        ok: false,
        status: providerPrice.premium ? "premium" : "service_error",
        domain: assessment.domain,
        domainMode: "existing_domain",
        migrationReadiness: "unsupported",
        migrationSourceMechanism: acquiredSource.mechanism,
        migrationPublicEvidence: assessment.publicEvidence,
        migrationPreflightOnly: true,
        message: t("checkoutMigrationPriceUnsupported"),
        requestToken,
      }
    }
    const profile = await loadLatestCheckoutProfile(context.payload, context.run.id)
    const quotes = issueCheckoutQuoteSet({
      domain: assessment.domain,
      providerPriceNetMinor: providerPrice.netAmountMinor,
      providerQuotedAt: new Date().toISOString(),
      profileVersion: profile?.profileVersion ?? 0,
      draftVersion: String(context.run.updatedAt ?? ""),
      domainMode: "existing_domain",
      migrationClassification: assessment.classification,
      migrationSourceMechanism: acquiredSource.mechanism,
      migrationSourceZoneHash: assessment.sourceZoneHash,
      migrationPublicEvidenceHash: existingDomainPublicEvidenceHash(
        assessment.publicEvidence!,
      ),
      ...(gtldTransferEligibilityDeclarationRequired(normalized.extension)
        ? {
            gtldTransferEligibilityDeclarationVersion:
              GTLD_TRANSFER_ELIGIBILITY_DECLARATION_VERSION,
            gtldTransferEligibilityDeclarationText:
              t("checkoutMigrationGtldEligibilityDeclaration"),
            gtldTransferEligibilityAccepted: true,
          }
        : {}),
      migrationInputEnvelope: assessment.encryptedInput,
      migrationSecretKey: migrationCheckoutSecretKey(
        context.run.id,
        assessment.domain,
        assessment.sourceZoneHash,
      ),
    })
    return {
      ok: true,
      status: "available",
      domain: assessment.domain,
      domainMode: "existing_domain",
      migrationReadiness: assessment.readiness,
      migrationClassification: assessment.classification,
      migrationSourceMechanism: acquiredSource.mechanism,
      migrationPublicEvidence: assessment.publicEvidence,
      message: migrationAssessmentMessage(t, assessment),
      included: providerPrice.netAmountMinor <=
        COMMERCIAL_CATALOG.domain.includedAllowanceNetMinor,
      domainSurchargeNetMinor: quotes.annual.quote.domainSurchargeNetMinor,
      totalPriceLabel: null,
      quotes,
      requestToken,
      suggestions: [],
    }
  } catch {
    return {
      ok: false,
      status: "service_error",
      domain: normalized.domain,
      domainMode: "existing_domain",
      migrationReadiness: "unsupported",
      migrationClassification: null,
      migrationSourceMechanism: sourceMethod as MigrationSourceMechanism,
      migrationPreflightOnly: true,
      migrationPublicEvidence: publicEvidence,
      message: t("checkoutMigrationSourceVerificationFailed"),
      requestToken,
    }
  }
}

export async function checkPreviewCheckoutDomainAction(
  clientSlug: string,
  _previousState: PreviewCheckoutActionState,
  formData: FormData,
): Promise<PreviewCheckoutActionState> {
  const totalStart = startPreviewCheckoutTimer()
  const t = await getTranslations("preview")
  const authStart = startPreviewCheckoutTimer()
  const context = await requirePreviewCheckoutContext(clientSlug)
  logPreviewCheckoutTiming("primary_check_auth", authStart, { clientSlug: context.clientSlug })

  const domain = String(formData.get("domain") ?? "").trim().toLowerCase()
  const requestToken = String(formData.get("requestToken") ?? "").trim() || undefined
  const domainMode = formData.get("domainMode") === "existing_domain"
    ? "existing_domain"
    : "new_registration"
  if (!domain) {
    return {
      ok: false,
      status: "invalid",
      domain,
      domainMode,
      message: t("checkoutDomainRequired"),
      requestToken,
    }
  }
  if (domainMode === "existing_domain") {
    return checkExistingDomainMigration(
      context,
      domain,
      formData,
      requestToken,
      t,
    )
  }
  if (!commerceProviderReadsAllowed()) {
    return {
      ok: false,
      status: "service_error",
      domain,
      domainMode,
      message: t("checkoutDomainServiceUnavailable"),
      requestToken,
    }
  }

  try {
    const locale = await getLocale()
    const providerStart = startPreviewCheckoutTimer()
    const result = await checkAndRecordPreviewDomainOrder(
      context.payload,
      context.run,
      domain,
      null,
      {
        record: false,
        includedProviderPrice: catalogDomainAllowance(),
        requireProductionCapability: false,
      },
    )
    logPreviewCheckoutTiming("primary_check_provider", providerStart, { clientSlug: context.clientSlug, domain: result.domain }, {
      status: result.messageKey,
    })
    const extraFee = result.extraFeeAmount && result.extraFeeCurrency
      ? { amount: result.extraFeeAmount, currency: result.extraFeeCurrency }
      : null
    const canCheckout = result.productionOperationEnabled && (
      result.messageKey === "checkoutDomainAvailable" ||
      result.messageKey === "checkoutDomainAvailableExtraFee"
    )
    let quotes: CheckoutQuoteSet | undefined
    if (canCheckout) {
      if (
        !result.providerPriceAmount ||
        result.providerPriceCurrency !== COMMERCIAL_CATALOG.currency
      ) {
        throw new Error("Checkout domain price is unavailable for the commercial quote.")
      }
      const profile = await loadLatestCheckoutProfile(context.payload, context.run.id)
      quotes = issueCheckoutQuoteSet({
        domain: result.domain,
        providerPriceNetMinor: decimalMoneyToMinor(result.providerPriceAmount),
        providerQuotedAt: result.providerQuotedAt,
        profileVersion: profile?.profileVersion ?? 0,
        draftVersion: String(context.run.updatedAt ?? result.providerQuotedAt),
      })
    }
    const response = {
      ok: canCheckout,
      status: domainStatusFromMessageKey(result.messageKey),
      message: t(result.messageKey, {
        domain: result.domain,
        extraFee: formatMoney(locale, extraFee) ?? "",
      }),
      domain: result.domain,
      included: result.included,
      extraFeeAmount: result.extraFeeAmount,
      extraFeeCurrency: result.extraFeeCurrency,
      extraFeeLabel: formatMoney(locale, extraFee),
      totalPriceLabel: quotes
        ? formatMoney(locale, {
            amount: (quotes.annual.quote.grossAmountMinor / 100).toFixed(2),
            currency: quotes.annual.quote.currency,
          })
        : null,
      domainSurchargeNetMinor: result.extraFeeAmount
        ? decimalMoneyToMinor(result.extraFeeAmount)
        : 0,
      quotes,
      requestToken,
      suggestions: [],
      domainMode: "new_registration" as const,
    }
    logPreviewCheckoutTiming("primary_check_total", totalStart, { clientSlug: context.clientSlug, domain: result.domain }, {
      ok: response.ok,
      status: response.status,
    })
    return response
  } catch (error) {
    logPreviewCheckoutTiming("primary_check_total", totalStart, { clientSlug: context.clientSlug, domain }, {
      ok: false,
      status: domainErrorStatus(error),
    })
    return {
      ok: false,
      status: domainErrorStatus(error),
      message: safeCheckoutErrorMessage(error, t, domain),
      domain,
      domainMode,
      requestToken,
    }
  }
}

const versionField = (formData: FormData, key: string): number | null => {
  const rawValue = String(formData.get(key) ?? "").trim()
  if (!/^\d+$/.test(rawValue)) return null
  const value = Number(rawValue)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

const requestAudit = async () => {
  const requestHeaders = await headers()
  return {
    requestId: requestHeaders.get("x-request-id") ?? crypto.randomUUID(),
    ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: requestHeaders.get("user-agent"),
  }
}

class MigrationCustomerActionError extends Error {
  constructor(
    readonly category:
      | "invalid_input"
      | "refresh_required"
      | "retryable_service_error",
  ) {
    super(category)
    this.name = "MigrationCustomerActionError"
  }
}

const migrationCustomerActionFailure = async (
  error: unknown,
): Promise<MigrationCustomerActionState> => {
  const t = await getTranslations("preview")
  const status = error instanceof MigrationCustomerActionError
    ? error.category
    : "refresh_required"
  const messageKey = {
    invalid_input: "checkoutMigrationActionInvalidInput",
    refresh_required: "checkoutMigrationActionRefreshRequired",
    retryable_service_error: "checkoutMigrationActionRetryLater",
  }[status] as
    | "checkoutMigrationActionInvalidInput"
    | "checkoutMigrationActionRefreshRequired"
    | "checkoutMigrationActionRetryLater"
  return { ok: false, status, message: t(messageKey) }
}

const translateDomainMigrationInputFailure = (error: unknown): never => {
  if (error instanceof DomainMigrationCustomerInputError) {
    throw new MigrationCustomerActionError(
      error.kind === "invalid_input" ? "invalid_input" : "refresh_required",
    )
  }
  throw new MigrationCustomerActionError("retryable_service_error")
}

async function recollectAcceptedMigrationInput(
  clientSlug: string,
  formData: FormData,
): Promise<string> {
  if (!commerceProviderReadsAllowed()) {
    throw new MigrationCustomerActionError("retryable_service_error")
  }
  const context = await requirePreviewCheckoutContext(clientSlug)
  const orderId = String(formData.get("acceptedOrderId") ?? "").trim()
  if (!/^\d+$/.test(orderId)) {
    throw new Error("Migration-input recollection requires an accepted order.")
  }
  const signingSecret = checkoutQuoteSigningSecret()
  const resume = await loadAcceptedCheckoutResume(context.payload, {
    generationRunId: context.run.id,
    customerEmail: context.customerEmail,
    signingSecret,
  })
  if (
    !resume ||
    String(resume.orderId) !== orderId ||
    !resume.requiresMigrationRecollection
  ) {
    throw new MigrationCustomerActionError("refresh_required")
  }
  const quote = resume.quotes[resume.billingPeriod].quote
  const publicEvidence = await inspectExistingDomainPublicEvidence(
    quote.selectedDomain,
  ).catch(() => {
    throw new MigrationCustomerActionError("retryable_service_error")
  })
  const currentAutomaticSource =
    quote.migrationSourceMechanism &&
    quote.migrationSourceMechanism !==
      "customer_authorized_provider_export_v1"
      ? await acquireAutomaticMigrationSourceFromForm(
          quote.selectedDomain,
          quote.migrationSourceMechanism,
          formData,
          publicEvidence,
          { context },
        ).catch(() => {
          throw new MigrationCustomerActionError("invalid_input")
        })
      : null
  let zoneExport: unknown
  if (currentAutomaticSource) {
    zoneExport = currentAutomaticSource.zone
  } else {
    try {
      zoneExport = await readCompleteZoneExport(formData)
    } catch {
      throw new MigrationCustomerActionError("invalid_input")
    }
  }
  const assessment = assessExistingDomainMigrationInput({
    generationRunId: context.run.id,
    domain: quote.selectedDomain,
    zoneExport: zoneExport as Parameters<
      typeof assessExistingDomainMigrationInput
    >[0]["zoneExport"],
    transferCode: String(formData.get("transferCode") ?? ""),
    transferAuthorizationAccepted:
      formData.get("transferAuthorization") === "accepted",
    gtldTransferEligibilityAccepted:
      formData.get("gtldTransferEligibility") === "accepted",
    requestedAssistance:
      quote.migrationClassification === "assisted_standard",
    publicEvidence,
    acceptedOrderRecollection: true,
    acceptedCapabilityVersion: resume.tldCapabilityVersion ?? undefined,
    acquiredSource: currentAutomaticSource ?? undefined,
  })
  if (
    !assessment.encryptedInput ||
    assessment.classification !== quote.migrationClassification ||
    assessment.sourceZoneHash !== quote.migrationSourceZoneHash ||
    (
      currentAutomaticSource &&
      currentAutomaticSource.mechanism !== quote.migrationSourceMechanism
    )
  ) {
    throw new MigrationCustomerActionError("invalid_input")
  }
  if (currentAutomaticSource?.oauthAuthorization) {
    try {
      await attachCloudflareSourceAuthorization(
        context.payload,
        currentAutomaticSource.oauthAuthorization,
      )
    } catch {
      throw new MigrationCustomerActionError("refresh_required")
    }
  }
  await replaceExpiredAttachedMigrationCheckoutSecret(context.payload, {
    secretKey: quote.migrationSecretKey!,
    orderId: resume.orderId,
    generationRunId: context.run.id,
    domain: quote.selectedDomain,
    sourceZoneHash: quote.migrationSourceZoneHash!,
    encryptedInput: assessment.encryptedInput,
  })
  return `https://${PREVIEW_HOST}/${context.clientSlug}/checkout?payment=return`
}

export async function recollectAcceptedMigrationInputAction(
  clientSlug: string,
  formData: FormData,
): Promise<MigrationCustomerActionState> {
  let returnUrl: string
  try {
    returnUrl = await recollectAcceptedMigrationInput(clientSlug, formData)
  } catch (error) {
    return migrationCustomerActionFailure(error)
  }
  redirect(returnUrl)
}

async function submitMigrationTransferCode(
  clientSlug: string,
  formData: FormData,
): Promise<void> {
  const context = await requirePreviewCheckoutContext(clientSlug)
  const migrationId = String(formData.get("migrationId") ?? "").trim()
  const expectedVersion = String(formData.get("expectedMigrationVersion") ?? "").trim()
  const transferCode = String(formData.get("transferCode") ?? "").trim()
  const sourceAuthorityOnly =
    formData.get("sourceAuthorityOnly") === "accepted"
  if (
    !/^\d+$/.test(migrationId) ||
    !expectedVersion ||
    (!transferCode && !sourceAuthorityOnly)
  ) {
    throw new MigrationCustomerActionError("invalid_input")
  }
  const migration = await context.payload.findByID({
    collection: "domain-migrations",
    id: migrationId,
    depth: 0,
    overrideAccess: true,
  })
  if (
    !transferCode &&
    !(
      migration.failureReason ===
        "source_authority_reauthorization_required" &&
      migration.providerTransferState === "confirmed" &&
      sourceAuthorityOnly
    )
  ) {
    throw new MigrationCustomerActionError("invalid_input")
  }
  const originatingOrderId = relationshipId(migration.originatingOrder)
  if (!originatingOrderId) {
    throw new Error("Transfer-code correction has no originating order.")
  }
  const order = await context.payload.findByID({
    collection: "orders",
    id: originatingOrderId,
    depth: 0,
    overrideAccess: true,
  })
  if (
    !sameRelationshipId(order.generationRun, context.run.id) ||
    !sameRelationshipId(order.tenant, context.tenant.id) ||
    order.customerEmail.trim().toLowerCase() !==
      context.customerEmail.trim().toLowerCase()
  ) {
    throw new Error("Transfer-code correction belongs to another customer.")
  }
  if (
    migration.failureReason === "source_evidence_stale" ||
    migration.failureReason === "source_authority_reauthorization_required"
  ) {
    if (
      migration.updatedAt !== expectedVersion ||
      migration.state !== "awaiting_customer"
    ) {
      throw new MigrationCustomerActionError("refresh_required")
    }
    const sourceMechanism = migration.sourceMechanism
    let zoneExport: unknown
    let acquiredSource: Awaited<
      ReturnType<typeof acquireAutomaticMigrationSourceFromForm>
    > | null = null
    if (
      sourceMechanism &&
      sourceMechanism !== "customer_authorized_provider_export_v1"
    ) {
      if (
        !commerceProviderReadsAllowed() ||
        !automaticMigrationSourceEnabled(sourceMechanism)
      ) {
        throw new MigrationCustomerActionError("retryable_service_error")
      }
      const publicEvidence = await inspectExistingDomainPublicEvidence(
        migration.domainNameAscii,
      ).catch(() => {
        throw new MigrationCustomerActionError("retryable_service_error")
      })
      acquiredSource = await acquireAutomaticMigrationSourceFromForm(
        migration.domainNameAscii,
        sourceMechanism,
        formData,
        publicEvidence,
        { context },
      ).catch(() => {
        throw new MigrationCustomerActionError("invalid_input")
      })
      if (acquiredSource.mechanism !== sourceMechanism) {
        throw new MigrationCustomerActionError("invalid_input")
      }
      zoneExport = acquiredSource.zone
    } else {
      try {
        zoneExport = await readCompleteZoneExport(formData)
      } catch {
        throw new MigrationCustomerActionError("invalid_input")
      }
    }
    if (
      migration.failureReason ===
        "source_authority_reauthorization_required" &&
      !acquiredSource
    ) {
      throw new MigrationCustomerActionError("invalid_input")
    }
    try {
      if (acquiredSource?.oauthAuthorization) {
        await attachCloudflareSourceAuthorization(
          context.payload,
          acquiredSource.oauthAuthorization,
        )
      }
      if (
        migration.failureReason ===
          "source_authority_reauthorization_required"
      ) {
        await replaceMigrationSourceRefreshAuthority(context.payload, {
          migrationId: migration.id,
          acquiredSource: acquiredSource!,
          transferCode: transferCode || undefined,
          expectedUpdatedAt: expectedVersion,
        })
      } else {
        if (!transferCode) {
          throw new DomainMigrationCustomerInputError("invalid_input")
        }
        await acquireAutomaticMigrationInputs(context.payload, {
          migrationId: migration.id,
          zoneExport: zoneExport as Parameters<
            typeof acquireAutomaticMigrationInputs
          >[1]["zoneExport"],
          transferCode,
          sourceRefreshAuthority: acquiredSource
            ? buildAutomaticSourceRefreshAuthority({
                domain: migration.domainNameAscii,
                sourceMechanism: acquiredSource.mechanism,
                sourceZone: acquiredSource.zone,
                credential: acquiredSource.refreshCredential,
              })
            : undefined,
          expectedUpdatedAt: expectedVersion,
        })
      }
    } catch (error) {
      translateDomainMigrationInputFailure(error)
    }
  } else {
    if (!transferCode) {
      throw new MigrationCustomerActionError("invalid_input")
    }
    try {
      await replaceMigrationTransferAuthorization(context.payload, {
        migrationId: migration.id,
        expectedUpdatedAt: expectedVersion,
        transferCode,
      })
    } catch (error) {
      translateDomainMigrationInputFailure(error)
    }
  }
  revalidatePath(`/${context.clientSlug}/checkout`)
}

export async function savePreviewCheckoutProfileAction(
  clientSlug: string,
  _previousState: PreviewCheckoutProfileActionState,
  formData: FormData,
): Promise<PreviewCheckoutProfileActionState> {
  const t = await getTranslations("preview")
  const context = await requirePreviewCheckoutContext(clientSlug)
  const requestToken = String(formData.get("requestToken") ?? "").trim() || undefined
  const expectedProfileVersion = versionField(formData, "expectedProfileVersion")
  if (expectedProfileVersion == null) {
    return {
      ok: false,
      status: "invalid",
      message: t("checkoutProfileVersionInvalid"),
      requestToken,
    }
  }
  const parsed = checkoutProfileDraftFromFormData(formData)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form")
      fieldErrors[field] ??= issue.message
    }
    return {
      ok: false,
      status: "invalid",
      message: t("checkoutDetailsInvalid"),
      requestToken,
      fieldErrors,
    }
  }
  const profileDomain = normalizeDomain(
    String(formData.get("domain") ?? ""),
  )
  const euEligibilityCombinationInvalid =
    profileDomain.ok &&
    profileDomain.extension === "eu" &&
    (
      (
        parsed.data.partyType === "registered_business" &&
        (
          parsed.data.euEligibilityBasis !== "establishment" ||
          parsed.data.euEligibilityCountry !== parsed.data.country
        )
      ) ||
      (
        parsed.data.partyType === "business_in_formation" &&
        (
          parsed.data.euEligibilityBasis === "establishment" ||
          (
            parsed.data.euEligibilityBasis === "residence" &&
            parsed.data.euEligibilityCountry !== parsed.data.country
          )
        )
      )
    )
  if (
    profileDomain.ok &&
    profileDomain.extension === "eu" &&
    (
      !parsed.data.euEligibilityBasis ||
      !isEuRegistryEligibilityCountry(parsed.data.euEligibilityCountry) ||
      euEligibilityCombinationInvalid
    )
  ) {
    return {
      ok: false,
      status: "invalid",
      message: t("checkoutDetailsInvalid"),
      requestToken,
      fieldErrors: {
        ...(!parsed.data.euEligibilityBasis || euEligibilityCombinationInvalid
          ? {
              euEligibilityBasis:
                t(
                  euEligibilityCombinationInvalid
                    ? "checkoutEuEligibilityCombinationInvalid"
                    : "checkoutEuEligibilityBasisRequired",
                ),
            }
          : {}),
        ...(
          !isEuRegistryEligibilityCountry(parsed.data.euEligibilityCountry) ||
          euEligibilityCombinationInvalid
          ? {
              euEligibilityCountry:
                t(
                  euEligibilityCombinationInvalid
                    ? "checkoutEuEligibilityCombinationInvalid"
                    : "checkoutEuEligibilityCountryRequired",
                ),
            }
          : {}),
      },
    }
  }
  const audit = await requestAudit()
  const saved = await saveCheckoutProfileVersion({
    payload: context.payload,
    generationRunId: context.run.id,
    tenantId: context.tenant.id,
    actorEmail: context.customerEmail,
    expectedProfileVersion,
    draft: parsed.data,
    requestId: audit.requestId,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  if (saved.status === "conflict") {
    return {
      ok: false,
      status: "conflict",
      message: t("checkoutProfileConflict"),
      requestToken,
      currentProfile: saved.currentProfile,
    }
  }
  const selectedDomain = String(formData.get("domain") ?? "").trim().toLowerCase()
  const domainMode = formData.get("domainMode") === "existing_domain"
    ? "existing_domain"
    : "new_registration"
  let quotes: CheckoutQuoteSet | undefined
  if (
    selectedDomain &&
    commerceProviderReadsAllowed() &&
    domainMode === "existing_domain"
  ) {
    try {
      const priorQuote = openCheckoutQuote(
        String(formData.get("existingMigrationQuoteToken") ?? ""),
        checkoutQuoteSigningSecret(),
      )
      if (
        priorQuote.domainMode !== "existing_domain" ||
        priorQuote.selectedDomain !== selectedDomain ||
        !priorQuote.migrationClassification ||
        !priorQuote.migrationSourceZoneHash ||
        !priorQuote.migrationPublicEvidenceHash ||
        !priorQuote.migrationInputEnvelope ||
        !priorQuote.migrationSecretKey
      ) {
        throw new Error("Existing-domain quote evidence is incomplete.")
      }
      const providerPrice = await getOpenProviderDomainTransferPrice(selectedDomain)
      if (
        providerPrice.currency !== COMMERCIAL_CATALOG.currency ||
        providerPrice.premium
      ) {
        throw new Error("Existing-domain transfer price is not supported.")
      }
      quotes = issueCheckoutQuoteSet({
        domain: selectedDomain,
        providerPriceNetMinor: providerPrice.netAmountMinor,
        providerQuotedAt: new Date().toISOString(),
        profileVersion: saved.profile.profileVersion,
        draftVersion: String(context.run.updatedAt ?? ""),
        domainMode,
        migrationClassification: priorQuote.migrationClassification,
        migrationSourceMechanism: priorQuote.migrationSourceMechanism,
        migrationSourceZoneHash: priorQuote.migrationSourceZoneHash,
        migrationPublicEvidenceHash:
          priorQuote.migrationPublicEvidenceHash,
        gtldTransferEligibilityDeclarationVersion:
          priorQuote.gtldTransferEligibilityDeclarationVersion,
        gtldTransferEligibilityDeclarationText:
          priorQuote.gtldTransferEligibilityDeclarationText,
        gtldTransferEligibilityAccepted:
          priorQuote.gtldTransferEligibilityAccepted,
        migrationInputEnvelope: priorQuote.migrationInputEnvelope,
        migrationSecretKey: priorQuote.migrationSecretKey,
      })
    } catch {
      quotes = undefined
    }
  } else if (selectedDomain && commerceProviderReadsAllowed()) {
    const refreshed = await checkAndRecordPreviewDomainOrder(
      context.payload,
      context.run,
      selectedDomain,
      null,
      {
        record: false,
        includedProviderPrice: catalogDomainAllowance(),
      },
    )
    if (
      (
        refreshed.messageKey === "checkoutDomainAvailable" ||
        refreshed.messageKey === "checkoutDomainAvailableExtraFee"
      ) &&
      refreshed.providerPriceAmount &&
      refreshed.providerPriceCurrency === COMMERCIAL_CATALOG.currency
    ) {
      quotes = issueCheckoutQuoteSet({
        domain: refreshed.domain,
        providerPriceNetMinor: decimalMoneyToMinor(refreshed.providerPriceAmount),
        providerQuotedAt: refreshed.providerQuotedAt,
        profileVersion: saved.profile.profileVersion,
        draftVersion: String(context.run.updatedAt ?? refreshed.providerQuotedAt),
    })
  }
}

  return {
    ok: true,
    status: "saved",
    message: saved.created
      ? t("checkoutProfileSaved")
      : t("checkoutProfileAlreadyCurrent"),
    requestToken,
    profile: saved.profile,
    quotes,
  }
}

export async function submitMigrationTransferCodeAction(
  clientSlug: string,
  formData: FormData,
): Promise<MigrationCustomerActionState> {
  const t = await getTranslations("preview")
  try {
    await submitMigrationTransferCode(clientSlug, formData)
    return {
      ok: true,
      status: "saved",
      message: t("checkoutMigrationActionSaved"),
    }
  } catch (error) {
    return migrationCustomerActionFailure(error)
  }
}

export async function suggestPreviewCheckoutDomainsAction(
  clientSlug: string,
  previousState: PreviewCheckoutSuggestionsState,
  formData: FormData,
): Promise<PreviewCheckoutSuggestionsState> {
  await requirePreviewCheckoutContext(clientSlug)

  const domain = String(formData.get("domain") ?? "").trim().toLowerCase()
  if (!domain) return { ok: false, suggestions: [], cursor: 0, done: true }
  if (!commerceProviderReadsAllowed()) {
    return { ok: false, domain, suggestions: [], cursor: 0, done: true }
  }

  try {
    const locale = await getLocale()
    const previousSuggestions = previousState.domain === domain ? previousState.suggestions ?? [] : []
    if (previousSuggestions.length >= 5 || (previousState.domain === domain && previousState.done)) {
      return { ok: true, domain, suggestions: previousSuggestions.slice(0, 5), cursor: previousState.cursor ?? 0, done: true }
    }
    const batch = await suggestAvailablePreviewDomainBatch(domain, catalogDomainAllowance(), {
      cursor: previousState.domain === domain ? previousState.cursor ?? 0 : 0,
      batchSize: 5,
      existingDomains: previousSuggestions.map((suggestion) => suggestion.domain),
    })
    const nextSuggestions = [
      ...previousSuggestions,
      ...batch.suggestions.map((suggestion) => {
        const suggestionExtraFee = suggestion.extraFeeAmount && suggestion.extraFeeCurrency
          ? { amount: suggestion.extraFeeAmount, currency: suggestion.extraFeeCurrency }
          : null
        return {
          ...suggestion,
          extraFeeLabel: formatMoney(locale, suggestionExtraFee),
        }
      }),
    ].slice(0, 5)
    return {
      ok: true,
      domain,
      suggestions: nextSuggestions,
      cursor: batch.nextCursor,
      done: batch.done || nextSuggestions.length >= 5,
    }
  } catch {
    console.error("Preview checkout operation failed", {
      operation: "domain_suggestions",
      code: "unexpected_failure",
    })
    return {
      ok: false,
      domain,
      suggestions: previousState.domain === domain ? previousState.suggestions ?? [] : [],
      cursor: previousState.domain === domain ? previousState.cursor ?? 0 : 0,
      done: true,
    }
  }
}

export async function startPreviewCheckoutPaymentAction(
  clientSlug: string,
  _previousState: PreviewCheckoutActionState,
  formData: FormData,
): Promise<PreviewCheckoutActionState> {
  const totalStart = startPreviewCheckoutTimer()
  const t = await getTranslations("preview")
  const authStart = startPreviewCheckoutTimer()
  const context = await requirePreviewCheckoutContext(clientSlug)
  logPreviewCheckoutTiming("payment_auth", authStart, { clientSlug: context.clientSlug })
  const currentPayment = normalizeGenerationRunPaymentState(context.run.payment)
  if (currentPayment.status === "pending_provider") {
    return {
      ok: false,
      status: "payment_pending",
      message: t("checkoutPaymentStillPending"),
    }
  }
  if (["completed", "waived"].includes(currentPayment.status)) {
    return {
      ok: false,
      status: "payment_complete",
      message: t("checkoutPaymentAlreadyComplete"),
    }
  }

  const domain = String(formData.get("domain") ?? "").trim().toLowerCase()
  if (!domain) return { ok: false, message: t("checkoutDomainRequired") }
  if (formData.get("previewApproval") !== "accepted") {
    return { ok: false, message: t("checkoutPreviewApprovalRequired") }
  }
  if (formData.get("termsAcceptance") !== "accepted") {
    return { ok: false, message: t("checkoutTermsAcceptanceRequired") }
  }
  if (formData.get("businessUseAcceptance") !== "accepted") {
    return { ok: false, message: t("checkoutBusinessUseRequired") }
  }
  const expectedProfileVersion = versionField(formData, "expectedProfileVersion")
  const expectedProfileKey = String(formData.get("expectedProfileKey") ?? "").trim()
  if (expectedProfileVersion == null || !expectedProfileKey) {
    return { ok: false, status: "profile_conflict", message: t("checkoutProfileRequired") }
  }
  const currentTerms = getCurrentLegalDocument("platform-terms", "nl")
  const currentPrivacy = getCurrentLegalDocument("platform-privacy", "nl")
  if (
    String(formData.get("expectedTermsVersion") ?? "") !== currentTerms.documentVersion ||
    String(formData.get("expectedPrivacyVersion") ?? "") !== currentPrivacy.documentVersion ||
    String(formData.get("expectedBusinessUseDeclarationVersion") ?? "") !== BUSINESS_USE_DECLARATION_VERSION
  ) {
    return { ok: false, status: "version_conflict", message: t("checkoutLegalVersionConflict") }
  }
  const billingPeriodValue = String(formData.get("billingPeriod") ?? "")
  if (billingPeriodValue !== "monthly" && billingPeriodValue !== "annual") {
    return { ok: false, message: t("checkoutBillingPeriodRequired") }
  }
  const billingPeriod: CheckoutBillingPeriod = billingPeriodValue
  const quoteToken = String(formData.get("checkoutQuoteToken") ?? "").trim()
  if (!quoteToken) {
    return { ok: false, status: "version_conflict", message: t("checkoutQuoteVersionConflict") }
  }
  let acceptedQuote
  try {
    acceptedQuote = openCheckoutQuote(quoteToken, checkoutQuoteSigningSecret())
  } catch {
    return { ok: false, status: "version_conflict", message: t("checkoutQuoteVersionConflict") }
  }
  const acceptedOrderId = String(formData.get("acceptedOrderId") ?? "").trim()
  let resumesAcceptedOrder = false
  if (acceptedOrderId) {
    try {
      const resume = await loadAcceptedCheckoutResume(context.payload, {
        generationRunId: context.run.id,
        customerEmail: context.customerEmail,
        signingSecret: checkoutQuoteSigningSecret(),
      })
      resumesAcceptedOrder = Boolean(
        resume &&
        String(resume.orderId) === acceptedOrderId &&
        resume.billingPeriod === acceptedQuote.billingPeriod &&
        sameAcceptedCheckoutAuthority(
          acceptedQuote,
          resume.quotes[resume.billingPeriod].quote,
        ),
      )
    } catch {
      resumesAcceptedOrder = false
    }
  }
  if (
    acceptedQuote.billingPeriod !== billingPeriod ||
    acceptedQuote.selectedDomain !== domain ||
    (
      !resumesAcceptedOrder &&
      acceptedQuote.catalogVersion !== COMMERCIAL_CATALOG_VERSION
    ) ||
    (
      !resumesAcceptedOrder &&
      acceptedQuote.domainMode === "existing_domain" &&
      acceptedQuote.migrationClassification !== "automatic"
    ) ||
    !["new_registration", "existing_domain"].includes(acceptedQuote.domainMode) ||
    (
      acceptedQuote.draftVersion !== String(context.run.updatedAt ?? "") &&
      !resumesAcceptedOrder
    ) ||
    (acceptedOrderId && !resumesAcceptedOrder)
  ) {
    return { ok: false, status: "version_conflict", message: t("checkoutQuoteVersionConflict") }
  }
  const checkoutProfile = await loadLatestCheckoutProfile(context.payload, context.run.id)
  if (
    !checkoutProfile ||
    checkoutProfile.profileVersion !== expectedProfileVersion ||
    checkoutProfile.profileKey !== expectedProfileKey ||
    checkoutProfile.customerEmail.trim().toLowerCase() !==
      context.customerEmail.trim().toLowerCase()
  ) {
    return {
      ok: false,
      status: "profile_conflict",
      message: t("checkoutProfileConflict"),
      currentProfile: checkoutProfile ? checkoutProfileView(checkoutProfile) : undefined,
    }
  }
  if (acceptedQuote.profileVersion !== checkoutProfile.profileVersion) {
    return {
      ok: false,
      status: "version_conflict",
      message: t("checkoutQuoteVersionConflict"),
    }
  }
  const registrant = domainRegistrantFromCheckoutProfile(checkoutProfile)
  let acceptedMigrationInput: ReturnType<
    typeof openCheckoutMigrationInput
  > | null = null
  let sourceAuthorization:
    | Awaited<ReturnType<typeof loadCloudflareSourceAuthorization>>
    | null = null

  try {
    const domainStart = startPreviewCheckoutTimer()
    let readyRun = context.run
    let readyDomain = domain
    let currentQuote: ReturnType<typeof buildCheckoutQuote>
    if (acceptedQuote.domainMode === "existing_domain") {
      if (
        !commerceProviderReadsAllowed() ||
        !existingDomainMigrationCheckoutEnabled() ||
        !acceptedQuote.migrationClassification ||
        !acceptedQuote.migrationSourceMechanism ||
        !automaticMigrationSourceEnabled(
          acceptedQuote.migrationSourceMechanism,
        ) ||
        !acceptedQuote.migrationSourceZoneHash ||
        !acceptedQuote.migrationPublicEvidenceHash ||
        !acceptedQuote.migrationSecretKey ||
        (!acceptedQuote.migrationInputEnvelope && !resumesAcceptedOrder)
      ) {
        return {
          ok: false,
          status: "version_conflict",
          message: t("checkoutQuoteVersionConflict"),
        }
      }
      let refreshedPublicEvidence: ExistingDomainPublicEvidence
      try {
        refreshedPublicEvidence = await inspectExistingDomainPublicEvidence(
          domain,
        )
      } catch {
        return {
          ok: false,
          status: "version_conflict",
          message: t("checkoutQuoteVersionConflict"),
        }
      }
      if (
        (refreshedPublicEvidence.transferBlockers?.length ?? 0) > 0 ||
        existingDomainPublicEvidenceHash(refreshedPublicEvidence) !==
          acceptedQuote.migrationPublicEvidenceHash
      ) {
        return {
          ok: false,
          status: "version_conflict",
          message: t("checkoutQuoteVersionConflict"),
        }
      }
    }
    if (resumesAcceptedOrder) {
      currentQuote = acceptedQuote
    } else if (acceptedQuote.domainMode === "existing_domain") {
      if (acceptedQuote.migrationInputEnvelope) {
        const migrationInput = openCheckoutMigrationInput(
          acceptedQuote.migrationInputEnvelope,
          context.run.id,
          domain,
        )
        acceptedMigrationInput = migrationInput
        if (
          migrationInput.classification !== acceptedQuote.migrationClassification ||
          migrationInput.sourceMechanism !==
            acceptedQuote.migrationSourceMechanism ||
          migrationInput.sourceZoneHash !== acceptedQuote.migrationSourceZoneHash
        ) {
          return {
            ok: false,
            status: "version_conflict",
            message: t("checkoutQuoteVersionConflict"),
          }
        }
      }
      const transferPrice = await getOpenProviderDomainTransferPrice(domain)
      if (
        transferPrice.currency !== COMMERCIAL_CATALOG.currency ||
        transferPrice.premium
      ) {
        return {
          ok: false,
          status: "version_conflict",
          message: t("checkoutQuoteVersionConflict"),
        }
      }
      currentQuote = buildCheckoutQuote({
        billingPeriod,
        providerOperationPriceNetMinor: transferPrice.netAmountMinor,
        selectedDomain: domain,
        domainMode: "existing_domain",
        migrationClassification: acceptedQuote.migrationClassification,
        migrationSourceMechanism: acceptedQuote.migrationSourceMechanism,
        migrationSourceZoneHash: acceptedQuote.migrationSourceZoneHash,
        migrationPublicEvidenceHash:
          acceptedQuote.migrationPublicEvidenceHash,
        gtldTransferEligibilityDeclarationVersion:
          acceptedQuote.gtldTransferEligibilityDeclarationVersion,
        gtldTransferEligibilityDeclarationText:
          acceptedQuote.gtldTransferEligibilityDeclarationText,
        gtldTransferEligibilityAccepted:
          acceptedQuote.gtldTransferEligibilityAccepted,
        migrationInputEnvelope: acceptedQuote.migrationInputEnvelope,
        migrationSecretKey: acceptedQuote.migrationSecretKey,
        providerQuotedAt: new Date().toISOString(),
        profileVersion: checkoutProfile.profileVersion,
        draftVersion: acceptedQuote.draftVersion,
      })
    } else {
      if (!commerceProviderReadsAllowed()) {
        return {
          ok: false,
          status: "version_conflict",
          message: t("checkoutQuoteVersionConflict"),
        }
      }
      const ready = await requireReadyPreviewDomainOrder(
        context.payload,
        context.run,
        domain,
        registrant,
        { includedProviderPrice: catalogDomainAllowance() },
      )
      readyRun = ready.run
      readyDomain = ready.domain
      const orderState = normalizeDomainOrderState(ready.run.domainOrder)
      const providerPrice = orderState.providerPriceAmount && orderState.providerPriceCurrency
        ? { amount: orderState.providerPriceAmount, currency: orderState.providerPriceCurrency }
        : null
      if (!providerPrice || providerPrice.currency !== "EUR") {
        throw new Error("Checkout domain price is unavailable for the commercial quote.")
      }
      currentQuote = buildCheckoutQuote({
        billingPeriod,
        providerOperationPriceNetMinor: decimalMoneyToMinor(providerPrice.amount),
        selectedDomain: ready.domain,
        providerQuotedAt: orderState.checkedAt ?? new Date().toISOString(),
        profileVersion: checkoutProfile.profileVersion,
        draftVersion: acceptedQuote.draftVersion,
      })
    }
    logPreviewCheckoutTiming(
      "payment_domain_check",
      domainStart,
      {
        clientSlug: context.clientSlug,
        domain: readyDomain,
      },
      { mode: acceptedQuote.domainMode },
    )
    if (!sameCommercialCheckoutQuote(acceptedQuote, currentQuote)) {
      return {
        ok: false,
        status: "version_conflict",
        message: t("checkoutQuoteVersionConflict"),
        quotes: issueCheckoutQuoteSet({
          domain: readyDomain,
          providerPriceNetMinor: currentQuote.providerOperationPriceNetMinor,
          providerQuotedAt: currentQuote.providerQuotedAt,
          profileVersion: checkoutProfile.profileVersion,
          draftVersion: currentQuote.draftVersion,
          domainMode: currentQuote.domainMode,
          migrationClassification: currentQuote.migrationClassification,
          migrationSourceMechanism: currentQuote.migrationSourceMechanism,
          migrationSourceZoneHash: currentQuote.migrationSourceZoneHash,
          migrationPublicEvidenceHash:
            currentQuote.migrationPublicEvidenceHash,
          gtldTransferEligibilityDeclarationVersion:
            currentQuote.gtldTransferEligibilityDeclarationVersion,
          gtldTransferEligibilityDeclarationText:
            currentQuote.gtldTransferEligibilityDeclarationText,
          gtldTransferEligibilityAccepted:
            currentQuote.gtldTransferEligibilityAccepted,
          migrationInputEnvelope: currentQuote.migrationInputEnvelope,
          migrationSecretKey: currentQuote.migrationSecretKey,
        }),
      }
    }
    if (acceptedQuote.domainMode === "existing_domain") {
      if (acceptedQuote.migrationInputEnvelope) {
        if (
          acceptedMigrationInput?.schemaVersion === 2 &&
          acceptedMigrationInput.sourceRefreshCredential.kind ===
            "cloudflare_oauth"
        ) {
          const authorizationKey = String(
            formData.get("cloudflareSourceAuthorization") ?? "",
          ).trim()
          if (
            !authorizationKey ||
            authorizationKey !==
              acceptedMigrationInput.sourceRefreshCredential.authorizationKey
          ) {
            return {
              ok: false,
              status: "version_conflict",
              message: t("checkoutQuoteVersionConflict"),
            }
          }
          sourceAuthorization = await loadCloudflareSourceAuthorization(
            context.payload,
            {
              authorizationKey,
              generationRunId: context.run.id,
              tenantId: context.tenant.id,
              clientSlug: context.clientSlug,
              customerEmail: context.customerEmail,
              domain,
            },
          )
          if (
            domainMigrationSourceAuthorityHash(
              sourceAuthorization.source.zone,
            ) !== acceptedQuote.migrationSourceZoneHash
          ) {
            return {
              ok: false,
              status: "version_conflict",
              message: t("checkoutQuoteVersionConflict"),
            }
          }
        }
        await persistMigrationCheckoutSecret(context.payload, {
          generationRunId: context.run.id,
          domain: readyDomain,
          sourceZoneHash: acceptedQuote.migrationSourceZoneHash!,
          encryptedInput: acceptedQuote.migrationInputEnvelope,
        })
        if (sourceAuthorization) {
          await attachCloudflareSourceAuthorization(
            context.payload,
            sourceAuthorization.record,
          )
        }
      } else {
        await openAttachedMigrationCheckoutSecret(context.payload, {
          secretKey: acceptedQuote.migrationSecretKey!,
          orderId: acceptedOrderId,
          generationRunId: context.run.id,
          domain: readyDomain,
          sourceZoneHash: acceptedQuote.migrationSourceZoneHash!,
        })
      }
    }
    const audit = await requestAudit()
    const approvalEvidence = await createSiteApprovalEvidence({
      payload: context.payload,
      run: readyRun,
      tenant: context.tenant,
      pages: context.pages,
      domain: readyDomain,
      actorEmail: context.customerEmail,
      requestId: audit.requestId,
    })
    const legalEvidence = await createOrderAndAcceptanceEvidence({
      payload: context.payload,
      run: readyRun,
      tenant: context.tenant,
      approval: approvalEvidence.approval,
      checkoutProfile: checkoutProfile as CheckoutProfile,
      quote: acceptedQuote,
      domainRegistrant: registrant,
      domain: readyDomain,
      requestId: audit.requestId,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })
    if (acceptedQuote.domainMode === "existing_domain") {
      await attachMigrationCheckoutSecret(context.payload, {
        secretKey: acceptedQuote.migrationSecretKey!,
        orderId: legalEvidence.order.id,
        generationRunId: context.run.id,
        domain: readyDomain,
        sourceZoneHash: acceptedQuote.migrationSourceZoneHash!,
      })
    }
    await satisfyRequirementsFromTransaction({
      payload: context.payload,
      tenantId: context.tenant.id,
      actorEmail: context.customerEmail,
      documentId: legalEvidence.terms.id,
      acceptanceId: legalEvidence.acceptance.id,
      acceptedAt: legalEvidence.acceptance.acceptedAt,
    })
    const approvalStart = startPreviewCheckoutTimer()
    const approved = await context.payload.update({
      collection: "site-generation-runs",
      id: readyRun.id,
      data: {
        clientApproval: {
          status: "approved",
          approvedAt: approvalEvidence.approval.approvedAt,
          approvalEvidenceId: approvalEvidence.approval.id,
          reviewRevisionId: approvalEvidence.revision.id,
          snapshotHash: approvalEvidence.snapshotHash,
          actorEmail: context.customerEmail,
        },
      },
      depth: 0,
      overrideAccess: true,
    }) as typeof context.run
    logPreviewCheckoutTiming("payment_approval_update", approvalStart, {
      clientSlug: context.clientSlug,
      domain: readyDomain,
    })
    const mollieStart = startPreviewCheckoutTimer()
    const checkout = await createMollieCheckoutForGenerationRun(context.payload, {
      runId: approved.id,
      customerEmail: context.customerEmail,
      clientSlug: context.clientSlug,
      selectedDomain: readyDomain,
      actor: context.customerEmail,
      orderId: legalEvidence.order.id,
    })
    logPreviewCheckoutTiming("payment_mollie_checkout", mollieStart, {
      clientSlug: context.clientSlug,
      domain: readyDomain,
    })
    logPreviewCheckoutTiming("payment_total", totalStart, {
      clientSlug: context.clientSlug,
      domain: readyDomain,
    }, { ok: true })
    return {
      ok: true,
      message: t("checkoutRedirectingToPayment"),
      checkoutUrl: checkout.checkoutUrl,
    }
  } catch (error) {
    logPreviewCheckoutTiming("payment_total", totalStart, { clientSlug: context.clientSlug, domain }, {
      ok: false,
      status: error instanceof Error && error.message === "Payment gate is already satisfied."
        ? "payment_complete"
        : domainErrorStatus(error),
    })
    if (error instanceof Error && error.message === "Payment gate is already satisfied.") {
      return { ok: false, status: "payment_complete", message: t("checkoutPaymentAlreadyComplete") }
    }
    if (error instanceof Error && error.message.startsWith("Invalid domain")) {
      return { ok: false, status: "invalid", message: t("checkoutDomainInvalid") }
    }
    if (
      error instanceof Error &&
      ["checkoutDomainUnavailable", "checkoutDomainPremium", "checkoutDomainCheckFailed"].includes(error.message)
    ) {
      return { ok: false, status: domainErrorStatus(error), message: safeCheckoutErrorMessage(error, t, domain) }
    }
    if (error instanceof MollieApiError) {
      console.error("Preview checkout operation failed", {
        operation: "payment_start",
        code: "provider_http_failure",
        providerStatus: error.status,
      })
    } else {
      console.error("Preview checkout operation failed", {
        operation: "payment_start",
        code: "unexpected_failure",
      })
    }
    return { ok: false, status: "payment_error", message: t("checkoutPaymentFailed") }
  }
}

export async function schedulePreviewCheckoutCancellationAction(
  clientSlug: string,
  _previousState: PreviewCheckoutCancellationState,
  _formData: FormData,
): Promise<PreviewCheckoutCancellationState> {
  const t = await getTranslations("preview")
  try {
    const context = await requirePreviewCheckoutActorContext(clientSlug)
    const agreement = await loadCustomerBillingAgreement(context.payload, {
      generationRunId: context.run.id,
      tenantId: context.tenant.id,
      customerEmail: context.customerEmail,
    })
    if (
      !agreement ||
      !["active", "past_due", "suspended", "cancellation_scheduled", "cancelled"]
        .includes(agreement.state)
    ) {
      return {
        ok: false,
        status: "unavailable",
        message: t("checkoutCancellationUnavailable"),
        agreement,
      }
    }
    const audit = await requestAudit()
    const cancelled = await scheduleCancellationAtPeriodEnd({
      payload: context.payload,
      agreementId: agreement.id,
      tenantId: context.tenant.id,
      actorUserId: context.previewUserId,
      actorEmail: context.customerEmail,
      requestId: audit.requestId,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })
    const view: CustomerBillingAgreementView = {
      id: cancelled.id,
      state: cancelled.state,
      billingPeriod: cancelled.billingPeriod,
      currentPeriodEndsAt: cancelled.currentPeriodEndsAt ?? null,
      cancelAt: cancelled.cancelAt ?? null,
      updatedAt: cancelled.updatedAt,
    }
    revalidatePath(`/${context.clientSlug}/checkout`)
    return {
      ok: true,
      status: "scheduled",
      message: t("checkoutCancellationScheduled"),
      agreement: view,
    }
  } catch {
    console.error("Preview checkout cancellation failed", {
      operation: "schedule_cancellation",
      code: "bounded_failure",
    })
    return {
      ok: false,
      status: "failed",
      message: t("checkoutCancellationFailed"),
    }
  }
}

export async function loadPreviewCheckoutLiveStatusAction(
  clientSlug: string,
): Promise<PreviewCheckoutLiveStatus> {
  const context = await requirePreviewCheckoutContext(clientSlug)
  const [migrationStatus, provisioningStatus, billingAgreement] =
    await Promise.all([
      loadCustomerMigrationStatus(context.payload, {
        generationRunId: context.run.id,
        customerEmail: context.customerEmail,
      }),
      loadCustomerProvisioningStatus(context.payload, {
        generationRunId: context.run.id,
        customerEmail: context.customerEmail,
      }),
      loadCustomerBillingAgreement(context.payload, {
        generationRunId: context.run.id,
        tenantId: context.tenant.id,
        customerEmail: context.customerEmail,
      }),
    ])
  return {
    paymentStatus:
      normalizeGenerationRunPaymentState(context.run.payment).status,
    migrationStatus,
    provisioningStatus,
    billingAgreement,
  }
}
