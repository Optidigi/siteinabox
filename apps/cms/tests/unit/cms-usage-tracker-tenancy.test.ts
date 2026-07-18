import { describe, expect, it } from "vitest"
import { managedTenantSlug } from "@/components/analytics/CmsUsageTracker"

describe("CMS usage route tenancy", () => {
  it("extracts only canonical super-admin site routes", () => {
    expect(managedTenantSlug("/sites/amicare/pages/7?tab=content")).toBe("amicare")
    expect(managedTenantSlug("/sites/new")).toBeNull()
    expect(managedTenantSlug("/analytics")).toBeNull()
    expect(managedTenantSlug("/sites/../../admin")).toBeNull()
  })
})
