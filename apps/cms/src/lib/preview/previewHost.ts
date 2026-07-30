import { headers } from "next/headers"
import {
  canonicalRequestAuthority,
  isPreviewRequestAuthority,
} from "@/lib/requestAuthority"

export const PREVIEW_HOST = "preview.siteinabox.nl"

export async function isPreviewHost(): Promise<boolean> {
  const headerStore = await headers()
  return isPreviewRequestAuthority(headerStore)
}

export async function previewRequestOrigin(): Promise<string> {
  const headerStore = await headers()
  const authority = canonicalRequestAuthority(headerStore)
  if (!authority || !isPreviewRequestAuthority(headerStore)) {
    throw new Error("Preview request authority is invalid.")
  }
  return authority.origin
}
