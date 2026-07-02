import { describe, expect, it, vi } from "vitest"
import { ValidationError } from "payload"
import { enforceTenantBlockVariantScope } from "@/hooks/enforceTenantBlockVariantScope"

const createReq = (tenant: { id: number; slug: string; domain?: string | null }) => ({
  payload: {
    findByID: vi.fn(async ({ collection, id }: any) => {
      expect(collection).toBe("tenants")
      expect(String(id)).toBe(String(tenant.id))
      return tenant
    }),
  },
})

const runHook = (
  tenant: { id: number; slug: string; domain?: string | null },
  blocks: unknown[],
) => enforceTenantBlockVariantScope({
  collection: { slug: "pages" } as any,
  data: { tenant: tenant.id, blocks },
  originalDoc: undefined,
  req: createReq(tenant) as any,
  operation: "create",
  context: {},
} as any)

describe("enforceTenantBlockVariantScope", () => {
  it("rejects Amicare tenant-exclusive variants for generic tenants", async () => {
    let err: unknown

    try {
      await runHook({ id: 1, slug: "generic-care", domain: "generic-care.nl" }, [{
        blockType: "hero",
        variant: "amicareZenHero",
        analytics: { sectionVariant: "amicare-zen-hero" },
      }])
    } catch (caught) {
      err = caught
    }

    expect(err).toBeInstanceOf(ValidationError)
    expect((err as any).data?.errors).toEqual([
      expect.objectContaining({ path: "blocks.0.variant" }),
      expect.objectContaining({ path: "blocks.0.analytics.sectionVariant" }),
    ])
  })

  it("allows Amicare official tenants to keep legacy block variants", async () => {
    await expect(runHook({ id: 2, slug: "amicare-zorg", domain: "ami-care.nl" }, [{
      blockType: "hero",
      variant: "amicareZenHero",
      analytics: { sectionVariant: "amicare-zen-hero" },
    }])).resolves.toMatchObject({
      tenant: 2,
    })
  })

  it("keeps normal self-serve variants valid", async () => {
    await expect(runHook({ id: 3, slug: "generic-care", domain: "generic-care.nl" }, [{
      blockType: "hero",
      variant: "tailwindPlusSimpleCentered",
      analytics: { sectionVariant: "tailwind-plus-simple-centered" },
    }])).resolves.toMatchObject({
      tenant: 3,
    })
  })
})
