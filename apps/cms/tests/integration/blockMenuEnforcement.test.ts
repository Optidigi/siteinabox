import { createLocalReq } from "payload"
import { enforceTenantBlockMenu } from "@/hooks/enforceTenantBlockMenu"
import { describe, expect, it, beforeAll } from "vitest"
import { getTestPayload } from "./_helpers"
import { createArgs, relationId } from "../_helpers/payloadApi"

let payload: Awaited<ReturnType<typeof getTestPayload>>
let tenantWithMenu: number
let tenantWithDefaultMenu: number

beforeAll(async () => {
  payload = await getTestPayload()

  const ts = Date.now()
  const restricted = await payload.create(createArgs("tenants", { status: "provisioning",
    name: "restricted-blocks",
    slug: `restricted-blocks-${ts}`,
    domain: `restricted-${ts}.test`,
    siteManifest: {
      version: 1,
      inlineMarks: { bold: true, italic: true },
      blockTypes: { paragraph: true, heading: { levels: [2, 3] } },
      blocks: [{ slug: "hero" }],
    },
  }, { overrideAccess: true }))
  tenantWithMenu = relationId(restricted)

  const defaultMenu = await payload.create(createArgs("tenants", { status: "provisioning",
    name: "default-owned-blocks",
    slug: `default-owned-blocks-${ts}`,
    domain: `default-owned-${ts}.test`,
  }, { overrideAccess: true }))
  tenantWithDefaultMenu = relationId(defaultMenu)
}, 30000)

const minimalHero = {
  blockType: "hero" as const, variant: "hero-01" as const,
  heading: "Hi",
  body: "Body",
  primaryAction: { label: "Go", href: "/" },
} as const

describe("enforceTenantBlockMenu — integration", () => {
  it("allows an in-menu block on a restricted tenant", async () => {
    const result = await payload.create(createArgs("pages", { status: "draft",
      title: "p1", slug: "p1", tenant: tenantWithMenu,
      blocks: [minimalHero],
    }, { overrideAccess: true }))
    expect(result.id).toBeTruthy()
  })

  it("rejects an out-of-menu block on a restricted tenant", async () => {
    await expect(
      payload.create(createArgs("pages", { status: "draft",
        title: "p2", slug: "p2", tenant: tenantWithMenu,
        blocks: [{
          blockType: "cta", variant: "cta-01",
          heading: "Call to action",
          primaryAction: { label: "Go", href: "/" },
        }],
      }, { overrideAccess: true })),
    ).rejects.toThrow(/cta \(index 0\)/)
  })

  it("allows active owned blocks when no blocks[] menu is declared", async () => {
    const result = await payload.create(createArgs("pages", { status: "draft",
      title: "p3", slug: "p3", tenant: tenantWithDefaultMenu,
        blocks: [{
          blockType: "cta", variant: "cta-01",
          heading: "Call to action",
        primaryAction: { label: "Go", href: "/" },
      }],
    }, { overrideAccess: true }))
    expect(result.id).toBeTruthy()
  })

  it("rejects retired blocks when no blocks[] menu is declared", async () => {
    await expect(
      enforceTenantBlockMenu({
        data: {
          title: "p4", slug: "p4", tenant: tenantWithDefaultMenu,
          blocks: [{ blockType: "comparison", heading: "Retired block" }],
        },
        operation: "create", context: {},
        collection: payload.collections.pages.config,
        req: await createLocalReq({}, payload),
      }),
    ).rejects.toThrow()
  })
})
