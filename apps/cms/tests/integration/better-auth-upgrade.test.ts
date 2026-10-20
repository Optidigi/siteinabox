import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { getMigrations } from "better-auth/db/migration"
import type { Payload } from "payload"
import { getTestPayload } from "./_helpers"

describe("Better Auth schema compatibility with committed migrations", () => {
  let payload: Payload
  beforeAll(async () => { payload = await getTestPayload() }, 120000)
  afterAll(async () => {
    await globalThis.__siabBetterAuthPool?.end()
    await globalThis.__siabPreviewBetterAuthPool?.end()
    globalThis.__siabBetterAuthPool = undefined
    globalThis.__siabPreviewBetterAuthPool = undefined
    await payload?.destroy()
  })

  it("plans the CMS and preview schemas against the real migrated disposable database", async () => {
    const [{ auth }, { previewAuth }] = await Promise.all([
      import("@/lib/betterAuth"), import("@/lib/preview/betterAuth"),
    ])
    for (const instance of [auth, previewAuth]) {
      const plan = await getMigrations(instance.options)
      expect(plan.unsafeChanges).toEqual([])
      expect(plan.schemaProblems).toEqual([])
      expect(plan.toBeCreated).toEqual([])
      expect(plan.toBeAdded).toEqual([])
      expect(plan.toBeAddedIndexes).toEqual([])
    }
  }, 30000)

  it("preserves persisted Payload links, provider keys and sessions on a populated schema", async () => {
    const { auth } = await import("@/lib/betterAuth")
    const user = await payload.create({ collection: "users", overrideAccess: true, data: {
      email: "auth-upgrade@example.test", name: "Upgrade fixture", role: "super-admin", password: "Synthetic-fixture-password-42!",
    } })
    const context = await auth.$context
    const accountUser = await context.internalAdapter.createUser({
      email: user.email, name: "Upgrade fixture", emailVerified: true, payloadUserId: String(user.id),
    }, { method: "test" })
    for (const providerId of ["google", "apple"]) {
      await context.internalAdapter.createAccount({ userId: accountUser.id, providerId, accountId: "shared-synthetic-subject" })
    }
    const session = await context.internalAdapter.createSession(accountUser.id)
    const pool = globalThis.__siabBetterAuthPool!
    const snapshot = async () => JSON.stringify((await pool.query('SELECT row_to_json(a) AS row FROM better_auth_accounts a ORDER BY id')).rows)
    const before = await snapshot()
    const plan = await getMigrations(auth.options)
    expect(plan.toBeCreated.length + plan.toBeAdded.length + plan.toBeAddedIndexes.length).toBe(0)
    expect(plan.unsafeChanges).toEqual([])
    expect(await snapshot() === before).toBe(true)
    const linked = await pool.query<{ payloadUserId: string }>('SELECT "payloadUserId" FROM better_auth_users WHERE id=$1', [accountUser.id])
    expect(linked.rows[0]?.payloadUserId).toBe(String(user.id))
    expect((await context.internalAdapter.findSession(session.token))?.user.id).toBe(accountUser.id)
    await context.internalAdapter.deleteSession(session.token)
    expect(await context.internalAdapter.findSession(session.token)).toBeNull()
  }, 30000)

  it("accepts the existing loopback builder cookie through the real preview SDK", async () => {
    const [{ createLocalPreviewSessionCookie }, { previewAuth }] = await Promise.all([
      import("@/lib/builder/localPreviewSession"), import("@/lib/preview/betterAuth"),
    ])
    const cookie = await createLocalPreviewSessionCookie()
    const response = await previewAuth.handler(new Request("https://admin.siteinabox.nl/api/preview-auth/get-session", {
      headers: { cookie: `${cookie.name}=${encodeURIComponent(cookie.value)}` },
    }))
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result?.user?.email === "builder@local.test").toBe(true)
    expect(cookie.name).toContain("siab-preview-auth")
  })
})
