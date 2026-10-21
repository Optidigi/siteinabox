import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { MastraLanguageModelV2Mock } from "@mastra/core/test-utils/llm-mock"
import type { ToolsInput } from "@mastra/core/agent"
import { sql } from "@payloadcms/db-postgres"
import { Client } from "pg"
import { readFile, unlink, mkdir, rmdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fixtureSpec } from "../_helpers/siteGenerationFixture"
import type { Payload } from "payload"
import { getTestPayload } from "./_helpers"
import { asRecord, queryRows } from "@/lib/record"

const projectionSdk = vi.hoisted(() => ({ model: undefined as MastraLanguageModelV2Mock | undefined }))
vi.mock("@mastra/core/agent", async importOriginal => {
  const actual = await importOriginal<typeof import("@mastra/core/agent")>()
  return { ...actual, Agent: class extends actual.Agent<string, ToolsInput, unknown> {
    constructor(config: ConstructorParameters<typeof actual.Agent>[0]) {
      if (!projectionSdk.model) throw new Error("A controlled model is required for the projection test")
      super({ ...config, model: projectionSdk.model })
    }
  } }
})

let payload: Payload
beforeAll(async () => { payload = await getTestPayload() })
afterAll(async () => {
  await globalThis.__siabBetterAuthPool?.end()
  await globalThis.__siabPreviewBetterAuthPool?.end()
  globalThis.__siabBetterAuthPool = undefined
  globalThis.__siabPreviewBetterAuthPool = undefined
  await payload?.destroy()
})

