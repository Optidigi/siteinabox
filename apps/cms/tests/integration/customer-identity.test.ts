import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import { createLocalReq, logoutOperation } from "payload"
import { REST_POST, GRAPHQL_POST } from "@payloadcms/next/routes"
import { getTestPayload } from "./_helpers"
import { auth } from "@/lib/betterAuth"
import { CMS_SESSION_EXPIRES_IN_SECONDS } from "@/lib/auth/sessionDurations"
import config from "@/payload.config"
import { issueBoundPayloadSessionCookie, revokeCustomerPayloadSessions, validateCustomerPayloadSession } from "@/lib/auth/customerSessionBridge"

let payload: Awaited<ReturnType<typeof getTestPayload>>
beforeAll(async () => {
  const uri = new URL(process.env.DATABASE_URI ?? "")
  if (!["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) || uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || process.env.SITE_GENERATION_PROVIDER !== "mock") throw new Error("Identity integration requires isolated payload_test with jobs disabled and mock Sitegen")
  if (process.env.BETTER_AUTH_API_KEY) throw new Error("Identity integration prohibits external Better Auth infra")
  payload = await getTestPayload()
}, 60_000)

async function fixture() {
  const key = randomUUID()
  const tenant = await payload.create({ collection: "tenants", overrideAccess: true, data: { name: "Identity fixture", slug: `identity-${key}`, domain: `identity-${key}.test`, status: "provisioning" } })
  const user = await payload.create({ collection: "users", overrideAccess: true, data: { email: `identity-${key}@example.test`, password: "valid-fixture-password", role: "owner", tenants: [{ tenant: tenant.id }] } })
  const ctx = await auth.$context
  const baUser = await ctx.internalAdapter.createUser({ email: user.email, name: "Identity fixture", emailVerified: true, payloadUserId: String(user.id) })
  if (!baUser) throw new Error("BA fixture user not created")
  const session = await ctx.internalAdapter.createSession(baUser.id)
  if (!session) throw new Error("BA fixture session not created")
  const request = new Request("https://admin.siteinabox.nl/api/siab-auth/complete", { headers: { host: "admin.siteinabox.nl", DisableAutologin: "true" } })
  return { tenant, user, session, baUser, request, ctx }
}
const cookieHeader = (cookie: string) => new Headers({ cookie: cookie.split(";")[0] ?? "", DisableAutologin: "true" })

describe("real PostgreSQL + installed auth SDK entry points", () => {
  it("Local, REST and GraphQL customer password login deny; valid restricted admin still logs in", async () => {
    const { user } = await fixture()
    await expect(payload.login({ collection: "users", data: { email: user.email, password: "valid-fixture-password" }, overrideAccess: true })).rejects.toThrow()
    await expect(payload.forgotPassword({ collection: "users", data: { email: user.email } })).rejects.toThrow()
    const token = randomUUID()
    await payload.db.updateOne({ collection: "users", id: user.id, data: { resetPasswordToken: token, resetPasswordExpiration: new Date(Date.now() + 60_000).toISOString() }, returning: false })
    await expect(payload.resetPassword({ collection: "users", data: { token, password: "replacement-fixture-password" }, overrideAccess: true })).rejects.toThrow()
    const rest = await REST_POST(config)(new Request("https://admin.siteinabox.nl/api/users/login", { method: "POST", headers: { "content-type": "application/json", host: "admin.siteinabox.nl" }, body: JSON.stringify({ email: user.email, password: "valid-fixture-password" }) }), { params: Promise.resolve({ slug: ["users", "login"] }) })
    expect(rest.status).toBe(403)
    const gql = await GRAPHQL_POST(config)(new Request("https://admin.siteinabox.nl/api/graphql", { method: "POST", headers: { "content-type": "application/json", host: "admin.siteinabox.nl" }, body: JSON.stringify({ query: "mutation($email:String!,$password:String!){ loginUser(email:$email,password:$password){ token } }", variables: { email: user.email, password: "valid-fixture-password" } }) }))
    const body: unknown = await gql.json()
    expect(body).toMatchObject({ errors: [{ extensions: { statusCode: 403 } }] })
    const admin = await payload.create({ collection: "users", overrideAccess: true, data: { email: `admin-${randomUUID()}@example.test`, role: "super-admin", password: "valid-fixture-password" } })
    expect((await payload.login({ collection: "users", data: { email: admin.email, password: "valid-fixture-password" } })).token).toBeTruthy()
  })
  it("concurrent repeated completion issues exactly one sid and binding", async () => {
    const { user, session, request } = await fixture()
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => issueBoundPayloadSessionCookie(user.id, request, session.id)))
    expect(results.some((result) => result.status === "fulfilled")).toBe(true)
    const bindings = await payload.find({ collection: "customer-session-bindings", where: { betterAuthSessionId: { equals: session.id } }, overrideAccess: true })
    expect(bindings.totalDocs).toBe(1)
    const stored = await payload.findByID({ collection: "users", id: user.id, overrideAccess: true })
    expect(stored.sessions).toHaveLength(1)
    for (const result of results) if (result.status === "fulfilled") expect((await payload.auth({ headers: cookieHeader(result.value) })).user?.id).toBe(user.id)
  })
  it("renewal follows a 60-day BA authority and preserves the exact existing sid", async () => {
    const { user, session, request, ctx } = await fixture()
    expect(Math.abs(session.expiresAt.getTime() - session.createdAt.getTime() - CMS_SESSION_EXPIRES_IN_SECONDS * 1000)).toBeLessThan(2000)
    await issueBoundPayloadSessionCookie(user.id, request, session.id)
    const before = await payload.findByID({ collection: "users", id: user.id, overrideAccess: true })
    const extended = new Date(session.expiresAt.getTime() + 24 * 60 * 60 * 1000)
    await ctx.internalAdapter.updateSession(session.token, { expiresAt: extended, updatedAt: new Date() })
    const renewed = await issueBoundPayloadSessionCookie(user.id, request, session.id)
    const after = await payload.findByID({ collection: "users", id: user.id, overrideAccess: true })
    expect(after.sessions).toHaveLength(1)
    expect(after.sessions?.[0]?.id).toBe(before.sessions?.[0]?.id)
    expect(new Date(after.sessions?.[0]?.expiresAt ?? "").getTime()).toBe(extended.getTime())
    expect((await payload.auth({ headers: cookieHeader(renewed) })).user?.id).toBe(user.id)
  })
  it("BA-only deletion denies the surviving JWT and bridge remint", async () => {
    const { user, session, request, ctx } = await fixture()
    const cookie = await issueBoundPayloadSessionCookie(user.id, request, session.id)
    await ctx.internalAdapter.deleteSession(session.token)
    expect((await payload.auth({ headers: cookieHeader(cookie) })).user).toBeNull()
    await expect(issueBoundPayloadSessionCookie(user.id, request, session.id)).rejects.toThrow()
  })
  it("Payload-only device removal cannot remint via surviving BA", async () => {
    const { user, session, request } = await fixture()
    const cookie = await issueBoundPayloadSessionCookie(user.id, request, session.id)
    await payload.update({ collection: "users", id: user.id, data: { sessions: [] }, overrideAccess: true })
    expect((await payload.auth({ headers: cookieHeader(cookie) })).user).toBeNull()
    await expect(issueBoundPayloadSessionCookie(user.id, request, session.id)).rejects.toThrow()
    expect((await payload.findByID({ collection: "users", id: user.id, overrideAccess: true })).sessions).toHaveLength(0)
  })
  it("per-device tombstone denies the device and preserves another BA device", async () => {
    const { user, session, request, baUser, ctx } = await fixture()
    const second = await ctx.internalAdapter.createSession(baUser.id)
    if (!second) throw new Error("Missing second device")
    const firstCookie = await issueBoundPayloadSessionCookie(user.id, request, session.id)
    const secondCookie = await issueBoundPayloadSessionCookie(user.id, request, second.id)
    const first = (await payload.auth({ headers: cookieHeader(firstCookie) })).user
    if (!first) throw new Error("First device missing")
    await revokeCustomerPayloadSessions(payload, first, false)
    expect((await payload.auth({ headers: cookieHeader(firstCookie) })).user).toBeNull()
    expect((await payload.auth({ headers: cookieHeader(secondCookie) })).user?.id).toBe(user.id)
    await expect(issueBoundPayloadSessionCookie(user.id, request, session.id)).rejects.toThrow()
  })
  it("global epoch remains authoritative after stale SDK full-user write", async () => {
    const { user, session, request } = await fixture()
    const cookie = await issueBoundPayloadSessionCookie(user.id, request, session.id)
    const stale = await payload.findByID({ collection: "users", id: user.id, overrideAccess: true })
    await revokeCustomerPayloadSessions(payload, stale, true)
    // Actual stale adapter write bypasses collection hooks, matching SDK session
    // code. It cannot overwrite the independent durable account fence.
    await payload.db.updateOne({ collection: "users", id: user.id, data: { ...stale }, returning: false })
    expect((await payload.auth({ headers: cookieHeader(cookie) })).user).toBeNull()
    expect(await validateCustomerPayloadSession(payload, { ...stale, _sid: stale.sessions?.[0]?.id })).toBe(false)
    await expect(issueBoundPayloadSessionCookie(user.id, request, session.id)).rejects.toThrow()
  })
  it("completion racing global revoke cannot yield an authorized old-session cookie", async () => {
    const { user, session, request } = await fixture()
    const cookies = await Promise.allSettled([issueBoundPayloadSessionCookie(user.id, request, session.id), revokeCustomerPayloadSessions(payload, user, true)])
    expect(cookies[1]?.status).toBe("fulfilled")
    const result = cookies[0]
    if (result?.status === "fulfilled" && typeof result.value === "string") expect((await payload.auth({ headers: cookieHeader(result.value) })).user).toBeNull()
    await expect(issueBoundPayloadSessionCookie(user.id, request, session.id)).rejects.toThrow()
  })
  it("actual SDK logout owns a live transaction for the revocation hook", async () => {
    const { user, session, request } = await fixture()
    const cookie = await issueBoundPayloadSessionCookie(user.id, request, session.id)
    const principal = (await payload.auth({ headers: cookieHeader(cookie) })).user
    if (!principal) throw new Error("Missing logout principal")
    const req = await createLocalReq({ user: principal, req: { payloadAPI: "REST", searchParams: new URLSearchParams() } }, payload)
    const collection = payload.collections.users
    if (!collection) throw new Error("Missing users collection")
    expect(await logoutOperation({ collection, req })).toBe(true)
    expect((await payload.auth({ headers: cookieHeader(cookie) })).user).toBeNull()
    await expect(issueBoundPayloadSessionCookie(user.id, request, session.id)).rejects.toThrow()
  })
  it("role membership change and tenant archive revoke current authority", async () => {
    const first = await fixture()
    const cookie = await issueBoundPayloadSessionCookie(first.user.id, first.request, first.session.id)
    await payload.update({ collection: "users", id: first.user.id, data: { role: "viewer" }, overrideAccess: true })
    expect((await payload.auth({ headers: cookieHeader(cookie) })).user).toBeNull()
    const second = await fixture()
    const another = await issueBoundPayloadSessionCookie(second.user.id, second.request, second.session.id)
    await payload.update({ collection: "tenants", id: second.tenant.id, data: { status: "archived" }, overrideAccess: true })
    expect((await payload.auth({ headers: cookieHeader(another) })).user).toBeNull()
  })
})
