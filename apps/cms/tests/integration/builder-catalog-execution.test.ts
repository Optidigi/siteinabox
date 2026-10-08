import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestPayload } from "./_helpers"
import { BuilderQuotaService } from "@/lib/builder/quota"
import { ReservedBuilderExecution } from "@/lib/builder/quotaExecution"
import { builderQuotaPolicy } from "@/lib/builder/quotaPolicy"
import { applySiteGenerationSpec } from "@/lib/site-generation/applySiteGenerationSpec"
import { loadMockSiteGenerationSpec } from "@/lib/intake/mockGeneration"
import { patchSection } from "@/lib/agent/tools"

let payload: Awaited<ReturnType<typeof getTestPayload>>
beforeAll(async () => {
  const uri = new URL(process.env.DATABASE_URI ?? "")
  if (!["postgres:", "postgresql:"].includes(uri.protocol) || !["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) || uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || process.env.SITE_GENERATION_PROVIDER !== "mock") throw new Error("Catalog execution requires isolated payload_test, disabled jobs and mock Sitegen.")
  payload = await getTestPayload()
}, 60000)

describe("actual catalog/apply execution on PostgreSQL (no model calls)", () => {
  it("fences actual multirow apply and direct editor tool after operation terminalization", async () => {
    const unique = randomUUID()
    const service = new BuilderQuotaService(payload, { ...builderQuotaPolicy, enabled: true })
    await service.initialize()
    const eligible = async () => {}
    const admission = await service.reserve(`model-${unique}@example.test`, { operationId: unique, message: "Build an offline approved fixture" }, eligible)
    if (admission.status !== "reserved") throw new Error(`Expected reservation, received ${admission.status}`)
    await service.claim(admission.lease, eligible)
    const execution = new ReservedBuilderExecution(service, admission.lease, eligible)
    try {
      const slug = `model-${unique}`
      const spec = loadMockSiteGenerationSpec({ businessName: "Offline gardener", tenantSlug: slug, primaryDomain: `${slug}.test`, siteUrl: `https://${slug}.test`, language: "en", contact: { email: "fixture@example.test" }, serviceArea: ["Utrecht"], goals: ["contact"], requestedPages: [{ slug: "index", title: "Home" }] })
      const result = await applySiteGenerationSpec(payload, spec, { executionContext: execution, variantScope: "self-serve" })
      expect(result.ok).toBe(true)
      if (result.tenantId == null || !result.pageIds?.[0]) throw new Error("Apply omitted actual tenant/page references")
      await patchSection({ payload, tenantId: result.tenantId, executionContext: execution }, { pageSlug: "index", patch: { heading: "Fenced change" } })
      const before = await payload.findByID({ collection: "pages", id: result.pageIds[0], depth: 0, overrideAccess: true })
      expect(before.blocks?.[0]).toMatchObject({ heading: "Fenced change" })
      await service.fail(admission.lease, "fixture_terminal", true)
      await expect(patchSection({ payload, tenantId: result.tenantId, executionContext: execution }, { pageSlug: "index", patch: { heading: "Stale forbidden change" } })).rejects.toThrow()
      await expect(applySiteGenerationSpec(payload, { ...spec, tenant: { ...spec.tenant, name: "Stale forbidden name" } }, { executionContext: execution })).rejects.toThrow()
      const after = await payload.findByID({ collection: "pages", id: result.pageIds[0], depth: 0, overrideAccess: true })
      expect(after.blocks).toEqual(before.blocks)
    } finally { execution.dispose() }
  }, 60000)
  it("rejects direct Local API introduction of unavailable contact design while preserving the tenant", async () => {
    const slug = `catalog-${randomUUID()}`
    const tenant = await payload.create({ collection: "tenants", data: { name: "Catalog bypass fixture", slug, domain: `${slug}.test`, status: "provisioning" }, overrideAccess: true, context: { skipProjection: true } })
    await expect(payload.create({ collection: "pages", data: { tenant: tenant.id, title: "Unavailable", slug: "index", status: "draft", blocks: [{ blockType: "contact", form: { formName: "Legacy fixture", submitLabel: "Send", fields: [{ name: "email", label: "Email", type: "email" }] }, heading: "Contact", contactMethods: [{ kind: "email", label: "Email", value: "fixture@example.test" }] }] }, overrideAccess: true, context: { skipProjection: true } })).rejects.toThrow("approved")
    const pages = await payload.find({ collection: "pages", where: { tenant: { equals: tenant.id } }, overrideAccess: true })
    expect(pages.docs).toHaveLength(0)
    expect((await payload.findByID({ collection: "tenants", id: tenant.id, overrideAccess: true })).id).toBe(tenant.id)
  })
})
