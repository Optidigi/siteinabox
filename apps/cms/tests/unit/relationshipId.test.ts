import { describe, expect, it } from "vitest"
import {
  numericRelationshipId,
  relationshipId,
  relationshipIdSet,
  sameRelationshipId,
} from "@/lib/relationshipId"

describe("relationshipId helpers", () => {
  it("normalizes raw and populated relationship IDs to strings", () => {
    expect(relationshipId(7)).toBe("7")
    expect(relationshipId("7")).toBe("7")
    expect(relationshipId({ id: 7 })).toBe("7")
    expect(relationshipId({ id: "7" })).toBe("7")
  })

  it("returns null for missing relationship IDs", () => {
    expect(relationshipId(null)).toBeNull()
    expect(relationshipId(undefined)).toBeNull()
    expect(relationshipId({})).toBeNull()
    expect(relationshipId({ id: null })).toBeNull()
  })

  it("normalizes numeric relationship IDs and rejects unsafe values", () => {
    expect(numericRelationshipId(7)).toBe(7)
    expect(numericRelationshipId("7")).toBe(7)
    expect(numericRelationshipId({ id: "7" })).toBe(7)
    expect(numericRelationshipId(null)).toBeUndefined()
    expect(() => numericRelationshipId("1.5")).toThrow(
      "Expected a numeric Payload relationship id.",
    )
    expect(() => numericRelationshipId(String(Number.MAX_SAFE_INTEGER + 1))).toThrow(
      "Expected a numeric Payload relationship id.",
    )
  })

  it("compares only present normalized IDs", () => {
    expect(sameRelationshipId(7, "7")).toBe(true)
    expect(sameRelationshipId({ id: 7 }, "7")).toBe(true)
    expect(sameRelationshipId({ id: 7 }, { id: 8 })).toBe(false)
    expect(sameRelationshipId(null, null)).toBe(false)
  })

  it("builds sets without null entries", () => {
    expect(relationshipIdSet([1, "2", { id: 3 }, null, { id: null }])).toEqual(
      new Set(["1", "2", "3"]),
    )
  })
})
