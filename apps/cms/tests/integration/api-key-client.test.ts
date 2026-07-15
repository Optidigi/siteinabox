import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { getTestPayload, resetTestData } from "./_helpers"
import type { Payload } from "payload"

let payload: Payload
beforeAll(async () => { payload = await getTestPayload() }, 30000)
beforeEach(async () => { await resetTestData(payload) }, 30000)

describe("API-key client flow", () => {
  it("API-key user can create a tenant and a scoped page", async () => {
    const apiKeyClient = await payload.create({
      collection: "users", overrideAccess: true,
      data: {
        email: "api-client@test.local", password: "test1234", name: "API Client",
        role: "super-admin", enableAPIKey: true,
        apiKey: "test-api-key-12345678901234567890"
      } as any
    })

    const tenant = await payload.create({
      collection: "tenants", user: apiKeyClient,
      data: { name: "Client X", slug: "clientx", domain: "clientx.test", status: "provisioning" }
    } as any)
    expect(tenant.id).toBeTruthy()

    // Page seed (must include tenant explicitly because super-admin writes aren't auto-scoped).
    // Hero.headline is `type: "json"` + `editor: "richTextInline"` (rt-v2 Phase 1), so the
    // fixture must be a valid inline-variant RtRoot — a plain string fails
    // `validateRichTextOnSave` with "Invalid input". Minimal valid shape is a root with
    // a single text child carrying the headline copy.
    const page = await payload.create({
      collection: "pages", user: apiKeyClient,
      data: {
        tenant: tenant.id, title: "Home", slug: "home", status: "published",
        blocks: [{
          blockType: "hero",
          designVariant: "shadcnui-blocks.hero-01",
          headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Welcome", marks: [] }] },
        }]
      }
    } as any)
    expect(page.id).toBeTruthy()
    const pageTenant = (page as any).tenant
    const tenantId = typeof pageTenant === "object" ? pageTenant.id : pageTenant
    expect(tenantId).toBe(tenant.id)
  })
})
