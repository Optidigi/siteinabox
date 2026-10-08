import "server-only"
import { queueCustomerRevocationReceipt } from "./customerRevocationReceipts"
import { betterAuth } from "better-auth"
import { APIError } from "better-auth/api"
import { z } from "zod"
import { createLocalReq, getFieldsToSign, getPayload, jwtSign, type Payload, type PayloadRequest } from "payload"
import { generatePayloadCookie } from "payload/shared"
import { BuilderQuotaService } from "@/lib/builder/quota"
import { createHash, randomUUID } from "node:crypto"
import config from "@/payload.config"
import { assertLiveBuilderTransaction } from "@/lib/builder/quotaTransaction"
import type { User } from "@/payload-types"
import { evaluateGate } from "@/lib/gateDecision"
import { resolveSiabContextForUser } from "@/lib/context"

const baSessionSchema = z.object({ id: z.string(), userId: z.string(), createdAt: z.coerce.date(), expiresAt: z.coerce.date() })
const baUserSchema = z.object({ id: z.string(), email: z.string().email(), emailVerified: z.literal(true), payloadUserId: z.string() })
type SessionUser = User & { _sid?: string }
export type CmsSessionAuthority = { id: string; createdAt: Date; expiresAt: Date; user: { payloadUserId: string; email: string; emailVerified: boolean } }

async function currentBetterAuthAuthority(id: string): Promise<CmsSessionAuthority | null> {
  const { auth } = await import("@/lib/betterAuth")
  const { adapter } = await auth.$context
  const session = baSessionSchema.safeParse(await adapter.findOne({ model: "session", where: [{ field: "id", value: id }] }))
  if (!session.success || session.data.expiresAt.getTime() <= Date.now()) return null
  const user = baUserSchema.safeParse(await adapter.findOne({ model: "user", where: [{ field: "id", value: session.data.userId }] }))
  return user.success ? { ...session.data, user: user.data } : null
}

async function accountAuthority(payload: Payload, user: User, req?: Partial<PayloadRequest>, allowCreation = false) {
  if (req) assertLiveBuilderTransaction(payload, req)
  const result = await payload.find({ collection: "customer-auth-accounts", where: { user: { equals: user.id } }, limit: 2, depth: 0, overrideAccess: true, req })
  if (result.totalDocs > 1) throw new Error("Duplicate customer account authority")
  if (result.docs[0]) return result.docs[0]
  if (!allowCreation) throw new Error("Missing customer account authority")
  try {
    if (req) assertLiveBuilderTransaction(payload, req)
    return await payload.create({ collection: "customer-auth-accounts", data: { user: user.id, authEpoch: new Date(0).toISOString() }, overrideAccess: true, req })
  } catch {
    if (req) assertLiveBuilderTransaction(payload, req)
    const retry = await payload.find({ collection: "customer-auth-accounts", where: { user: { equals: user.id } }, limit: 2, depth: 0, overrideAccess: true, req })
    if (retry.totalDocs !== 1 || !retry.docs[0]) throw new Error("Customer authority unavailable")
    return retry.docs[0]
  }
}

export async function assertPreviewHandoffEpoch(payload: Payload, user: User, previewCreatedAt: Date, req: Partial<PayloadRequest>): Promise<void> {
  assertLiveBuilderTransaction(payload, req)
  const accounts = await payload.find({ collection: "customer-auth-accounts", where: { user: { equals: user.id } }, limit: 2, depth: 0, overrideAccess: true, req })
  if (accounts.totalDocs > 1 || !Number.isFinite(previewCreatedAt.getTime())) throw new Error("Preview epoch authority unavailable")
  const account = accounts.docs[0]
  if (account && previewCreatedAt.getTime() <= new Date(account.authEpoch).getTime()) throw new APIError("FORBIDDEN", { message: "Preview predates customer revocation" })
}

