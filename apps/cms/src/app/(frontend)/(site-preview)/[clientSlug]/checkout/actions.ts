"use server"

import { getLocale, getTranslations } from "next-intl/server"
import { checkAndRecordPreviewDomainOrder, requireReadyPreviewDomainOrder, suggestAvailablePreviewDomainBatch } from "@/lib/domains/previewDomainOrder"
import {
  fixedDomainOrderPriceFromEnv,
  maxDomainProviderPriceFromEnv,
  normalizeDomainRegistrantDetails,
  type FixedDomainOrderPrice,
} from "@/lib/domains/orderState"
import { createMollieCheckoutForGenerationRun } from "@/lib/payments/molliePayments"
import { MollieApiError } from "@/lib/payments/mollieAdapter"
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
  status?: "idle" | "available" | "available_extra" | "unavailable" | "premium" | "invalid" | "service_error" | "payment_error" | "payment_complete" | "redirecting"
  checkoutUrl?: string
  domain?: string
  included?: boolean
  extraFeeAmount?: string | null
  extraFeeCurrency?: string | null
  extraFeeLabel?: string | null
  totalPriceLabel?: string | null
  suggestions?: PreviewCheckoutDomainOption[]
}

export type PreviewCheckoutSuggestionsState = {
  ok: boolean
  domain?: string
  suggestions?: PreviewCheckoutDomainOption[]
  cursor?: number
  done?: boolean
}

const textField = (formData: FormData, key: string): string | null => {
  const value = String(formData.get(key) ?? "").trim()
  return value || null
}

const registrantFromFormData = (formData: FormData) =>
  normalizeDomainRegistrantDetails({
    companyName: textField(formData, "companyName"),
    firstName: textField(formData, "firstName"),
    lastName: textField(formData, "lastName"),
    email: textField(formData, "registrantEmail"),
    street: textField(formData, "street"),
    number: textField(formData, "number"),
    suffix: textField(formData, "suffix"),
    zipcode: textField(formData, "zipcode"),
    city: textField(formData, "city"),
    country: textField(formData, "country") ?? "NL",
    state: textField(formData, "state"),
    phoneCountryCode: textField(formData, "phoneCountryCode") ?? "+31",
    phoneAreaCode: textField(formData, "phoneAreaCode"),
    phoneSubscriberNumber: textField(formData, "phoneSubscriberNumber"),
    locale: "nl_NL",
  })

const formatMoney = (locale: string, price: FixedDomainOrderPrice | null): string | null => {
  if (!price) return null
  const amount = Number(price.amount)
  if (!Number.isFinite(amount)) return `${price.currency} ${price.amount}`
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: price.currency,
  }).format(amount)
}

const addMoney = (base: FixedDomainOrderPrice, extra: FixedDomainOrderPrice | null): FixedDomainOrderPrice => {
  if (!extra || extra.currency !== base.currency) return base
  const baseCents = Math.round(Number(base.amount) * 100)
  const extraCents = Math.round(Number(extra.amount) * 100)
  if (!Number.isFinite(baseCents) || !Number.isFinite(extraCents)) return base
  const totalCents = baseCents + extraCents
  return {
    amount: `${Math.floor(totalCents / 100)}.${String(totalCents % 100).padStart(2, "0")}`,
    currency: base.currency,
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
  if (!domain) return { ok: false, message: t("checkoutDomainRequired") }
  const registrant = registrantFromFormData(formData)

  try {
    const locale = await getLocale()
    const providerStart = startPreviewCheckoutTimer()
    const result = await checkAndRecordPreviewDomainOrder(context.payload, context.run, domain, registrant, { record: false })
    logPreviewCheckoutTiming("primary_check_provider", providerStart, { clientSlug: context.clientSlug, domain: result.domain }, {
      status: result.messageKey,
    })
    const extraFee = result.extraFeeAmount && result.extraFeeCurrency
      ? { amount: result.extraFeeAmount, currency: result.extraFeeCurrency }
      : null
    const totalPrice = addMoney(fixedDomainOrderPriceFromEnv(), extraFee)
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
      totalPriceLabel: formatMoney(locale, totalPrice),
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
    }
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
    const batch = await suggestAvailablePreviewDomainBatch(domain, maxDomainProviderPriceFromEnv(), {
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

  const domain = String(formData.get("domain") ?? "").trim().toLowerCase()
  if (!domain) return { ok: false, message: t("checkoutDomainRequired") }
  const registrant = registrantFromFormData(formData)
  if (!registrant) return { ok: false, message: t("checkoutRegistrantRequired") }

  try {
    const domainStart = startPreviewCheckoutTimer()
    const ready = await requireReadyPreviewDomainOrder(context.payload, context.run, domain, registrant)
    logPreviewCheckoutTiming("payment_domain_check", domainStart, { clientSlug: context.clientSlug, domain: ready.domain })
    const approvalStart = startPreviewCheckoutTimer()
    const approved = await context.payload.update({
      collection: "site-generation-runs",
      id: ready.run.id,
      data: {
        clientApproval: { status: "approved", approvedAt: new Date().toISOString() },
      } as any,
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
