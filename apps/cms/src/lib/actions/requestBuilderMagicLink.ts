"use server"

import { headers } from "next/headers"
import { getPayload } from "payload"
import { previewAuth } from "@/lib/preview/betterAuth"
import { previewAuthRequestHeaders } from "@/lib/preview/previewHost"
import { isPreviewRequestAuthority } from "@/lib/requestAuthority"
import { upsertBuilderRegistration } from "@/lib/builder/sessionStore"
import { BuilderLegalSchema, normalizeBuilderEmail } from "@/lib/builder/thread"
import { loadLatestActivePreviewGrant } from "@/lib/preview/previewAccess"
import config from "@/payload.config"

export type RequestBuilderMagicLinkState = {
  ok: boolean
  message: string
}

export const BUILDER_MAGIC_LINK_GENERIC_SUCCESS =
  "Als dit e-mailadres bij ons bekend is of net is geregistreerd, sturen we een inloglink."

export async function requestBuilderMagicLinkAction(
  _state: RequestBuilderMagicLinkState,
  formData: FormData,
): Promise<RequestBuilderMagicLinkState> {
  const headerStore = await headers()
  if (!isPreviewRequestAuthority(headerStore)) {
    return { ok: false, message: "Niet beschikbaar." }
  }
  const intent = String(formData.get("intent") ?? "login")
  const email = normalizeBuilderEmail(String(formData.get("email") ?? ""))
  if (!email || !email.includes("@")) {
    return { ok: false, message: "Vul een geldig e-mailadres in." }
  }

  try {
    if (intent === "register") {
      const displayName = String(formData.get("displayName") ?? "").trim()
      const legal = BuilderLegalSchema.safeParse({
        businessUseAccepted: formData.get("businessUseAccepted") === "on" || formData.get("businessUseAccepted") === "true",
        termsAccepted: formData.get("termsAccepted") === "on" || formData.get("termsAccepted") === "true",
        marketingOptIn: formData.get("marketingOptIn") === "on" || formData.get("marketingOptIn") === "true",
      })
      if (displayName.length < 2) {
        return { ok: false, message: "Vul je naam in." }
      }
      if (!legal.success || !legal.data.businessUseAccepted || !legal.data.termsAccepted) {
        return { ok: false, message: "Bevestig dat je dit voor je bedrijf aanvraagt en dat je akkoord gaat met de voorwaarden." }
      }
      const payload = await getPayload({ config })
      await upsertBuilderRegistration(payload, {
        email,
        displayName,
        legal: legal.data,
      })
    }

    let callbackURL = "/builder"
    if (intent !== "register") {
      const payload = await getPayload({ config })
      const grant = await loadLatestActivePreviewGrant(email, payload)
      if (typeof grant?.clientSlug === "string" && grant.clientSlug.trim()) {
        callbackURL = `/builder/${grant.clientSlug}`
      }
    }

    await (previewAuth.api).signInMagicLink({
      body: {
        email,
        callbackURL,
        errorCallbackURL: "/login",
      },
      headers: previewAuthRequestHeaders(headerStore),
    })
    return { ok: true, message: BUILDER_MAGIC_LINK_GENERIC_SUCCESS }
  } catch (error) {
    console.error("Builder magic-link request failed", error)
    return { ok: true, message: BUILDER_MAGIC_LINK_GENERIC_SUCCESS }
  }
}

export async function signOutBuilderAction(): Promise<void> {
  const headerStore = await headers()
  if (!isPreviewRequestAuthority(headerStore)) return
  await (previewAuth.api).signOut({
    headers: previewAuthRequestHeaders(headerStore),
  }).catch(() => null)
}
