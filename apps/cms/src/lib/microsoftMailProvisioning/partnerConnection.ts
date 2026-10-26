import "server-only"
import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from "node:crypto"
import { createRemoteJWKSet, jwtVerify } from "jose"
import type { Payload } from "payload"
import { withCommerceOrderLock } from "../commerce/orderLock.ts"
import { createMicrosoftDelegatedTokenProvider, type MicrosoftRefreshTokenStore } from "./microsoftAuth.ts"

const connectionContext = { microsoftPartnerConnectionMutation: true }
const required = (env: NodeJS.ProcessEnv, name: string) => {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name}_NOT_CONFIGURED`)
  return value
}

function cipherKey(env: NodeJS.ProcessEnv) {
  const raw = required(env, "MICROSOFT_PARTNER_TOKEN_ENCRYPTION_KEY")
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64")
  if (key.length !== 32) throw new Error("Microsoft partner token encryption key must be 32 bytes.")
  return key
}
export function encryptPartnerSecret(value: string, env: NodeJS.ProcessEnv = process.env, purpose: "refresh" | "handshake" = "refresh") {
  const nonce = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", cipherKey(env), nonce)
  cipher.setAAD(Buffer.from(`siab-microsoft-partner-v1:${purpose}:${required(env, "MICROSOFT_PARTNER_TENANT_ID")}:${required(env, "MICROSOFT_PARTNER_APP_CLIENT_ID")}`))
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".")
}
export function decryptPartnerSecret(value: string, env: NodeJS.ProcessEnv = process.env, purpose: "refresh" | "handshake" = "refresh") {
  const [version, nonce, tag, body, extra] = value.split(".")
  if (version !== "v1" || !nonce || !tag || !body || extra) throw new Error("Invalid partner token envelope.")
  const decipher = createDecipheriv("aes-256-gcm", cipherKey(env), Buffer.from(nonce, "base64url"))
  decipher.setAAD(Buffer.from(`siab-microsoft-partner-v1:${purpose}:${required(env, "MICROSOFT_PARTNER_TENANT_ID")}:${required(env, "MICROSOFT_PARTNER_APP_CLIENT_ID")}`))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8")
}

export function createPartnerTokenProvider(payload: Payload, env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch) {
  const partnerTenantId = required(env, "MICROSOFT_PARTNER_TENANT_ID")
  const clientId = required(env, "MICROSOFT_PARTNER_APP_CLIENT_ID")
  const readConnection = async () => {
    const result = await payload.find({ collection: "microsoft-partner-connections", where: { and: [
      { partnerTenantId: { equals: partnerTenantId } }, { clientId: { equals: clientId } },
    ] }, limit: 1, overrideAccess: true })
    const connection = result.docs[0]
    if (!connection || connection.status !== "connected") throw new Error("MICROSOFT_PARTNER_RECONNECT_REQUIRED")
    return connection
  }
  const store: MicrosoftRefreshTokenStore = {
    exclusive: operation => withCommerceOrderLock(payload, `microsoft-partner-token:${partnerTenantId}:${clientId}`, operation),
    read: async () => decryptPartnerSecret((await readConnection()).encryptedRefreshToken, env),
    write: async token => {
      const connection = await readConnection()
      await payload.update({ collection: "microsoft-partner-connections", id: connection.id,
        data: { encryptedRefreshToken: encryptPartnerSecret(token, env), refreshedAt: new Date().toISOString() }, overrideAccess: true, context: connectionContext })
    },
    requireReconnect: async () => {
      const connection = await readConnection()
      await payload.update({ collection: "microsoft-partner-connections", id: connection.id, data: { status: "reauthorization_required" }, overrideAccess: true, context: connectionContext })
    },
  }
  return createMicrosoftDelegatedTokenProvider({ clientId, clientSecret: required(env, "MICROSOFT_PARTNER_APP_CLIENT_SECRET"), store, fetchImpl })
}

type PartnerHandshake = { state: string; nonce: string; verifier: string; actorId: string; expiresAt: number }
export function beginPartnerConnection(actorId: string, env: NodeJS.ProcessEnv = process.env) {
  const handshake: PartnerHandshake = { state: randomBytes(32).toString("base64url"), nonce: randomBytes(32).toString("base64url"), verifier: randomBytes(48).toString("base64url"), actorId, expiresAt: Date.now() + 600_000 }
  const url = new URL(`https://login.microsoftonline.com/${required(env, "MICROSOFT_PARTNER_TENANT_ID")}/oauth2/v2.0/authorize`)
  const redirect = new URL(required(env, "MICROSOFT_PARTNER_APP_REDIRECT_URI"))
  if (redirect.protocol !== "https:") throw new Error("Microsoft partner callback requires HTTPS.")
  for (const [key, value] of Object.entries({ client_id: required(env, "MICROSOFT_PARTNER_APP_CLIENT_ID"), response_type: "code", response_mode: "query", redirect_uri: redirect.href,
    scope: "openid profile offline_access https://graph.microsoft.com/.default", state: handshake.state, nonce: handshake.nonce,
    code_challenge: createHash("sha256").update(handshake.verifier).digest("base64url"), code_challenge_method: "S256", prompt: "select_account" })) url.searchParams.set(key, value)
  return { url: url.href, cookie: encryptPartnerSecret(JSON.stringify(handshake), env, "handshake") }
}

