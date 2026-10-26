import "server-only"
import type { MicrosoftResource, MicrosoftTokenProvider } from "./microsoft.ts"

const scopes: Record<MicrosoftResource, string> = {
  graph: "https://graph.microsoft.com/.default",
  partner_center: "https://api.partnercenter.microsoft.com/.default",
  exchange: "https://outlook.office365.com/.default",
}

export class MicrosoftTokenRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(`Microsoft token request failed (HTTP ${status}, ${code}).`)
    this.name = "MicrosoftTokenRequestError"
    this.status = status
    this.code = code
  }
}

const safeCode = (value: unknown): string =>
  typeof value === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(value) ? value : "token_request_failed"

export type MicrosoftRefreshTokenStore = {
  exclusive: <T>(operation: () => Promise<T>) => Promise<T>
  read: () => Promise<string>
  write: (refreshToken: string) => Promise<void>
  requireReconnect: () => Promise<void>
}

/** Secure app model: partner user refresh token, exchanged at the target tenant. */
export function createMicrosoftDelegatedTokenProvider(options: {
  clientId: string; clientSecret: string; store: MicrosoftRefreshTokenStore;
  fetchImpl?: typeof fetch; now?: () => number
}): MicrosoftTokenProvider {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const cache = new Map<string, { token: string; expiresAt: number }>()
  return async ({ tenantId, resource }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(tenantId)) throw new Error("Microsoft tenant ID is invalid.")
    const key = `${tenantId}:${resource}`
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now() + 60_000) return cached.token
    return options.store.exclusive(async () => {
      const refreshToken = await options.store.read()
      const response = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
        method: "POST", cache: "no-store", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", client_id: options.clientId,
          client_secret: options.clientSecret, refresh_token: refreshToken, scope: scopes[resource] }),
        signal: AbortSignal.timeout(30_000),
      }).catch(() => { throw new MicrosoftTokenRequestError(0, "network_error") })
      const parsed: unknown = await response.json().catch(() => null)
      const body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
      if (!response.ok) {
        const errorCodes = Array.isArray(body.error_codes) ? body.error_codes.map(Number) : []
        if (errorCodes.some(code => [65001, 650052].includes(code))) throw new MicrosoftTokenRequestError(response.status, "customer_consent_required")
        if (body.error === "invalid_grant" || body.error === "interaction_required") await options.store.requireReconnect()
        throw new MicrosoftTokenRequestError(response.status, safeCode(body.error))
      }
      if (typeof body.access_token !== "string" || !Number.isFinite(Number(body.expires_in)) || Number(body.expires_in) <= 0) {
        throw new MicrosoftTokenRequestError(response.status, "token_response_invalid")
      }
      if (typeof body.refresh_token === "string" && body.refresh_token) await options.store.write(body.refresh_token)
      cache.set(key, { token: body.access_token, expiresAt: now() + Number(body.expires_in) * 1000 })
      return body.access_token
    })
  }
}

/**
 * Acquires app-only tokens separately for each resource and tenant. The app
 * must have been consented in the customer tenant before customer tokens can
 * be issued. This function never logs or returns token errors from the body.
 */
export function createMicrosoftAppTokenProvider(options: {
  partnerTenantId: string
  clientId: string
  clientSecret: string
  fetchImpl?: typeof fetch
  now?: () => number
}): MicrosoftTokenProvider {
  const partnerTenantId = options.partnerTenantId.trim()
  const clientId = options.clientId.trim()
  const clientSecret = options.clientSecret
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const cache = new Map<string, { token: string; expiresAt: number }>()
  if (!/^[0-9a-fA-F-]{36}$/.test(partnerTenantId) || !clientId || !clientSecret) {
    throw new Error("Microsoft partner tenant and application credentials are required.")
  }

  return async ({ tenantId: requestedTenantId, resource }) => {
    const tenantId = requestedTenantId.trim()
    if (!/^[0-9a-fA-F-]{36}$/.test(tenantId)) throw new Error("Microsoft tenant ID is invalid.")
    const key = `${tenantId}:${resource}`
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now() + 60_000) return cached.token

    const endpoint = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`
    let response: Response
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
          scope: scopes[resource],
        }),
        cache: "no-store",
      })
    } catch {
      throw new MicrosoftTokenRequestError(0, "network_error")
    }

    let body: Record<string, unknown> = {}
    try {
      const parsed = await response.json() as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>
    } catch { /* keep the response opaque */ }
    if (!response.ok) throw new MicrosoftTokenRequestError(response.status, safeCode(body.error))
    const token = typeof body.access_token === "string" ? body.access_token : ""
    const expiresIn = Number(body.expires_in)
    if (!token || !Number.isFinite(expiresIn) || expiresIn <= 0) throw new MicrosoftTokenRequestError(response.status, "token_response_invalid")
    cache.set(key, { token, expiresAt: now() + expiresIn * 1000 })
    return token
  }
}