describe("verified customer identity", () => {
  it("records the actual first verification transition once, independently of account creation and retries", async () => {
    const database = payload.db.drizzle
    const id = "m14-original-verification"
    const createdAt = "2025-01-01T00:00:00.000Z"
    await database.execute(sql`INSERT INTO preview_auth_users
      (id, name, email, "emailVerified", "createdAt", "updatedAt")
      VALUES (${id}, 'Synthetic identity', 'm14-anchor@test.invalid', false, ${createdAt}, ${createdAt})`)
    const read = async () => queryRows<{ firstVerifiedAt: string | Date | null }>(
      await database.execute(sql`SELECT "firstVerifiedAt" FROM preview_auth_users WHERE id=${id}`),
    )[0]!.firstVerifiedAt
    expect(await read()).toBeNull()
    const before = Date.now()
    await database.execute(sql`UPDATE preview_auth_users SET "emailVerified"=true WHERE id=${id}`)
    const original = new Date((await read())!).toISOString()
    expect(Date.parse(original)).toBeGreaterThanOrEqual(before - 1000)
    expect(Date.parse(original)).toBeLessThanOrEqual(Date.now())
    expect(original).not.toBe(createdAt)
    await database.execute(sql`UPDATE preview_auth_users
      SET "firstVerifiedAt"='2099-01-01T00:00:00Z', "updatedAt"=now() WHERE id=${id}`)
    expect(new Date((await read())!).toISOString()).toBe(original)
    await database.execute(sql`UPDATE preview_auth_users SET "emailVerified"=false WHERE id=${id}`)
    await database.execute(sql`UPDATE preview_auth_users SET "emailVerified"=true WHERE id=${id}`)
    expect(new Date((await read())!).toISOString()).toBe(original)
  })

  it("concurrent verified sessions claim one durable account and cannot replace its anchor or authority", async () => {
    const { resolveVerifiedCustomerAccount } = await import("@/lib/auth/verifiedCustomer")
    const inserted = queryRows<{ firstVerifiedAt: string | Date }>(await payload.db.drizzle.execute(sql`
      INSERT INTO preview_auth_users (id,name,email,"emailVerified","createdAt","updatedAt")
      VALUES ('m14-concurrent','Synthetic identity','m14-race@test.invalid',true,now(),now()) RETURNING "firstVerifiedAt"`))
    const verifiedAt = new Date(inserted[0]!.firstVerifiedAt).toISOString()
    const session = {
      user: { id: "m14-concurrent", email: "m14-race@test.invalid", emailVerified: true, firstVerifiedAt: verifiedAt },
      session: { id: "m14-session", userId: "m14-concurrent", expiresAt: new Date(Date.now() + 60_000) },
    }
    const accounts = await Promise.all(Array.from({ length: 4 }, () => resolveVerifiedCustomerAccount(payload, session)))
    expect(new Set(accounts.map(account => account.id)).size).toBe(1)
    expect(accounts.every(account => account.verifiedAt === verifiedAt)).toBe(true)
    const account = accounts[0]!
    await expect(resolveVerifiedCustomerAccount(payload, {
      ...session, user: { ...session.user, firstVerifiedAt: new Date().toISOString() },
    })).rejects.toThrow("E_CUSTOMER_IDENTITY_CONFLICT")
    await expect(resolveVerifiedCustomerAccount(payload, {
      ...session, user: { ...session.user, id: "substituted" },
      session: { ...session.session, userId: "substituted" },
    })).rejects.toThrow("E_CUSTOMER_IDENTITY_CONFLICT")
    await payload.update({ collection: "customer-accounts", id: account.id, overrideAccess: true,
      data: { revokedAt: new Date().toISOString() } })
    await expect(resolveVerifiedCustomerAccount(payload, session)).rejects.toThrow("E_CUSTOMER_ACCOUNT_REVOKED")
  })

  it("refuses an initial claim with a substituted verification instant, then permits the actual database evidence", async () => {
    const { resolveVerifiedCustomerAccount } = await import("@/lib/auth/verifiedCustomer")
    const inserted = queryRows<{ firstVerifiedAt: string | Date }>(await payload.db.drizzle.execute(sql`
      INSERT INTO preview_auth_users (id,name,email,"emailVerified","createdAt","updatedAt")
      VALUES ('m14-source','Synthetic identity','m14-source@test.invalid',true,now(),now()) RETURNING "firstVerifiedAt"`))
    const firstVerifiedAt = new Date(inserted[0]!.firstVerifiedAt).toISOString()
    const session = {
      user: { id: "m14-source", email: "m14-source@test.invalid", emailVerified: true, firstVerifiedAt },
      session: { id: "m14-source-session", userId: "m14-source", expiresAt: new Date(Date.now() + 60_000) },
    }
    await expect(resolveVerifiedCustomerAccount(payload, {
      ...session, user: { ...session.user, firstVerifiedAt: "2025-01-01T00:00:00.000Z" },
    })).rejects.toThrow()
    expect((await resolveVerifiedCustomerAccount(payload, session)).verifiedAt).toBe(firstVerifiedAt)
  })

  it("serializes competing workspace creation into one tenant and rejects an expired actor before its factory runs", async () => {
    const { resolveVerifiedCustomerAccount } = await import("@/lib/auth/verifiedCustomer")
    const { withCustomerWorkspace } = await import("@/lib/auth/customerWorkspace")
    const inserted = queryRows<{ firstVerifiedAt: string | Date }>(await payload.db.drizzle.execute(sql`
      INSERT INTO preview_auth_users (id,name,email,"emailVerified","createdAt","updatedAt")
      VALUES ('m14-workspace','Synthetic identity','m14-workspace@test.invalid',true,now(),now()) RETURNING "firstVerifiedAt"`))
    await payload.db.drizzle.execute(sql`INSERT INTO preview_auth_sessions
      (id,"userId",token,"expiresAt","createdAt","updatedAt")
      VALUES ('m14-workspace-session','m14-workspace','synthetic-workspace-token',now()+interval '1 hour',now(),now())`)
    const account = await resolveVerifiedCustomerAccount(payload, {
      user: { id: "m14-workspace", email: "m14-workspace@test.invalid", emailVerified: true,
        firstVerifiedAt: new Date(inserted[0]!.firstVerifiedAt).toISOString() },
      session: { id: "m14-workspace-session", userId: "m14-workspace", expiresAt: new Date(Date.now() + 60_000) },
    })
    const authority = { accountId: account.id, previewSessionId: "m14-workspace-session" }
    let creations = 0
    const results = await Promise.all(Array.from({ length: 4 }, () => withCustomerWorkspace(payload, authority, async (bound, req) => {
      if (bound) return { doc: bound, operation: "updated" }
      creations += 1
      const doc = await payload.create({ collection: "tenants", overrideAccess: true, req,
        context: { skipProjection: true }, data: { name: "Private workspace", slug: "m14-private", domain: "m14-private.invalid", status: "provisioning" } })
      return { doc, operation: "created" }
    })))
    expect(creations).toBe(1)
    expect(new Set(results.map(result => result.doc.id)).size).toBe(1)
    await payload.db.drizzle.execute(sql`UPDATE preview_auth_sessions SET "expiresAt"=now()-interval '1 second'
      WHERE id='m14-workspace-session'`)
    let attempted = false
    await expect(withCustomerWorkspace(payload, authority, async () => {
      attempted = true
      throw new Error("Expired authority reached tenant creation")
    })).rejects.toThrow("E_CUSTOMER_SESSION_REQUIRED")
    expect(attempted).toBe(false)
  })

  it("rejects a competing CMS membership before a bound customer can acquire another tenant", async () => {
    const other = await payload.create({ collection: "tenants", overrideAccess: true,
      context: { skipProjection: true }, data: { name: "Other workspace", slug: "m14-other", domain: "m14-other.invalid", status: "provisioning" } })
    await expect(payload.create({ collection: "users", overrideAccess: true,
      data: { name: "Conflicting owner", email: "m14-workspace@test.invalid", password: "Synthetic-fixture-password-42!",
        role: "owner", tenants: [{ tenant: other.id }] } })).rejects.toThrow()
    expect((await payload.find({ collection: "users", where: { email: { equals: "m14-workspace@test.invalid" } },
      overrideAccess: true, depth: 0 })).totalDocs).toBe(0)
  })

  it("renews an expired bound grant with a fresh session while preserving identity, but never renews revoked access", async () => {
    const { loadVerifiedCustomerGrant } = await import("@/lib/preview/previewAccess")
    const account = (await payload.find({ collection: "customer-accounts", where: { email: { equals: "m14-workspace@test.invalid" } },
      depth: 0, overrideAccess: true })).docs[0]!
    const originalAnchor = account.verifiedAt
    const tenantId = typeof account.tenant === "object" ? account.tenant!.id : account.tenant!
    await payload.db.drizzle.execute(sql`INSERT INTO preview_auth_sessions
      (id,"userId",token,"expiresAt","createdAt","updatedAt")
      VALUES ('m14-return-session','m14-workspace','synthetic-return-token',now()+interval '1 hour',now(),now())`)
    const authority = { accountId: account.id, previewSessionId: "m14-return-session" }
    const intake = await payload.create({ collection: "intake-submissions", overrideAccess: true,
      data: { businessName: "Private workspace", source: "builder", status: "preview_ready", idempotencyKey: "m14-return-intake", raw: { fixture: true } } })
    const run = await payload.create({ collection: "site-generation-runs", overrideAccess: true,
      data: { intakeSubmission: intake.id, tenant: tenantId, status: "preview_ready", idempotencyKey: "m14-return-run",
        normalizedIntake: {}, normalizedIntakeHash: "a".repeat(64), provider: "mock", model: "fixture:generic",
        promptVersion: "m14-fixture", generationInputHash: "b".repeat(64) } })
    const grant = await payload.create({ collection: "preview-access-grants", overrideAccess: true,
      data: { customerEmail: account.email, tenant: tenantId, generationRun: run.id, clientSlug: "m14-private",
        expiresAt: "2025-01-01T00:00:00.000Z" } })
    const restored = await loadVerifiedCustomerGrant({ payload, email: account.email, authority })
    expect(restored?.grant.id).toBe(grant.id)
    expect(Date.parse(restored!.grant.expiresAt)).toBeGreaterThan(Date.now())
    expect((await payload.findByID({ collection: "customer-accounts", id: account.id, overrideAccess: true })).verifiedAt).toBe(originalAnchor)
    await payload.update({ collection: "preview-access-grants", id: grant.id, overrideAccess: true,
      data: { revokedAt: new Date().toISOString() } })
    await expect(loadVerifiedCustomerGrant({ payload, email: account.email, authority })).rejects.toThrow("E_CUSTOMER_WORKSPACE_UNAVAILABLE")
    await payload.db.drizzle.execute(sql`UPDATE preview_auth_sessions SET "expiresAt"=now()-interval '1 second'
      WHERE id='m14-return-session'`)
    await expect(loadVerifiedCustomerGrant({ payload, email: account.email, authority })).rejects.toThrow("E_CUSTOMER_SESSION_REQUIRED")
  })

  it("account revocation invalidates linked Payload cookies, API keys and both SDK sessions without minting a replacement", async () => {
    const account = (await payload.find({ collection: "customer-accounts", where: { email: { equals: "m14-workspace@test.invalid" } },
      depth: 0, overrideAccess: true })).docs[0]!
    const tenantId = typeof account.tenant === "object" ? account.tenant!.id : account.tenant!
    const apiKey = "synthetic-m14-revocation-api-key"
    const password = "Synthetic-fixture-password-42!"
    const owner = await payload.create({ collection: "users", overrideAccess: true,
      data: { name: "Bound owner", email: account.email, password, role: "owner", tenants: [{ tenant: tenantId }],
        enableAPIKey: true, apiKey } })
    const login = await payload.login({ collection: "users", data: { email: account.email, password } })
    const headers = new Headers({ cookie: `${payload.config.cookiePrefix ?? "payload"}-token=${login.token}` })
    const keyHeaders = new Headers({ authorization: `users API-Key ${apiKey}` })
    expect((await payload.auth({ headers })).user?.id).toBe(owner.id)
    expect((await payload.auth({ headers: keyHeaders })).user?.id).toBe(owner.id)
    const [{ auth }, { previewAuth }] = await Promise.all([import("@/lib/betterAuth"), import("@/lib/preview/betterAuth")])
    const cmsContext = await auth.$context
    const previewContext = await previewAuth.$context
    const cmsUser = await cmsContext.internalAdapter.createUser({ email: account.email, name: "Bound owner",
      emailVerified: true, payloadUserId: String(owner.id) }, { method: "test" })
    const cmsSession = await cmsContext.internalAdapter.createSession(cmsUser.id)
    const previewSession = await previewContext.internalAdapter.createSession(account.previewUserId)
    expect(Boolean(await cmsContext.internalAdapter.findSession(cmsSession.token))).toBe(true)
    expect(Boolean(await previewContext.internalAdapter.findSession(previewSession.token))).toBe(true)
    expect((await payload.findByID({ collection: "customer-accounts", id: account.id, overrideAccess: true, depth: 0 })).payloadUser).toBe(owner.id)
    await payload.update({ collection: "customer-accounts", id: account.id, overrideAccess: true,
      data: { revokedAt: new Date().toISOString() } })
    expect((await payload.auth({ headers })).user?.id).toBeUndefined()
    expect((await payload.auth({ headers: keyHeaders })).user?.id).toBeUndefined()
    expect(Boolean(await cmsContext.internalAdapter.findSession(cmsSession.token))).toBe(false)
    expect(Boolean(await previewContext.internalAdapter.findSession(previewSession.token))).toBe(false)
    await expect(cmsContext.internalAdapter.createSession(cmsUser.id)).rejects.toThrow()
    await expect(previewContext.internalAdapter.createSession(account.previewUserId)).rejects.toThrow()
    await expect(payload.login({ collection: "users", data: { email: account.email, password } })).rejects.toThrow()
    const { issuePayloadSessionCookie } = await import("@/lib/socialAuth/payloadSession")
    await expect(issuePayloadSessionCookie(owner.id, new Request("https://admin.siteinabox.nl"), account.email)).rejects.toThrow()
    await payload.update({ collection: "customer-accounts", id: account.id, overrideAccess: true, data: { revokedAt: null } })
    const fresh = await payload.login({ collection: "users", data: { email: account.email, password } })
    expect((await payload.auth({ headers: new Headers({ cookie: `${payload.config.cookiePrefix ?? "payload"}-token=${fresh.token}` }) })).user?.id).toBe(owner.id)
    expect((await payload.auth({ headers })).user?.id).toBeUndefined()
    expect((await payload.auth({ headers: keyHeaders })).user?.id).toBeUndefined()
    expect((await payload.findByID({ collection: "customer-accounts", id: account.id, overrideAccess: true })).verifiedAt).toBe(account.verifiedAt)
  })

  it("refuses a suspended workspace at admission before any provider or content operation", async () => {
    const { assertCustomerAccess } = await import("@/lib/auth/customerWorkspace")
    const { previewAuth } = await import("@/lib/preview/betterAuth")
    const account = (await payload.find({ collection: "customer-accounts", where: { email: { equals: "m14-workspace@test.invalid" } },
      depth: 0, overrideAccess: true })).docs[0]!
    const session = await (await previewAuth.$context).internalAdapter.createSession(account.previewUserId)
    const tenantId = typeof account.tenant === "object" ? account.tenant!.id : account.tenant!
    await payload.update({ collection: "tenants", id: tenantId, overrideAccess: true, context: { skipProjection: true },
      data: { status: "suspended" } })
    await expect(assertCustomerAccess(payload, { accountId: account.id, previewSessionId: session.id },
      { intent: "write" })).rejects.toThrow("E_CUSTOMER_WORKSPACE_UNAVAILABLE")
  })

  it("refuses a substituted verified broker email before minting a Payload session", async () => {
    const { issuePayloadSessionCookie } = await import("@/lib/socialAuth/payloadSession")
    const tenant = await payload.create({ collection: "tenants", overrideAccess: true, context: { skipProjection: true },
      data: { name: "Existing CMS binding", slug: "m14-bridge", domain: "m14-bridge.invalid", status: "active" } })
    const user = await payload.create({ collection: "users", overrideAccess: true,
      data: { name: "Existing CMS owner", email: "m14-bridge@test.invalid", password: "Synthetic-fixture-password-42!",
        role: "owner", tenants: [{ tenant: tenant.id }] } })
    let minted = false
    try {
      await issuePayloadSessionCookie(user.id, new Request("https://admin.siteinabox.nl"), "substituted@test.invalid")
      minted = true
    } catch { /* The caller's verified email must agree with the current stored binding. */ }
    expect(minted).toBe(false)
    const sessions = queryRows<{ count: string }>(await payload.db.drizzle.execute(sql`
      SELECT count(*) AS count FROM users_sessions WHERE _parent_id=${user.id}`))
    expect(Number(sessions[0]!.count)).toBe(0)
  })
})


