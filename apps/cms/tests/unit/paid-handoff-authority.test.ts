import { describe, expect, it, vi } from "vitest"
import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { checkoutProfileFixture, orderFixture, paymentAttemptFixture, tenantFixture } from "../_helpers/generatedDocs"
vi.mock("@/payload.config", () => ({ default: {} }))
import { assertPaidHandoffFacts, paidHandoffPlugin } from "@/lib/auth/paidHandoff"
function facts() {
  return {
    order: orderFixture({ orderKind: "initial_subscription", acceptedAt: "2026-10-01T00:00:00.000Z", paymentStatus: "paid", state: "fulfillment_pending", tenant: 1, generationRun: 1, checkoutProfileKey: "fixture-profile", contractingPartyProfileVersion: 1, providerPaymentId: "tr_fixture", totalGrossMinor: 2299, subtotalNetMinor: 1900, vatAmountMinor: 399 }),
    attempt: paymentAttemptFixture({ state: "paid", purpose: "first_payment", paidAt: "2026-10-01T00:00:00.000Z", providerPaymentId: "tr_fixture", providerStatus: "paid", tenant: 1 }),
    profile: checkoutProfileFixture({ tenant: 1 }), tenant: tenantFixture(), verifiedEmail: "fixture@example.com",
  }
}
describe("paid membership handoff source authority", () => {
  it("accepts exact frozen paid order/attempt/profile/tenant/verified email", () => expect(() => assertPaidHandoffFacts(facts())).not.toThrow())
  it.each(["unpaid", "wrong-attempt", "wrong-tenant", "wrong-provider-id", "wrong-provider-state", "wrong-currency", "wrong-gross", "wrong-profile", "wrong-email", "archived", "indeterminate", "renewal"])("denies %s authority", (scenario) => {
    const input = facts()
    if (scenario === "unpaid") input.order.paymentStatus = "pending"
    if (scenario === "wrong-attempt") input.attempt.order = 999
    if (scenario === "wrong-tenant") input.attempt.tenant = 999
    if (scenario === "wrong-provider-id") input.attempt.providerPaymentId = "tr_other"
    if (scenario === "wrong-provider-state") input.attempt.providerStatus = "authorized"
    if (scenario === "wrong-currency") input.attempt.currency = "USD"
    if (scenario === "wrong-gross") input.attempt.grossAmountMinor = 1
    if (scenario === "wrong-profile") input.order.checkoutProfileKey = "different"
    if (scenario === "wrong-email") input.verifiedEmail = "attacker@example.com"
    if (scenario === "archived") input.tenant.status = "archived"
    if (scenario === "indeterminate") input.attempt.reconciliationRequired = true
    if (scenario === "renewal") input.order.orderKind = "subscription_renewal"
    expect(() => assertPaidHandoffFacts(input)).toThrow()
  })
  it("disabled real SDK handoff endpoint denies forged paid body before stores or session issuance", async () => {
    const auth = betterAuth({ baseURL: "http://localhost:3000", secret: "paid-handoff-test-secret-at-least-32", database: memoryAdapter({}), plugins: [paidHandoffPlugin()], telemetry: { enabled: false } })
    const response = await auth.handler(new Request("http://localhost:3000/api/auth/paid-handoff", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify({ orderId: 1, paymentAttemptId: 1, paid: true, tenantId: 999, email: "attacker@example.com" }) }))
    expect(response.status).toBe(403)
  })
})
