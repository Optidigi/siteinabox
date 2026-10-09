"use server"

import { recordVerifiedPreviewActivity } from "@/lib/preview/authenticatedPreviewActivity"
import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { readVerifiedPreviewSession } from "@/lib/auth/verifiedPreviewSession"
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

const previewSessionEmail = async (loginRequiredMessage: string, clientSlug: string): Promise<string> => {
  const headerStore = await headers()
  const session = await readVerifiedPreviewSession(headerStore)
  const email = session?.user?.email
  if (!email) throw new Error(loginRequiredMessage)
  await loadPreviewGrantContext({ clientSlug, email })
  await recordVerifiedPreviewActivity(headerStore, clientSlug)
  return email
}


export async function setPreviewTheme(access: PreviewCustomizerAccess, theme: ThemeTokens) {
  if (isPreviewFixtureRoute(access.clientSlug)) return theme

  const t = await getTranslations("preview")
  return persistPreviewThemeForGrant({
    clientSlug: access.clientSlug,
    customerEmail: await previewSessionEmail(t("previewLoginRequired"), access.clientSlug),
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
    customerEmail: await previewSessionEmail(t("previewLoginRequired"), access.clientSlug),
  })
}

export async function createPreviewMollieCheckout(access: PreviewCustomizerAccess): Promise<{
  checkoutUrl: string
  payment: PreviewPaymentState
  reused: boolean
}> {
  const t = await getTranslations("preview")
  const customerEmail = await previewSessionEmail(t("previewLoginRequired"), access.clientSlug)
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
