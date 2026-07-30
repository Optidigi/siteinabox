import { auth } from "@/lib/betterAuth"
import { buildCmsAuthRequest, isAllowedSocialAuthHost } from "@/lib/socialAuth/hosts"
import {
  getEnabledSocialAuthProvidersForHost,
  isSocialAuthProvider,
  type SocialAuthProvider,
} from "@/lib/socialAuth/providers"
import { toNextJsHandler } from "better-auth/next-js"

const handlers = toNextJsHandler(auth)

const ensureAllowedHost = async (request: Request): Promise<Response | null> => {
  if (await isAllowedSocialAuthHost(request)) return null
  return new Response("Unknown auth host", { status: 404 })
}

const normalizeRequestHost = (value: string | null): string =>
  (value ?? "").split(",")[0]?.trim().toLowerCase() ?? ""

const requestHost = (request: Request): string | null => {
  const host = normalizeRequestHost(request.headers.get("host"))
  const forwardedHost = normalizeRequestHost(
    request.headers.get("x-forwarded-host"),
  )
  if (!host || (forwardedHost && forwardedHost !== host)) return null
  return host
}

const requestedSocialProvider = async (
  request: Request,
): Promise<SocialAuthProvider | null | undefined> => {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "")
  const callback = pathname.match(/\/api\/auth\/callback\/([^/]+)$/)
  if (callback) {
    return isSocialAuthProvider(callback[1]) ? callback[1] : null
  }
  if (!pathname.endsWith("/api/auth/sign-in/social")) return undefined
  try {
    const body = await request.clone().json() as { provider?: unknown }
    return isSocialAuthProvider(body.provider) ? body.provider : null
  } catch {
    return null
  }
}

const ensureSocialCallbackEvidence = async (
  request: Request,
): Promise<Response | null> => {
  const provider = await requestedSocialProvider(request)
  if (provider === undefined) return null
  if (
    provider &&
    getEnabledSocialAuthProvidersForHost(requestHost(request)).includes(provider)
  ) {
    return null
  }
  return new Response("Social auth is not configured for this host", {
    status: 404,
  })
}

export async function GET(request: Request) {
  const denied = await ensureAllowedHost(request)
  if (denied) return denied
  const socialDenied = await ensureSocialCallbackEvidence(request)
  if (socialDenied) return socialDenied
  const authRequest = buildCmsAuthRequest(request)
  return handlers.GET(authRequest)
}

export async function POST(request: Request) {
  const denied = await ensureAllowedHost(request)
  if (denied) return denied
  const socialDenied = await ensureSocialCallbackEvidence(request)
  if (socialDenied) return socialDenied
  const authRequest = buildCmsAuthRequest(request)
  return handlers.POST(authRequest)
}
