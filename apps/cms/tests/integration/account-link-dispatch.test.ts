import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"
import type { User } from "@/payload-types"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres"
import { down as undoAccountLinkSchema } from "@/migrations/20261021_225131_account_link_dispatch"
import { signPrivilegedMagicLinkMetadata } from "@/lib/auth/privilegedMagicLinkMetadata"
import { getTestPayload } from "./_helpers"
import { admitAccountLink, beginAccountLinkDelivery, bindAccountLinkToken, finishAccountLinkDelivery } from "@/lib/auth/accountLinkStore"
import type { AccountLinkTarget } from "@/lib/auth/accountLinkTypes"

const mail = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock("@/lib/email/sendEmail", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/email/sendEmail")>(), sendEmail: mail.send,
}))

let payload: Payload
beforeAll(async () => { payload = await getTestPayload() })
afterAll(async () => {
  await globalThis.__siabBetterAuthPool?.end()
  await globalThis.__siabPreviewBetterAuthPool?.end()
  globalThis.__siabBetterAuthPool = undefined
  globalThis.__siabPreviewBetterAuthPool = undefined
  await payload?.destroy()
})
const target = (recipient = "m15-race@test.invalid"): AccountLinkTarget => ({
  namespace: "preview", purpose: "free_verification", lane: "acquisition", recipient,
  origin: "https://admin.siteinabox.nl", callbackPath: "/builder", errorCallbackPath: "/login",
})
function expectRecovery(response: Response) {
  expect(response.status).toBe(302)
  expect(response.headers.get("location")).toBe("https://admin.siteinabox.nl/login?error=magic-link-session")
}

