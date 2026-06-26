import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Page, SiteGenerationRun, Tenant } from "@/payload-types"

const settingsDoc = {
  id: 10,
  tenant: 1,
  siteName: "Snapshot Studio",
  siteUrl: "https://snapshot.test",
  description: "Snapshot test site",
  language: "en",
  aliases: [{ host: "www.snapshot.test" }],
  navHeader: [{ type: "page", page: 100, label: "Home" }],
  navFooter: [{ type: "page", page: 100, label: "Home" }],
  updatedAt: "2026-06-25T20:00:00.000Z",
}

vi.mock("@/lib/queries/settings", () => ({
  getOrCreateSiteSettings: vi.fn(async () => settingsDoc),
}))

const inlineText = (text: string) => ({
  t: "root" as const,
  variant: "inline" as const,
  children: [{ t: "text" as const, v: text }],
})

const matchesWhere = (doc: any, where: any): boolean => {
  if (!where) return true
  if (where.and) return where.and.every((entry: any) => matchesWhere(doc, entry))
  return Object.entries(where).every(([field, condition]) => {
    if (condition && typeof condition === "object" && "equals" in condition) {
      return String(doc[field]) === String((condition as any).equals)
    }
    return doc[field] === condition
  })
}

const createPayloadStub = () => {
  const tenant: Tenant = {
    id: 1,
    name: "Snapshot Studio",
    slug: "snapshot-studio",
    domain: "snapshot.test",
    status: "provisioning",
    domainVerification: { status: "verified" },
    theme: {
      colors: { accent: "#0f766e", bg: "#ffffff", ink: "#111827" },
    },
    siteManifest: null,
    createdAt: "2026-06-25T19:00:00.000Z",
    updatedAt: "2026-06-25T19:00:00.000Z",
  } as Tenant
  const pages: Page[] = [
    {
      id: 100,
      tenant: 1,
      slug: "index",
      title: "Home",
      status: "published",
      blocks: [{ blockType: "hero", headline: inlineText("First publish") }],
      updatedAt: "2026-06-25T20:01:00.000Z",
      createdAt: "2026-06-25T20:01:00.000Z",
    },
  ]
  const generationRuns: SiteGenerationRun[] = [
    {
      id: 500,
      intakeSubmission: 400,
      status: "preview_ready",
      idempotencyKey: "snapshot-run",
      normalizedIntake: {},
      normalizedIntakeHash: "normalized",
      provider: "mock",
      model: "fixture",
      promptVersion: "site-generation-v1",
      generationInputHash: "input",
      clientApproval: { status: "approved" },
      payment: { status: "completed" },
      tenant: 1,
      pages: [100],
      createdAt: "2026-06-25T20:02:00.000Z",
      updatedAt: "2026-06-25T20:02:00.000Z",
    } as SiteGenerationRun,
  ]
  const snapshots: any[] = []
  const payload = {
    findByID: vi.fn(async ({ collection, id }: any) => {
      if (collection === "tenants" && String(id) === "1") return tenant
      if (collection === "site-generation-runs") {
        const run = generationRuns.find((doc) => String(doc.id) === String(id))
        if (run) return run
      }
      if (collection === "published-site-snapshots") {
        const snapshot = snapshots.find((doc) => String(doc.id) === String(id))
        if (snapshot) return snapshot
      }
      throw new Error(`Missing ${collection} ${id}`)
    }),
    find: vi.fn(async ({ collection, where }: any) => {
      if (collection === "pages") {
        const docs = pages.filter((page) => matchesWhere(page, where))
        return { docs, totalDocs: docs.length }
      }
      if (collection === "site-generation-runs") {
        const docs = generationRuns.filter((run) => matchesWhere(run, where))
        return { docs, totalDocs: docs.length }
      }
      if (collection === "published-site-snapshots") {
        const docs = snapshots.filter((snapshot) => matchesWhere(snapshot, where))
        return { docs, totalDocs: docs.length }
      }
      if (collection === "site-settings") return { docs: [settingsDoc], totalDocs: 1 }
      return { docs: [], totalDocs: 0 }
    }),
    create: vi.fn(async ({ collection, data }: any) => {
      const doc = { ...data, id: snapshots.length + 1 }
      if (collection === "published-site-snapshots") snapshots.push(doc)
      return doc
    }),
    update: vi.fn(async ({ collection, id, data }: any) => {
      if (collection === "tenants") {
        Object.assign(tenant, data, { id })
        return tenant
      }
      const snapshot = snapshots.find((doc) => String(doc.id) === String(id))
      if (!snapshot) throw new Error(`Missing ${collection} ${id}`)
      Object.assign(snapshot, data)
      return snapshot
    }),
  }
  return { payload: payload as any, tenant, pages, generationRuns, snapshots }
}

