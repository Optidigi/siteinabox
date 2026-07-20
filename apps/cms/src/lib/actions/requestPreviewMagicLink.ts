"use server"

import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { previewAuth } from "@/lib/preview/betterAuth"
import { normalizePreviewClientSlug } from "@/lib/preview/previewAccess"
import { PREVIEW_HOST } from "@/lib/preview/previewHost"

export type RequestPreviewMagicLinkState = {
  ok: boolean
  message: string
}

const previewAuthHeaders = (source: Headers): Headers => {
  const next = new Headers(source)
  next.set("host", PREVIEW_HOST)
  next.set("x-forwarded-host", PREVIEW_HOST)
  next.set("x-forwarded-proto", "https")
  return next
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
      headers: previewAuthHeaders(await headers()),
    })
    return { ok: true, message: genericSuccess }
  } catch (error) {
    console.error("Preview magic-link request failed", error)
    return { ok: true, message: genericSuccess }
  }
}
