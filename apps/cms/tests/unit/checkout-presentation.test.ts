import { describe, expect, it } from "vitest"

import { createCheckoutPresentation } from "@/components/preview/checkout/checkoutPresentation"

describe("checkout presentation", () => {
  it("models two editable customer decisions", () => {
    expect(createCheckoutPresentation({
      decision: "domain",
      paymentActive: false,
      fulfilmentActive: false,
      domainReady: true,
      profileReady: false,
      paymentInProgress: false,
    })).toMatchObject({ phase: "address", primaryAction: { kind: "continue_to_review" } })

    expect(createCheckoutPresentation({
      decision: "review",
      paymentActive: false,
      fulfilmentActive: false,
      domainReady: true,
      profileReady: true,
      paymentInProgress: false,
    })).toMatchObject({ phase: "review", primaryAction: { kind: "pay" } })
  })

  it("keeps payment and fulfilment as lifecycle phases", () => {
    expect(createCheckoutPresentation({
      decision: "review",
      paymentActive: true,
      fulfilmentActive: false,
      domainReady: true,
      profileReady: true,
      paymentInProgress: true,
    }).phase).toBe("payment")
    expect(createCheckoutPresentation({
      decision: "review",
      paymentActive: true,
      fulfilmentActive: true,
      domainReady: true,
      profileReady: true,
      paymentInProgress: false,
    }).phase).toBe("fulfilment")
  })

  it("keeps payment-return presentation distinct from fulfilment", () => {
    const payment = createCheckoutPresentation({
      decision: "review",
      paymentActive: true,
      fulfilmentActive: false,
      domainReady: true,
      profileReady: true,
      paymentInProgress: true,
    })
    expect(payment).toMatchObject({
      phase: "payment",
      primaryAction: { kind: "wait", disabled: true, pending: true },
    })
  })
})
