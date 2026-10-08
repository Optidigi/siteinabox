import { describe, expect, it } from "vitest"
import { restorePendingBuilderOperation } from "@/components/builder/clientOperation"

describe("retry authority survives browser reload", () => {
  it("restores the exact operation UUID, message and locale", () => {
    const operation = { operationId: "552ae921-0dd9-4c4b-9477-56df7a38bbee", message: "Build a bakery", locale: "en" }
    expect(restorePendingBuilderOperation(JSON.stringify(operation))).toEqual(operation)
  })
  it.each([null, "{", "null", '{"operationId":"fake","message":"Build","locale":"en"}', '{"operationId":"552ae921-0dd9-4c4b-9477-56df7a38bbee","message":"Build","locale":"en","paid":true}'])("rejects corrupted or expanded browser authority", (value) => {
    expect(restorePendingBuilderOperation(value)).toBeNull()
  })
})
