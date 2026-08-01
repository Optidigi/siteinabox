import { describe, expect, it } from "vitest"

import {
  checkoutScenarioIds,
  checkoutScenarios,
} from "../browser/checkout-scenarios"

describe("checkout browser review scenarios", () => {
  it("keeps the complete prototype state catalog unique and typed", () => {
    expect(checkoutScenarioIds).toHaveLength(23)
    expect(new Set(checkoutScenarioIds).size).toBe(23)
    expect(checkoutScenarios.map(({ id }) => id)).toEqual(checkoutScenarioIds)
  })

  it("keeps lifecycle states out of the editable checkout decisions", () => {
    expect(checkoutScenarios.filter(({ family }) => family === "payment")).toHaveLength(3)
    expect(checkoutScenarios.filter(({ family }) => family === "fulfilment")).toHaveLength(4)
    expect(checkoutScenarios.filter(({ initial }) => initial === "payment" || initial === "fulfilment"))
      .toHaveLength(6)
  })
})
