import { describe, expect, it } from "vitest"
import { truncate } from "@/blocks/_summary"

describe("block summary helpers", () => {
  it("truncates long labels with the existing ellipsis contract", () => {
    expect(truncate("abcdef", 4)).toBe("abc…")
    expect(truncate("abc", 4)).toBe("abc")
  })
})
