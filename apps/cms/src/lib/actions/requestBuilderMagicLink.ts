"use server"

import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { previewAuth } from "@/lib/preview/betterAuth"
import { previewAuthRequestHeaders } from "@/lib/preview/previewHost"
import { isPreviewRequestAuthority } from "@/lib/requestAuthority"
import {
  sendBuilderMagicLink,
  type RequestBuilderMagicLinkState,
} from "@/lib/builder/sendBuilderMagicLink"

export async function requestBuilderMagicLinkAction(
  _state: RequestBuilderMagicLinkState,
  formData: FormData,
): Promise<RequestBuilderMagicLinkState> {
  return sendBuilderMagicLink(formData)
}

export async function signOutBuilderAction(): Promise<void> {
  const headerStore = await headers()
  if (!isPreviewRequestAuthority(headerStore)) return
  const result = await previewAuth.api.signOut({
    returnHeaders: true,
    headers: previewAuthRequestHeaders(headerStore),
  })
  if (result.response.success !== true) throw new Error("Builder sign-out failed")
  const cookieStore = await cookies()
  for (const setCookie of result.headers.getSetCookie()) {
    for (const [name, attributes] of parseSetCookieHeader(setCookie)) {
      cookieStore.set(name, attributes.value, toCookieOptions(attributes))
    }
  }
  redirect("/login")
}