async function authorityAllows(payload: Payload, user: User, authority: CmsSessionAuthority, req?: Partial<PayloadRequest>): Promise<boolean> {
  if (String(user.id) !== authority.user.payloadUserId || authority.user.emailVerified !== true || user.email.toLowerCase() !== authority.user.email.toLowerCase()) return false
  const account = await accountAuthority(payload, user, req, Boolean(req))
  if (authority.createdAt.getTime() <= new Date(account.authEpoch).getTime()) return false
  const ctx = await resolveSiabContextForUser(user, req)
  return evaluateGate(user, ctx).allow
}

export async function validateCustomerPayloadSession(payload: Payload, user: SessionUser, req?: Partial<PayloadRequest>): Promise<boolean> {
  if (!user._sid) return user.role === "super-admin"
  if (req) assertLiveBuilderTransaction(payload, req)
  const bindings = await payload.find({ collection: "customer-session-bindings", where: { and: [{ user: { equals: user.id } }, { payloadSessionId: { equals: user._sid } }] }, depth: 0, limit: 2, overrideAccess: true, req })
  const binding = bindings.docs[0]
  if (bindings.totalDocs === 0) return user.role === "super-admin"
  if (bindings.totalDocs !== 1 || !binding || binding.revokedAt || binding.state !== "active") return false
  const authority = await currentBetterAuthAuthority(binding.betterAuthSessionId)
  return authority !== null && await authorityAllows(payload, user, authority, req)
}

export type CustomerRevocationReceipt = {
  userId: number
  allSessions: boolean
  sid?: string
  epoch?: { id: number; minimum: string }
  bindings: { id: number; betterAuthSessionId: string; payloadSessionId?: string | null; revokedAt: string }[]
}

export async function verifyCommittedCustomerRevocation(payload: Payload, receipt: CustomerRevocationReceipt): Promise<void> {
  if (receipt.epoch) {
    const account = await payload.findByID({ collection: "customer-auth-accounts", id: receipt.epoch.id, depth: 0, overrideAccess: true })
    const accountUser = typeof account.user === "object" ? account.user.id : account.user
    if (accountUser !== receipt.userId || !(new Date(account.authEpoch).getTime() >= new Date(receipt.epoch.minimum).getTime())) throw new Error("Account revocation commit receipt unavailable")
  }
  for (const expected of receipt.bindings) {
    const binding = await payload.findByID({ collection: "customer-session-bindings", id: expected.id, depth: 0, overrideAccess: true })
    const bindingUser = typeof binding.user === "object" ? binding.user.id : binding.user
    if (bindingUser !== receipt.userId || binding.betterAuthSessionId !== expected.betterAuthSessionId || binding.payloadSessionId !== expected.payloadSessionId || binding.state !== "revoked" || !binding.revokedAt || new Date(binding.revokedAt).getTime() < new Date(expected.revokedAt).getTime()) throw new Error("Device revocation commit receipt unavailable")
  }
}

