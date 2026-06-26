import { describe, expect, it } from "vitest"
import {
  createOperationalPaymentState,
  createPendingProviderPaymentState,
  isActivationPaymentSatisfied,
  normalizeGenerationRunPaymentState,
} from "@/lib/payments/generationRunPayment"

describe("generation run payment abstraction", () => {
  it("normalizes missing or invalid payment JSON to not started", () => {
    expect(normalizeGenerationRunPaymentState(null)).toMatchObject({
      status: "not_started",
      provider: null,
      externalReference: null,
      actor: null,
      completedAt: null,
      waivedAt: null,
      updatedAt: null,
      note: null,
      checkoutUrl: null,
      customerEmail: null,
      clientSlug: null,
      amount: null,
      currency: null,
      providerStatus: null,
      webhookProcessedAt: null,
    })
    expect(normalizeGenerationRunPaymentState({ status: "paid" }).status).toBe("not_started")
  })

  it("creates a provider-neutral pending provider handoff after approval", () => {
    expect(createPendingProviderPaymentState("2026-06-26T10:00:00.000Z")).toEqual({
      status: "pending_provider",
      provider: null,
      externalReference: null,
      actor: null,
      completedAt: null,
      waivedAt: null,
      updatedAt: "2026-06-26T10:00:00.000Z",
      note: "Payment provider not selected; operator completion or waiver is required before activation.",
      checkoutUrl: null,
      customerEmail: null,
      clientSlug: null,
      amount: null,
      currency: null,
      providerStatus: null,
      webhookProcessedAt: null,
    })
  })

  it("records completed and waived audit fields without provider-specific assumptions", () => {
    expect(createOperationalPaymentState({
      status: "completed",
      actor: 7,
      provider: " invoice ",
      externalReference: " ref-123 ",
      note: " paid outside platform ",
      now: "2026-06-26T10:00:00.000Z",
    })).toEqual({
      status: "completed",
      provider: "invoice",
      externalReference: "ref-123",
      actor: 7,
      completedAt: "2026-06-26T10:00:00.000Z",
      waivedAt: null,
      updatedAt: "2026-06-26T10:00:00.000Z",
      note: "paid outside platform",
      checkoutUrl: null,
      customerEmail: null,
      clientSlug: null,
      amount: null,
      currency: null,
      providerStatus: null,
      webhookProcessedAt: null,
    })

    expect(createOperationalPaymentState({
      status: "waived",
      actor: "operator",
      now: "2026-06-26T11:00:00.000Z",
    })).toMatchObject({
      status: "waived",
      provider: "manual",
      actor: "operator",
      completedAt: null,
      waivedAt: "2026-06-26T11:00:00.000Z",
    })
  })

  it("only treats completed and waived as activation-satisfying states", () => {
    expect(isActivationPaymentSatisfied({ status: "not_started" })).toBe(false)
    expect(isActivationPaymentSatisfied({ status: "pending_provider" })).toBe(false)
    expect(isActivationPaymentSatisfied({ status: "canceled" })).toBe(false)
    expect(isActivationPaymentSatisfied({ status: "failed" })).toBe(false)
    expect(isActivationPaymentSatisfied({ status: "expired" })).toBe(false)
    expect(isActivationPaymentSatisfied({ status: "completed" })).toBe(true)
    expect(isActivationPaymentSatisfied({ status: "waived" })).toBe(true)
  })
})
