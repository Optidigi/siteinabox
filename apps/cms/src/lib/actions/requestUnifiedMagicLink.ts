"use server"

import { headers } from "next/headers"
import { getPayload } from "payload"
import { auth } from "@/lib/betterAuth"
import {
  BUILDER_MAGIC_LINK_GENERIC_SUCCESS,
  sendBuilderMagicLink,
  type RequestBuilderMagicLinkState,
} from "@/lib/builder/sendBuilderMagicLink"
import { PLATFORM_ADMIN_HOST } from "@/lib/preview/previewHost"
import { canonicalRequestAuthority, isPreviewRequestAuthority } from "@/lib/requestAuthority"
import { normalizeBuilderEmail } from "@/lib/builder/thread"
import { buildCmsAuthHeaders } from "@/lib/socialAuth/hosts"
import type { User } from "@/payload-types"
import config from "@/payload.config"

export async function requestUnifiedMagicLinkAction(
  _state: RequestBuilderMagicLinkState,
  formData: FormData,
): Promise<RequestBuilderMagicLinkState> {
  const headerStore = await headers()
  if (!isPreviewRequestAuthority(headerStore)) {
    return { ok: false, message: "Niet beschikbaar." }
  }

  const intent = String(formData.get("intent") ?? "login")
  if (intent === "register") {
    return sendBuilderMagicLink(formData)
  }

  const email = normalizeBuilderEmail(String(formData.get("email") ?? ""))
  if (!email || !email.includes("@")) {
    return { ok: false, message: "Vul een geldig e-mailadres in." }
  }

  try {
    const authority = canonicalRequestAuthority(headerStore)
    const superAdminHost = authority?.developmentLoopback ? authority.host : PLATFORM_ADMIN_HOST
    const user = await loadEligibleCmsUser(email)
    const host = user ? cmsMagicLinkHost(user, superAdminHost) : null
    if (user && host) {
      await sendCmsLoginMagicLink(email, host)
      return { ok: true, message: BUILDER_MAGIC_LINK_GENERIC_SUCCESS }
    }
  } catch (error) {
    console.error("Unified CMS magic-link request failed", error)
    return { ok: true, message: BUILDER_MAGIC_LINK_GENERIC_SUCCESS }
  }

  return sendBuilderMagicLink(formData)
}

const cmsAuthHeadersForHost = (host: string): Headers =>
  buildCmsAuthHeaders(new Headers({
    host,
    "x-forwarded-host": host,
    "x-forwarded-proto": "https",
  }))

const cmsMagicLinkHost = (user: User, requestHost: string | null): string | null => {
  if (user.role === "super-admin") return requestHost ?? PLATFORM_ADMIN_HOST
  const tenant = user.tenants?.[0]?.tenant
  if (!tenant || typeof tenant !== "object") return null
  if (tenant.status === "archived") return null
  return requestHost ?? PLATFORM_ADMIN_HOST
}

const loadEligibleCmsUser = async (email: string): Promise<User | null> => {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: "users",
    where: { email: { equals: email } },
    limit: 2,
    depth: 1,
    overrideAccess: true,
  })
  if (result.totalDocs !== 1) return null
  const user = result.docs[0] as User
  const tenants = Array.isArray(user.tenants) ? user.tenants : []
  if (user.role === "super-admin") return tenants.length === 0 ? user : null
  if (tenants.length !== 1) return null
  return user
}

async function sendCmsLoginMagicLink(email: string, host: string): Promise<void> {
  await (auth.api).signInMagicLink({
    body: {
      email,
      callbackURL: "/api/siab-auth/complete?next=/",
      errorCallbackURL: "/login?error=magic-link-session",
    },
    headers: cmsAuthHeadersForHost(host),
  })
}