export async function revokeCustomerPayloadSessions(payload: Payload, user: SessionUser, allSessions: boolean, req?: Partial<PayloadRequest>): Promise<CustomerRevocationReceipt> {
  if (!req) {
    const service = new BuilderQuotaService(payload)
    await service.initialize()
    const receipt = await service.retry(() => service.transaction(async (transactionReq) => {
      await service.lockGlobal(transactionReq)
      return revokeCustomerPayloadSessions(payload, user, allSessions, transactionReq)
    }))
    await verifyCommittedCustomerRevocation(payload, receipt)
    return receipt
  }
  assertLiveBuilderTransaction(payload, req)
  let epoch: CustomerRevocationReceipt["epoch"]
  if (allSessions) {
    // Separate durable fence cannot be overwritten by SDK full-user session
    // writes. Advance conditionally so concurrent revocations cannot regress it.
    const account = await accountAuthority(payload, user, req, true)
    const now = new Date().toISOString()
    epoch = { id: account.id, minimum: now }
    assertLiveBuilderTransaction(payload, req)
    await payload.update({ collection: "customer-auth-accounts", where: { and: [{ id: { equals: account.id } }, { authEpoch: { less_than: now } }] }, data: { authEpoch: now }, overrideAccess: true, req })
    assertLiveBuilderTransaction(payload, req)
    const receipt = await payload.findByID({ collection: "customer-auth-accounts", id: account.id, depth: 0, overrideAccess: true, req })
    if (!(new Date(receipt.authEpoch).getTime() >= new Date(now).getTime())) throw new Error("Account revocation receipt unavailable")
  }
  if (!allSessions && !user._sid) throw new Error("Missing device session")
  if (req) assertLiveBuilderTransaction(payload, req)
  const revokedAt = new Date().toISOString()
  const result = await payload.update({ collection: "customer-session-bindings", where: { and: [{ user: { equals: user.id } }, ...(allSessions ? [] : [{ payloadSessionId: { equals: user._sid } }])] }, data: { state: "revoked", revokedAt }, overrideAccess: true, req })
  if (result.errors.length) throw new Error("Device revocation failed")
  if (req) assertLiveBuilderTransaction(payload, req)
  const remaining = await payload.find({ collection: "customer-session-bindings", where: { and: [{ user: { equals: user.id } }, { state: { not_equals: "revoked" } }, ...(allSessions ? [] : [{ payloadSessionId: { equals: user._sid } }])] }, limit: 1, depth: 0, overrideAccess: true, req })
  if (remaining.totalDocs !== 0) throw new Error("Device revocation receipt unavailable")
  const receipt: CustomerRevocationReceipt = { userId: user.id, allSessions, sid: user._sid, epoch, bindings: result.docs.map((binding) => ({ id: binding.id, betterAuthSessionId: binding.betterAuthSessionId, payloadSessionId: binding.payloadSessionId, revokedAt })) }
  queueCustomerRevocationReceipt(payload, req, receipt)
  return receipt
}

export async function revokeBetterAuthBinding(betterAuthSessionId: string): Promise<void> {
  const payload = await getPayload({ config })
  const service = new BuilderQuotaService(payload)
  await service.initialize()
  const revokedAt = new Date().toISOString()
  const receipt = await service.retry(() => service.transaction(async (req) => {
    await service.lockGlobal(req)
    assertLiveBuilderTransaction(payload, req)
    const result = await payload.update({ collection: "customer-session-bindings", where: { betterAuthSessionId: { equals: betterAuthSessionId } }, data: { state: "revoked", revokedAt }, overrideAccess: true, req })
    if (result.errors.length) throw new Error("Better Auth device revocation failed")
    assertLiveBuilderTransaction(payload, req)
    const remaining = await payload.find({ collection: "customer-session-bindings", where: { and: [{ betterAuthSessionId: { equals: betterAuthSessionId } }, { state: { not_equals: "revoked" } }] }, limit: 1, depth: 0, overrideAccess: true, req })
    if (remaining.totalDocs !== 0) throw new Error("Better Auth device revocation receipt unavailable")
    const rows = result.docs.map((binding) => ({ id: binding.id, userId: typeof binding.user === "object" ? binding.user.id : binding.user, payloadSessionId: binding.payloadSessionId }))
    for (const row of rows) queueCustomerRevocationReceipt(payload, req, { userId: row.userId, allSessions: false, bindings: [{ id: row.id, betterAuthSessionId, payloadSessionId: row.payloadSessionId, revokedAt }] })
    return rows
  }))
  for (const expected of receipt) {
    await verifyCommittedCustomerRevocation(payload, { userId: expected.userId, allSessions: false, bindings: [{ id: expected.id, betterAuthSessionId, payloadSessionId: expected.payloadSessionId, revokedAt }] })
  }
}

