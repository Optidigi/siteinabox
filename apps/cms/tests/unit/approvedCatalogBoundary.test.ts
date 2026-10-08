import { describe, expect, it } from "vitest"
import { approvedCatalogIssues } from "@/lib/sitegen/catalog"

describe("approved catalog boundary", () => {
  it("rejects schema-valid legacy contact family with actionable repair", () => {
    expect(approvedCatalogIssues([{ blockType: "contact", heading: "Contact", contactMethods: [] }])).toEqual([
      expect.objectContaining({ code: "unapproved_catalog_block", message: expect.stringContaining("contact") }),
    ])
  })
  it("accepts only the central catalog's numbered variants", () => {
    expect(approvedCatalogIssues([{ blockType: "hero", variant: "hero-01" }])).toEqual([])
    expect(approvedCatalogIssues([{ blockType: "hero", variant: "hero-99" }])).toHaveLength(1)
    expect(approvedCatalogIssues([{ blockType: "hero" }])).toHaveLength(1)
  })
  it("permits the governed system privacy page only when explicitly requested", () => {
    expect(approvedCatalogIssues([{ blockType: "richText" }])).toHaveLength(1)
  })
})
