import { targetAttemptState } from "@/lib/payments/paymentDecisions"
import { paymentAttemptFixture } from "../_helpers/generatedDocs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createMollieCustomer, inspectMollieProfileCapabilities, listRecentMollieCustomers, listRecentMolliePayments, retrieveMolliePayment } from "@/lib/payments/mollieAdapter"

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })

describe("Mollie responses at the real adapter boundary", () => {
  it("does not grant paid authority with an unknown refund state", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "tr_requested", status: "paid", amount: { currency: "EUR", value: "19.00" }, _embedded: { refunds: [{ id: "re_fixture", status: "future_state", amount: { currency: "EUR", value: "19.00" } }] } })))
    await expect(retrieveMolliePayment("tr_requested")).rejects.toThrow("invalid provider response")
  })

  it("preserves explicit unknown payment status and tolerates irrelevant fields", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "tr_requested", status: "future_state", amount: { currency: "EUR", value: "19.00" }, extra: { providerExtension: true } })))
    expect(await retrieveMolliePayment("tr_requested")).toMatchObject({ id: "tr_requested", status: "unknown" })
  })

  it("rejects missing adjustment evidence when the provider reports refunded money", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "tr_requested", status: "paid", amount: { currency: "EUR", value: "19.00" }, amountRefunded: { currency: "EUR", value: "19.00" } })))
    await expect(retrieveMolliePayment("tr_requested")).rejects.toThrow("invalid provider response")
  })
  it("rejects a malformed successful customer response before binding provider identity", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: 42 })))
    await expect(createMollieCustomer({ name: "Fixture", email: "fixture@example.invalid", idempotencyKey: "fixture:customer" })).rejects.toThrow()
  })

  it("rejects a different payment identity instead of reconciling it with the requested attempt", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "tr_other", status: "paid", amount: { currency: "EUR", value: "19.00" } })))
    await expect(retrieveMolliePayment("tr_requested")).rejects.toThrow()
  })
})


const money = { currency: "EUR", value: "19.00" }
const paid = { id: "tr_requested", status: "paid", amount: money }

describe("Mollie consumed adjustment evidence", () => {
  it.each([
    { amountChargedBack: money },
    { amountChargedBack: money, _embedded: { chargebacks: [] } },
    { amountChargedBack: money, _embedded: { chargebacks: [{ id: "chb_fixture", amount: { ...money, value: "1.00" } }] } },
    { amountRefunded: money, _embedded: { refunds: [] } },
    { amountRefunded: money, _embedded: { refunds: [{ id: "re_fixture", status: "failed", amount: money }] } },
    { amountRefunded: money, _embedded: { refunds: [{ id: "re_fixture", status: "refunded", amount: { ...money, value: "1.00" } }] } },
  ])("does not grant paid authority without corresponding adjustment evidence %j", async adjustment => {
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...paid, ...adjustment })))
    await expect(retrieveMolliePayment("tr_requested")).rejects.toThrow("invalid provider response")
  })
})

