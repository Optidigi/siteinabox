import { describe, expect, it, vi, beforeEach } from "vitest"
import { enforceTenantBlockMenu } from "@/hooks/enforceTenantBlockMenu"
import * as loadManifest from "@/lib/richText/loadManifest"
import type { RtManifest } from "@/lib/richText/manifest"

const baseManifest: RtManifest = {
  version: 1,
  inlineMarks: { bold: true, italic: true },
  blockTypes: { paragraph: true, heading: { levels: [2, 3] } },
}

describe("enforceTenantBlockMenu", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("uses the canonical Payload block registry when manifest has no blocks[]", async () => {
    vi.spyOn(loadManifest, "loadTenantManifest").mockResolvedValue(baseManifest)
    const data = {
      tenant: 7,
      blocks: [
        { blockType: "hero" },
        { blockType: "cta" },
        { blockType: "richText" },
      ],
    }
    const result = await enforceTenantBlockMenu({ data, originalDoc: undefined } as any)
    expect(result).toBe(data)
  })

  it("rejects unsupported block types when manifest has no blocks[]", async () => {
    vi.spyOn(loadManifest, "loadTenantManifest").mockResolvedValue(baseManifest)
    const data = {
      tenant: 7,
      blocks: [
        { blockType: "hero" },
        { blockType: "processSteps" },
        { blockType: "comparison" },
      ],
    }
    await expect(
      enforceTenantBlockMenu({ data, originalDoc: undefined } as any),
    ).rejects.toThrow(/processSteps \(index 1\).*comparison \(index 2\)/)
  })

  it("allows blocks that are in the tenant's allowed menu", async () => {
    vi.spyOn(loadManifest, "loadTenantManifest").mockResolvedValue({
      ...baseManifest,
      blocks: [{ slug: "hero" }, { slug: "richText" }],
    })
    const data = {
      tenant: 7,
      blocks: [{ blockType: "hero" }, { blockType: "richText" }, { blockType: "hero" }],
    }
    const result = await enforceTenantBlockMenu({ data, originalDoc: undefined } as any)
    expect(result).toBe(data)
  })

  it("rejects blocks outside the tenant's allowed menu", async () => {
    vi.spyOn(loadManifest, "loadTenantManifest").mockResolvedValue({
      ...baseManifest,
      blocks: [{ slug: "hero" }, { slug: "richText" }],
    })
    const data = {
      tenant: 7,
      blocks: [{ blockType: "hero" }, { blockType: "cta" }, { blockType: "faq" }],
    }
    await expect(
      enforceTenantBlockMenu({ data, originalDoc: undefined } as any),
    ).rejects.toThrow(/cta \(index 1\).*faq \(index 2\)/)
  })

  it("falls through when no tenant id can be resolved", async () => {
    const spy = vi.spyOn(loadManifest, "loadTenantManifest")
    const data = { tenant: null, blocks: [{ blockType: "hero" }] }
    const result = await enforceTenantBlockMenu({ data, originalDoc: undefined } as any)
    expect(result).toBe(data)
    expect(spy).not.toHaveBeenCalled()
  })

  it("extracts tenant id from a populated tenant object", async () => {
    const spy = vi.spyOn(loadManifest, "loadTenantManifest").mockResolvedValue(baseManifest)
    const data = { tenant: { id: 42 }, blocks: [{ blockType: "hero" }] }
    await enforceTenantBlockMenu({ data, originalDoc: undefined } as any)
    expect(spy).toHaveBeenCalledWith(42)
  })

  it("falls back to originalDoc.tenant when data.tenant is missing", async () => {
    const spy = vi.spyOn(loadManifest, "loadTenantManifest").mockResolvedValue(baseManifest)
    const data = { blocks: [{ blockType: "hero" }] }
    await enforceTenantBlockMenu({ data, originalDoc: { tenant: 13 } } as any)
    expect(spy).toHaveBeenCalledWith(13)
  })
})
