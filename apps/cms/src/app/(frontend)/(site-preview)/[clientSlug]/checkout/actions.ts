"use server"

import { headers } from "next/headers"
import { getLocale, getTranslations } from "next-intl/server"
import { previewAuth } from "@/lib/preview/betterAuth"
import { loadPreviewGrantContext, normalizePreviewClientSlug } from "@/lib/preview/previewAccess"
import { checkAndRecordPreviewDomainOrder, requireReadyPreviewDomainOrder } from "@/lib/domains/previewDomainOrder"
import {
  fixedDomainOrderPriceFromEnv,
  normalizeDomainRegistrantDetails,
  type FixedDomainOrderPrice,
} from "@/lib/domains/orderState"
import { createMollieCheckoutForGenerationRun } from "@/lib/payments/molliePayments"

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

const requirePreviewCheckoutContext = async (clientSlug: string) => {
  const t = await getTranslations("preview")
  const session = await previewAuth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  })
  const customerEmail = session?.user?.email
  if (!customerEmail) throw new Error(t("previewLoginRequired"))

  return loadPreviewGrantContext({
    clientSlug: normalizePreviewClientSlug(clientSlug),
    email: customerEmail,
  })
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
  const t = await getTranslations("preview")
  const context = await requirePreviewCheckoutContext(clientSlug)

  const domain = String(formData.get("domain") ?? "").trim().toLowerCase()
  if (!domain) return { ok: false, message: t("checkoutDomainRequired") }
  const registrant = registrantFromFormData(formData)

  try {
    const locale = await getLocale()
    const result = await checkAndRecordPreviewDomainOrder(context.payload, context.run, domain, registrant)
    const extraFee = result.extraFeeAmount && result.extraFeeCurrency
      ? { amount: result.extraFeeAmount, currency: result.extraFeeCurrency }
      : null
    const totalPrice = addMoney(fixedDomainOrderPriceFromEnv(), extraFee)
    return {
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
      suggestions: result.suggestions.map((suggestion) => {
        const suggestionExtraFee = suggestion.extraFeeAmount && suggestion.extraFeeCurrency
          ? { amount: suggestion.extraFeeAmount, currency: suggestion.extraFeeCurrency }
          : null
        return {
          ...suggestion,
          extraFeeLabel: formatMoney(locale, suggestionExtraFee),
        }
      }),
    }
  } catch (error) {
    return {
      ok: false,
      status: domainErrorStatus(error),
      message: safeCheckoutErrorMessage(error, t, domain),
    }
  }
}

export async function startPreviewCheckoutPaymentAction(
  clientSlug: string,
  _previousState: PreviewCheckoutActionState,
  formData: FormData,
): Promise<PreviewCheckoutActionState> {
  const t = await getTranslations("preview")
  const context = await requirePreviewCheckoutContext(clientSlug)

  const domain = String(formData.get("domain") ?? "").trim().toLowerCase()
  if (!domain) return { ok: false, message: t("checkoutDomainRequired") }
  const registrant = registrantFromFormData(formData)
  if (!registrant) return { ok: false, message: t("checkoutRegistrantRequired") }

  try {
    const ready = await requireReadyPreviewDomainOrder(context.payload, context.run, domain, registrant)
    const approved = await context.payload.update({
      collection: "site-generation-runs",
      id: ready.run.id,
      data: {
        clientApproval: { status: "approved", approvedAt: new Date().toISOString() },
      } as any,
      depth: 0,
      overrideAccess: true,
    }) as typeof context.run
    const checkout = await createMollieCheckoutForGenerationRun(context.payload, {
      runId: approved.id,
      customerEmail: context.customerEmail,
      clientSlug: context.clientSlug,
      selectedDomain: ready.domain,
      actor: context.customerEmail,
    })
    return {
      ok: true,
      message: t("checkoutRedirectingToPayment"),
      checkoutUrl: checkout.checkoutUrl,
    }
  } catch (error) {
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
    console.error("Preview checkout payment error", error)
    return { ok: false, status: "payment_error", message: t("checkoutPaymentFailed") }
  }
}