describe("Mollie capability method identities", () => {
  it.each([{}, { id: 42 }, { id: "" }, { id: "not a method" }, { id: "future_method" }])("rejects a non-authoritative capability entry %j", async method => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(Response.json({ id: "pfl_fixture" })).mockResolvedValue(Response.json({ _embedded: { methods: [method] } }))
    await expect(inspectMollieProfileCapabilities({ env: { NODE_ENV: "test", MOLLIE_API_KEY: "test_fixture" }, fetchImpl })).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})

describe("Mollie aggregate read budget", () => {
  it.each(["customers", "payments", "capabilities"])("bounds aggregate %s reads to thirty seconds", async kind => {
    vi.useFakeTimers()
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    let page = 0
    const fetchImpl = vi.fn(() => new Promise<Response>(resolve => setTimeout(() => {
      page += 1
      if (kind === "capabilities") resolve(Response.json(page === 1 ? { id: "pfl_fixture" } : { _embedded: { methods: [{ id: "ideal" }] } }))
      else resolve(Response.json({ _embedded: { [kind]: [] }, ...(page < 3 ? { _links: { next: { href: `https://api.mollie.com/v2/${kind}?from=fixture${page}` } } } : {}) }))
    }, 11000)))
    vi.stubGlobal("fetch", fetchImpl)
    let outcome: unknown
    const pending = kind === "capabilities" ? inspectMollieProfileCapabilities({ fetchImpl }) : kind === "customers" ? listRecentMollieCustomers() : listRecentMolliePayments()
    void pending.then(value => { outcome = value }, error => { outcome = error })
    try {
      await vi.advanceTimersByTimeAsync(30001)
      expect(outcome).toMatchObject({ reason: "timeout" })
      expect(fetchImpl).toHaveBeenCalledTimes(3)
    } finally { await vi.advanceTimersByTimeAsync(50000) }
  })
  it.each(["customers", "payments"])("honors caller cancellation during %s response consumption", async kind => {
    vi.useFakeTimers()
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    const controller = new AbortController()
    const cancel = vi.fn()
    const fetchImpl = vi.fn(async () => new Response(new ReadableStream({ cancel })))
    vi.stubGlobal("fetch", fetchImpl)
    let outcome: unknown
    const pending = kind === "customers" ? listRecentMollieCustomers(250, { signal: controller.signal }) : listRecentMolliePayments(250, { signal: controller.signal })
    void pending.catch(error => { outcome = error })
    await vi.advanceTimersByTimeAsync(1)
    controller.abort()
    await vi.advanceTimersByTimeAsync(1)
    try { expect(outcome).toMatchObject({ reason: "cancelled" }); expect(cancel).toHaveBeenCalledOnce() }
    finally { await vi.advanceTimersByTimeAsync(30001) }
  })
})

describe("Mollie bounded read and financial compatibility", () => {
  it("accepts valid completed refunds and chargebacks while tolerating extra provider fields", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    const body = { ...paid, amountRefunded: { ...money, value: "5.00" }, amountChargedBack: { ...money, value: "3.00" }, _embedded: { refunds: [{ id: "re_fixture", status: "refunded", amount: { ...money, value: "5.00" }, irrelevant: true }], chargebacks: [{ id: "chb_fixture", amount: { ...money, value: "3.00" }, irrelevant: true }] }, irrelevant: { extension: true } }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)))
    expect(await retrieveMolliePayment("tr_requested")).toMatchObject({ status: "paid", amountChargedBack: body.amountChargedBack, _embedded: { refunds: [{ status: "refunded" }], chargebacks: [{ id: "chb_fixture" }] } })
  })
  it("rejects duplicate adjustment identity even if duplicate amounts equal the reported total", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...paid, amountRefunded: { ...money, value: "2.00" }, _embedded: { refunds: [{ id: "re_fixture", status: "refunded", amount: { ...money, value: "1.00" } }, { id: "re_fixture", status: "refunded", amount: { ...money, value: "1.00" } }] } })))
    await expect(retrieveMolliePayment("tr_requested")).rejects.toThrow("invalid provider response")
  })
  it("uses the remaining aggregate deadline while cancelling a stalled third response body", async () => {
    vi.useFakeTimers()
    const cancel = vi.fn()
    let page = 0
    const fetchImpl = vi.fn(() => {
      if (++page === 3) return Promise.resolve(new Response(new ReadableStream({ cancel })))
      return new Promise<Response>(resolve => setTimeout(() => resolve(Response.json({ _embedded: { customers: [] }, _links: { next: { href: `https://api.mollie.com/v2/customers?from=cst_fixture${page}` } } })), 11000))
    })
    const pending = listRecentMollieCustomers(250, { env: { NODE_ENV: "test", MOLLIE_API_KEY: "test_fixture" }, fetchImpl }).catch(error => error)
    await vi.advanceTimersByTimeAsync(30001)
    expect(await pending).toMatchObject({ reason: "timeout" })
    expect(fetchImpl).toHaveBeenCalledTimes(3); expect(cancel).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it("cancels capability response consumption and ignores the caller's private abort reason", async () => {
    const controller = new AbortController()
    const cancel = vi.fn()
    const fetchImpl = vi.fn(async () => new Response(new ReadableStream({ cancel })))
    const pending = inspectMollieProfileCapabilities({ env: { NODE_ENV: "test", MOLLIE_API_KEY: "test_fixture" }, fetchImpl, signal: controller.signal }).catch(error => error)
    await new Promise(resolve => setImmediate(resolve))
    controller.abort(new Error("private-fixture-secret"))
    expect(await pending).toMatchObject({ reason: "cancelled", message: "Mollie API: provider cancelled." })
    expect(cancel).toHaveBeenCalledOnce(); expect(fetchImpl).toHaveBeenCalledOnce()
  })
  it("rejects oversized list bodies through the actual adapter transport", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { headers: { "content-length": "1048577" } }))
    await expect(listRecentMollieCustomers(250, { env: { NODE_ENV: "test", MOLLIE_API_KEY: "test_fixture" }, fetchImpl })).rejects.toMatchObject({ reason: "body_limit" })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })
  it("cleans its aggregate timer when a read retry recovers from 429", async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 429 })).mockResolvedValueOnce(Response.json({ _embedded: { customers: [{ id: "cst_fixture", extra: true }] } }))
    const pending = listRecentMollieCustomers(250, { env: { NODE_ENV: "test", MOLLIE_API_KEY: "test_fixture" }, fetchImpl })
    await vi.advanceTimersByTimeAsync(101)
    expect(await pending).toEqual([{ id: "cst_fixture" }]); expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })
  it("does not replay a customer write after an uncertain response", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    const fetchImpl = vi.fn().mockRejectedValue(new Error("Synthetic transport uncertainty")); vi.stubGlobal("fetch", fetchImpl)
    await expect(createMollieCustomer({ name: "Fixture", email: "fixture@example.invalid", idempotencyKey: "fixture:stable-operation" })).rejects.toMatchObject({ reason: "transport" })
    expect(fetchImpl).toHaveBeenCalledOnce(); expect(fetchImpl.mock.calls[0]?.[1]?.headers).toHaveProperty("Idempotency-Key", "fixture:stable-operation")
  })
})