type PaidHandoffClaim = { orderId: number; attemptId: number; previewSessionId: string }
export async function issueBoundPayloadSession(payloadUserId: string | number, request: Request, betterAuthSessionId: string, handoff?: PaidHandoffClaim): Promise<{ cookie: string; betterAuthSessionId: string }> {
  const payload = await getPayload({ config })
  const service = new BuilderQuotaService(payload)
  await service.initialize()
  const issued = await service.retry(() => service.transaction(async (transactionReq) => {
    await service.lockGlobal(transactionReq)
    assertLiveBuilderTransaction(payload, transactionReq)
    let user = await payload.findByID({ collection: "users", id: payloadUserId, depth: 0, overrideAccess: true, req: transactionReq })
    const handoffKey = handoff ? createHash("sha256").update(JSON.stringify([handoff.orderId, handoff.previewSessionId])).digest("hex") : null
    if (handoff) {
      const { readVerifiedPreviewSession } = await import("./verifiedPreviewSession")
      const preview = await readVerifiedPreviewSession(request.headers, transactionReq)
      if (!preview || preview.session.id !== handoff.previewSessionId || preview.user.emailVerified !== true) throw new Error("Preview handoff authority unavailable")
      const { loadPaidHandoffFacts } = await import("./paidHandoff")
      await loadPaidHandoffFacts(payload, transactionReq, handoff.orderId, handoff.attemptId, preview.user.email)
      await assertPreviewHandoffEpoch(payload, user, preview.session.createdAt, transactionReq)
    }
    assertLiveBuilderTransaction(payload, transactionReq)
    const existing = await payload.find({ collection: "customer-session-bindings", where: handoffKey ? { handoffKey: { equals: handoffKey } } : { betterAuthSessionId: { equals: betterAuthSessionId } }, limit: 2, depth: 0, overrideAccess: true, req: transactionReq })
    let binding = existing.docs[0]
    if (existing.totalDocs > 1) throw new Error("Duplicate session authority")
    const authority = await currentBetterAuthAuthority(binding?.betterAuthSessionId ?? betterAuthSessionId)
    if (!authority || !await authorityAllows(payload, user, authority, transactionReq)) throw new Error("CMS identity authority unavailable")
    const collection = payload.collections.users
    if (!collection) throw new Error("Users collection unavailable")
    const req = await createLocalReq({ req: { ...transactionReq, headers: new Headers(request.headers) }, user }, payload)
    if (!binding) {
      // Unique BA ID is the issuer claim. A loser or interrupted issuing row
      // cannot mint another sid. Incomplete claims require a fresh email session.
      assertLiveBuilderTransaction(payload, transactionReq)
      binding = await payload.create({ collection: "customer-session-bindings", data: { betterAuthSessionId, user: user.id, state: "issuing", payloadSessionId: randomUUID(), ...(handoff && handoffKey ? { handoffKey, paidOrder: handoff.orderId, paidAttempt: handoff.attemptId, previewSessionId: handoff.previewSessionId } : {}) }, overrideAccess: true, req: transactionReq })
      const sid = binding.payloadSessionId
      if (!sid) throw new Error("Missing session claim")
      assertLiveBuilderTransaction(payload, transactionReq)
      await payload.update({ collection: "users", id: user.id, data: { sessions: [...(user.sessions ?? []), { id: sid, createdAt: new Date().toISOString(), expiresAt: authority.expiresAt.toISOString() }] }, overrideAccess: true, req })
      assertLiveBuilderTransaction(payload, transactionReq)
      const activated = await payload.update({ collection: "customer-session-bindings", where: { and: [{ id: { equals: binding.id } }, { state: { equals: "issuing" } }] }, data: { state: "active" }, overrideAccess: true, req: transactionReq })
      const activeBinding = activated.docs[0]
      if (activated.docs.length !== 1 || !activeBinding) throw new Error("Session claim revoked")
      binding = activeBinding
    }
    if (binding.state !== "active" || binding.revokedAt || String(typeof binding.user === "object" ? binding.user.id : binding.user) !== String(user.id) || !binding.payloadSessionId) throw new Error("Session claim unavailable")
    assertLiveBuilderTransaction(payload, transactionReq)
    user = await payload.findByID({ collection: "users", id: user.id, depth: 0, overrideAccess: true, req: transactionReq })
    const sessionUser: SessionUser = { ...user, _sid: binding.payloadSessionId }
    if (!user.sessions?.some((session) => session.id === sessionUser._sid) || !await validateCustomerPayloadSession(payload, sessionUser, transactionReq)) throw new Error("Session was revoked")
    assertLiveBuilderTransaction(payload, transactionReq)
    await payload.update({ collection: "users", id: user.id, data: { sessions: user.sessions.map((session) => session.id === binding.payloadSessionId ? { ...session, expiresAt: authority.expiresAt.toISOString() } : session) }, overrideAccess: true, req })
    const tokenExpiration = Math.floor((authority.expiresAt.getTime() - Date.now()) / 1000)
    if (tokenExpiration <= 0) throw new Error("Expired session")
    const fieldsToSign = getFieldsToSign({ collectionConfig: collection.config, email: user.email, sid: binding.payloadSessionId, user })
    const { token } = await jwtSign({ fieldsToSign, secret: payload.secret, tokenExpiration })
    const cookie = generatePayloadCookie({ collectionAuthConfig: { ...collection.config.auth, tokenExpiration }, cookiePrefix: payload.config.cookiePrefix ?? "payload", token })
    return { cookie, sid: binding.payloadSessionId, userId: user.id, betterAuthSessionId: binding.betterAuthSessionId }
  }))
  const committedUser = await payload.findByID({ collection: "users", id: issued.userId, depth: 0, overrideAccess: true })
  if (!committedUser.sessions?.some((session) => session.id === issued.sid) || !await validateCustomerPayloadSession(payload, { ...committedUser, _sid: issued.sid })) throw new Error("Session commit receipt unavailable")
  return { cookie: issued.cookie, betterAuthSessionId: issued.betterAuthSessionId }
}

