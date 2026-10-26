import { requireLiveMailWritesAllowed } from "../../src/lib/microsoftMailProvisioning/writeGate.ts"
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mailPrice, assertPaidMailOrder } from "../../src/lib/microsoftMailProvisioning/quote.ts"
import { hasWorkspaceService, platformFeesExempt } from "../../src/lib/tenants/services.ts"
import { inspectExistingMailRouting } from "../../src/lib/microsoftMailProvisioning/infoRouting.ts"

describe("email financial and service authority", () => {
  it("waives only platform fees and retains license charges and tax", () => {
    const price = mailPrice({ quantity: 2, unitNetMinor: 5604, providerUnitCostMinor: 4932, platformNetMinor: 1000,
      policy: { mode: "exempt", reason: "Externally managed platform account" } })
    assert.equal(price.platformNetMinor, 0)
    assert.equal(price.platformDiscountNetMinor, 1000)
    assert.equal(price.subtotalNetMinor, 11208)
    assert.equal(price.totalGrossMinor, 13562)
    assert.throws(() => mailPrice({ quantity: 2, unitNetMinor: 4000, providerUnitCostMinor: 4932, platformNetMinor: 0 }), /invalid/)
  })
  it("expires waivers and preserves legacy website capabilities without enabling email implicitly", () => {
    assert.equal(platformFeesExempt({ mode: "exempt", reason: "Ended", expiresAt: "2020-01-01" }), false)
    assert.equal(hasWorkspaceService({}, "website"), true)
    assert.equal(hasWorkspaceService({}, "email"), false)
    assert.equal(hasWorkspaceService({ enabledServices: ["email"] }, "website"), false)
  })
  it("rejects unpaid, cross-tenant, wrong-order and wrong-amount attempts", () => {
    const valid = { orderId: 8, tenantId: 3, orderTenantId: "3", orderStatus: "fulfillment_pending", paymentStatus: "paid",
      paymentOrderId: "8", paymentTenantId: "3", attemptState: "paid", purpose: "first_payment", grossMinor: 13562,
      paidGrossMinor: 13562, currency: "EUR", paidCurrency: "EUR" }
    assert.doesNotThrow(() => assertPaidMailOrder(valid))
    for (const invalid of [{ paymentStatus: "pending" }, { paymentTenantId: "4" }, { paymentOrderId: "9" }, { paidGrossMinor: 1 }, { paidCurrency: "USD" }, { attemptState: "authorized" }]) {
      assert.throws(() => assertPaidMailOrder({ ...valid, ...invalid }), /matching settled/)
    }
  })
  it("preserves the existing info destination and detects other routes before MX changes", () => {
    const rule = { enabled: true, matchers: [{ type: "literal" as const, field: "to", value: "info@mail-fixture.test" }], actions: [{ type: "forward" as const, value: ["contact@external.test"] }] }
    const before = inspectExistingMailRouting("mail-fixture.test", ["one@mail-fixture.test"], [rule])
    assert.equal(before.legacyInfoForwardTo, "contact@external.test")
    const after = inspectExistingMailRouting("mail-fixture.test", ["one@mail-fixture.test"], [{ ...rule, actions: [{ type: "forward", value: ["other@external.test"] }] }])
    assert.notEqual(before.routingHash, after.routingHash)
    assert.throws(() => inspectExistingMailRouting("mail-fixture.test", [], [{ ...rule, matchers: [{ type: "literal", value: "sales@mail-fixture.test" }] }]), /review/)
  })
})

import { proratedMailUnit } from "../../src/lib/microsoftMailProvisioning/quote.ts"
import { mailRenewalDecision } from "../../src/lib/microsoftMailProvisioning/renewalPolicy.ts"

describe("email commitment pricing and renewal cutoff", () => {
  it("prorates additional seats only within a verified current commitment", () => {
    assert.equal(proratedMailUnit(10000,"2026-01-01T00:00:00Z","2026-01-11T00:00:00Z",new Date("2026-01-06T00:00:00Z")),5000)
    assert.throws(() => proratedMailUnit(10000,"2026-01-01","2026-01-11",new Date("2026-01-12")),/verified/)
  })
  it("prepares renewal early, protects paid coverage, and never repeats an uncertain cancellation", () => {
    const period={termStartsAt:"2026-01-01",termEndsAt:"2027-01-01",paidNextPeriod:false}
    assert.equal(mailRenewalDecision({...period,now:new Date("2026-11-20")}),"prepare_renewal")
    assert.equal(mailRenewalDecision({...period,now:new Date("2026-12-20")}),"schedule_term_end")
    assert.equal(mailRenewalDecision({...period,now:new Date("2026-12-20"),paidNextPeriod:true}),"covered")
    assert.equal(mailRenewalDecision({...period,now:new Date("2026-12-20"),paidNextPeriod:true,cancellationState:"uncertain"}),"reconcile_cancellation")
    assert.equal(mailRenewalDecision({...period,termStartsAt:"2026-12-19",now:new Date("2026-12-20")}),"review")
  })
  it("cannot use a Mollie test payment to unlock real licenses", () => {
    assert.throws(() => assertPaidMailOrder({ orderId: 1, tenantId: 2, orderTenantId: "2", orderStatus: "fulfillment_pending", paymentStatus: "paid", paymentOrderId: "1", paymentTenantId: "2",
      attemptState: "paid", purpose: "first_payment", grossMinor: 100, paidGrossMinor: 100, currency: "EUR", paidCurrency: "EUR", provider:"mollie",providerMode:"test" }),/matching settled/)
  })
})

it("honors disabled and shadow global stops even when the mail feature is enabled", () => {
  const env = { NODE_ENV: "production", COMMERCE_RELEASE_STAGE: "production", COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED: "1", COMMERCE_RELEASE_EVIDENCE_VERSION: "commerce-production-readiness-2026-07-30.1", COMMERCE_ORIGIN_ISOLATION_VERIFIED: "1", MICROSOFT_MAIL_LIVE_PROVISIONING_ENABLED: "true" } as NodeJS.ProcessEnv
  assert.doesNotThrow(() => requireLiveMailWritesAllowed(env))
  for (const stage of ["disabled","shadow","sandbox",""]) assert.throws(() => requireLiveMailWritesAllowed({ ...env, COMMERCE_RELEASE_STAGE: stage }))
  assert.throws(() => requireLiveMailWritesAllowed({ ...env, COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED: "0" }))
})