export async function completePartnerConnection(input: { payload: Payload; code: string; state: string; cookie: string; actorId: string; env?: NodeJS.ProcessEnv }) {
  const env = input.env ?? process.env
  const h: PartnerHandshake = JSON.parse(decryptPartnerSecret(input.cookie, env, "handshake"))
  const received = Buffer.from(input.state)
  const expected = Buffer.from(h.state)
  if (h.actorId !== input.actorId || h.expiresAt <= Date.now() || received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("Invalid Microsoft partner sign-in state.")
  const tenantId = required(env, "MICROSOFT_PARTNER_TENANT_ID")
  const clientId = required(env, "MICROSOFT_PARTNER_APP_CLIENT_ID")
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, cache: "no-store", signal: AbortSignal.timeout(30_000),
    body: new URLSearchParams({ client_id: clientId, client_secret: required(env, "MICROSOFT_PARTNER_APP_CLIENT_SECRET"), grant_type: "authorization_code", code: input.code,
      redirect_uri: required(env, "MICROSOFT_PARTNER_APP_REDIRECT_URI"), code_verifier: h.verifier }),
  })
  const tokens = await response.json() as Record<string, unknown>
  if (!response.ok || typeof tokens.id_token !== "string" || typeof tokens.refresh_token !== "string") throw new Error("Microsoft partner sign-in could not be completed.")
  const jwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`))
  const { payload: identity } = await jwtVerify(tokens.id_token, jwks, { issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`, audience: clientId, algorithms: ["RS256"] })
  if (identity.nonce !== h.nonce || identity.tid !== tenantId || typeof identity.oid !== "string" || typeof identity.preferred_username !== "string") throw new Error("Microsoft partner identity could not be verified.")
  let refreshToken = tokens.refresh_token
  const validationTokenProvider = createMicrosoftDelegatedTokenProvider({ clientId, clientSecret: required(env, "MICROSOFT_PARTNER_APP_CLIENT_SECRET"), store: {
    exclusive: async operation => operation(), read: async () => refreshToken,
    write: async value => { refreshToken = value }, requireReconnect: async () => {},
  } })
  const token = await validationTokenProvider({ tenantId, resource: "partner_center" })
  const check = await fetch("https://api.partnercenter.microsoft.com/v1/customers?size=1", { headers: { authorization: `Bearer ${token}`, ValidateMfa: "true" }, cache: "no-store", signal: AbortSignal.timeout(30_000) })
  if (!check.ok || check.headers.get("isMfaCompliant")?.toLowerCase() !== "true") throw new Error("Partner Center did not confirm MFA-compliant partner access.")
  const now = new Date().toISOString()
  const data = { partnerTenantId: tenantId, clientId, userPrincipalName: identity.preferred_username, userObjectId: identity.oid,
    encryptedRefreshToken: encryptPartnerSecret(refreshToken, env), status: "connected" as const, connectedAt: now, refreshedAt: now, connectedBy: Number(input.actorId) }
  await withCommerceOrderLock(input.payload, `microsoft-partner-token:${tenantId}:${clientId}`, async () => {
    const existing = await input.payload.find({ collection: "microsoft-partner-connections", where: { partnerTenantId: { equals: tenantId } }, limit: 1, overrideAccess: true })
    if (existing.docs[0]) await input.payload.update({ collection: "microsoft-partner-connections", id: existing.docs[0].id, data, overrideAccess: true, context: connectionContext })
    else await input.payload.create({ collection: "microsoft-partner-connections", data, overrideAccess: true, context: connectionContext })
  })
}
