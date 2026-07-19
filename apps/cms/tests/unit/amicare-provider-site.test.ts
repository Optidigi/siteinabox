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
import { pageToJson } from "@/lib/projection/pageToJson"

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

  it("publishes the exact Ami Care page after Payload rehydrates empty CTA groups", () => {
    const sourcePage = amicareSiteGenerationSpec.pages[0]!
    const hydratedPage = {
      ...sourcePage,
      id: "amicare-index",
      blocks: sourcePage.blocks.map((block) => block.blockType === "cta"
        ? {
            ...block,
            primary: block.primary ?? { label: null, href: null },
            secondary: { label: null, href: null },
          }
        : block),
    }
    const projectedPage: any = {
      ...pageToJson(hydratedPage),
      id: "amicare-index",
      status: "published" as const,
      updatedAt: sourcePage.updatedAt,
    }
    const result = PublishedSiteSnapshotSchema.safeParse({
      ...amicarePublishedSiteSnapshot,
      pages: [projectedPage],
    })

    expect(result.success).toBe(true)
    expect(projectedPage.blocks.filter((block: any) => block.blockType === "cta"))
      .toEqual(expect.arrayContaining([
        expect.not.objectContaining({ secondary: expect.anything() }),
        expect.not.objectContaining({ secondary: expect.anything() }),
      ]))
  })
})
