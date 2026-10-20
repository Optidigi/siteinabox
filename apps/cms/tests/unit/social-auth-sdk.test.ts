import { generateKeyPairSync, sign } from "node:crypto"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { betterAuth, type BetterAuthOptions } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"

const { findPayloadUsers, sendCms } = vi.hoisted(() => ({ findPayloadUsers: vi.fn(), sendCms: vi.fn(async (_input: { url: string }) => {}) }))
vi.mock("payload", () => ({ getPayload: vi.fn(async () => ({ find: findPayloadUsers })) }))
vi.mock("@/payload.config", () => ({ default: {} }))
vi.mock("@/lib/auth/sendCmsMagicLinkEmail", () => ({ sendCmsMagicLinkEmail: sendCms }))

const origin = "https://admin.siteinabox.nl"
const providers = ["google", "microsoft", "apple"] as const
type Provider = (typeof providers)[number]
const directory = "11111111-2222-3333-4444-555555555555"
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "synthetic-oauth-key", alg: "RS256", use: "sig" }
let configuredOptions: BetterAuthOptions

const cookieHeader = (response: Response) => response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ")
const headers = (cookie = "") => ({ host: "admin.siteinabox.nl", origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) })

function identityToken(provider: Provider, nonce: string, verified: boolean) {
  const timestamp = Math.floor(Date.now() / 1000)
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
  const payload = {
    iss: provider === "google" ? "https://accounts.google.com" : provider === "apple" ? "https://appleid.apple.com" : `https://login.microsoftonline.com/${directory}/v2.0`,
    aud: `${provider}-synthetic-client`, sub: `${provider}-synthetic-subject`,
    ...(provider === "microsoft" ? { tid: directory, oid: "synthetic-directory-object" } : {}),
    nonce, email: "invited@example.test", email_verified: verified, name: "Invited fixture", iat: timestamp, exp: timestamp + 300,
  }
  const body = `${encode({ alg: "RS256", kid: jwk.kid, typ: "JWT" })}.${encode(payload)}`
  return `${body}.${sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64url")}`
}

beforeAll(async () => {
  // Only synthetic values are injected after the test environment guard. The
  // real application constructs provider options and its Payload eligibility hook.
  for (const provider of providers) {
    vi.stubEnv(`${provider.toUpperCase()}_CLIENT_ID`, `${provider}-synthetic-client`)
    vi.stubEnv(`${provider.toUpperCase()}_CLIENT_SECRET`, "synthetic-client-secret")
  }
  vi.stubEnv("MICROSOFT_TENANT_ID", "common")
  configuredOptions = (await import("@/lib/betterAuth")).auth.options
})
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
afterAll(() => { vi.unstubAllEnvs() })

async function fixture(provider: Provider, verified = true) {
  const store: Record<string, Record<string, unknown>[]> = {
    better_auth_users: [], better_auth_sessions: [], better_auth_accounts: [], better_auth_verifications: [],
  }
  const auth = betterAuth({ ...configuredOptions, advanced: { ...configuredOptions.advanced, disableOriginCheck: false, disableCSRFCheck: false }, database: memoryAdapter(store) })
  findPayloadUsers.mockResolvedValue({ totalDocs: 1, docs: [{ id: 42, email: "invited@example.test", role: "owner", tenants: [{ tenant: 7 }] }] })
  // Production closes implicit social signup. Establish the existing CMS
  // identity through its real primary magic-link flow and real eligibility hook,
  // then log out before testing social sign-in/account linking.
  const issueLink = await auth.handler(new Request(`${origin}/api/auth/sign-in/magic-link`, {
    method: "POST", headers: headers(), body: JSON.stringify({ email: "invited@example.test" }),
  }))
  expect(issueLink.status).toBe(200)
  const link = sendCms.mock.calls.at(-1)?.[0].url
  if (!link) throw new Error("SDK did not issue the synthetic CMS link")
  const verifiedLink = await auth.handler(new Request(link, { headers: headers() }))
  expect(verifiedLink.status).toBe(302)
  await auth.api.signOut({ headers: new Headers(headers(cookieHeader(verifiedLink))) })
  expect(store.better_auth_sessions).toHaveLength(0)
  let nonce = ""
  const calls: string[] = []
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    calls.push(url)
    if (["https://www.googleapis.com/oauth2/v3/certs", "https://appleid.apple.com/auth/keys", "https://login.microsoftonline.com/common/discovery/v2.0/keys"].includes(url)) {
      return Response.json({ keys: [jwk] })
    }
    if (["https://oauth2.googleapis.com/token", "https://appleid.apple.com/auth/token", "https://login.microsoftonline.com/common/oauth2/v2.0/token"].includes(url)) {
      return Response.json({ access_token: "synthetic-access-token", token_type: "Bearer", expires_in: 300, id_token: identityToken(provider, nonce, verified) })
    }
    if (url.startsWith("https://graph.microsoft.com/v1.0/me/photos/")) return new Response(null, { status: 404 })
    throw new Error("Unexpected OAuth network destination; fixture refuses real network")
  }))
  const start = await auth.handler(new Request(`${origin}/api/auth/sign-in/social`, {
    method: "POST", headers: headers(), body: JSON.stringify({ provider, callbackURL: "/api/siab-auth/complete", additionalData: { role: "super-admin", tenantId: "forged" } }),
  }))
  expect(start.status).toBe(200)
  const result: { url: string } = await start.json()
  const authorization = new URL(result.url)
  expect(authorization.searchParams.get("redirect_uri")).toBe(`${origin}/api/auth/callback/${provider}`)
  expect(authorization.searchParams.get("code_challenge_method")).toBe("S256")
  nonce = authorization.searchParams.get("nonce") ?? ""
  const callback = async (state = authorization.searchParams.get("state")!) => {
    const url = new URL(`${origin}/api/auth/callback/${provider}`)
    url.searchParams.set("state", state)
    url.searchParams.set("code", "synthetic-code")
    return auth.handler(new Request(url, { headers: headers(cookieHeader(start)) }))
  }
  return { auth, store, callback, calls }
}

