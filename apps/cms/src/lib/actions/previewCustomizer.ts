"use server"

import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { getVerifiedPreviewCustomer } from "@/lib/auth/verifiedPreviewSession"
import {
  approvePreviewForGrant,
  persistPreviewThemeForGrant,
  type PreviewCustomizerAccess,
  type PreviewApprovalState,
  type PreviewPaymentState,
} from "@/lib/preview/customizer"
import { isPreviewFixtureRoute } from "@/lib/preview/previewFixture"
import { loadPreviewGrantContext } from "@/lib/preview/previewAccess"
import { createMollieCheckoutForGenerationRun } from "@/lib/payments/molliePayments"
import type { ThemeTokens } from "@/lib/theme/schema"

const requirePreviewCustomer = async (loginRequiredMessage: string) => {
  const customer = await getVerifiedPreviewCustomer(await headers())
  if (!customer) throw new Error(loginRequiredMessage)
  return customer
}


export async function setPreviewTheme(access: PreviewCustomizerAccess, theme: ThemeTokens) {
  if (isPreviewFixtureRoute(access.clientSlug)) return theme

  const t = await getTranslations("preview")
  const customer = await requirePreviewCustomer(t("previewLoginRequired"))
  return persistPreviewThemeForGrant({
    clientSlug: access.clientSlug,
    customerEmail: customer.account.email,
    customerAuthority: customer.authority,
    theme,
  })
}

export async function approvePreviewSite(access: PreviewCustomizerAccess): Promise<{
  approval: PreviewApprovalState
  payment: PreviewPaymentState
}> {
  const t = await getTranslations("preview")
  const customer = await requirePreviewCustomer(t("previewLoginRequired"))
  return approvePreviewForGrant({
    clientSlug: access.clientSlug,
    customerEmail: customer.account.email,
    customerAuthority: customer.authority,
  })
}

export async function createPreviewMollieCheckout(access: PreviewCustomizerAccess): Promise<{
  checkoutUrl: string
  payment: PreviewPaymentState
  reused: boolean
}> {
  const t = await getTranslations("preview")
  const customer = await requirePreviewCustomer(t("previewLoginRequired"))
  const customerEmail = customer.account.email
  const context = await loadPreviewGrantContext({
    clientSlug: access.clientSlug,
    email: customerEmail,
    customerAuthority: customer.authority,
    intent: "purchase",
    renewExpired: true,
  })
  const result = await createMollieCheckoutForGenerationRun(context.payload, {
    runId: context.run.id,
    customerEmail,
    clientSlug: context.clientSlug,
    actor: customerEmail,
  })
  return result
}
