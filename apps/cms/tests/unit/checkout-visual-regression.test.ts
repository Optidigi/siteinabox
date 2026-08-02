import { describe, expect, it } from "vitest"

import {
  checkoutVisualCases,
  intentionalPrototypeDifferences,
} from "../browser/checkout-visual-regression.mjs"

describe("checkout visual evidence manifest", () => {
  it("covers required responsive boundaries, themes, and locales without duplicate names", () => {
    expect(new Set(checkoutVisualCases.map(({ id }) => id)).size).toBe(checkoutVisualCases.length)
    expect(checkoutVisualCases.map(({ width }) => width)).toEqual(expect.arrayContaining([320, 375, 768, 880, 1280]))
    expect(new Set(checkoutVisualCases.map(({ theme }) => theme))).toEqual(new Set(["light", "dark"]))
    expect(new Set(checkoutVisualCases.map(({ locale }) => locale))).toEqual(new Set(["en", "nl"]))
  })

  it("records the contract-level differences that make pixel identity unsafe", () => {
    expect(intentionalPrototypeDifferences).toHaveLength(6)
    expect(intentionalPrototypeDifferences.join(" ")).toMatch(/two required confirmations/i)
    expect(intentionalPrototypeDifferences.join(" ")).toMatch(/six-stage fulfilment/i)
  })
})