describe("published site snapshots", () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it("freezes current CMS state into immutable snapshot JSON", async () => {
    const { buildPublishedSiteSnapshot } = await import("@/lib/publish/siteSnapshots")
    const { payload, pages, generationRuns } = createPayloadStub()

    const first = await buildPublishedSiteSnapshot(payload, 1, generationRuns[0]!)
    pages[0]!.title = "Changed CMS page"
    pages[0]!.blocks = [{ blockType: "hero", headline: inlineText("Second publish") }]
    const second = await buildPublishedSiteSnapshot(payload, 1, generationRuns[0]!)

    expect(first.pages[0]?.title).toBe("Home")
    expect(JSON.stringify(first.pages[0]?.blocks)).toContain("First publish")
    expect(second.pages[0]?.title).toBe("Changed CMS page")
    expect(JSON.stringify(second.pages[0]?.blocks)).toContain("Second publish")
    expect(first.pages[0]?.status).toBe("published")
  })

  it("publishes only run-linked CMS pages that are already published", async () => {
    const { buildPublishedSiteSnapshot } = await import("@/lib/publish/siteSnapshots")
    const { payload, pages, generationRuns } = createPayloadStub()
    pages.push({
      id: 101,
      tenant: 1,
      slug: "stale-retained",
      title: "Retained",
      status: "published",
      blocks: [{ blockType: "hero", headline: inlineText("Retained page") }],
      updatedAt: "2026-06-25T20:03:00.000Z",
      createdAt: "2026-06-25T20:03:00.000Z",
    } as Page)

    const snapshot = await buildPublishedSiteSnapshot(payload, 1, generationRuns[0]!)

    expect(snapshot.pages.map((page) => page.slug)).toEqual(["index"])

    pages[0]!.status = "draft"
    await expect(buildPublishedSiteSnapshot(payload, 1, generationRuns[0]!)).rejects.toThrow("Cannot publish a site with no pages.")
    generationRuns[0]!.pages = []
    await expect(buildPublishedSiteSnapshot(payload, 1, generationRuns[0]!)).rejects.toThrow("generation run that records published pages")
  })

  it("rejects invalid snapshot payloads before storage", async () => {
    const { buildPublishedSiteSnapshot } = await import("@/lib/publish/siteSnapshots")
    const { payload, pages, generationRuns, snapshots } = createPayloadStub()
    pages[0]!.blocks = [{ blockType: "hero" } as any]

    await expect(buildPublishedSiteSnapshot(payload, 1, generationRuns[0]!)).rejects.toThrow("Published site snapshot failed contract validation")
    expect(snapshots).toHaveLength(0)
  })

  it("blocks activation while approved payment is pending", async () => {
    const { canActivatePublishedSnapshot } = await import("@/lib/publish/siteSnapshots")
    const approvedPendingPayment = {
      clientApproval: { status: "approved" },
      payment: { status: "pending_provider" },
    } as unknown as SiteGenerationRun
    const verifiedTenant = {
      status: "provisioning",
      domainVerification: { status: "verified" },
    } as unknown as Tenant

    expect(canActivatePublishedSnapshot(null).ok).toBe(false)
    expect(canActivatePublishedSnapshot(approvedPendingPayment).ok).toBe(false)
    expect(canActivatePublishedSnapshot(approvedPendingPayment, { tenant: verifiedTenant }).ok).toBe(false)
  })

  it("allows activation after completed payment", async () => {
    const { canActivatePublishedSnapshot } = await import("@/lib/publish/siteSnapshots")
    const approvedPaid = {
      clientApproval: { status: "approved" },
      payment: {
        status: "completed",
        provider: "manual",
        externalReference: "invoice-100",
        actor: 1,
        completedAt: "2026-06-26T10:00:00.000Z",
        updatedAt: "2026-06-26T10:00:00.000Z",
      },
    } as unknown as SiteGenerationRun
    const verifiedTenant = {
      status: "provisioning",
      domainVerification: { status: "verified" },
    } as unknown as Tenant

    expect(canActivatePublishedSnapshot(approvedPaid).ok).toBe(true)
    expect(canActivatePublishedSnapshot(approvedPaid, { tenant: verifiedTenant }).ok).toBe(true)
  })

  it("allows activation after waived payment", async () => {
    const { canActivatePublishedSnapshot } = await import("@/lib/publish/siteSnapshots")
    const approvedWaived = {
      clientApproval: { status: "approved" },
      payment: {
        status: "waived",
        provider: "manual",
        actor: 1,
        waivedAt: "2026-06-26T10:00:00.000Z",
        updatedAt: "2026-06-26T10:00:00.000Z",
        note: "Operator waiver",
      },
    } as unknown as SiteGenerationRun

    expect(canActivatePublishedSnapshot(approvedWaived).ok).toBe(true)
  })

  it("keeps manual activation override behind tenant and domain safety gates", async () => {
    const { canActivatePublishedSnapshot } = await import("@/lib/publish/siteSnapshots")
    const approvedPendingPayment = {
      clientApproval: { status: "approved" },
      payment: { status: "pending_provider" },
    } as unknown as SiteGenerationRun
    const verifiedTenant = {
      status: "provisioning",
      domainVerification: { status: "verified" },
    } as unknown as Tenant
    const unverifiedTenant = {
      status: "provisioning",
      domainVerification: { status: "not_checked" },
    } as unknown as Tenant
    const suspendedTenant = {
      status: "suspended",
      domainVerification: { status: "verified" },
    } as unknown as Tenant

    expect(canActivatePublishedSnapshot(approvedPendingPayment, { manualActivation: true }).ok).toBe(true)
    expect(canActivatePublishedSnapshot(approvedPendingPayment, { manualActivation: true, tenant: verifiedTenant }).ok).toBe(true)
    expect(canActivatePublishedSnapshot(approvedPendingPayment, { manualActivation: true, tenant: unverifiedTenant }).ok).toBe(false)
    expect(canActivatePublishedSnapshot(approvedPendingPayment, { manualActivation: true, tenant: suspendedTenant }).ok).toBe(false)
  })

  it("publishes without activation and activates only after policy gates pass", async () => {
    const { activatePublishedSnapshot, publishSiteSnapshot } = await import("@/lib/publish/siteSnapshots")
    const { payload, generationRuns, snapshots } = createPayloadStub()

    const result = await publishSiteSnapshot(payload, { tenantId: 1, generationRunId: 500, activate: false })

    expect(result.activated).toBe(false)
    expect(result.snapshot.status).toBe("drafted")
    expect(snapshots).toHaveLength(1)

    generationRuns[0]!.payment = { status: "pending_provider" }
    await expect(activatePublishedSnapshot(payload, { snapshotId: result.snapshot.id })).rejects.toThrow("Activation requires completed or waived payment")

    const manuallyActivated = await activatePublishedSnapshot(payload, {
      snapshotId: result.snapshot.id,
      manualActivation: true,
      activationReason: "operator override",
    })
    expect(manuallyActivated.status).toBe("active")

    generationRuns[0]!.payment = { status: "completed" }
    const paidResult = await publishSiteSnapshot(payload, { tenantId: 1, generationRunId: 500, activate: true })
    expect(paidResult.activated).toBe(true)
    expect(paidResult.snapshot.status).toBe("active")
  })

  it("records rollback state on the snapshot replaced by rollback activation", async () => {
    const { publishSiteSnapshot, activatePublishedSnapshot } = await import("@/lib/publish/siteSnapshots")
    const { payload, snapshots } = createPayloadStub()

    const first = await publishSiteSnapshot(payload, { tenantId: 1, generationRunId: 500, activate: true })
    const second = await publishSiteSnapshot(payload, { tenantId: 1, generationRunId: 500, activate: true })

    await activatePublishedSnapshot(payload, {
      snapshotId: first.snapshot.id,
      rollback: true,
      activationReason: "manual rollback",
    })

    const replaced = snapshots.find((snapshot) => String(snapshot.id) === String(second.snapshot.id))
    const reactivated = snapshots.find((snapshot) => String(snapshot.id) === String(first.snapshot.id))
    expect(replaced.status).toBe("rolled_back")
    expect(replaced.rolledBackAt).toBeTruthy()
    expect(replaced.activationReason).toBe("manual rollback")
    expect(reactivated.status).toBe("active")
  })

  it("resolves only active tenants with active validated snapshots and ignores draft CMS changes", async () => {
    const { publishSiteSnapshot, resolvePublishedSnapshotByHost } = await import("@/lib/publish/siteSnapshots")
    const { payload, tenant, pages } = createPayloadStub()

    const inactive = await publishSiteSnapshot(payload, { tenantId: 1, generationRunId: 500, activate: false })
    expect(await resolvePublishedSnapshotByHost(payload, "snapshot.test")).toBeNull()

    await publishSiteSnapshot(payload, { tenantId: 1, generationRunId: 500, activate: true })
    pages[0]!.title = "Changed draft after activation"

    const resolved = await resolvePublishedSnapshotByHost(payload, "www.snapshot.test")
    expect(resolved?.snapshot.pages[0]?.title).toBe("Home")

    tenant.status = "suspended"
    expect(await resolvePublishedSnapshotByHost(payload, "snapshot.test")).toBeNull()
    tenant.status = "archived"
    await expect(publishSiteSnapshot(payload, { tenantId: 1, generationRunId: 500, activate: false })).rejects.toThrow("Cannot publish an archived or suspended tenant.")
    expect(inactive.snapshot.status).toBe("drafted")
  })

  it("blocks direct snapshot update/delete access and immutable field mutation", async () => {
    const { PublishedSiteSnapshots } = await import("@/collections/PublishedSiteSnapshots")

    expect(await (PublishedSiteSnapshots.access?.update as any)?.({ req: { user: { role: "super-admin" } } })).toBe(false)
    expect(await (PublishedSiteSnapshots.access?.delete as any)?.({ req: { user: { role: "super-admin" } } })).toBe(false)

    const beforeChange = PublishedSiteSnapshots.hooks?.beforeChange?.[0] as any
    expect(() => beforeChange({
      operation: "update",
      data: { snapshotHash: "tampered" },
      req: { context: { publishSnapshotLifecycleMutation: true } },
    })).toThrow("immutable")
    expect(() => beforeChange({
      operation: "update",
      data: { status: "active" },
      req: { context: {} },
    })).toThrow("immutable")
    expect(beforeChange({
      operation: "update",
      data: { status: "active" },
      req: { context: { publishSnapshotLifecycleMutation: true } },
    })).toEqual({ status: "active" })
  })
})
