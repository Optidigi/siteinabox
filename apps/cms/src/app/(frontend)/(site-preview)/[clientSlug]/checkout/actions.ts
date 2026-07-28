"use server"

import crypto from "node:crypto"
import { headers } from "next/headers"
import { getLocale, getTranslations } from "next-intl/server"
import {
  BUSINESS_USE_DECLARATION_VERSION,
  getCurrentLegalDocument,
} from "@siteinabox/legal-content"
import { COMMERCIAL_CATALOG } from "@siteinabox/contracts/commerce"
import type { CheckoutProfile } from "@/payload-types"
import {
  checkoutProfileDraftFromFormData,
  checkoutProfileView,
  domainRegistrantFromCheckoutProfile,
  loadLatestCheckoutProfile,
  saveCheckoutProfileVersion,
  type CheckoutProfileView,
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
import { checkAndRecordPreviewDomainOrder, requireReadyPreviewDomainOrder, suggestAvailablePreviewDomainBatch } from "@/lib/domains/previewDomainOrder"
import {
  normalizeDomainOrderState,
  type FixedDomainOrderPrice,
} from "@/lib/domains/orderState"
import { createOrderAndAcceptanceEvidence, createSiteApprovalEvidence } from "@/lib/legal/checkoutEvidence"
import { satisfyRequirementsFromTransaction } from "@/lib/legal/customerRequirements"
import { createMollieCheckoutForGenerationRun } from "@/lib/payments/molliePayments"
import { MollieApiError } from "@/lib/payments/mollieAdapter"
import { normalizeGenerationRunPaymentState } from "@/lib/payments/generationRunPayment"
import { logPreviewCheckoutTiming, startPreviewCheckoutTimer } from "@/lib/preview/domainCheckoutTiming"
import { requirePreviewCheckoutContext } from "./previewCheckoutContext"

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
  status?: "idle" | "available" | "available_extra" | "unavailable" | "premium" | "invalid" | "service_error" | "payment_error" | "payment_pending" | "payment_complete" | "redirecting" | "profile_conflict" | "version_conflict"
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
  console.error("Preview checkout domain error", error)
  return t("checkoutDomainServiceUnavailable")
}

