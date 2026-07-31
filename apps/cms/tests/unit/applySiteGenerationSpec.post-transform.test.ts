import { describe, expect, it, vi } from "vitest"
import type { NormalizedIntake, SiteGenerationSpec } from "@siteinabox/contracts"
import { asPayload } from "../_helpers/mockPayload"
import { loadMockSiteGenerationSpec } from "@/lib/intake/mockGeneration"

vi.mock("@/lib/legal/tenantPrivacyPage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/legal/tenantPrivacyPage")>()
  return {
    ...actual,
    materializeTenantPrivacyPage: (spec: SiteGenerationSpec): SiteGenerationSpec => ({
      ...spec,
      tenant: { ...spec.tenant, slug: "Invalid Transformed Slug" },
    }),
  }
})

const normalized: NormalizedIntake = {
  businessName: "Post-transform fixture",
  tenantSlug: "post-transform-fixture",
  primaryDomain: "post-transform-fixture.test",
  siteUrl: "https://post-transform-fixture.test",
  language: "en",
  contact: { email: "fixture@example.com" },
  serviceArea: ["Amsterdam"],
  goals: ["Validate transformed output"],
  requestedPages: [{ slug: "index", title: "Home" }],
}

describe("applySiteGenerationSpec post-transform validation", () => {
  it("rejects an invalid transformed spec before any Payload write", async () => {
    const { applySiteGenerationSpec } = await import("@/lib/site-generation/applySiteGenerationSpec")
    const create = vi.fn()
    const update = vi.fn()
    const find = vi.fn()
    const result = await applySiteGenerationSpec(
      asPayload({ create, update, find }),
      loadMockSiteGenerationSpec(normalized),
      { variantScope: "self-serve" },
    )

    expect(result.ok).toBe(false)
    expect(result.validation.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["invalid_contract_shape", "invalid_tenant_slug", "tenant_slug_mismatch"]),
    )
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(find).not.toHaveBeenCalled()
  })
})