it("serializes complete generated content against concurrent account revocation", async () => {
  const { previewAuth } = await import("@/lib/preview/betterAuth")
  const { resolveVerifiedCustomerAccount } = await import("@/lib/auth/verifiedCustomer")
  const { applySiteGenerationSpec } = await import("@/lib/site-generation/applySiteGenerationSpec")
  const context = await previewAuth.$context
  const user = await context.internalAdapter.createUser({ name: "Synthetic generation race", email: "m14-content-race@test.invalid", emailVerified: true }, { method: "test" })
  const session = await context.internalAdapter.createSession(user.id)
  const source = queryRows<{ firstVerifiedAt: Date | string }>(await payload.db.drizzle.execute(sql`
    SELECT "firstVerifiedAt" FROM preview_auth_users WHERE id=${user.id}`))[0]!
  const account = await resolveVerifiedCustomerAccount(payload, { user: { ...user, firstVerifiedAt: source.firstVerifiedAt }, session })
  const authority = { accountId: account.id, previewSessionId: session.id }
  let releasePage!: () => void, reachedPage!: () => void
  const paused = new Promise<void>(resolve => { releasePage = resolve })
  const reached = new Promise<void>(resolve => { reachedPage = resolve })
  const hooks = payload.collections.pages.config.hooks.afterChange ??= []
  const hook: (typeof hooks)[number] = async ({ doc }) => {
    if (doc.slug === "index" && doc.title === "M14 concurrent content") { reachedPage(); await paused }
    return doc
  }
  hooks.push(hook)
  const revoker = new Client({ connectionString: process.env.DATABASE_URI, application_name: "siab-m14-revocation-race" })
  let generation: ReturnType<typeof applySiteGenerationSpec> | undefined
  let revocation: Promise<void> | undefined
  try {
    await revoker.connect()
    const spec = fixtureSpec(); spec.pages[0]!.title = "M14 concurrent content"
    generation = applySiteGenerationSpec(payload, spec, { customerAuthority: authority })
    await Promise.race([reached, generation.then(() => { throw new Error("Generation never reached the paused page") })])
    revocation = revoker.query("UPDATE customer_accounts SET revoked_at=clock_timestamp() WHERE id=$1", [account.id]).then(() => undefined)
    let blocked = false
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const waiting = queryRows<{ blocked: boolean }>(await payload.db.drizzle.execute(sql`
        SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='siab-m14-revocation-race'
          AND wait_event_type='Lock') AS blocked`))
      if (waiting[0]?.blocked) { blocked = true; break }
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    expect(blocked, "Revocation must wait for all local generation work, including settings after this page").toBe(true)
    releasePage()
    const result = await generation; expect(result.ok).toBe(true)
    await revocation
    const persisted = await payload.findByID({ collection: "customer-accounts", id: account.id, overrideAccess: true, depth: 0 })
    expect(persisted.revokedAt).toBeTruthy()
    const tenantId = typeof persisted.tenant === "object" ? persisted.tenant!.id : persisted.tenant!
    const settings = await payload.find({ collection: "site-settings", where: { tenant: { equals: tenantId } }, overrideAccess: true, depth: 0 })
    expect(settings.totalDocs).toBe(1)
    await expect(applySiteGenerationSpec(payload, spec, { customerAuthority: authority })).rejects.toThrow("E_CUSTOMER_SESSION_REQUIRED")
    expect((await payload.find({ collection: "site-settings", where: { tenant: { equals: tenantId } }, overrideAccess: true, depth: 0 })).docs).toEqual(settings.docs)
  } finally {
    releasePage()
    await generation?.catch(() => undefined)
    await revocation?.catch(() => undefined)
    hooks.splice(hooks.indexOf(hook), 1)
    await revoker.end()
  }
}, 15000)


