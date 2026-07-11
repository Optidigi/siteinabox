import { describe, expect, it } from "vitest"
import { LegalOperatorEvents } from "@/collections/LegalOperatorEvents"

describe("LegalOperatorEvents", () => {
  it("is append-only and unavailable to tenant users", async () => {
    expect(LegalOperatorEvents.slug).toBe("legal-operator-events")
    expect(await (LegalOperatorEvents.access?.create as any)({ req: { user: { role: "super-admin" } } })).toBe(false)
    expect(await (LegalOperatorEvents.access?.update as any)({ req: { user: { role: "super-admin" } } })).toBe(false)
    expect(await (LegalOperatorEvents.access?.delete as any)({ req: { user: { role: "super-admin" } } })).toBe(false)
    expect(await (LegalOperatorEvents.access?.read as any)({ req: { user: { role: "owner" } } })).toBe(false)
    expect(await (LegalOperatorEvents.access?.read as any)({ req: { user: { role: "super-admin" } } })).toBe(true)
  })
})
