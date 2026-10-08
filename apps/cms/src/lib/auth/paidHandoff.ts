import "server-only"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { z } from "zod"
import { APIError, createAuthEndpoint } from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import type { BetterAuthPlugin } from "better-auth"
import { getPayload, type Payload, type PayloadRequest } from "payload"
import config from "@/payload.config"
import type { CheckoutProfile, Order, PaymentAttempt, Tenant } from "@/payload-types"
import { BuilderQuotaError, BuilderQuotaService } from "@/lib/builder/quota"
import { assertPreviewHandoffEpoch, issueBoundPayloadSession } from "@/lib/auth/customerSessionBridge"
import { assertLiveBuilderTransaction } from "@/lib/builder/quotaTransaction"

// PR05 must wire authoritative payment and the integrated release gates before
// changing this constant. There is no environment/browser paid override.
const PAID_HANDOFF_RELEASE_ENABLED = false
const relationId = (value: number | { id: number } | null | undefined) => typeof value === "object" && value !== null ? value.id : value
const email = (value: string) => value.trim().toLowerCase()

export function assertPaidHandoffFacts(input: { order: Order; attempt: PaymentAttempt; profile: CheckoutProfile; tenant: Tenant; verifiedEmail: string }): void {
  const { order, attempt, profile, tenant, verifiedEmail } = input
  if (order.orderKind !== "initial_subscription" || !order.acceptedAt || order.paymentStatus !== "paid"
    || !["fulfillment_pending", "fulfilled"].includes(order.state ?? "")
    || attempt.providerStatus !== "paid" || relationId(attempt.tenant) !== tenant.id
    || attempt.state !== "paid" || attempt.purpose !== "first_payment" || !attempt.paidAt || attempt.reconciliationRequired
    || relationId(attempt.order) !== order.id || relationId(order.tenant) !== tenant.id || relationId(profile.tenant) !== tenant.id
    || order.checkoutProfileKey !== profile.profileKey || order.contractingPartyProfileVersion !== profile.profileVersion
    || relationId(order.generationRun) !== relationId(profile.generationRun)
    || !attempt.providerPaymentId || attempt.provider !== order.paymentProvider || attempt.providerPaymentId !== order.providerPaymentId
    || attempt.currency !== "EUR" || order.currency !== attempt.currency || !Number.isSafeInteger(order.totalGrossMinor)
    || order.totalGrossMinor !== attempt.grossAmountMinor || order.subtotalNetMinor !== attempt.netAmountMinor || order.vatAmountMinor !== attempt.vatAmountMinor
    || email(order.customerEmail) !== email(profile.customerEmail) || email(order.customerEmail) !== email(verifiedEmail)
    || tenant.status === "archived" || tenant.status === "suspended") {
    throw new APIError("FORBIDDEN", { message: "Verified paid customer authority is unavailable." })
  }
}

export async function loadPaidHandoffFacts(payload: Payload, req: Partial<PayloadRequest>, orderId: number, attemptId: number, verifiedEmail: string) {
  assertLiveBuilderTransaction(payload, req)
  const order = await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true, req })
  assertLiveBuilderTransaction(payload, req)
  const attempt = await payload.findByID({ collection: "payment-attempts", id: attemptId, depth: 0, overrideAccess: true, req })
  assertLiveBuilderTransaction(payload, req)
  const profiles = await payload.find({ collection: "checkout-profiles", where: { profileKey: { equals: order.checkoutProfileKey } }, limit: 2, depth: 0, overrideAccess: true, req })
  const tenantId = relationId(order.tenant)
  if (!tenantId || profiles.totalDocs !== 1 || !profiles.docs[0]) throw new APIError("FORBIDDEN")
  assertLiveBuilderTransaction(payload, req)
  const tenant = await payload.findByID({ collection: "tenants", id: tenantId, depth: 0, overrideAccess: true, req })
  assertPaidHandoffFacts({ order, attempt, profile: profiles.docs[0], tenant, verifiedEmail })
  return { order, attempt, profile: profiles.docs[0], tenant }
}