it("rolls back local workspace work when its locked session expires before commit", async () => {
  const { previewAuth } = await import("@/lib/preview/betterAuth")
  const { resolveVerifiedCustomerAccount } = await import("@/lib/auth/verifiedCustomer")
  const { withCustomerWorkspace } = await import("@/lib/auth/customerWorkspace")
  const context = await previewAuth.$context
  const user = await context.internalAdapter.createUser({ name: "Synthetic expiry", email: "m14-during-expiry@test.invalid", emailVerified: true }, { method: "test" })
  const session = await context.internalAdapter.createSession(user.id)
  const row = queryRows<{ firstVerifiedAt: Date | string }>(await payload.db.drizzle.execute(sql`
    SELECT "firstVerifiedAt" FROM preview_auth_users WHERE id=${user.id}`))[0]!
  const account = await resolveVerifiedCustomerAccount(payload, { user: { ...user, firstVerifiedAt: row.firstVerifiedAt }, session })
  await payload.db.drizzle.execute(sql`UPDATE preview_auth_sessions SET "expiresAt"=clock_timestamp()+interval '500 milliseconds' WHERE id=${session.id}`)
  let created = false
  await expect(withCustomerWorkspace(payload, { accountId: account.id, previewSessionId: session.id }, async (_bound, req) => {
    const doc = await payload.create({ collection: "tenants", overrideAccess: true, req, context: { skipProjection: true },
      data: { name: "Rolled back workspace", slug: "m14-expiring", domain: "m14-expiring.invalid", status: "provisioning" } })
    created = true
    await new Promise(resolve => setTimeout(resolve, 600))
    return { doc, operation: "created" }
  })).rejects.toThrow("E_CUSTOMER_SESSION_REQUIRED")
  expect(created).toBe(true)
  expect((await payload.find({ collection: "tenants", where: { slug: { equals: "m14-expiring" } }, overrideAccess: true })).totalDocs).toBe(0)
  expect((await payload.findByID({ collection: "customer-accounts", id: account.id, overrideAccess: true, depth: 0 })).tenant).toBeFalsy()
})

