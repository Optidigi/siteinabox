import { beforeEach, describe, expect, it, vi } from "vitest"
import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"

const { sendCms, sendPreview, resolveUser, findAccounts } = vi.hoisted(() => ({
  sendCms: vi.fn(async (_input: { email: string; url: string }) => {}),
  sendPreview: vi.fn(async (_input: { text?: string; html?: string }) => {}),
  findAccounts: vi.fn(async () => ({ docs: [] as Array<{ previewUserId?: string; revokedAt?: string }>, totalDocs: 0 })),
  resolveUser: vi.fn(async () => ({ id: 42 })),
}))
vi.mock("@/lib/auth/sendCmsMagicLinkEmail", () => ({ sendCmsMagicLinkEmail: sendCms }))
vi.mock("@/lib/socialAuth/payloadUser", () => ({ resolvePayloadUserForSocialSignup: resolveUser }))
vi.mock("@/lib/email/sendEmail", () => ({ asMailLogPayload: (value: unknown) => value, sendEmail: sendPreview }))
vi.mock("payload", () => ({ getPayload: vi.fn(async () => ({ find: findAccounts })) }))
vi.mock("@/payload.config", () => ({ default: {} }))

import { auth as cmsAuth } from "@/lib/betterAuth"
import { previewAuth } from "@/lib/preview/betterAuth"

const origin = "https://admin.siteinabox.nl"
const headers = () => new Headers({ host: "admin.siteinabox.nl", origin })
function fixture() {
  const store: Record<string, Record<string, unknown>[]> = {
    better_auth_users: [], better_auth_sessions: [], better_auth_accounts: [], better_auth_verifications: [],
  }
  // The SDK skips origin/CSRF checks by default under NODE_ENV=test. Exercise
  // the production security behavior explicitly, retaining all app settings.
  const auth = betterAuth({ ...cmsAuth.options, advanced: { ...cmsAuth.options.advanced, disableOriginCheck: false, disableCSRFCheck: false }, database: memoryAdapter(store) })
  return { auth, store }
}

