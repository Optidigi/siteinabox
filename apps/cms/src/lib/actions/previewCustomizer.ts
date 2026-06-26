"use server"

import { headers } from "next/headers"
import { previewAuth } from "@/lib/preview/betterAuth"
import {
  approvePreview,
  approvePreviewForGrant,
  persistPreviewTheme,
  persistPreviewThemeForGrant,
  type PreviewCustomizerAccess,
  type PreviewApprovalState,
  type PreviewPaymentState,
} from "@/lib/preview/customizer"
import { loadPreviewGrantContext } from "@/lib/preview/previewAccess"
import { createMollieCheckoutForGenerationRun } from "@/lib/payments/molliePayments"
import type { ThemeTokens } from "@/lib/theme/schema"

const previewSessionEmail = async (): Promise<string> => {
  const session = await previewAuth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  })
  const email = session?.user?.email
  if (!email) throw new Error("Preview login required")
  return email
}

export async function setPreviewTheme(access: PreviewCustomizerAccess, theme: ThemeTokens) {
  if (access.type === "legacy-token") return persistPreviewTheme(access.token, theme)
  return persistPreviewThemeForGrant({
    clientSlug: access.clientSlug,
    customerEmail: await previewSessionEmail(),
    theme,
  })
}

export async function approvePreviewSite(access: PreviewCustomizerAccess): Promise<{
  approval: PreviewApprovalState
  payment: PreviewPaymentState
}> {
  if (access.type === "legacy-token") return approvePreview(access.token)
  return approvePreviewForGrant({
    clientSlug: access.clientSlug,
    customerEmail: await previewSessionEmail(),
  })
}

export async function createPreviewMollieCheckout(access: PreviewCustomizerAccess): Promise<{
  checkoutUrl: string
  payment: PreviewPaymentState
  reused: boolean
}> {
  if (access.type === "legacy-token") {
    throw new Error("Customer checkout requires Better Auth preview access.")
  }
  const customerEmail = await previewSessionEmail()
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
