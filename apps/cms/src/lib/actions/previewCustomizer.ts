"use server"

import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { previewAuth } from "@/lib/preview/betterAuth"
import {
  approvePreviewForGrant,
  persistPreviewThemeForGrant,
  type PreviewCustomizerAccess,
  type PreviewApprovalState,
  type PreviewPaymentState,
} from "@/lib/preview/customizer"
import { loadPreviewGrantContext } from "@/lib/preview/previewAccess"
import { createMollieCheckoutForGenerationRun } from "@/lib/payments/molliePayments"
import type { ThemeTokens } from "@/lib/theme/schema"

const previewSessionEmail = async (loginRequiredMessage: string): Promise<string> => {
  const session = await previewAuth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  })
  const email = session?.user?.email
  if (!email) throw new Error(loginRequiredMessage)
  return email
}

export async function setPreviewTheme(access: PreviewCustomizerAccess, theme: ThemeTokens) {
  const t = await getTranslations("preview")
  return persistPreviewThemeForGrant({
    clientSlug: access.clientSlug,
    customerEmail: await previewSessionEmail(t("previewLoginRequired")),
    theme,
  })
}

export async function approvePreviewSite(access: PreviewCustomizerAccess): Promise<{
  approval: PreviewApprovalState
  payment: PreviewPaymentState
}> {
  const t = await getTranslations("preview")
  return approvePreviewForGrant({
    clientSlug: access.clientSlug,
    customerEmail: await previewSessionEmail(t("previewLoginRequired")),
  })
}

export async function createPreviewMollieCheckout(access: PreviewCustomizerAccess): Promise<{
  checkoutUrl: string
  payment: PreviewPaymentState
  reused: boolean
}> {
  const t = await getTranslations("preview")
  const customerEmail = await previewSessionEmail(t("previewLoginRequired"))
  const context = await loadPreviewGrantContext({
    clientSlug: access.clientSlug,
    email: customerEmail,
  })
  const result = await createMollieCheckoutForGenerationRun(context.payload, {
    runId: context.run.id,
    customerEmail,
    clientSlug: context.clientSlug,
    actor: customerEmail,
  })
  return result
}
