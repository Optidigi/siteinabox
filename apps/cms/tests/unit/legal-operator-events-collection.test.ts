import { userFixture } from "../_helpers/generatedDocs"
import { describe, expect, it } from "vitest"
import { LegalOperatorEvents } from "@/collections/LegalOperatorEvents"

import { accessArgs } from "../_helpers/accessArgs"

describe("LegalOperatorEvents", () => {
  it("is append-only and unavailable to tenant users", async () => {
    expect(LegalOperatorEvents.slug).toBe("legal-operator-events")
    expect(await LegalOperatorEvents.access?.create?.(accessArgs({ req: { user: userFixture({ role: "super-admin" }) } }))).toBe(false)
    expect(await LegalOperatorEvents.access?.update?.(accessArgs({ req: { user: userFixture({ role: "super-admin" }) } }))).toBe(false)
    expect(await LegalOperatorEvents.access?.delete?.(accessArgs({ req: { user: userFixture({ role: "super-admin" }) } }))).toBe(false)
    expect(await LegalOperatorEvents.access?.read?.(accessArgs({ req: { user: userFixture({ role: "owner" }) } }))).toBe(false)
    expect(await LegalOperatorEvents.access?.read?.(accessArgs({ req: { user: userFixture({ role: "super-admin" }) } }))).toBe(true)
  })
})
