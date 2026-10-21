import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { betterAuth } from "better-auth"
import type { Payload } from "payload"
import { sql } from "@payloadcms/db-postgres"
import { getTestPayload } from "./_helpers"

const mail = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock("@/lib/email/sendEmail", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/email/sendEmail")>(), sendEmail: mail.send,
}))

let payload: Payload
const origin = "https://admin.siteinabox.nl"
const headers = () => new Headers({ host: "admin.siteinabox.nl", origin })
const recovery = origin + "/login?error=magic-link-session"

beforeAll(async () => { payload = await getTestPayload() })
afterAll(async () => {
  await globalThis.__siabBetterAuthPool?.end()
  await globalThis.__siabPreviewBetterAuthPool?.end()
  globalThis.__siabBetterAuthPool = undefined
  globalThis.__siabPreviewBetterAuthPool = undefined
  await payload?.destroy()
})
beforeEach(() => { mail.send.mockClear(); mail.send.mockResolvedValue({ provider: "synthetic" }) })

function capturedLink(): URL {
  const message = mail.send.mock.calls.at(-1)?.[0] as { text?: string } | undefined
  const url = (message?.text?.match(/https:\/\/[^\s<>"']+/g) ?? []).find(value => new URL(value).pathname.endsWith("/magic-link/verify"))
  if (!url) throw new Error("No synthetic SDK verification captured")
  return new URL(url)
}
async function fixture(email: string) {
  const user = await payload.create({ collection: "users", overrideAccess: true, data: {
    name: "Synthetic SDK fixture", email, role: "super-admin", password: "Synthetic-password-42!",
  } })
  const { auth: cmsAuth } = await import("@/lib/betterAuth")
  // The SDK skips origin/CSRF checks by default under NODE_ENV=test. Exercise
  // production checks, retaining the real configured PostgreSQL/hooks/plugins.
  const auth = betterAuth({ ...cmsAuth.options, advanced: {
    ...cmsAuth.options.advanced, disableOriginCheck: false, disableCSRFCheck: false,
  } })
  return { auth, user }
}
async function counts(email: string) {
  const { rows } = await payload.db.drizzle.execute(sql`SELECT
    (SELECT count(*) FROM better_auth_users WHERE email=${email}) AS users,
    (SELECT count(*) FROM better_auth_sessions s JOIN better_auth_users u ON u.id=s."userId" WHERE u.email=${email}) AS sessions`)
  return { users: Number(rows[0]?.users), sessions: Number(rows[0]?.sessions) }
}

describe("configured Better Auth SDK boundary on committed PostgreSQL", () => {
  it("issues the public CMS link, consumes it once, and revokes the actual SDK session", async () => {
    const { auth, user } = await fixture("invited-sdk@example.test")
    await auth.api.signInMagicLink({ headers: headers(), body: { email: user.email, callbackURL: "/sites" } })
    expect(mail.send).toHaveBeenCalledOnce()
    const url = capturedLink()
    expect(url.origin).toBe(origin)
    const response = await auth.handler(new Request(url, { headers: headers() }))
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe(`${origin}/sites`)
    const { rows } = await payload.db.drizzle.execute(sql`SELECT "payloadUserId" FROM better_auth_users WHERE email=${user.email}`)
    expect(rows).toEqual([{ payloadUserId: String(user.id) }])
    const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ")
    const sessionHeaders = new Headers({ ...Object.fromEntries(headers()), cookie })
    expect((await auth.api.getSession({ headers: sessionHeaders }))?.user.email).toBe(user.email)
    expect((await auth.handler(new Request(url, { headers: headers() }))).headers.get("location")).toBe(recovery)
    await auth.api.signOut({ headers: sessionHeaders })
    expect(await auth.api.getSession({ headers: sessionHeaders })).toBeNull()
  })

  it("rejects an unsafe callback before creating an account or session", async () => {
    const { auth, user } = await fixture("unsafe-sdk@example.test")
    await auth.api.signInMagicLink({ headers: headers(), body: { email: user.email } })
    const url = capturedLink()
    url.searchParams.set("callbackURL", "https://attacker.example/steal")
    const response = await auth.handler(new Request(url, { headers: headers() }))
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe(recovery)
    expect(await counts(user.email)).toEqual({ users: 0, sessions: 0 })
  })

  it("rejects an expired verification without creating a user or session", async () => {
    const { auth, user } = await fixture("expired-sdk@example.test")
    await auth.api.signInMagicLink({ headers: headers(), body: { email: user.email } })
    const url = capturedLink()
    await payload.db.drizzle.execute(sql`UPDATE better_auth_verifications SET "expiresAt"=to_timestamp(0)
      WHERE identifier=${"magic-link:" + url.searchParams.get("token")}`)
    const response = await auth.handler(new Request(url, { headers: headers() }))
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe(recovery)
    expect(await counts(user.email)).toEqual({ users: 0, sessions: 0 })
  })

  it("rejects a forged cross-origin request before issuing mail or verification", async () => {
    const { auth, user } = await fixture("forged-sdk@example.test")
    const response = await auth.handler(new Request(`${origin}/api/auth/sign-in/magic-link`, {
      method: "POST", headers: { host: "admin.siteinabox.nl", origin: "https://attacker.example", cookie: "unrelated=1", "content-type": "application/json" },
      body: JSON.stringify({ email: user.email }),
    }))
    expect(response.status).toBe(403)
    expect(mail.send).not.toHaveBeenCalled()
    const { rows } = await payload.db.drizzle.execute(sql`SELECT count(*) AS count FROM account_link_dispatches WHERE recipient=${user.email}`)
    expect(Number(rows[0]?.count)).toBe(0)
    expect(await counts(user.email)).toEqual({ users: 0, sessions: 0 })
  })

  it("keeps the preview SDK instance in its separate table and cookie namespace", async () => {
    const { previewAuth } = await import("@/lib/preview/betterAuth")
    await previewAuth.api.signInMagicLink({ headers: headers(), body: { email: "builder-sdk@example.test", callbackURL: "/builder" } })
    expect(mail.send).toHaveBeenCalledOnce()
    const url = capturedLink()
    const { rows } = await payload.db.drizzle.execute(sql`SELECT
      (SELECT count(*) FROM preview_auth_verifications WHERE identifier=${"magic-link:" + url.searchParams.get("token")}) AS preview,
      (SELECT count(*) FROM better_auth_verifications WHERE identifier=${"magic-link:" + url.searchParams.get("token")}) AS cms`)
    expect(Number(rows[0]?.preview)).toBe(1)
    expect(Number(rows[0]?.cms)).toBe(0)
    expect((await previewAuth.$context).authCookies.sessionToken.name).toContain("siab-preview-auth")
  })

  it("keeps revoked-account requests non-enumerating and refuses an issued verification", async () => {
    const { previewAuth } = await import("@/lib/preview/betterAuth")
    const user = await (await previewAuth.$context).internalAdapter.createUser({
      email: "revoked-sdk@example.test", name: "Synthetic account", emailVerified: true,
    }, { method: "test" })
    const { rows } = await payload.db.drizzle.execute(sql`SELECT "firstVerifiedAt" FROM preview_auth_users WHERE id=${user.id}`)
    const instant = rows[0]?.firstVerifiedAt
    if (!(instant instanceof Date) && typeof instant !== "string") throw new Error("Missing actual verification instant")
    const verifiedAt = new Date(instant)
    if (!Number.isFinite(verifiedAt.getTime())) throw new Error("Invalid actual verification instant")
    const account = await payload.create({ collection: "customer-accounts", overrideAccess: true,
      data: { email: user.email, previewUserId: user.id, verifiedAt: verifiedAt.toISOString() } })
    await previewAuth.api.signInMagicLink({ headers: headers(), body: { email: user.email, callbackURL: "/builder" } })
    const link = capturedLink()
    await payload.update({ collection: "customer-accounts", id: account.id, overrideAccess: true, data: { revokedAt: new Date().toISOString() } })
    const verified = await previewAuth.handler(new Request(link, { headers: headers() }))
    expect(verified.status).toBe(302)
    expect(verified.headers.get("location")).toBe(recovery)
    const sessions = await payload.db.drizzle.execute(sql`SELECT count(*) AS count FROM preview_auth_sessions WHERE "userId"=${user.id}`)
    expect(Number(sessions.rows[0]?.count)).toBe(0)
    mail.send.mockClear()
    expect((await previewAuth.api.signInMagicLink({ headers: headers(), body: { email: user.email, callbackURL: "/builder" } })).status).toBe(true)
    expect(mail.send).not.toHaveBeenCalled()
  })
})
