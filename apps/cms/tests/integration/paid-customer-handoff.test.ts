import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import { betterAuth } from "better-auth"
import { createAuthEndpoint } from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import { COMMERCIAL_CATALOG_VERSION } from "@siteinabox/contracts/commerce"
import { getTestPayload } from "./_helpers"
import { auth } from "@/lib/betterAuth"
import { previewAuth } from "@/lib/preview/betterAuth"
import { revokeCustomerPayloadSessions } from "@/lib/auth/customerSessionBridge"
import { createPaidHandoffPlugin } from "@/lib/auth/paidHandoff"
import { checkoutProfileFixture, legalDocumentFixture, orderFixture, paymentAttemptFixture } from "../_helpers/generatedDocs"

let payload: Awaited<ReturnType<typeof getTestPayload>>
beforeAll(async () => {
  const uri = new URL(process.env.DATABASE_URI ?? "")
  if (!["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) || uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || process.env.SITE_GENERATION_PROVIDER !== "mock" || process.env.BETTER_AUTH_API_KEY) throw new Error("Paid handoff requires isolated payload_test, jobs disabled, mock Sitegen and no external auth infra")
  payload = await getTestPayload()
}, 60_000)

async function fixture() {
  const suffix = randomUUID(), email = `handoff-${suffix}@example.test`
  const tenant = await payload.create({ collection: "tenants", overrideAccess: true, data: { name: "Paid handoff fixture", slug: `handoff-${suffix}`, domain: `handoff-${suffix}.test`, status: "provisioning" } })
  const intake = await payload.create({ collection: "intake-submissions", overrideAccess: true, data: { status: "submitted", businessName: "Fixture", source: "integration-test", idempotencyKey: suffix, raw: { fixture: true } } })
  const run = await payload.create({ collection: "site-generation-runs", overrideAccess: true, data: { intakeSubmission: intake.id, tenant: tenant.id, status: "preview_ready", idempotencyKey: suffix, normalizedIntake: {}, normalizedIntakeHash: suffix, provider: "mock", model: "fixture", promptVersion: "fixture", generationInputHash: suffix } })
  const { id: profileId, ...profileData } = checkoutProfileFixture({ profileKey: suffix, generationRun: run.id, tenant: tenant.id, customerEmail: email, kvkNumber: "12345678" })
  const profile = await payload.create({ collection: "checkout-profiles", overrideAccess: true, data: profileData })
  const { id: legalId, ...legalData } = legalDocumentFixture({ releaseKey: suffix })
  const legal = await payload.create({ collection: "legal-documents", overrideAccess: true, data: legalData })
  const paymentId = `tr_${suffix.replaceAll("-", "")}`
  const { id: orderId, ...orderData } = orderFixture({ orderNumber: suffix, orderKind: "initial_subscription", catalogVersion: COMMERCIAL_CATALOG_VERSION, quoteEvidence: { domainMode: "new_registration", migrationServiceFeeNetMinor: 0 }, tenant: tenant.id, generationRun: run.id, checkoutProfileKey: profile.profileKey, contractingPartyProfileVersion: profile.profileVersion, acceptedAt: new Date().toISOString(), customerEmail: email, legalDocuments: [legal.id], paymentStatus: "paid", state: "fulfillment_pending", providerPaymentId: paymentId, subtotalNetMinor: 1900, vatAmountMinor: 399, totalGrossMinor: 2299 })
  const order = await payload.create({ collection: "orders", overrideAccess: true, data: orderData })
  const { id: attemptId, ...attemptData } = paymentAttemptFixture({ idempotencyKey: suffix, order: order.id, tenant: tenant.id, state: "paid", purpose: "first_payment", providerPaymentId: paymentId, providerStatus: "paid", paidAt: new Date().toISOString() })
  const attempt = await payload.create({ collection: "payment-attempts", overrideAccess: true, data: attemptData })
  // A fixture-only endpoint uses the real preview adapter and SDK signed-cookie
  // writer. It is never registered by application configuration.
  let previewSessionId = ""
  const fixtureAuth = betterAuth({ ...previewAuth.options, plugins: [...(previewAuth.options.plugins ?? []), { id: "verified-preview-fixture", endpoints: { fixtureSession: createAuthEndpoint("/fixture-session", { method: "POST" }, async (ctx) => {
    const user = await ctx.context.internalAdapter.createUser({ email, name: "Verified fixture", emailVerified: true })
    const session = await ctx.context.internalAdapter.createSession(user.id)
    if (!session) throw new Error("Fixture session absent")
    previewSessionId = session.id
    await setSessionCookie(ctx, { user, session })
    return ctx.json({ ok: true })
  }) } }] })
  const minted = await fixtureAuth.handler(new Request("https://admin.siteinabox.nl/api/preview-auth/fixture-session", { method: "POST", headers: { origin: "https://admin.siteinabox.nl", host: "admin.siteinabox.nl" } }))
  expect(minted.status).toBe(200)
  const cookie = minted.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ")
  const recognized = await previewAuth.api.getSession({ headers: new Headers({ cookie }), query: { disableCookieCache: true } })
  expect(recognized).toMatchObject({ user: { email, emailVerified: true }, session: { id: previewSessionId } })
  const paidAuth = betterAuth({ ...auth.options, plugins: [createPaidHandoffPlugin(() => true), ...(auth.options.plugins ?? []).filter((plugin) => plugin.id !== "siab-paid-handoff")] })
  const invoke = (ids: { orderId: number; paymentAttemptId: number } = { orderId: order.id, paymentAttemptId: attempt.id }, sessionCookie = cookie) => paidAuth.handler(new Request("https://admin.siteinabox.nl/api/auth/paid-handoff", { method: "POST", headers: { "content-type": "application/json", origin: "https://admin.siteinabox.nl", host: "admin.siteinabox.nl", cookie: sessionCookie }, body: JSON.stringify(ids) }))
  return { invoke, order, attempt, tenant, email, previewSessionId }
}

describe("enabled paid handoff on actual records and auth adapters", () => {
  it("creates exactly one owner and replays the same signed BA/Payload device sessions without another email", async () => {
    const { invoke, email, order } = await fixture()
    const first = await invoke()
    expect(first.status, await first.clone().text()).toBe(200)
    const second = await invoke()
    expect(second.status).toBe(200)
    const membership = await payload.find({ collection: "users", where: { email: { equals: email } }, overrideAccess: true, depth: 0 })
    expect(membership.totalDocs).toBe(1)
    expect(membership.docs[0]?.role).toBe("owner")
    const bindings = await payload.find({ collection: "customer-session-bindings", where: { paidOrder: { equals: order.id } }, overrideAccess: true, depth: 0 })
    expect(bindings.totalDocs).toBe(1)
    expect(bindings.docs[0]?.state).toBe("active")
    expect(membership.docs[0]?.sessions).toHaveLength(1)
    for (const response of [first, second]) {
      const cookies = response.headers.getSetCookie()
      expect(cookies.some((cookie) => cookie.includes("better-auth.session_token="))).toBe(true)
      expect(cookies.some((cookie) => cookie.startsWith("payload-token="))).toBe(true)
      expect(cookies.every((cookie) => cookie.includes("HttpOnly") && cookie.includes("Secure"))).toBe(true)
      const jar = cookies.map((cookie) => cookie.split(";")[0]).join("; ")
      expect((await payload.auth({ headers: new Headers({ cookie: jar }) })).user?.id).toBe(membership.docs[0]?.id)
    }
    const storedOrder = await payload.findByID({ collection: "orders", id: order.id, overrideAccess: true })
    expect(storedOrder.servicePeriodStartsAt).toBeFalsy()
  })
  it("denies missing preview proof and cross-order payment attempt", async () => {
    const first = await fixture(), second = await fixture()
    expect((await first.invoke(undefined, "")).status).toBe(401)
    expect((await first.invoke({ orderId: first.order.id, paymentAttemptId: second.attempt.id })).status).toBe(403)
    expect((await first.invoke({ orderId: second.order.id, paymentAttemptId: second.attempt.id })).status).toBe(403)
  })
  it("an unpaid authoritative order cannot grant membership", async () => {
    const { invoke, order, attempt, email } = await fixture()
    await payload.db.updateOne({ collection: "orders", id: order.id, data: { paymentStatus: "pending" }, returning: false })
    const response = await invoke({ orderId: order.id, paymentAttemptId: attempt.id })
    expect(response.status).toBe(403)
    expect((await payload.find({ collection: "users", where: { email: { equals: email } }, overrideAccess: true })).totalDocs).toBe(0)
  })
  it("concurrent paid handoff creates at most one BA session and one Payload sid", async () => {
    const { invoke, email, order } = await fixture()
    const responses = await Promise.all(Array.from({ length: 4 }, () => invoke()))
    expect(responses.some((response) => response.status === 200)).toBe(true)
    expect(responses.every((response) => response.status === 200 || response.status === 403 || response.status === 409)).toBe(true)
    for (const response of responses) if (response.status !== 200) expect(response.headers.getSetCookie()).toHaveLength(0)
    const bindings = await payload.find({ collection: "customer-session-bindings", where: { paidOrder: { equals: order.id } }, overrideAccess: true })
    expect(bindings.totalDocs).toBe(1)
    const users = await payload.find({ collection: "users", where: { email: { equals: email } }, overrideAccess: true })
    expect(users.totalDocs).toBe(1)
    expect(users.docs[0]?.sessions).toHaveLength(1)
    const ctx = await auth.$context
    const baUser = await ctx.internalAdapter.findUserByEmail(email)
    if (!baUser) throw new Error("Missing handoff BA user")
    expect(await ctx.adapter.count({ model: "session", where: [{ field: "userId", value: baUser.user.id }] })).toBe(1)
  })
  it("an old verified preview cannot hand off after global customer revocation", async () => {
    const { invoke, email, tenant } = await fixture()
    const user = await payload.create({ collection: "users", overrideAccess: true, data: { email, password: "unusable-fixture-password", role: "owner", tenants: [{ tenant: tenant.id }] } })
    await revokeCustomerPayloadSessions(payload, user, true)
    const response = await invoke()
    expect(response.status).toBe(403)
    expect((await payload.find({ collection: "customer-session-bindings", where: { user: { equals: user.id } }, overrideAccess: true })).totalDocs).toBe(0)
  })
  it("an interrupted durable claim cannot create a replacement BA session", async () => {
    const { invoke, order, attempt, email, tenant, previewSessionId } = await fixture()
    const user = await payload.create({ collection: "users", overrideAccess: true, data: { email, password: "unusable-fixture-password", role: "owner", tenants: [{ tenant: tenant.id }] } })
    const { createHash } = await import("node:crypto")
    const handoffKey = createHash("sha256").update(JSON.stringify([order.id, previewSessionId])).digest("hex")
    await payload.create({ collection: "customer-session-bindings", overrideAccess: true, data: { handoffKey, betterAuthSessionId: "pending:interrupted", payloadSessionId: randomUUID(), user: user.id, paidOrder: order.id, paidAttempt: attempt.id, previewSessionId, state: "issuing" } })
    const response = await invoke()
    expect(response.status, await response.clone().text()).toBe(403)
    const bindings = await payload.find({ collection: "customer-session-bindings", where: { handoffKey: { equals: handoffKey } }, overrideAccess: true })
    expect(bindings.totalDocs).toBe(1)
    expect(bindings.docs[0]?.betterAuthSessionId).toBe("pending:interrupted")
  })
})