describe("documented independent Mollie refund states", () => {
  it.each(["queued", "pending", "processing"])("accepts known %s refund evidence without granting paid authority", async status => {
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    const body = { ...paid, amountRefunded: { ...money, value: "5.00" }, _embedded: { refunds: [{ id: "re_completed", status: "refunded", amount: { ...money, value: "5.00" } }, { id: "re_pending", status, amount: { ...money, value: "3.00" } }] } }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)))
    const payment = await retrieveMolliePayment("tr_requested")
    expect(targetAttemptState(paymentAttemptFixture({ grossAmountMinor: 1900 }), payment)).toMatchObject({ state: "refund_pending", refundedAmountMinor: 500 })
  })
  it("allows a pending-only receipt whose aggregate includes reserved refund money, preserving pending authority", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...paid, amountRefunded: money, _embedded: { refunds: [{ id: "re_pending", status: "pending", amount: money }] } })))
    const payment = await retrieveMolliePayment("tr_requested")
    expect(targetAttemptState(paymentAttemptFixture({ grossAmountMinor: 1900 }), payment)).toMatchObject({ state: "refund_pending", refundedAmountMinor: 0 })
  })
  it("does not invent a mismatch for a pending receipt with zero already-refunded total", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_isolated_fixture")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...paid, amountRefunded: { ...money, value: "0.00" }, _embedded: { refunds: [{ id: "re_pending", status: "pending", amount: money }] } })))
    const payment = await retrieveMolliePayment("tr_requested")
    expect(targetAttemptState(paymentAttemptFixture({ grossAmountMinor: 1900 }), payment).state).toBe("refund_pending")
  })
})
