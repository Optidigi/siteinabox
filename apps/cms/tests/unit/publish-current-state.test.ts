import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  publishSiteSnapshot: vi.fn(),
  assertTenantPublicationAllowed: vi.fn(),
  recordQualifyingContinuedUse: vi.fn(),
}))

vi.mock("@/lib/publish/siteSnapshots", () => ({
  publishSiteSnapshot: mocks.publishSiteSnapshot,
}))
vi.mock("@/lib/legal/customerRequirements", () => ({
  assertTenantPublicationAllowed: mocks.assertTenantPublicationAllowed,
  recordQualifyingContinuedUse: mocks.recordQualifyingContinuedUse,
}))

import {
  canPublishCurrentTenantState,
  publishCurrentTenantState,
} from "@/lib/publish/currentState"

const payload = (tenant: { id: number; slug: string; domain: string }) => ({
  findByID: vi.fn(async () => tenant),
  find: vi.fn(async () => ({ docs: [] })),
})

describe("publish current tenant state", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.publishSiteSnapshot.mockResolvedValue({
      activated: true,
      snapshot: { id: 12, status: "active", version: 3, domain: "ami-care.nl" },
    })
  })

  it("lets tenant editors publish and activate their own tenant current CMS state", async () => {
    const p = payload({ id: 7, slug: "ami-care", domain: "ami-care.nl" })
    const user = { id: 2, role: "editor", tenants: [{ tenant: { id: 7 } }] }

    await expect(canPublishCurrentTenantState(p as any, user, 7)).resolves.toBe(true)
    const result = await publishCurrentTenantState(p as any, {
      tenantId: 7,
      user,
      reason: "page editor save",
    })

    expect(result.activated).toBe(true)
    expect(mocks.publishSiteSnapshot).toHaveBeenCalledWith(p, {
      tenantId: 7,
      generationRunId: null,
      includeAllPublishedPages: true,
      activate: true,
      manualActivation: true,
      publishedBy: 2,
      activationReason: "page editor save",
    })
    expect(mocks.recordQualifyingContinuedUse).toHaveBeenCalledWith({
      payload: p,
      tenantId: 7,
      evidenceType: "tenant_publish",
      evidenceId: "12",
    })
  })

  it("rejects tenant members publishing a tenant they do not belong to", async () => {
    const p = payload({ id: 7, slug: "customer-preview", domain: "customer.example" })
    const user = { id: 2, role: "owner", tenants: [{ tenant: 8 }] }

    await expect(canPublishCurrentTenantState(p as any, user, 7)).resolves.toBe(false)
    await expect(publishCurrentTenantState(p as any, { tenantId: 7, user })).rejects.toThrow(/not authorized/i)
    expect(mocks.publishSiteSnapshot).not.toHaveBeenCalled()
  })

  it("uses the generic current-state publish route from the shared page editor", () => {
    const sources = [
      "src/components/forms/PageForm.tsx",
      "src/components/forms/SettingsForm.tsx",
      "src/components/navigation/NavigationManager.tsx",
    ].map((file) => readFileSync(file, "utf8")).join("\n")
    expect(sources).not.toContain("autoPublishLive")
    expect(sources).not.toContain("publishCurrentTenantStateAction")
    expect(sources).toContain('fetch("/api/publish"')
    expect(sources).toContain("includeAllPublishedPages: true")
    expect(sources).toContain("reason: \"page editor save\"")
  })
})
