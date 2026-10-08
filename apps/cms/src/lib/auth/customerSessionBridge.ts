import "server-only"
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

export async function revokeCustomerPayloadSessions(payload: Payload, user: SessionUser, allSessions: boolean, req?: Partial<PayloadRequest>): Promise<void> {
  if (!req) {
    const service = new BuilderQuotaService(payload)
    await service.initialize()
    await service.retry(() => service.transaction(async (transactionReq) => {
      await service.lockGlobal(transactionReq)
      await revokeCustomerPayloadSessions(payload, user, allSessions, transactionReq)
    }))
    return
  }
  assertLiveBuilderTransaction(payload, req)
  if (allSessions) {
    // Separate durable fence cannot be overwritten by SDK full-user session
    // writes. Advance conditionally so concurrent revocations cannot regress it.
    const account = await accountAuthority(payload, user, req, true)
    const now = new Date().toISOString()
    assertLiveBuilderTransaction(payload, req)
    await payload.update({ collection: "customer-auth-accounts", where: { and: [{ id: { equals: account.id } }, { authEpoch: { less_than: now } }] }, data: { authEpoch: now }, overrideAccess: true, req })
    assertLiveBuilderTransaction(payload, req)
    const receipt = await payload.findByID({ collection: "customer-auth-accounts", id: account.id, depth: 0, overrideAccess: true, req })
    if (!(new Date(receipt.authEpoch).getTime() >= new Date(now).getTime())) throw new Error("Account revocation receipt unavailable")
  }
  if (!allSessions && !user._sid) throw new Error("Missing device session")
  if (req) assertLiveBuilderTransaction(payload, req)
  const result = await payload.update({ collection: "customer-session-bindings", where: { and: [{ user: { equals: user.id } }, ...(allSessions ? [] : [{ payloadSessionId: { equals: user._sid } }])] }, data: { state: "revoked", revokedAt: new Date().toISOString() }, overrideAccess: true, ...(req ? { req } : {}) })
  if (result.errors.length) throw new Error("Device revocation failed")
  if (req) assertLiveBuilderTransaction(payload, req)
  const remaining = await payload.find({ collection: "customer-session-bindings", where: { and: [{ user: { equals: user.id } }, { state: { not_equals: "revoked" } }, ...(allSessions ? [] : [{ payloadSessionId: { equals: user._sid } }])] }, limit: 1, depth: 0, overrideAccess: true, req })
  if (remaining.totalDocs !== 0) throw new Error("Device revocation receipt unavailable")
}

export async function revokeBetterAuthBinding(betterAuthSessionId: string): Promise<void> {
  const payload = await getPayload({ config })
  const service = new BuilderQuotaService(payload)
  await service.initialize()
  await service.retry(() => service.transaction(async (req) => {
    await service.lockGlobal(req)
    assertLiveBuilderTransaction(payload, req)
    const result = await payload.update({ collection: "customer-session-bindings", where: { betterAuthSessionId: { equals: betterAuthSessionId } }, data: { state: "revoked", revokedAt: new Date().toISOString() }, overrideAccess: true, req })
    if (result.errors.length) throw new Error("Better Auth device revocation failed")
    assertLiveBuilderTransaction(payload, req)
    const remaining = await payload.find({ collection: "customer-session-bindings", where: { and: [{ betterAuthSessionId: { equals: betterAuthSessionId } }, { state: { not_equals: "revoked" } }] }, limit: 1, depth: 0, overrideAccess: true, req })
    if (remaining.totalDocs !== 0) throw new Error("Better Auth device revocation receipt unavailable")
  }))
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
      const preview = await readVerifiedPreviewSession(request.headers)
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