export async function issueBoundPayloadSessionCookie(payloadUserId: string | number, request: Request, betterAuthSessionId: string): Promise<string> {
  return (await issueBoundPayloadSession(payloadUserId, request, betterAuthSessionId)).cookie
}

async function createReadOnlyCmsAuth() {
  const { auth } = await import("@/lib/betterAuth")
  return betterAuth({ ...auth.options, session: { ...auth.options.session, deferSessionRefresh: true } })
}
let revocationReader: ReturnType<typeof createReadOnlyCmsAuth> | undefined
export async function revokeCmsRequestSessions(headers: Headers, path: string, body: unknown): Promise<void> {
  const { auth } = await import("@/lib/betterAuth")
  revocationReader ??= createReadOnlyCmsAuth()
  const reader = await revocationReader
  const response = await reader.handler(new Request("https://admin.siteinabox.nl/api/auth/get-session?disableCookieCache=true&disableRefresh=true", { headers }))
  if (!response.ok) throw new Error("CMS revocation authority unavailable")
  const value: unknown = await response.json()
  if (value === null) return
  const current = z.object({ session: baSessionSchema, user: baUserSchema }).parse(value)
  if (current.session.expiresAt.getTime() <= Date.now()) return
  const { adapter } = await auth.$context
  const rows = z.array(z.object({ id: z.string(), userId: z.string(), token: z.string() })).max(1000).parse(await adapter.findMany({ model: "session", where: [{ field: "userId", value: current.user.id }], limit: 1001 }))
  let selected = rows.filter((row) => row.id === current.session.id)
  if (path === "/revoke-sessions") {
    selected = rows
    const payload = await getPayload({ config })
    const user = await payload.findByID({ collection: "users", id: z.coerce.number().int().positive().safe().parse(current.user.payloadUserId), depth: 0, overrideAccess: true })
    if (user.email.trim().toLowerCase() !== current.user.email.trim().toLowerCase()) throw new Error("CMS revocation identity mismatch")
    await revokeCustomerPayloadSessions(payload, user, true)
  }
  if (path === "/revoke-other-sessions") selected = rows.filter((row) => row.id !== current.session.id)
  if (path === "/revoke-session") {
    const target = z.object({ token: z.string().min(1) }).parse(body)
    selected = rows.filter((row) => row.token === target.token)
    if (selected.length !== 1) throw new Error("CMS revocation target not owned")
  }
  for (const row of selected) await revokeBetterAuthBinding(row.id)
}
