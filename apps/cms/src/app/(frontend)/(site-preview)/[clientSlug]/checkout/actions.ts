"use server"

import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { previewAuth } from "@/lib/preview/betterAuth"
import { loadPreviewGrantContext, normalizePreviewClientSlug } from "@/lib/preview/previewAccess"
import { checkAndRecordPreviewDomainOrder, requireReadyPreviewDomainOrder } from "@/lib/domains/previewDomainOrder"
import { normalizeDomainRegistrantDetails } from "@/lib/domains/orderState"
import { createMollieCheckoutForGenerationRun } from "@/lib/payments/molliePayments"

export type PreviewCheckoutActionState = {
  ok: boolean
  message: string
  checkoutUrl?: string
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
    const result = await checkAndRecordPreviewDomainOrder(context.payload, context.run, domain, registrant)
    return { ok: result.messageKey === "checkoutDomainAvailable", message: t(result.messageKey, { domain: result.domain }) }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : t("checkoutDomainCheckFailed", { domain }),
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
    const checkoutErrorKeys = new Set(["checkoutDomainUnavailable", "checkoutDomainPremium", "checkoutDomainCheckFailed", "checkoutDomainTooExpensive"])
    const message = error instanceof Error && checkoutErrorKeys.has(error.message)
      ? t(error.message as "checkoutDomainUnavailable" | "checkoutDomainPremium" | "checkoutDomainCheckFailed" | "checkoutDomainTooExpensive", { domain })
      : error instanceof Error
        ? error.message
        : t("checkoutFailed")
    return { ok: false, message }
  }
}
