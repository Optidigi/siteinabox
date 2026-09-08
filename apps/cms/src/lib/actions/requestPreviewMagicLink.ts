"use server"

import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { previewAuth } from "@/lib/preview/betterAuth"
import { normalizePreviewClientSlug } from "@/lib/preview/previewAccess"
import { previewAuthRequestHeaders } from "@/lib/preview/previewHost"

export type RequestPreviewMagicLinkState = {
  ok: boolean
  message: string
}

export async function requestPreviewMagicLinkAction(
  clientSlug: string,
  callbackPath: string,
  _state: RequestPreviewMagicLinkState,
  formData: FormData,
): Promise<RequestPreviewMagicLinkState> {
  const t = await getTranslations("preview")
  const genericSuccess = t("magicLinkGenericSuccess")
  try {
    const normalizedClientSlug = normalizePreviewClientSlug(clientSlug)
    const email = String(formData.get("email") ?? "").trim().toLowerCase()
    if (!normalizedClientSlug || !email) {
      return { ok: false, message: t("emailRequired") }
    }

    await (previewAuth.api).signInMagicLink({
      body: {
        email,
        callbackURL: callbackPath,
        errorCallbackURL: callbackPath,
        metadata: { previewClientSlug: normalizedClientSlug },
      },
      headers: previewAuthRequestHeaders(await headers()),
    })
    return { ok: true, message: genericSuccess }
  } catch (error) {
    console.error("Preview magic-link request failed", error)
    return { ok: true, message: genericSuccess }
  }
}
