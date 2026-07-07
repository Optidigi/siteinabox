import { describe, expect, it } from "vitest"
import {
  AMICARE_TENANT_ALIASES,
  SITE_CHROME_CATALOG,
  SITE_GENERATION_BLOCK_CATALOG,
  type BlockVariantScope,
} from "@siteinabox/contracts/block-catalog"
import {
  OfficialTenantPublishedSiteSnapshotSchema,
  OfficialTenantSiteGenerationSpecSchema,
  schemaForPublishedSiteSnapshot,
} from "@siteinabox/contracts"
import {
  amicarePublishedSiteSnapshot,
  amicareSiteGenerationSpec,
} from "@siteinabox/contracts/fixtures/tenants"

const amicareBlockVariantNames = new Set([
  "amicareZenHero",
  "amicareCareCards",
  "amicareWarmAccordion",
  "amicareEditorial",
  "amicareQuoteContact",
  "amicareContactForm",
  "amicareStoryCards",
])

describe("Amicare save compatibility", () => {
  it("keeps Amicare block and chrome ownership aliases consistent", () => {
    expect(AMICARE_TENANT_ALIASES).toEqual([
      "ami-care",
      "amicare",
      "amicare-zorg",
      "tenant-amicare",
      "amicare-renderer",
    ])

    const blockScopes: BlockVariantScope[] = []
    for (const entry of SITE_GENERATION_BLOCK_CATALOG) {
      for (const variant of entry.variants) {
        if (amicareBlockVariantNames.has(variant.variant)) blockScopes.push(variant.scope)
      }
    }

    const chromeScopes = SITE_CHROME_CATALOG
      .filter((entry) => entry.variant === "amicareZen")
      .map((entry) => entry.scope)

    expect(blockScopes).toHaveLength(amicareBlockVariantNames.size)
    expect(chromeScopes).toHaveLength(2)

    for (const scope of [...blockScopes, ...chromeScopes]) {
      expect(scope.kind).toBe("tenant-exclusive")
      if (scope.kind !== "tenant-exclusive") throw new Error("Expected tenant-exclusive Amicare scope")
      expect(scope.tenantSlugs).toEqual([...AMICARE_TENANT_ALIASES])
    }
  })

  it("accepts official Amicare generation specs for every alias slug", () => {
    for (const tenantSlug of AMICARE_TENANT_ALIASES) {
      const spec = {
        ...amicareSiteGenerationSpec,
        tenant: {
          ...amicareSiteGenerationSpec.tenant,
          slug: tenantSlug,
        },
      }

      expect(OfficialTenantSiteGenerationSpecSchema.safeParse(spec).success, tenantSlug).toBe(true)
    }
  })

  it("selects the official published snapshot schema for every Amicare alias", () => {
    for (const tenantSlug of AMICARE_TENANT_ALIASES) {
      const snapshot = {
        ...amicarePublishedSiteSnapshot,
        tenantSlug,
      }

      expect(schemaForPublishedSiteSnapshot(snapshot)).toBe(OfficialTenantPublishedSiteSnapshotSchema)
      expect(schemaForPublishedSiteSnapshot(snapshot).safeParse(snapshot).success, tenantSlug).toBe(true)
    }
  })

  it("rejects Amicare-exclusive chrome and block variants for non-alias tenant slugs", () => {
    const snapshot = {
      ...amicarePublishedSiteSnapshot,
      tenantSlug: "customer-preview",
    }

    const parsed = schemaForPublishedSiteSnapshot(snapshot).safeParse(snapshot)
    expect(parsed.success).toBe(false)

    const officialParsed = OfficialTenantPublishedSiteSnapshotSchema.safeParse(snapshot)
    expect(officialParsed.success).toBe(false)
    expect(officialParsed.error?.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'Chrome variant "amicareZen" is not allowed for official tenant "customer-preview"',
        'Block design variant "amicareZenHero" is not allowed for official tenant "customer-preview"',
      ]),
    )
  })
})