async function handoffTransaction<T>(service: BuilderQuotaService, mutation: (req: Partial<PayloadRequest>) => Promise<T>): Promise<T> {
  try {
    return await service.retry(() => service.transaction(mutation))
  } catch (error) {
    if (error instanceof BuilderQuotaError && error.code === "builder_quota_contention") throw new APIError("CONFLICT", { message: "Handoff is busy; retry the same verified request." })
    throw error
  }
}

export function createPaidHandoffPlugin(releaseGate: () => boolean): BetterAuthPlugin {
  return {
    id: "siab-paid-handoff",
    endpoints: {
      paidHandoff: createAuthEndpoint("/paid-handoff", { method: "POST", body: z.object({ orderId: z.number().int().positive(), paymentAttemptId: z.number().int().positive() }) }, async (ctx) => {
        if (!releaseGate()) throw new APIError("FORBIDDEN", { message: "Paid handoff is awaiting release validation." })
        if (!ctx.headers || !ctx.request) throw new APIError("UNAUTHORIZED", { message: "Handoff HTTP context unavailable" })
        const requestHeaders = ctx.headers
        const { readVerifiedPreviewSession } = await import("./verifiedPreviewSession")
        const preview = await readVerifiedPreviewSession(requestHeaders)
        if (!preview || preview.user.emailVerified !== true) throw new APIError("UNAUTHORIZED", { message: "Verified preview identity unavailable" })
        const payload = await getPayload({ config })
        const service = new BuilderQuotaService(payload)
        await service.initialize()
        const membership = await handoffTransaction(service, async (req) => {
          await service.lockGlobal(req)
          const { tenant, profile } = await loadPaidHandoffFacts(payload, req, ctx.body.orderId, ctx.body.paymentAttemptId, preview.user.email)
          assertLiveBuilderTransaction(payload, req)
          const users = await payload.find({ collection: "users", where: { email: { equals: email(preview.user.email) } }, limit: 2, depth: 0, overrideAccess: true, req })
          if (users.totalDocs > 1) throw new APIError("FORBIDDEN")
          const user = users.docs[0]
          if (user) {
            if (user.role !== "owner" || user.tenants?.length !== 1 || relationId(user.tenants[0]?.tenant) !== tenant.id) throw new APIError("FORBIDDEN")
            await assertPreviewHandoffEpoch(payload, user, preview.session.createdAt, req)
            return user
          }
          assertLiveBuilderTransaction(payload, req)
          return payload.create({ collection: "users", data: { email: email(preview.user.email), name: profile.customerName, role: "owner", tenants: [{ tenant: tenant.id }], password: randomBytes(48).toString("hex") }, overrideAccess: true, req })
        })
        // Better Auth's public endpoint context owns session creation and signed
        // cookie handling. No fabricated token or activation grant is accepted.
        const existing = await ctx.context.internalAdapter.findUserByEmail(membership.email)
        const user = existing?.user ?? await ctx.context.internalAdapter.createUser({ email: membership.email, name: membership.name ?? membership.email, emailVerified: true, payloadUserId: String(membership.id) })
        if (!user || !user.emailVerified || !("payloadUserId" in user) || user.payloadUserId !== String(membership.id)) throw new APIError("FORBIDDEN")
        const handoffKey = createHash("sha256").update(JSON.stringify([ctx.body.orderId, preview.session.id])).digest("hex")
        const claim = await handoffTransaction(service, async (req) => {
          await service.lockGlobal(req)
          await assertPreviewHandoffEpoch(payload, membership, preview.session.createdAt, req)
          await loadPaidHandoffFacts(payload, req, ctx.body.orderId, ctx.body.paymentAttemptId, preview.user.email)
          assertLiveBuilderTransaction(payload, req)
          const existing = await payload.find({ collection: "customer-session-bindings", where: { handoffKey: { equals: handoffKey } }, limit: 2, depth: 0, overrideAccess: true, req })
          if (existing.totalDocs > 1) throw new APIError("FORBIDDEN")
          const prior = existing.docs[0]
          if (prior) {
            if (prior.state !== "active" || prior.revokedAt || relationId(prior.user) !== membership.id || relationId(prior.paidAttempt) !== ctx.body.paymentAttemptId) throw new APIError("FORBIDDEN", { message: "Interrupted handoff requires verified recovery." })
            return { binding: prior, owned: false }
          }
          assertLiveBuilderTransaction(payload, req)
          const binding = await payload.create({ collection: "customer-session-bindings", data: { betterAuthSessionId: `pending:${randomUUID()}`, payloadSessionId: randomUUID(), handoffKey, user: membership.id, paidOrder: ctx.body.orderId, paidAttempt: ctx.body.paymentAttemptId, previewSessionId: preview.session.id, state: "issuing" }, overrideAccess: true, req })
          return { binding, owned: true }
        })
        const durableClaim = await payload.findByID({ collection: "customer-session-bindings", id: claim.binding.id, depth: 0, overrideAccess: true })
        if (durableClaim.handoffKey !== handoffKey || durableClaim.betterAuthSessionId !== claim.binding.betterAuthSessionId || durableClaim.state !== claim.binding.state) throw new APIError("FORBIDDEN")
        let session
        if (claim.owned) {
          session = await ctx.context.internalAdapter.createSession(user.id)
          if (!session) throw new APIError("FORBIDDEN")
          const newSession = session
          await handoffTransaction(service, async (req) => {
            await service.lockGlobal(req)
            await loadPaidHandoffFacts(payload, req, ctx.body.orderId, ctx.body.paymentAttemptId, preview.user.email)
            const currentPreview = await readVerifiedPreviewSession(requestHeaders, req)
            if (currentPreview?.session.id !== preview.session.id || currentPreview.user.emailVerified !== true) throw new APIError("FORBIDDEN")
            assertLiveBuilderTransaction(payload, req)
            const current = await payload.findByID({ collection: "customer-session-bindings", id: claim.binding.id, depth: 0, overrideAccess: true, req })
            if (current.state !== "issuing" || current.revokedAt || current.betterAuthSessionId !== claim.binding.betterAuthSessionId || !current.payloadSessionId) throw new APIError("FORBIDDEN")
            assertLiveBuilderTransaction(payload, req)
            const currentUser = await payload.findByID({ collection: "users", id: membership.id, depth: 0, overrideAccess: true, req })
            await assertPreviewHandoffEpoch(payload, currentUser, preview.session.createdAt, req)
            if (currentUser.role !== "owner" || currentUser.tenants?.length !== 1 || relationId(currentUser.tenants[0]?.tenant) !== relationId(membership.tenants?.[0]?.tenant)) throw new APIError("FORBIDDEN")
            assertLiveBuilderTransaction(payload, req)
            await payload.update({ collection: "users", id: membership.id, data: { sessions: [...(currentUser.sessions ?? []), { id: current.payloadSessionId, createdAt: newSession.createdAt.toISOString(), expiresAt: newSession.expiresAt.toISOString() }] }, overrideAccess: true, req })
            assertLiveBuilderTransaction(payload, req)
            await payload.update({ collection: "customer-session-bindings", id: current.id, data: { betterAuthSessionId: newSession.id, state: "active" }, overrideAccess: true, req })
          })
        } else {
          const raw = await ctx.context.adapter.findOne({ model: "session", where: [{ field: "id", value: claim.binding.betterAuthSessionId }] })
          const parsed = z.object({ id: z.string(), token: z.string(), userId: z.string(), createdAt: z.coerce.date(), updatedAt: z.coerce.date(), expiresAt: z.coerce.date(), ipAddress: z.string().nullish(), userAgent: z.string().nullish() }).safeParse(raw)
          if (!parsed.success || parsed.data.userId !== user.id || parsed.data.expiresAt.getTime() <= Date.now()) throw new APIError("FORBIDDEN")
          session = parsed.data
        }
        const issued = await issueBoundPayloadSession(membership.id, ctx.request, session.id, { orderId: ctx.body.orderId, attemptId: ctx.body.paymentAttemptId, previewSessionId: preview.session.id })
        if (issued.betterAuthSessionId !== session.id) throw new APIError("FORBIDDEN")
        const payloadCookie = issued.cookie
        await setSessionCookie(ctx, { session, user })
        if (!ctx.responseHeaders) throw new APIError("INTERNAL_SERVER_ERROR")
        ctx.responseHeaders.append("set-cookie", payloadCookie)
        return ctx.json({ ok: true })
      }),
    },
  }
}

export function paidHandoffPlugin(): BetterAuthPlugin {
  return createPaidHandoffPlugin(() => PAID_HANDOFF_RELEASE_ENABLED)
}