it.each(["revocation", "expiry"] as const)("keeps maintainer theme writes atomic against %s during hooks", async boundary => {
  const { previewAuth } = await import("@/lib/preview/betterAuth")
  const { resolveVerifiedCustomerAccount } = await import("@/lib/auth/verifiedCustomer")
  const { withCustomerWorkspace } = await import("@/lib/auth/customerWorkspace")
  const { setTheme } = await import("@/lib/agent/tools")
  const context = await previewAuth.$context
  const user = await context.internalAdapter.createUser({ name: "Synthetic maintainer", email: `m14-tool-${boundary}@test.invalid`, emailVerified: true }, { method: "test" })
  const session = await context.internalAdapter.createSession(user.id)
  const row = queryRows<{ firstVerifiedAt: Date | string }>(await payload.db.drizzle.execute(sql`
    SELECT "firstVerifiedAt" FROM preview_auth_users WHERE id=${user.id}`))[0]!
  const account = await resolveVerifiedCustomerAccount(payload, { user: { ...user, firstVerifiedAt: row.firstVerifiedAt }, session })
  const authority = { accountId: account.id, previewSessionId: session.id }
  const tenant = (await withCustomerWorkspace(payload, authority, async (_bound, req) => ({
    doc: await payload.create({ collection: "tenants", overrideAccess: true, req, context: { skipProjection: true },
      data: { name: "Synthetic maintainer", slug: `m14-tool-${boundary}`, domain: `m14-tool-${boundary}.invalid`, status: "provisioning" } }), operation: "created",
  }))).doc
  let release!: () => void, reached!: () => void
  const paused = new Promise<void>(resolve => { release = resolve })
  const entered = new Promise<void>(resolve => { reached = resolve })
  const hooks = payload.collections.tenants.config.hooks.afterChange ??= []
  const hook: (typeof hooks)[number] = async ({ doc }) => {
    if (doc.id === tenant.id) { reached(); await paused }
    return doc
  }
  hooks.push(hook)
  const revoker = new Client({ connectionString: process.env.DATABASE_URI, application_name: "siab-m14-tool-revoker" })
  let mutation: ReturnType<typeof setTheme> | undefined, revocation: Promise<void> | undefined
  try {
    await revoker.connect()
    if (boundary === "expiry") await payload.db.drizzle.execute(sql`UPDATE preview_auth_sessions
      SET "expiresAt"=clock_timestamp()+interval '500 milliseconds' WHERE id=${session.id}`)
    mutation = setTheme({ payload, tenantId: tenant.id, customerAuthority: authority }, fixtureSpec().theme)
    // Attach the expected rejection before releasing the expiry hook.
    const outcome = mutation.then(value => ({ value, error: null }), error => ({ value: null, error }))
    await Promise.race([entered, outcome.then(() => { throw new Error("Mutation never reached the controlled hook") })])
    if (boundary === "revocation") {
      revocation = revoker.query("UPDATE customer_accounts SET revoked_at=clock_timestamp() WHERE id=$1", [account.id]).then(() => undefined)
      let blocked = false
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const waiting = queryRows<{ blocked: boolean }>(await payload.db.drizzle.execute(sql`
          SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='siab-m14-tool-revoker' AND wait_event_type='Lock') AS blocked`))
        if (waiting[0]?.blocked) { blocked = true; break }
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      expect(blocked, "Revocation must serialize with the actual maintainer mutation and its hooks").toBe(true)
      release(); expect((await outcome).error).toBeNull(); await revocation
      await expect(setTheme({ payload, tenantId: tenant.id, customerAuthority: authority }, fixtureSpec().theme)).rejects.toThrow("E_CUSTOMER_SESSION_REQUIRED")
    } else {
      await new Promise(resolve => setTimeout(resolve, 600)); release()
      expect((await outcome).error).toMatchObject({ message: "E_CUSTOMER_SESSION_REQUIRED" })
      expect((await payload.findByID({ collection: "tenants", id: tenant.id, overrideAccess: true })).theme).toEqual(tenant.theme)
    }
  } finally {
    release(); await mutation?.catch(() => undefined); await revocation?.catch(() => undefined)
    hooks.splice(hooks.indexOf(hook), 1); await revoker.end()
  }
}, 15000)


