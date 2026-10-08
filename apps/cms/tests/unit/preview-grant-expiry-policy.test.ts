import { describe, expect, it, vi } from "vitest"
import { validatePreviewGrantExpiry, PreviewAccessGrants } from "@/collections/PreviewAccessGrants"
import { assertBuilderAccountEligible } from "@/lib/builder/access"
import { createInitializedTestPayload, createTestRequest } from "../_helpers/testPayload"
import { generationRunFixture, paginatedFixture, previewGrantFixture, tenantFixture } from "../_helpers/generatedDocs"

async function fixture() {
  const payload = await createInitializedTestPayload([PreviewAccessGrants, { slug: "tenants", fields: [] }, { slug: "site-generation-runs", fields: [] }, { slug: "pages", fields: [] }])
  const req = await createTestRequest(payload)
  const collection = payload.collections["preview-access-grants"]?.config
  if (!collection) throw new Error("Missing grant collection")
  return { payload, req, collection }
}
describe("grant expiry policy at actual collection and builder seams", () => {
  it("requires fixed expiry and preserves source expiry on partial updates", async () => {
    const { req, collection } = await fixture()
    const base = { req, collection, context: {}, operation: "create" }
    await expect(Promise.resolve().then(() => validatePreviewGrantExpiry({ ...base, operation: "create", data: { expiryPolicy: "fixed" } }))).rejects.toThrow("Fixed preview grants require an expiry date")
    expect(await validatePreviewGrantExpiry({ ...base, operation: "create", data: { expiryPolicy: "inactivity" } })).toMatchObject({ expiryPolicy: "inactivity" })
    const originalDoc = previewGrantFixture({ expiryPolicy: "fixed" })
    expect(await validatePreviewGrantExpiry({ ...base, operation: "update", originalDoc, data: { sentCount: 2 } })).toMatchObject({ expiryPolicy: "fixed", sentCount: 2 })
    await expect(Promise.resolve().then(() => validatePreviewGrantExpiry({ ...base, operation: "update", originalDoc, data: { expiresAt: null } }))).rejects.toThrow("Fixed preview grants require an expiry date")
  })
  it.each(["inactivity", "fixed"] as const)("builder eligibility honors %s authority instead of an unconditional timestamp query", async (expiryPolicy) => {
    const { payload } = await fixture()
    const grant = previewGrantFixture({ expiryPolicy, expiresAt: "2000-01-01T00:00:00.000Z" })
    const find = vi.spyOn(payload, "find").mockResolvedValue(paginatedFixture([]))
    find.mockResolvedValueOnce(paginatedFixture([])).mockResolvedValueOnce(paginatedFixture([])).mockResolvedValueOnce(paginatedFixture([{ id: 1, customerEmail: grant.customerEmail, displayName: "Fixture", legal: {}, messages: [], clientSlug: "fixture", createdAt: "", updatedAt: "" }])).mockResolvedValueOnce(paginatedFixture([grant]))
    vi.spyOn(payload, "findByID").mockResolvedValueOnce(tenantFixture()).mockResolvedValueOnce(generationRunFixture({ tenant: 1 }))
    if (expiryPolicy === "inactivity") await assertBuilderAccountEligible(payload, grant.customerEmail)
    else await expect(assertBuilderAccountEligible(payload, grant.customerEmail)).rejects.toThrow("builder_preview_revoked")
    expect(find.mock.calls[3]?.[0].where).not.toHaveProperty("and.3.expiresAt")
  })
})
