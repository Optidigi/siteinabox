import { describe, expect, it } from "vitest"
import {
  PublishedSiteSnapshotSchema,
  SiteGenerationSpecSchema,
  schemaForPublishedSiteSnapshot,
} from "@siteinabox/contracts"
import { SITE_BLOCK_CATALOG, SITE_CHROME_CATALOG } from "@siteinabox/contracts/block-catalog"
import {
  amicarePublishedSiteSnapshot,
  amicareSiteGenerationSpec,
} from "@siteinabox/contracts/fixtures/tenants"

describe("Ami Care canonical provider site", () => {
  it("uses only globally approved provider blocks and chrome", () => {
    expect(SiteGenerationSpecSchema.safeParse(amicareSiteGenerationSpec).success).toBe(true)
    expect(amicareSiteGenerationSpec.settings.chrome?.header?.variant).toBe("shadcnui-blocks.navbar-03")
    expect(amicareSiteGenerationSpec.settings.chrome?.footer?.variant).toBe("shadcnui-blocks.footer-07")
    expect(amicareSiteGenerationSpec.pages[0]?.blocks.map((block) => block.designVariant)).toEqual([
      "shadcnui-blocks.hero-02",
      "shadcnui-blocks.features-01",
      "shadcnui-blocks.cta-03",
      "shadcnui-blocks.cta-02",
      "shadcnui-blocks.contact-01",
    ])
    expect(SITE_BLOCK_CATALOG.flatMap((entry) => entry.variants).every((variant) => variant.scope.kind === "global")).toBe(true)
    expect(SITE_CHROME_CATALOG.every((variant) => variant.scope.kind === "global")).toBe(true)
  })

  it("validates its published snapshot through the one canonical schema", () => {
    expect(schemaForPublishedSiteSnapshot(amicarePublishedSiteSnapshot)).toBe(PublishedSiteSnapshotSchema)
    expect(PublishedSiteSnapshotSchema.safeParse(amicarePublishedSiteSnapshot).success).toBe(true)
  })
})
