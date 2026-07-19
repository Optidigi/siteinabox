import { describe, expect, it, beforeAll } from "vitest"
import { getTestPayload } from "./_helpers"
import { createArgs, createArgsLoose, relationId } from "../_helpers/payloadApi"

let payload: Awaited<ReturnType<typeof getTestPayload>>
let tenantWithMenu: number
let tenantWithDefaultMenu: number

beforeAll(async () => {
  payload = await getTestPayload()

  const ts = Date.now()
  const restricted = await payload.create(createArgs("tenants", {
    name: "restricted-blocks",
    slug: `restricted-blocks-${ts}`,
    domain: `restricted-${ts}.test`,
    siteManifest: {
      version: 1,
      inlineMarks: { bold: true, italic: true },
      blockTypes: { paragraph: true, heading: { levels: [2, 3] } },
      blocks: [{ slug: "hero" }, { slug: "richText" }],
    },
  }, { overrideAccess: true }))
  tenantWithMenu = relationId(restricted)

  const defaultMenu = await payload.create(createArgs("tenants", {
    name: "default-source-backed-blocks",
    slug: `default-source-backed-blocks-${ts}`,
    domain: `default-source-backed-${ts}.test`,
  }, { overrideAccess: true }))
  tenantWithDefaultMenu = relationId(defaultMenu)
}, 30000)

const minimalInlineHeadline = {
  t: "root", variant: "inline",
  children: [{ t: "text", v: "Hi" }],
} as const

describe("enforceTenantBlockMenu — integration", () => {
  it("allows an in-menu block on a restricted tenant", async () => {
    const result = await payload.create(createArgs("pages", {
      title: "p1", slug: "p1", tenant: tenantWithMenu,
      blocks: [{ blockType: "hero", designVariant: "shadcnui-blocks.hero-01", headline: minimalInlineHeadline }],
    }, { overrideAccess: true }))
    expect(result.id).toBeTruthy()
  })

  it("rejects an out-of-menu block on a restricted tenant", async () => {
    await expect(
      payload.create(createArgs("pages", {
        title: "p2", slug: "p2", tenant: tenantWithMenu,
        blocks: [{
          blockType: "cta",
          headline: minimalInlineHeadline,
          primary: { label: "Go", href: "/" },
        }],
      }, { overrideAccess: true })),
    ).rejects.toThrow(/cta \(index 0\)/)
  })

  it("allows active source-backed blocks when no blocks[] menu is declared", async () => {
    const result = await payload.create(createArgs("pages", {
      title: "p3", slug: "p3", tenant: tenantWithDefaultMenu,
      blocks: [{
        blockType: "cta",
        designVariant: "shadcnui-blocks.cta-01",
        headline: minimalInlineHeadline,
        primary: { label: "Go", href: "/" },
      }],
    }, { overrideAccess: true }))
    expect(result.id).toBeTruthy()
  })

  it("rejects retired blocks when no blocks[] menu is declared", async () => {
    await expect(
      payload.create(createArgsLoose("pages", {
        title: "p4", slug: "p4", tenant: tenantWithDefaultMenu,
        blocks: [{
          blockType: "comparison",
          title: minimalInlineHeadline,
          columns: [{ title: minimalInlineHeadline }],
          rows: [{ label: "Pages", values: ["1"] }],
        }],
      }, { overrideAccess: true })),
    ).rejects.toThrow()
  })
})
