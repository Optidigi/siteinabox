"use server"

import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { previewAuth } from "@/lib/preview/betterAuth"
import { createOrRefreshPreviewGrant } from "@/lib/preview/previewAccess"
import { PREVIEW_HOST } from "@/lib/preview/previewHost"

export type PreviewAccessActionState = {
  ok: boolean
  previewUrl?: string
  message: string
}

const requireSuperAdmin = async (forbiddenMessage: string) => {
  const payload = await getPayload({ config })
  const authResult = await payload.auth({ headers: await headers() })
  if (authResult.user?.role !== "super-admin") {
    throw new Error(forbiddenMessage)
  }
}

const previewAuthHeaders = async (): Promise<Headers> => {
  const source = await headers()
  const next = new Headers(source)
  next.set("host", PREVIEW_HOST)
  next.set("x-forwarded-host", PREVIEW_HOST)
  next.set("x-forwarded-proto", "https")
  return next
}

export async function sendPreviewAccessAction(
  generationRunId: string | number,
  _state: PreviewAccessActionState,
  formData: FormData,
): Promise<PreviewAccessActionState> {
  const t = await getTranslations("preview")
  try {
    await requireSuperAdmin(t("superAdminRequired"))
    const email = String(formData.get("email") ?? "").trim().toLowerCase()
    if (!email) return { ok: false, message: t("customerEmailRequired") }

    const grant = await createOrRefreshPreviewGrant({
      generationRunId,
      customerEmail: email,
      sendEmail: true,
    })
    const previewUrl = `https://${PREVIEW_HOST}/${grant.clientSlug}`
    await (previewAuth.api as any).signInMagicLink({
      body: {
        email,
        callbackURL: previewUrl,
        errorCallbackURL: previewUrl,
        metadata: {
          previewClientSlug: grant.clientSlug,
          previewSiteReady: true,
        },
      },
      headers: await previewAuthHeaders(),
    })

    return { ok: true, previewUrl, message: t("previewMagicLinkSent") }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : t("previewAccessSendFailed"),
    }
  }
}