const domainStatusFromMessageKey = (
  messageKey: Awaited<ReturnType<typeof checkAndRecordPreviewDomainOrder>>["messageKey"],
): NonNullable<PreviewCheckoutActionState["status"]> => {
  if (messageKey === "checkoutDomainAvailable") return "available"
  if (messageKey === "checkoutDomainAvailableExtraFee") return "available_extra"
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
  if (!domain) return { ok: false, message: t("checkoutDomainRequired"), requestToken }

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
      },
    )
    logPreviewCheckoutTiming("primary_check_provider", providerStart, { clientSlug: context.clientSlug, domain: result.domain }, {
      status: result.messageKey,
    })
    const extraFee = result.extraFeeAmount && result.extraFeeCurrency
      ? { amount: result.extraFeeAmount, currency: result.extraFeeCurrency }
      : null
    const canCheckout = result.messageKey === "checkoutDomainAvailable" ||
      result.messageKey === "checkoutDomainAvailableExtraFee"
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
      ok: result.messageKey === "checkoutDomainAvailable" || result.messageKey === "checkoutDomainAvailableExtraFee",
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
  let quotes: CheckoutQuoteSet | undefined
  if (selectedDomain) {
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

export async function suggestPreviewCheckoutDomainsAction(
  clientSlug: string,
  previousState: PreviewCheckoutSuggestionsState,
  formData: FormData,
): Promise<PreviewCheckoutSuggestionsState> {
  await requirePreviewCheckoutContext(clientSlug)

  const domain = String(formData.get("domain") ?? "").trim().toLowerCase()
  if (!domain) return { ok: false, suggestions: [], cursor: 0, done: true }

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
  } catch (error) {
    console.error("Preview checkout domain suggestions error", error)
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
  if (
    acceptedQuote.billingPeriod !== billingPeriod ||
    acceptedQuote.selectedDomain !== domain ||
    acceptedQuote.domainMode !== "new_registration" ||
    acceptedQuote.draftVersion !== String(context.run.updatedAt ?? "")
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

  try {
    const domainStart = startPreviewCheckoutTimer()
    const ready = await requireReadyPreviewDomainOrder(
      context.payload,
      context.run,
      domain,
      registrant,
      { includedProviderPrice: catalogDomainAllowance() },
    )
    logPreviewCheckoutTiming("payment_domain_check", domainStart, { clientSlug: context.clientSlug, domain: ready.domain })
    const audit = await requestAudit()
    const approvalEvidence = await createSiteApprovalEvidence({
      payload: context.payload,
      run: ready.run,
      tenant: context.tenant,
      pages: context.pages,
      domain: ready.domain,
      actorEmail: context.customerEmail,
      requestId: audit.requestId,
    })
    const orderState = normalizeDomainOrderState(ready.run.domainOrder)
    const providerPrice = orderState.providerPriceAmount && orderState.providerPriceCurrency
      ? { amount: orderState.providerPriceAmount, currency: orderState.providerPriceCurrency }
      : null
    if (!providerPrice || providerPrice.currency !== "EUR") {
      throw new Error("Checkout domain price is unavailable for the commercial quote.")
    }
    const currentQuote = buildCheckoutQuote({
      billingPeriod,
      providerOperationPriceNetMinor: decimalMoneyToMinor(providerPrice.amount),
      selectedDomain: ready.domain,
      providerQuotedAt: orderState.checkedAt ?? new Date().toISOString(),
      profileVersion: checkoutProfile.profileVersion,
      draftVersion: acceptedQuote.draftVersion,
    })
    if (!sameCommercialCheckoutQuote(acceptedQuote, currentQuote)) {
      return {
        ok: false,
        status: "version_conflict",
        message: t("checkoutQuoteVersionConflict"),
        quotes: issueCheckoutQuoteSet({
          domain: ready.domain,
          providerPriceNetMinor: currentQuote.providerOperationPriceNetMinor,
          providerQuotedAt: currentQuote.providerQuotedAt,
          profileVersion: checkoutProfile.profileVersion,
          draftVersion: currentQuote.draftVersion,
        }),
      }
    }
    const legalEvidence = await createOrderAndAcceptanceEvidence({
      payload: context.payload,
      run: ready.run,
      tenant: context.tenant,
      approval: approvalEvidence.approval,
      checkoutProfile: checkoutProfile as CheckoutProfile,
      quote: acceptedQuote,
      domainRegistrant: registrant,
      domain: ready.domain,
      requestId: audit.requestId,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })
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
      id: ready.run.id,
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
    logPreviewCheckoutTiming("payment_approval_update", approvalStart, { clientSlug: context.clientSlug, domain: ready.domain })
    const mollieStart = startPreviewCheckoutTimer()
    const checkout = await createMollieCheckoutForGenerationRun(context.payload, {
      runId: approved.id,
      customerEmail: context.customerEmail,
      clientSlug: context.clientSlug,
      selectedDomain: ready.domain,
      actor: context.customerEmail,
      orderId: legalEvidence.order.id,
    })
    logPreviewCheckoutTiming("payment_mollie_checkout", mollieStart, { clientSlug: context.clientSlug, domain: ready.domain })
    logPreviewCheckoutTiming("payment_total", totalStart, { clientSlug: context.clientSlug, domain: ready.domain }, { ok: true })
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
      console.error("Preview checkout payment error", {
        status: error.status,
        title: error.title,
        detail: error.detail,
      })
    } else {
      console.error("Preview checkout payment error", error)
    }
    return { ok: false, status: "payment_error", message: t("checkoutPaymentFailed") }
  }
}
