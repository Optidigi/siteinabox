import { describe, expect, it } from "vitest"
import { amicarePublishedSiteSnapshot } from "@siteinabox/contracts/fixtures/tenants"
import { validatePublishedPageBlockVariants } from "@/lib/publish/siteSnapshots"

describe("published snapshot variant scope", () => {
  it("preserves approved Amicare variants for the official tenant renderer", () => {
    expect(() => validatePublishedPageBlockVariants(
      amicarePublishedSiteSnapshot.pages,
      amicarePublishedSiteSnapshot.tenantSlug,
    )).not.toThrow()
  })

  it("rejects Amicare variants outside their tenant scope", () => {
    expect(() => validatePublishedPageBlockVariants(
      amicarePublishedSiteSnapshot.pages,
      "customer-preview",
    )).toThrow(/Unresolved provider block variant "amicareZenHero"/)
  })
})
