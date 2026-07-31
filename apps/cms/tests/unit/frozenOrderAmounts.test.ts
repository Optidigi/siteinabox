import { describe, expect, it } from "vitest"

import type { Order } from "@/payload-types"
import { frozenOrderAmounts } from "@/lib/payments/frozenOrderAmounts"

const order = (values: Partial<Order>): Order => ({
  id: 1,
  subtotalNet: 19,
  vatAmount: 3.99,
  totalGross: 22.99,
  ...values,
} as Order)

describe("frozenOrderAmounts", () => {
  it("prefers immutable minor-unit amounts", () => {
    expect(frozenOrderAmounts(order({
      subtotalNet: 999,
      vatAmount: 999,
      totalGross: 999,
      subtotalNetMinor: 1_900,
      vatAmountMinor: 399,
      totalGrossMinor: 2_299,
    }))).toEqual({
      netAmountMinor: 1_900,
      vatAmountMinor: 399,
      grossAmountMinor: 2_299,
    })
  })

  it("preserves the historical decimal fallback", () => {
    expect(frozenOrderAmounts(order({
      subtotalNetMinor: null,
      vatAmountMinor: null,
      totalGrossMinor: null,
    }))).toEqual({
      netAmountMinor: 1_900,
      vatAmountMinor: 399,
      grossAmountMinor: 2_299,
    })
  })

  it("fails closed with the caller's existing exception text", () => {
    expect(() => frozenOrderAmounts(order({
      subtotalNet: Number.NaN,
      subtotalNetMinor: null,
      vatAmountMinor: null,
      totalGrossMinor: null,
    }), "accounting amounts invalid")).toThrow("accounting amounts invalid")
  })
})
