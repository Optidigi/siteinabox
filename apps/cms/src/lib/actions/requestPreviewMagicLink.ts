"use server"

import { headers } from "next/headers"
import { previewAuth } from "@/lib/preview/betterAuth"
import { normalizePreviewClientSlug } from "@/lib/preview/previewAccess"

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
  const genericSuccess = "Als dit e-mailadres toegang heeft tot de preview, ontvang je een inloglink."
  try {
    const normalizedClientSlug = normalizePreviewClientSlug(clientSlug)
    const email = String(formData.get("email") ?? "").trim().toLowerCase()
    if (!normalizedClientSlug || !email) {
      return { ok: false, message: "E-mailadres is verplicht." }
    }

    await (previewAuth.api as any).signInMagicLink({
      body: {
        email,
        callbackURL: callbackPath,
        errorCallbackURL: callbackPath,
        metadata: { previewClientSlug: normalizedClientSlug },
      },
      headers: await headers(),
    })
    return { ok: true, message: genericSuccess }
  } catch (error) {
    console.error("Preview magic-link request failed", error)
    return { ok: true, message: genericSuccess }
  }
}
