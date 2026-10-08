import { auth } from "@/lib/betterAuth"
import { buildCmsAuthRequest, isAllowedSocialAuthHost } from "@/lib/socialAuth/hosts"
import { isForbiddenCustomerAuthPath } from "@/lib/auth/passwordlessPolicy"
import { toNextJsHandler } from "better-auth/next-js"

const handlers = toNextJsHandler(auth)

const ensureAllowedHost = async (request: Request): Promise<Response | null> => {
  if (await isAllowedSocialAuthHost(request)) return null
  return new Response("Unknown auth host", { status: 404 })
}

const ensurePasswordless = (request: Request): Response | null => {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "")
  return isForbiddenCustomerAuthPath(path) ? new Response("Use an email magic link", { status: 403 }) : null
}

export async function GET(request: Request) {
  const denied = await ensureAllowedHost(request)
  if (denied) return denied
  const socialDenied = ensurePasswordless(request)
  if (socialDenied) return socialDenied
  const authRequest = buildCmsAuthRequest(request)
  return handlers.GET(authRequest)
}

export async function POST(request: Request) {
  const denied = await ensureAllowedHost(request)
  if (denied) return denied
  const socialDenied = ensurePasswordless(request)
  if (socialDenied) return socialDenied
  const authRequest = buildCmsAuthRequest(request)
  return handlers.POST(authRequest)
}
