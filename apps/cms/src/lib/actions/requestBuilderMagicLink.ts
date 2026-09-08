"use server"

import { headers } from "next/headers"
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
  await (previewAuth.api).signOut({
    headers: previewAuthRequestHeaders(headerStore),
  }).catch(() => null)
}