it.each(["settings", "page"] as const)("preserves %s projection bytes on expiry and refreshes only committed changes", async kind => {
  const { previewAuth } = await import("@/lib/preview/betterAuth")
  const { resolveVerifiedCustomerAccount } = await import("@/lib/auth/verifiedCustomer")
  const { applySiteGenerationSpec } = await import("@/lib/site-generation/applySiteGenerationSpec")
  const { setContact, patchSection } = await import("@/lib/agent/tools")
  const context = await previewAuth.$context
  const user = await context.internalAdapter.createUser({ name: "Synthetic projection", email: `m14-projection-${kind}@test.invalid`, emailVerified: true }, { method: "test" })
  const session = await context.internalAdapter.createSession(user.id)
  const source = queryRows<{ firstVerifiedAt: Date | string }>(await payload.db.drizzle.execute(sql`
    SELECT "firstVerifiedAt" FROM preview_auth_users WHERE id=${user.id}`))[0]!
  const account = await resolveVerifiedCustomerAccount(payload, { user: { ...user, firstVerifiedAt: source.firstVerifiedAt }, session })
  const authority = { accountId: account.id, previewSessionId: session.id }
  const spec = fixtureSpec(), slug = `m14-projection-${kind}`
  spec.tenant.slug = slug; spec.tenant.domain = slug + ".invalid"
  spec.intake.tenantSlug = slug; spec.intake.primaryDomain = spec.tenant.domain
  spec.intake.siteUrl = "https://" + spec.tenant.domain; spec.settings.siteUrl = spec.intake.siteUrl
  const applied = await applySiteGenerationSpec(payload, spec, { customerAuthority: authority })
  const { tenantId, settingsId } = applied
  const pageId = applied.pageIds?.[0]
  if (!applied.ok || tenantId == null || settingsId == null || pageId == null) throw new Error("Synthetic projection fixture did not apply")
  const tenant = await payload.findByID({ collection: "tenants", id: tenantId, depth: 0, overrideAccess: true })
  const manifest = asRecord(tenant.siteManifest)
  if (!manifest) throw new Error("Synthetic projection fixture has no manifest")
  const { resolveSettingsContract } = await import("@/lib/settingsContract")
  const contract = resolveSettingsContract(manifest)
  await payload.update({ collection: "tenants", id: tenant.id, overrideAccess: true, context: { skipProjection: true },
    data: { siteManifest: { ...manifest, settings: { ...contract, details: { ...contract.details,
      contact: { ...contract.details.contact, phone: true } } } } } })
  // Publish only this synthetic fixture through the normal hook, so real
  // projection files exist before the expiry/rollback experiment.
  await payload.update({ collection: "pages", id: pageId, overrideAccess: true, data: { status: "published" } })
  const collection = kind === "settings" ? "site-settings" : "pages"
  const id = kind === "settings" ? settingsId : pageId
  const before = await payload.findByID({ collection, id, overrideAccess: true, depth: 0 })
  const directory = path.join(process.env.DATA_DIR!, "tenants", String(tenantId))
  const files = ["site.json", "pages/index.json", "manifest.json"]
  const bytes = async () => Promise.all(files.map(file => readFile(path.join(directory, file))))
  const beforeFiles = await bytes()
  const hooks = payload.collections[collection].config.hooks.afterChange ??= []
  const hook: (typeof hooks)[number] = async ({ doc }) => {
    if (doc.id === id) await new Promise(resolve => setTimeout(resolve, 600))
    return doc
  }
  const change = (previewSessionId: string) => {
    const ctx = { payload, tenantId: tenantId, customerAuthority: { ...authority, previewSessionId } }
    return kind === "settings" ? setContact(ctx, { phone: "0612345678" })
      : patchSection(ctx, { pageSlug: "index", blockIndex: 0, patch: { heading: "Committed projection title" } })
  }
  hooks.push(hook)
  try {
    await payload.db.drizzle.execute(sql`UPDATE preview_auth_sessions SET "expiresAt"=clock_timestamp()+interval '500 milliseconds' WHERE id=${session.id}`)
    await expect(change(session.id)).rejects.toThrow("E_CUSTOMER_SESSION_REQUIRED")
  } finally { hooks.splice(hooks.indexOf(hook), 1) }
  expect(await payload.findByID({ collection, id, overrideAccess: true, depth: 0 })).toEqual(before)
  expect(await bytes()).toEqual(beforeFiles)
  const fresh = await context.internalAdapter.createSession(user.id)
  await change(fresh.id)
  expect(await bytes()).not.toEqual(beforeFiles)
  if (kind === "settings") {
    const site = path.join(directory, "site.json"), saved = await readFile(site)
    await unlink(site); await mkdir(site)
    try {
      await expect(setContact({ payload, tenantId: tenantId, customerAuthority: { ...authority, previewSessionId: fresh.id } },
        { phone: "0698765432" })).rejects.toMatchObject({ code: "E_CUSTOMER_PROJECTION_PENDING", committed: true })
      const committed = await payload.findByID({ collection: "site-settings", id: settingsId, overrideAccess: true, depth: 0 })
      expect(committed.contact?.phone).toBe("0698765432")
      const { runExistingSiteTurn, streamExistingSiteTurn } = await import("@/lib/agent/siteEditorAgent")
      const { heuristicExtractBuilderFacts } = await import("@/lib/builder/facts")
      const { CustomerProjectionError } = await import("@/lib/projection/customerTransaction")
      const outcomes = []
      vi.stubEnv("OPENAI_API_KEY", "siab-test-controlled-model-only")
      vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Live provider requests are forbidden") }))
      try {
        for (const mode of ["generate", "stream"] as const) {
          let requests = 0
          const phone = mode === "generate" ? "0611111111" : "0622222222"
          const response = () => {
            requests += 1
            return { content: requests === 1
              ? [{ type: "tool-call" as const, toolCallId: "projection-contact", toolName: "setContact", input: JSON.stringify({ phone }) }]
              : [{ type: "text" as const, text: "Must not claim this failed projection completed" }],
            finishReason: requests === 1 ? "tool-calls" as const : "stop" as const,
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, warnings: [] }
          }
          projectionSdk.model = new MastraLanguageModelV2Mock({ doGenerate: async () => response(), doStream: async () => {
            const result = response()
            return { stream: new ReadableStream({ start(controller) {
              for (const item of result.content) {
                if (item.type === "tool-call") controller.enqueue(item)
                else {
                  controller.enqueue({ type: "text-start", id: "projection-text" })
                  controller.enqueue({ type: "text-delta", id: "projection-text", delta: item.text })
                  controller.enqueue({ type: "text-end", id: "projection-text" })
                }
              }
              controller.enqueue({ type: "finish", finishReason: result.finishReason, usage: result.usage }); controller.close()
            } }) }
          } })
          const input = { ctx: { payload, tenantId, customerAuthority: { ...authority, previewSessionId: fresh.id } },
            facts: heuristicExtractBuilderFacts("Synthetic projection", null), message: "Wijzig het telefoonnummer.", pageSlug: "index", role: "owner", useMastra: true }
          let outcome = "completed"
          try {
            if (mode === "generate") await runExistingSiteTurn(input)
            else for await (const _event of streamExistingSiteTurn(input)) { /* Drain the real SDK execution and final outcome. */ }
          } catch (error) {
            outcome = error instanceof CustomerProjectionError && error.committed ? error.code : error instanceof Error ? error.name : "unknown"
          }
          const stored = await payload.findByID({ collection: "site-settings", id: settingsId, overrideAccess: true, depth: 0 })
          outcomes.push({ mode, outcome, requests, phone: stored.contact?.phone })
        }
      } finally { projectionSdk.model = undefined; vi.unstubAllGlobals(); vi.unstubAllEnvs() }
      expect(outcomes).toEqual([
        { mode: "generate", outcome: "E_CUSTOMER_PROJECTION_PENDING", requests: 1, phone: "0611111111" },
        { mode: "stream", outcome: "E_CUSTOMER_PROJECTION_PENDING", requests: 1, phone: "0622222222" },
      ])
    } finally { await rmdir(site); await writeFile(site, saved) }
    // Repeat the same authenticated, idempotent save after storage recovery;
    // this projects committed data without repeating AI or a provider write.
    await setContact({ payload, tenantId: tenantId, customerAuthority: { ...authority, previewSessionId: fresh.id } }, { phone: "0698765432" })
    expect((await readFile(site, "utf8")).includes("0698765432")).toBe(true)
  }
}, 15000)