describe("configured Better Auth SDK boundary", () => {
  beforeEach(() => {
    findAccounts.mockResolvedValue({ docs: [], totalDocs: 0 })
    sendPreview.mockClear()
  })
  it("issues the public CMS link, consumes it once, and revokes the actual SDK session", async () => {
    const { auth, store } = fixture()
    sendCms.mockClear()
    await auth.api.signInMagicLink({ headers: headers(), body: { email: "invited@example.test", callbackURL: "/sites" } })
    expect(sendCms).toHaveBeenCalledOnce()
    const url = new URL(sendCms.mock.calls[0]![0].url)
    expect(url.origin).toBe(origin)
    const response = await auth.handler(new Request(url, { headers: headers() }))
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe(`${origin}/sites`)
    expect(store.better_auth_users).toEqual([expect.objectContaining({ payloadUserId: "42" })])
    const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ")
    const sessionHeaders = new Headers({ ...Object.fromEntries(headers()), cookie })
    const session = await auth.api.getSession({ headers: sessionHeaders })
    expect(session?.user.email).toBe("invited@example.test")
    const replay = await auth.handler(new Request(url, { headers: headers() }))
    expect(new URL(replay.headers.get("location")!).searchParams.get("error")).toBe("INVALID_TOKEN")
    await auth.api.signOut({ headers: sessionHeaders })
    expect(await auth.api.getSession({ headers: sessionHeaders })).toBeNull()
  })

  it("rejects an unsafe callback before creating an account or session", async () => {
    const { auth, store } = fixture()
    await auth.api.signInMagicLink({ headers: headers(), body: { email: "invited@example.test" } })
    const url = new URL(sendCms.mock.calls.at(-1)![0].url)
    url.searchParams.set("callbackURL", "https://attacker.example/steal")
    const response = await auth.handler(new Request(url, { headers: headers() }))
    expect(response.status).toBe(403)
    expect(store.better_auth_users).toHaveLength(0)
    expect(store.better_auth_sessions).toHaveLength(0)
  })

  it("rejects an expired verification without creating a user or session", async () => {
    const { auth, store } = fixture()
    await auth.api.signInMagicLink({ headers: headers(), body: { email: "expired@example.test" } })
    const url = new URL(sendCms.mock.calls.at(-1)![0].url)
    const pending = store.better_auth_verifications?.[0]
    if (!pending) throw new Error("SDK did not persist the verification fixture")
    pending.expiresAt = new Date(0)
    const response = await auth.handler(new Request(url, { headers: headers() }))
    expect(response.status).toBe(302)
    expect(new URL(response.headers.get("location")!).searchParams.get("error")).toBe("INVALID_TOKEN")
    expect(store.better_auth_users).toHaveLength(0)
    expect(store.better_auth_sessions).toHaveLength(0)
  })

  it("rejects a forged cross-origin request before issuing mail or verification", async () => {
    const { auth, store } = fixture()
    sendCms.mockClear()
    const response = await auth.handler(new Request(`${origin}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { host: "admin.siteinabox.nl", origin: "https://attacker.example", cookie: "unrelated=1", "content-type": "application/json" },
      body: JSON.stringify({ email: "invited@example.test" }),
    }))
    expect(response.status).toBe(403)
    expect(sendCms).not.toHaveBeenCalled()
    expect(store.better_auth_verifications).toHaveLength(0)
  })

  it("keeps the preview SDK instance in its separate table and cookie namespace", async () => {
    const store: Record<string, Record<string, unknown>[]> = {
      preview_auth_users: [], preview_auth_sessions: [], preview_auth_accounts: [], preview_auth_verifications: [],
    }
    const auth = betterAuth({ ...previewAuth.options, database: memoryAdapter(store) })
    // Exercise the real configured send callback through the SDK; only mail and
    // Payload initialization are doubled. No preview grant is needed for builder.
    await auth.api.signInMagicLink({ headers: headers(), body: { email: "builder@example.test", callbackURL: "/builder" } })
    expect(sendPreview).toHaveBeenCalled()
    expect(store.preview_auth_verifications).toHaveLength(1)
    expect(store.preview_auth_users).toHaveLength(0)
    expect((await auth.$context).authCookies.sessionToken.name).toContain("siab-preview-auth")
  })

  it("keeps revoked-account link requests non-enumerating and refuses a previously issued verification", async () => {
    const store: Record<string, Record<string, unknown>[]> = {
      preview_auth_users: [], preview_auth_sessions: [], preview_auth_accounts: [], preview_auth_verifications: [],
    }
    const instance = betterAuth({ ...previewAuth.options, database: memoryAdapter(store) })
    const user = await (await instance.$context).internalAdapter.createUser({
      email: "revoked@example.test", name: "Synthetic account", emailVerified: true,
    }, { method: "test" })
    await instance.api.signInMagicLink({ headers: headers(), body: { email: user.email, callbackURL: "/builder" } })
    const text = sendPreview.mock.calls.at(-1)?.[0]?.text ?? ""
    const link = (text.match(/https:\/\/[^\s<>"']+/g) ?? []).find(value =>
      new URL(value).pathname === "/api/preview-auth/magic-link/verify" && new URL(value).searchParams.has("token"))
    expect(link).toBeTruthy()
    findAccounts.mockResolvedValue({ docs: [{ previewUserId: user.id, revokedAt: new Date().toISOString() }], totalDocs: 1 })
    const verified = await instance.handler(new Request(link!, { headers: headers() }))
    expect([401, 403]).toContain(verified.status)
    expect(new URL(verified.headers.get("location") ?? origin).pathname).not.toBe("/builder")
    expect(store.preview_auth_sessions).toHaveLength(0)
    sendPreview.mockClear()
    const acknowledged = await instance.api.signInMagicLink({ headers: headers(), body: { email: user.email, callbackURL: "/builder" } })
    expect(acknowledged.status).toBe(true)
    expect(sendPreview).not.toHaveBeenCalled()
  })
})
