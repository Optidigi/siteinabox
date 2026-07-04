import { describe, expect, it, beforeAll } from "vitest"
import { getTestPayload } from "./_helpers"

let payload: Awaited<ReturnType<typeof getTestPayload>>
let tenantWithMenu: number | string
let tenantWithDefaultMenu: number | string

beforeAll(async () => {
  payload = await getTestPayload()

  const ts = Date.now()
  const restricted = await payload.create({
    collection: "tenants",
    data: {
      name: "restricted-blocks",
      slug: `restricted-blocks-${ts}`,
      domain: `restricted-${ts}.test`,
      siteManifest: {
        version: 1,
        inlineMarks: { bold: true, italic: true },
        blockTypes: { paragraph: true, heading: { levels: [2, 3] } },
        blocks: [{ slug: "hero" }, { slug: "richText" }],
      },
    } as any,
    overrideAccess: true,
  })
  tenantWithMenu = restricted.id

  const defaultMenu = await payload.create({
    collection: "tenants",
    data: {
      name: "default-source-backed-blocks",
      slug: `default-source-backed-blocks-${ts}`,
      domain: `default-source-backed-${ts}.test`,
    } as any,
    overrideAccess: true,
  })
  tenantWithDefaultMenu = defaultMenu.id
}, 30000)

// Inline-variant root: children must be inline nodes (text/link/linebreak),
// NOT a paragraph (which is a block-level node). Mirrors the shape used by
// the existing pageRtValidation integration test for inline headline fields.
const minimalInlineHeadline = {
  t: "root", variant: "inline",
  children: [{ t: "text", v: "Hi" }],
} as const

describe("enforceTenantBlockMenu — integration", () => {
  it("allows an in-menu block on a restricted tenant", async () => {
    const result = await payload.create({
      collection: "pages",
      data: {
        title: "p1", slug: "p1", tenant: tenantWithMenu,
        blocks: [{ blockType: "hero", headline: minimalInlineHeadline }],
      } as any,
      overrideAccess: true,
    })
    expect(result.id).toBeTruthy()
  })

  it("rejects an out-of-menu block on a restricted tenant", async () => {
    await expect(
      payload.create({
        collection: "pages",
        data: {
          title: "p2", slug: "p2", tenant: tenantWithMenu,
          blocks: [{
            blockType: "cta",
            headline: minimalInlineHeadline,
            primary: { label: "Go", href: "/" },
          }],
        } as any,
        overrideAccess: true,
      }),
    ).rejects.toThrow(/cta \(index 0\)/)
  })

  it("allows active source-backed blocks when no blocks[] menu is declared", async () => {
    const result = await payload.create({
      collection: "pages",
      data: {
        title: "p3", slug: "p3", tenant: tenantWithDefaultMenu,
        blocks: [{
          blockType: "cta",
          headline: minimalInlineHeadline,
          primary: { label: "Go", href: "/" },
        }],
      } as any,
      overrideAccess: true,
    })
    expect(result.id).toBeTruthy()
  })

  it("rejects retired blocks when no blocks[] menu is declared", async () => {
    await expect(
      payload.create({
        collection: "pages",
        data: {
          title: "p4", slug: "p4", tenant: tenantWithDefaultMenu,
          blocks: [{
            blockType: "comparison",
            title: minimalInlineHeadline,
            columns: [{ title: minimalInlineHeadline }],
            rows: [{ label: "Pages", values: ["1"] }],
          }],
        } as any,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
