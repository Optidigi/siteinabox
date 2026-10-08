import { describe, expect, it } from "vitest"
import { enforceApprovedCatalog } from "@/hooks/enforceApprovedCatalog"
import { hookArgsFor, hookCollection, hookRequest } from "../../_helpers/hookFixtures"
import { pageFixture } from "../../_helpers/generatedDocs"
const legacy = { blockType: "contact" as const, form: { formName: "Legacy fixture", submitLabel: "Send", fields: [{ name: "email", label: "Email", type: "email" as const }] }, heading: "Contact", contactMethods: [{ kind: "email" as const, label: "Email", value: "fixture@example.test" }] }
const args = (data: Parameters<typeof enforceApprovedCatalog>[0]["data"], originalDoc?: Parameters<typeof enforceApprovedCatalog>[0]["originalDoc"]) => hookArgsFor(enforceApprovedCatalog, { operation: originalDoc ? "update" : "create", req: hookRequest(), collection: hookCollection("pages"), context: {}, data, originalDoc })

describe("saved approved catalog boundary", () => {
  it("rejects direct creation and publication of unavailable blocks", () => {
    expect(() => enforceApprovedCatalog(args({ blocks: [legacy] }))).toThrow("approved renderable")
    expect(() => enforceApprovedCatalog(args({ status: "published" }, pageFixture({ status: "draft", blocks: [legacy] })))).toThrow("approved renderable")
  })
  it("preserves the existing legacy draft for repair and rejects edited legacy copy", () => {
    const original = pageFixture({ status: "draft", blocks: [legacy] })
    expect(enforceApprovedCatalog(args({ title: "Repairable" }, original))).toEqual({ title: "Repairable" })
    expect(() => enforceApprovedCatalog(args({ blocks: [{ ...legacy, heading: "Changed unapproved design" }] }, original))).toThrow("remove or replace")
  })
  it("accepts removal of the unavailable section", () => {
    expect(enforceApprovedCatalog(args({ blocks: [] }, pageFixture({ status: "draft", blocks: [legacy] })))).toEqual({ blocks: [] })
  })
  it("rejects an additional copy of an unchanged unavailable section", () => {
    expect(() => enforceApprovedCatalog(args({ blocks: [legacy, legacy] }, pageFixture({ status: "draft", blocks: [legacy] })))).toThrow("remove or replace")
  })
  it("permits reordering or reducing previously duplicated legacy sections", () => {
    const second = { ...legacy, heading: "Second legacy section" }
    const original = pageFixture({ status: "draft", blocks: [legacy, legacy, second] })
    const reordered = { blocks: [second, legacy, legacy] }
    expect(enforceApprovedCatalog(args(reordered, original))).toEqual(reordered)
    expect(enforceApprovedCatalog(args({ blocks: [legacy] }, original))).toEqual({ blocks: [legacy] })
  })
})
