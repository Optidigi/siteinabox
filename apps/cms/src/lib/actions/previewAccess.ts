"use server"

import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { previewAuth } from "@/lib/preview/betterAuth"
import { createOrRefreshPreviewGrant } from "@/lib/preview/previewAccess"
import { previewAuthRequestHeaders, PUBLIC_PREVIEW_ORIGIN } from "@/lib/preview/previewHost"
import { createPreviewSiteReadyAuthorization } from "@/lib/preview/trustedSiteReadyIntent"

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
    const previewUrl = `${PUBLIC_PREVIEW_ORIGIN}/${grant.clientSlug}`
    const previewSiteReadyAuthorization = createPreviewSiteReadyAuthorization({
      email,
      clientSlug: grant.clientSlug,
    })
    await (previewAuth.api).signInMagicLink({
      body: {
        email,
        callbackURL: previewUrl,
        errorCallbackURL: previewUrl,
        metadata: {
          previewClientSlug: grant.clientSlug,
          previewSiteReady: true,
          previewSiteReadyAuthorization,
        },
      },
      headers: previewAuthRequestHeaders(await headers()),
    })

    return { ok: true, previewUrl, message: t("previewMagicLinkSent") }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : t("previewAccessSendFailed"),
    }
  }
}
