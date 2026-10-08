import { describe, expect, it } from "vitest"
import { magicMailAccountKey, nextMagicMailAttempt } from "@/lib/auth/magicMailBudget"
const now = new Date("2026-10-08T12:00:00.000Z")
const budget = { id: 1, budgetKey: "fixture", day: "2026-10-08", attempts: 0 }
describe("durable email link attempt policy", () => {
  it("shares one recipient budget across normalized email and auth instances", () => {
    expect(magicMailAccountKey(" USER@Example.test ")).toBe(magicMailAccountKey("user@example.test"))
    expect(magicMailAccountKey("user@example.test")).not.toContain("user")
  })
  it("rejects malformed recipients before establishing a budget identity", () => {
    expect(() => magicMailAccountKey("not an email")).toThrow()
  })
  it("counts the last allowed account/global attempt and rejects exhaustion", () => {
    expect(nextMagicMailAttempt({ ...budget, attempts: 9 }, now, false)).toBe(10)
    expect(() => nextMagicMailAttempt({ ...budget, attempts: 10 }, now, false)).toThrow()
    expect(nextMagicMailAttempt({ ...budget, attempts: 499 }, now, true)).toBe(500)
    expect(() => nextMagicMailAttempt({ ...budget, attempts: 500 }, now, true)).toThrow()
  })
  it("preserves cooldown across day rollover and admits at exactly sixty seconds", () => {
    expect(() => nextMagicMailAttempt({ ...budget, day: "2026-10-07", attempts: 10, lastClaimAt: "2026-10-08T11:59:01.000Z" }, now, false)).toThrow()
    expect(nextMagicMailAttempt({ ...budget, attempts: 2, lastClaimAt: "2026-10-08T11:59:00.000Z" }, now, false)).toBe(3)
    expect(nextMagicMailAttempt({ ...budget, day: "2026-10-07", attempts: 10 }, now, false)).toBe(1)
  })
  it("global gate has no per-account cooldown or shared IP identity", () => {
    expect(nextMagicMailAttempt({ ...budget, lastClaimAt: now.toISOString() }, now, true)).toBe(1)
    expect(magicMailAccountKey("a@example.test")).not.toBe(magicMailAccountKey("b@example.test"))
  })
})