describe("configured social providers through the actual upgraded SDK", () => {
  it.each(providers)("%s callback links only the invited Payload identity and issues its session", async (provider) => {
    const { auth, store, callback, calls } = await fixture(provider)
    const response = await callback()
    expect(response.status).toBe(302)
    expect(new URL(response.headers.get("location")!, origin).href).toBe(`${origin}/api/siab-auth/complete`)
    expect(store.better_auth_accounts).toEqual([expect.objectContaining({ providerId: provider, accountId: provider === "microsoft" ? "synthetic-directory-object" : `${provider}-synthetic-subject` })])
    expect(store.better_auth_users).toEqual([expect.objectContaining({ payloadUserId: "42" })])
    const sessionResponse = await auth.handler(new Request(`${origin}/api/auth/get-session`, { headers: headers(cookieHeader(response)) }))
    const session: { user?: { payloadUserId?: string; role?: string; tenantId?: string } } = await sessionResponse.json()
    expect(session.user?.payloadUserId).toBe("42")
    expect(session.user?.role).toBeUndefined()
    expect(session.user?.tenantId).toBeUndefined()
    expect(calls.some((url) => url.includes("/token"))).toBe(true)
  })

  it.each(providers)("%s verifies signed direct identity tokens using its real key verifier", async (provider) => {
    const { auth, store, calls } = await fixture(provider)
    const response = await auth.handler(new Request(`${origin}/api/auth/sign-in/social`, {
      method: "POST", headers: headers(), body: JSON.stringify({ provider, idToken: { token: identityToken(provider, "direct-nonce", true), nonce: "direct-nonce" } }),
    }))
    expect(response.status).toBe(200)
    expect(store.better_auth_accounts?.length).toBe(1)
    expect(store.better_auth_sessions?.length).toBe(1)
    expect(calls.some((url) => url.includes("keys") || url.includes("certs"))).toBe(true)
  })

  it.each(providers)("%s rejects an invalid identity-token signature", async (provider) => {
    const { auth, store } = await fixture(provider)
    const token = identityToken(provider, "direct-nonce", true)
    const response = await auth.handler(new Request(`${origin}/api/auth/sign-in/social`, {
      method: "POST", headers: headers(), body: JSON.stringify({ provider, idToken: { token: token.slice(0, -4) + "AAAA", nonce: "direct-nonce" } }),
    }))
    expect(response.status).toBe(401)
    expect(store.better_auth_accounts).toHaveLength(0)
    expect(store.better_auth_sessions).toHaveLength(0)
  })

  it.each(providers)("%s rejects invalid state before exchanging a code", async (provider) => {
    const { store, callback, calls } = await fixture(provider)
    const response = await callback("forged-state")
    expect(new URL(response.headers.get("location")!).origin).toBe(origin)
    expect(new URL(response.headers.get("location")!).searchParams.has("error")).toBe(true)
    expect(calls).toHaveLength(0)
    expect(store.better_auth_accounts).toHaveLength(0)
    expect(store.better_auth_sessions).toHaveLength(0)
  })

  it.each(providers)("%s refuses an unsafe callback before contacting a provider", async (provider) => {
    const { auth, store, calls } = await fixture(provider)
    const response = await auth.handler(new Request(`${origin}/api/auth/sign-in/social`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ provider, callbackURL: "https://attacker.example/steal" }),
    }))
    expect(response.status).toBe(403)
    expect(calls).toHaveLength(0)
    expect(store.better_auth_accounts).toHaveLength(0)
    expect(store.better_auth_sessions).toHaveLength(0)
  })

  it.each(providers)("%s rejects an unverified identity without linking or issuing a session", async (provider) => {
    const { store, callback } = await fixture(provider, false)
    const response = await callback()
    expect(new URL(response.headers.get("location")!).searchParams.has("error")).toBe(true)
    expect(store.better_auth_users).toHaveLength(1)
    expect(store.better_auth_accounts).toHaveLength(0)
    expect(store.better_auth_sessions).toHaveLength(0)
  })
})