describe("durable account-link storage", () => {
  it("can undo an unused schema transactionally without dependency-order errors", async () => {
    const transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw new Error("No transaction")
    const db = (payload.db as unknown as PostgresAdapter).sessions[transactionID]!.db
    const { createLocalReq } = await import("payload")
    const req = await createLocalReq({}, payload)
    req.transactionID = transactionID
    try {
      await undoAccountLinkSchema({ db, payload, req })
      const { rows } = await db.execute(sql`SELECT to_regclass('account_link_dispatches') AS relation`)
      expect(rows[0]?.relation).toBeNull()
    } finally { await payload.db.rollbackTransaction(transactionID) }
  })
  it("coalesces simultaneous requests into one durable active claim", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => admitAccountLink(payload, target())))
    expect(results.filter(result => result.kind === "claimed")).toHaveLength(1)
    expect(results.filter(result => result.kind === "coalesced")).toHaveLength(7)
    expect((await payload.find({ collection: "account-link-dispatches", overrideAccess: true })).totalDocs).toBe(1)
  })

  it("fences duplicate dispatch and holds an uncertain outcome until token expiry", async () => {
    const input = target("m15-unknown@test.invalid")
    const admission = await admitAccountLink(payload, input)
    if (admission.kind !== "claimed") throw new Error("Expected an owned claim")
    const { lease } = admission
    await bindAccountLinkToken(payload, lease, { namespace: "preview", token: "synthetic-unknown-token",
      verificationId: "synthetic-row", expiresAt: new Date(Date.now() + 300_000) })
    await expect(beginAccountLinkDelivery(payload, { ...lease, token: "not-the-lease" })).rejects.toThrow("E_ACCOUNT_LINK_LEASE_LOST")
    await beginAccountLinkDelivery(payload, lease)
    await expect(beginAccountLinkDelivery(payload, lease)).rejects.toThrow("E_ACCOUNT_LINK_LEASE_LOST")
    await finishAccountLinkDelivery(payload, lease, { state: "indeterminate", code: "E_PROVIDER_WRITE_INDETERMINATE" })
    expect(await admitAccountLink(payload, input)).toEqual({ kind: "coalesced", id: lease.id })
    const row = await payload.findByID({ collection: "account-link-dispatches", id: lease.id, overrideAccess: true })
    expect(row.sendAttempts).toBe(1)
    expect(row.retryState).toBe("manual_review")
    await expect(finishAccountLinkDelivery(payload, lease, { state: "sent" })).rejects.toThrow("E_ACCOUNT_LINK_LEASE_LOST")
  })

  it("treats a crashed dispatch as uncertain rather than sending again", async () => {
    const input = target("m15-crash@test.invalid")
    const admission = await admitAccountLink(payload, input)
    if (admission.kind !== "claimed") throw new Error("Expected an owned claim")
    await bindAccountLinkToken(payload, admission.lease, { namespace: "preview", token: "synthetic-crash-token",
      verificationId: "synthetic-crash-row", expiresAt: new Date(Date.now() + 300_000) })
    await beginAccountLinkDelivery(payload, admission.lease)
    await payload.update({ collection: "account-link-dispatches", id: admission.lease.id, overrideAccess: true,
      data: { leaseUntil: new Date(Date.now() - 1000).toISOString() } })
    expect(await admitAccountLink(payload, input)).toEqual({ kind: "coalesced", id: admission.lease.id })
    expect((await payload.findByID({ collection: "account-link-dispatches", id: admission.lease.id,
      overrideAccess: true })).state).toBe("indeterminate")
  })

  it("keeps established-account admission independent of a full acquisition window", async () => {
    await payload.delete({ collection: "account-link-windows", where: {}, overrideAccess: true })
    for (let index = 0; index < 10; index++) {
      expect((await admitAccountLink(payload, target(`m15-free-${index}@test.invalid`))).kind).toBe("claimed")
    }
    expect((await admitAccountLink(payload, target("m15-free-overflow@test.invalid"))).kind).toBe("limited")
    expect((await admitAccountLink(payload, { ...target("m15-established@test.invalid"), namespace: "cms",
      purpose: "cms_login", lane: "protected", payloadUserId: "synthetic-owner" })).kind).toBe("claimed")
  })

  it("guards the actual preview SDK before issuance and binds consumption to its callback", async () => {
    await payload.delete({ collection: "account-link-windows", where: {}, overrideAccess: true })
    mail.send.mockResolvedValue({ provider: "synthetic" })
    const { previewAuth } = await import("@/lib/preview/betterAuth")
    const email = "m15-sdk@test.invalid"
    const origin = "https://admin.siteinabox.nl"
    const headers = new Headers({ origin, host: "admin.siteinabox.nl", "content-type": "application/json" })
    const replies = await Promise.all(Array.from({ length: 4 }, () => previewAuth.api.signInMagicLink({ headers,
      body: { email, callbackURL: "/builder", errorCallbackURL: "/login" } })))
    expect(replies).toEqual(Array.from({ length: 4 }, () => ({ status: true })))
    expect(mail.send).toHaveBeenCalledTimes(1)
    const message = mail.send.mock.calls[0]![0] as { text: string }
    const match = message.text.match(/https:\/\/[^\s<>]+magic-link\/verify[^\s<>]+/)
    if (!match) throw new Error("Synthetic link was not captured")
    const link = new URL(match[0])
    const bad = new URL(link)
    bad.searchParams.set("callbackURL", "/other-workspace")
    expectRecovery(await previewAuth.handler(new Request(bad)))
    const valid = await previewAuth.handler(new Request(link))
    expect(valid.status).toBe(302)
    expect(valid.headers.get("location")).toBe(origin + "/builder")
    expect(valid.headers.has("set-cookie")).toBe(true)
    expectRecovery(await previewAuth.handler(new Request(link)))
    const receipts = await payload.find({ collection: "account-link-dispatches", overrideAccess: true,
      where: { recipient: { equals: email } } })
    expect(receipts.totalDocs).toBe(1)
    expect(receipts.docs[0]?.state).toBe("consumed")
  })

  it("stages built-in recovery after commit and preserves a coalesced usable token", async () => {
    mail.send.mockClear()
    await payload.delete({ collection: "account-link-windows", where: {}, overrideAccess: true })
    const user = await payload.create({ collection: "users", overrideAccess: true, data: {
      email: "m15-reset@test.invalid", name: "Synthetic recovery", role: "super-admin", password: "Synthetic-password-42!",
    } })
    const first = await payload.forgotPassword({ collection: "users", data: { email: user.email } })
    expect(typeof first).toBe("string")
    expect(mail.send).not.toHaveBeenCalled()
    const second = await payload.forgotPassword({ collection: "users", data: { email: user.email } })
    expect(second).toBe(first)
    const stored = await payload.db.findOne<User>({ collection: "users", where: { id: { equals: user.id } } })
    expect(stored?.resetPasswordToken).toBe(first)
    const receipts = await payload.find({ collection: "account-link-dispatches", overrideAccess: true,
      where: { recipient: { equals: user.email } } })
    expect(receipts.totalDocs).toBe(1)
    expect(receipts.docs[0]?.state).toBe("queued")
    const { processAccountLinkDispatches } = await import("@/lib/jobs/accountLinkDispatchTask")
    await processAccountLinkDispatches(payload)
    expect(mail.send).toHaveBeenCalledTimes(1)
    await processAccountLinkDispatches(payload)
    expect(mail.send).toHaveBeenCalledTimes(1)
    const attempts = await Promise.allSettled(Array.from({ length: 2 }, () => payload.resetPassword({
      collection: "users", overrideAccess: true, data: { token: first!, password: "Changed-synthetic-password-43!" },
    })))
    expect(attempts.filter(attempt => attempt.status === "fulfilled")).toHaveLength(1)
    expect(attempts.filter(attempt => attempt.status === "rejected")).toHaveLength(1)
    expect(JSON.stringify(receipts.docs).includes(first!)).toBe(false)
  })

  it("never dispatches a reset staged in a transaction which later rolls back", async () => {
    mail.send.mockClear()
    const user = await payload.create({ collection: "users", overrideAccess: true, data: {
      email: "m15-rollback@test.invalid", name: "Synthetic rollback", role: "super-admin", password: "Synthetic-password-42!",
    } })
    const { createLocalReq } = await import("payload")
    const transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw new Error("No transaction")
    const req = await createLocalReq({}, payload)
    req.transactionID = transactionID
    try {
      await payload.forgotPassword({ collection: "users", data: { email: user.email }, req })
      const { processAccountLinkDispatches } = await import("@/lib/jobs/accountLinkDispatchTask")
      await processAccountLinkDispatches(payload)
      expect(mail.send).not.toHaveBeenCalled()
    } finally { await payload.db.rollbackTransaction(transactionID) }
    const stored = await payload.db.findOne<User>({ collection: "users", where: { id: { equals: user.id } } })
    expect(stored?.resetPasswordToken ?? null).toBeNull()
    const { processAccountLinkDispatches } = await import("@/lib/jobs/accountLinkDispatchTask")
    await processAccountLinkDispatches(payload)
    expect(mail.send).not.toHaveBeenCalled()
  })

  it("preserves active claims across independent process starts", async () => {
    await payload.delete({ collection: "account-link-windows", where: {}, overrideAccess: true })
    const run = async () => {
      const { stdout } = await promisify(execFile)(process.execPath,
        ["--import", "tsx", "tests/_helpers/accountLinkClaimProbe.mjs"], { env: process.env, timeout: 20000 })
      const result = stdout.split("\n").find(line => line.startsWith('{"accountLinkProbe":true'))
      if (!result) throw new Error("No bounded child result")
      return JSON.parse(result) as { kind: string }
    }
    const results = await Promise.all([run(), run()])
    expect(results.map(result => result.kind).sort()).toEqual(["claimed", "coalesced"])
    expect((await run()).kind).toBe("coalesced")
  })

  it("does not blindly redispatch a possibly delivered SDK link", async () => {
    mail.send.mockClear()
    mail.send.mockRejectedValue(new Error("Synthetic lost acknowledgement"))
    const { previewAuth } = await import("@/lib/preview/betterAuth")
    const request = { headers: new Headers({ origin: "https://admin.siteinabox.nl", host: "admin.siteinabox.nl" }),
      body: { email: "m15-sdk-unknown@test.invalid", callbackURL: "/builder", errorCallbackURL: "/login" } }
    await previewAuth.api.signInMagicLink(request)
    await previewAuth.api.signInMagicLink(request)
    expect(mail.send).toHaveBeenCalledTimes(1)
    const row = (await payload.find({ collection: "account-link-dispatches", overrideAccess: true,
      where: { recipient: { equals: request.body.email } } })).docs[0]!
    expect(row.state).toBe("indeterminate")
    expect(row.retryState).toBe("manual_review")
    mail.send.mockResolvedValue({ provider: "synthetic" })
    await payload.update({ collection: "account-link-dispatches", id: row.id, overrideAccess: true,
      data: { expiresAt: new Date(Date.now() - 1000).toISOString() } })
    await previewAuth.api.signInMagicLink(request)
    expect(mail.send).toHaveBeenCalledTimes(2)
  })

  it("retains only bounded pre-cutover SDK links and rejects duplicate identifiers", async () => {
    const { previewAuth } = await import("@/lib/preview/betterAuth")
    const { rows } = await payload.db.drizzle.execute(sql`SELECT activated_at FROM account_link_policies WHERE key='preview'`)
    const activation = rows[0]!.activated_at
    if (!(activation instanceof Date) && typeof activation !== "string") throw new Error("Missing activation instant")
    const activatedAt = new Date(activation)
    const expiresAt = new Date(activatedAt.getTime() + 299_000)
    const insert = async (id: string, token: string, createdAt: Date) => payload.db.drizzle.execute(sql`
      INSERT INTO preview_auth_verifications (id,identifier,value,"expiresAt","createdAt","updatedAt")
      VALUES (${id},${"magic-link:" + token},${JSON.stringify({ type: "magic-link", email: "m15-legacy@test.invalid" })},
        ${expiresAt.toISOString()},${createdAt.toISOString()},${createdAt.toISOString()})`)
    await insert("m15-legacy", "synthetic-legacy", new Date(activatedAt.getTime() - 1000))
    const link = (token: string) => new Request("https://admin.siteinabox.nl/api/preview-auth/magic-link/verify?" +
      new URLSearchParams({ token, callbackURL: "/builder", errorCallbackURL: "/login" }))
    expect((await previewAuth.handler(link("synthetic-legacy"))).status).toBe(302)
    await insert("m15-unbound-new", "synthetic-unbound", new Date(activatedAt.getTime() + 1000))
    expectRecovery(await previewAuth.handler(link("synthetic-unbound")))
    await insert("m15-duplicate-a", "synthetic-duplicate", new Date(activatedAt.getTime() - 1000))
    await insert("m15-duplicate-b", "synthetic-duplicate", new Date(activatedAt.getTime() - 1000))
    expectRecovery(await previewAuth.handler(link("synthetic-duplicate")))
  })

  it("rejects forged privileged CMS metadata before any verification row or mail is created", async () => {
    mail.send.mockClear()
    const { auth } = await import("@/lib/betterAuth")
    const user = await payload.create({ collection: "users", overrideAccess: true, data: {
      email: "m15-cms@test.invalid", name: "Synthetic CMS", role: "super-admin", password: "Synthetic-password-42!",
    } })
    const headers = new Headers({ origin: "https://admin.siteinabox.nl", host: "admin.siteinabox.nl" })
    await expect(auth.api.signInMagicLink({ headers, body: { email: user.email, callbackURL: "/",
      metadata: { intent: "user_invite", role: "owner", tenantId: "1", recipientEmail: user.email,
        adminUrl: "https://admin.siteinabox.nl" } } })).rejects.toMatchObject({ statusCode: 503 })
    expect(mail.send).not.toHaveBeenCalled()
    const { rows } = await payload.db.drizzle.execute(sql`SELECT count(*) AS count FROM better_auth_verifications`)
    expect(Number(rows[0]?.count)).toBe(0)
    await auth.api.signInMagicLink({ headers, body: { email: user.email, callbackURL: "/", errorCallbackURL: "/login" } })
    expect(mail.send).toHaveBeenCalledTimes(1)
    const receipt = (await payload.find({ collection: "account-link-dispatches", overrideAccess: true,
      where: { recipient: { equals: user.email } } })).docs[0]!
    expect(receipt.purpose).toBe("cms_login")
    expect(receipt.lane).toBe("protected")
    expect(receipt.payloadUserId).toBe(String(user.id))
  })

  it("refuses rollback rather than dropping durable authority or uncertainty records", async () => {
    const transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw new Error("No transaction")
    const db = (payload.db as unknown as PostgresAdapter).sessions[transactionID]!.db
    const { createLocalReq } = await import("payload")
    const req = await createLocalReq({}, payload)
    req.transactionID = transactionID
    try {
      await expect(undoAccountLinkSchema({ db, payload, req }))
        .rejects.toThrow("Preserve account-link authority")
    } finally { await payload.db.rollbackTransaction(transactionID) }
    expect((await payload.find({ collection: "account-link-dispatches", overrideAccess: true })).totalDocs).toBeGreaterThan(0)
  })

  it("never confirms a prior sent invitation for a changed role or a different purpose", async () => {
    await payload.delete({ collection: "account-link-windows", where: {}, overrideAccess: true })
    mail.send.mockClear()
    const { auth } = await import("@/lib/betterAuth")
    const tenant = await payload.create({ collection: "tenants", overrideAccess: true, context: { skipProjection: true },
      data: { name: "Scope fixture", slug: "m15-scope", domain: "m15-scope.test", status: "active" } })
    const user = await payload.create({ collection: "users", overrideAccess: true,
      data: { name: "Scope fixture", email: "m15-scope@test.invalid", password: "Synthetic-password-42!", role: "viewer", tenants: [{ tenant: tenant.id }] } })
    const headers = new Headers({ origin: "https://admin.siteinabox.nl", host: "admin.siteinabox.nl" })
    const invite = (role: string) => auth.api.signInMagicLink({ headers, body: { email: user.email, callbackURL: "/", errorCallbackURL: "/login",
      metadata: signPrivilegedMagicLinkMetadata("user_invite", { recipientEmail: user.email, tenantId: String(tenant.id),
        role, tenantName: tenant.name, recipientName: user.name!, adminUrl: "https://admin.siteinabox.nl" }) } })
    await invite("viewer")
    await invite("viewer")
    expect(mail.send).toHaveBeenCalledTimes(1)
    await payload.update({ collection: "users", id: user.id, overrideAccess: true, data: { role: "editor" } })
    await expect(invite("editor")).rejects.toMatchObject({ statusCode: 503 })
    expect(mail.send).toHaveBeenCalledTimes(1)
    const other = await payload.create({ collection: "users", overrideAccess: true,
      data: { name: "Other scope", email: "m15-other-scope@test.invalid", password: "Synthetic-password-42!", role: "editor", tenants: [{ tenant: tenant.id }] } })
    await auth.api.signInMagicLink({ headers, body: { email: other.email, callbackURL: "/", errorCallbackURL: "/login" } })
    await expect(auth.api.signInMagicLink({ headers, body: { email: other.email, callbackURL: "/", errorCallbackURL: "/login",
      metadata: signPrivilegedMagicLinkMetadata("user_invite", { recipientEmail: other.email, tenantId: String(tenant.id),
        role: "editor", tenantName: tenant.name, recipientName: other.name!, adminUrl: "https://admin.siteinabox.nl" }) } }))
      .rejects.toMatchObject({ statusCode: 503 })
    expect(mail.send).toHaveBeenCalledTimes(2)
  })

  it("keeps suspended-owner primary re-entry and recovery available under acquisition pressure", async () => {
    await payload.delete({ collection: "account-link-windows", where: {}, overrideAccess: true })
    await payload.create({ collection: "account-link-windows", overrideAccess: true,
      data: { key: "lane:acquisition", count: 10, expiresAt: new Date(Date.now() + 60_000).toISOString() } })
    mail.send.mockClear()
    const { auth } = await import("@/lib/betterAuth")
    const tenant = await payload.create({ collection: "tenants", overrideAccess: true, context: { skipProjection: true },
      data: { name: "Suspended recovery", slug: "m15-suspended", domain: "m15-suspended.test", status: "suspended" } })
    const user = await payload.create({ collection: "users", overrideAccess: true,
      data: { name: "Recovery owner", email: "m15-suspended@test.invalid", password: "Synthetic-password-42!",
        role: "owner", tenants: [{ tenant: tenant.id }] } })
    const headers = new Headers({ origin: "https://admin.siteinabox.nl", host: "admin.siteinabox.nl", cookie: "siab-locale=en" })
    await auth.api.signInMagicLink({ headers, body: { email: user.email, callbackURL: "/", errorCallbackURL: "/login" } })
    expect(mail.send).toHaveBeenCalledTimes(1)
    expect(mail.send.mock.calls[0]![0]).toMatchObject({ subject: "Sign in to Site in a Box" })
    const message = mail.send.mock.calls[0]![0] as { text: string }
    const link = message.text.match(/https:\/\/[^\s<>]+magic-link\/verify[^\s<>]+/)
    if (!link) throw new Error("No synthetic CMS link")
    const result = await auth.handler(new Request(link[0]))
    expect(result.status).toBe(302)
    expect(result.headers.get("location")).toBe("https://admin.siteinabox.nl/")
    await payload.forgotPassword({ collection: "users", data: { email: user.email } })
    const { processAccountLinkDispatches } = await import("@/lib/jobs/accountLinkDispatchTask")
    await processAccountLinkDispatches(payload)
    expect(mail.send).toHaveBeenCalledTimes(2)
    expect((await payload.findByID({ collection: "users", id: user.id, depth: 0, overrideAccess: true })).tenants?.[0]?.tenant).toBe(tenant.id)
  })
})
