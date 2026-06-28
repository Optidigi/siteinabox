import { beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { amblastPublishedSiteSnapshot, amicarePublishedSiteSnapshot } from "@siteinabox/contracts/fixtures/tenants"
import { SitePageRenderer } from "@siteinabox/site-renderer"
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
let mockedSettingsDoc = settingsDoc

vi.mock("@/lib/queries/settings", () => ({
  getOrCreateSiteSettings: vi.fn(async () => mockedSettingsDoc),
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
  const siteSettings = structuredClone(settingsDoc)
  mockedSettingsDoc = siteSettings
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
      if (collection === "site-settings") return { docs: [siteSettings], totalDocs: 1 }
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
  return { payload: payload as any, tenant, pages, generationRuns, snapshots, siteSettings }
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

  it("publishes Amicare snapshots with exact legacy color tokens even when tenant palette is missing", async () => {
    const { buildPublishedSiteSnapshot } = await import("@/lib/publish/siteSnapshots")
    const { payload, tenant, generationRuns, siteSettings } = createPayloadStub()
    tenant.slug = "ami-care"
    tenant.domain = "ami-care.nl"
    tenant.theme = {
      fonts: {
        text: "Inter Variable, system-ui, sans-serif",
        title: "Fraunces Variable, Georgia, serif",
        heading: "Fraunces Variable, Georgia, serif",
      },
      radius: "1.5rem",
      density: "comfortable",
      borderStyle: "solid",
      stylePreset: "warm-care",
      mode: "light",
    } as any
    ;(siteSettings as any).branding = { primaryColor: "#a04e32" }

    const snapshot = await buildPublishedSiteSnapshot(payload, 1, generationRuns[0]!)

    expect(snapshot.theme?.colors).toMatchObject({
      accent: "#a04e32",
      bg: "#fbf7f0",
      ink: "#1f1a14",
      muted: "#5a4f44",
      card: "#ffffff",
      secondary: "#efe9dd",
      rule: "rgba(31, 26, 20, 0.12)",
    })
    expect(snapshot.theme?.fonts).toMatchObject({
      script: "Caveat Variable, cursive",
    })
    expect(snapshot.theme?.radius).toBe("1.5rem")
  })

  it("publishes editable chrome variant settings and renderer analytics metadata", async () => {
    const { buildPublishedSiteSnapshot } = await import("@/lib/publish/siteSnapshots")
    const { payload, tenant, generationRuns, siteSettings } = createPayloadStub()
    tenant.slug = "amblast"
    tenant.siteManifest = {
      version: 12,
      themeId: "industrial-theme",
      analytics: { provider: "posthog", captureSections: true, captureActions: true, captureForms: true },
    } as any
    ;(siteSettings as any).chrome = {
      header: { variant: "amblastIndustrial", cta: { label: "Contact", href: "/contact" } },
      footer: { variant: "amblastIndustrial", tagline: "Industrial cleaning", legalLinks: [{ label: "Privacy", href: "/privacy" }] },
      banner: { variant: "hyperUiSimple", visible: true, title: "Update", message: "Now booking", link: { label: "Contact", href: "/contact" }, dismissible: true },
    }

    const snapshot = await buildPublishedSiteSnapshot(payload, 1, generationRuns[0]!)

    expect(snapshot.settings.chrome).toMatchObject({
      header: { variant: "amblastIndustrial", cta: { label: "Contact", href: "/contact" } },
      footer: { variant: "amblastIndustrial", tagline: "Industrial cleaning", legalLinks: [{ label: "Privacy", href: "/privacy" }] },
      banner: { variant: "hyperUiSimple", visible: true, title: "Update", message: "Now booking" },
    })
    expect(snapshot.settings.analytics).toMatchObject({
      provider: "posthog",
      consentMode: "required",
      conversionGoals: { acceptedForms: true },
      schemaVersion: 1,
      tenantId: "1",
      tenantSlug: "amblast",
      siteDomain: "snapshot.test",
      themeId: "industrial-theme",
      manifestVersion: 12,
    })
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

  it("can publish current CMS state without a generation-run page list", async () => {
    const { publishSiteSnapshot } = await import("@/lib/publish/siteSnapshots")
    const { payload, pages } = createPayloadStub()
    pages.push({
      id: 101,
      tenant: 1,
      slug: "services",
      title: "Services",
      status: "published",
      blocks: [{ blockType: "hero", headline: inlineText("Current services") }],
      updatedAt: "2026-06-25T20:03:00.000Z",
      createdAt: "2026-06-25T20:03:00.000Z",
    } as Page)

    const result = await publishSiteSnapshot(payload, {
      tenantId: 1,
      includeAllPublishedPages: true,
      activate: true,
      manualActivation: true,
      activationReason: "direct CMS publish",
    })

    expect(result.activated).toBe(true)
    expect(result.snapshot.snapshot.pages.map((page: any) => page.slug)).toEqual(["index", "services"])
    expect(result.snapshot.sourceGenerationRun).toBeUndefined()
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

  it("retargets migrated published fixtures for renderer staging without dropping parity data", async () => {
    const { retargetPublishedSiteSnapshot } = await import("@/lib/publish/retargetSnapshot")

    const snapshot = retargetPublishedSiteSnapshot(amblastPublishedSiteSnapshot, {
      tenantId: 42,
      tenantSlug: "amblast-renderer",
      domain: "amblast.optidigi.nl",
      siteUrl: "https://amblast.optidigi.nl",
      mediaBaseUrl: "https://amblast.siteinabox.nl",
      aliases: [],
      manifestVersion: 7,
      publishedAt: "2026-06-26T12:00:00.000Z",
    })

    expect(snapshot.tenantId).toBe("42")
    expect(snapshot.tenantSlug).toBe("amblast-renderer")
    expect(snapshot.domain).toBe("amblast.optidigi.nl")
    expect(snapshot.siteUrl).toBe("https://amblast.optidigi.nl")
    expect(snapshot.settings.siteUrl).toBe("https://amblast.optidigi.nl")
    expect(snapshot.settings.aliases).toEqual([])
    expect(snapshot.settings.seoJsonLd?.organization?.url).toBe("https://amblast.optidigi.nl")
    expect(snapshot.settings.branding?.logo).toMatchObject({ url: "https://amblast.siteinabox.nl/uploads/logo/cropped-AMBlast_logo.png" })
    expect(snapshot.manifest).toMatchObject({ tenantId: "42", version: 7 })
    expect(snapshot.publishedAt).toBe("2026-06-26T12:00:00.000Z")
    expect(snapshot.blocks?.map((block) => block.slug)).toEqual(expect.arrayContaining(["mediaHero", "beforeAfterGallery", "contactDetails"]))
    expect(snapshot.pages.flatMap((page) => page.blocks).map((block) => block.blockType)).toEqual(expect.arrayContaining(["mediaHero", "beforeAfterGallery"]))
    expect(JSON.stringify(snapshot.pages)).toContain("https://amblast.siteinabox.nl/uploads/portfolio/IMG_20210402_151225-scaled.jpg")
    expect(JSON.stringify(snapshot.pages)).toContain("\"href\":\"/contact\"")
    expect(JSON.stringify(snapshot.media)).toContain("IMG_20210402_151225-scaled.jpg")

    const homeHtml = renderToStaticMarkup(createElement(SitePageRenderer, {
      page: snapshot.pages.find((page) => page.slug === "index") as any,
      settings: snapshot.settings,
      theme: snapshot.theme,
    }))
    const portfolioHtml = renderToStaticMarkup(createElement(SitePageRenderer, {
      page: snapshot.pages.find((page) => page.slug === "portfolio") as any,
      settings: snapshot.settings,
      theme: snapshot.theme,
    }))
    expect(homeHtml).toContain("data-siab-service-carousel")
    expect(homeHtml).toContain("https://amblast.siteinabox.nl/uploads/logo/cropped-AMBlast_logo.png")
    expect(portfolioHtml).toContain("data-siab-before-after-pair")
    expect(portfolioHtml).toContain("https://amblast.siteinabox.nl/uploads/portfolio/IMG_20210402_151225-scaled.jpg")
  })

  it("retargets Amicare CMS media refs to the legacy media route for renderer staging", async () => {
    const { retargetPublishedSiteSnapshot } = await import("@/lib/publish/retargetSnapshot")

    const snapshot = retargetPublishedSiteSnapshot(amicarePublishedSiteSnapshot, {
      tenantId: 41,
      tenantSlug: "amicare-renderer",
      domain: "amicare.optidigi.nl",
      siteUrl: "https://amicare.optidigi.nl",
      mediaBaseUrl: "https://ami-care.nl",
      aliases: [],
      manifestVersion: 3,
      publishedAt: "2026-06-26T12:00:00.000Z",
    })

    expect(JSON.stringify(snapshot.pages)).toContain("https://ami-care.nl/media/toys.jpg")
    expect(JSON.stringify(snapshot.pages)).toContain("https://ami-care.nl/api/tenant-media/7/bedroom.jpg")
    expect(JSON.stringify(snapshot.pages)).not.toContain("https://ami-care.nl/assets/bedroom.jpg")
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

  it("keeps renderer resolution on the active snapshot while newer CMS changes are only drafted", async () => {
    const { activatePublishedSnapshot, publishSiteSnapshot, resolvePublishedSnapshotByHost } = await import("@/lib/publish/siteSnapshots")
    const { payload, tenant, pages, siteSettings } = createPayloadStub()

    tenant.theme = {
      palette: { accent: "#0f766e", bg: "#ffffff", ink: "#111827" },
    } as any
    const active = await publishSiteSnapshot(payload, { tenantId: 1, generationRunId: 500, activate: true })
    expect(active.snapshot.status).toBe("active")

    pages[0]!.title = "Drafted page change"
    pages[0]!.blocks = [{ blockType: "hero", headline: inlineText("Draft-only content") }]
    siteSettings.siteName = "Drafted Settings"
    ;(siteSettings as any).navHeader = [{ type: "custom", url: "/draft-only", label: "Draft only" }]
    tenant.theme = {
      palette: { accent: "#e11d48", bg: "#fff7ed", ink: "#111827" },
    } as any

    const drafted = await publishSiteSnapshot(payload, { tenantId: 1, generationRunId: 500, activate: false })
    expect(tenant.status).toBe("active")
    expect(tenant.activeSnapshot).toBe(active.snapshot.id)
    const resolvedBeforeActivation = await resolvePublishedSnapshotByHost(payload, "www.snapshot.test")

    expect(drafted.snapshot.status).toBe("drafted")
    expect(drafted.snapshot.snapshot.pages[0]?.title).toBe("Drafted page change")
    expect(drafted.snapshot.snapshot.settings.siteName).toBe("Drafted Settings")
    expect(drafted.snapshot.snapshot.theme?.colors?.accent).toBe("#e11d48")
    expect(resolvedBeforeActivation?.snapshotId).toBe(active.snapshot.id)
    expect(resolvedBeforeActivation?.snapshot.pages[0]?.title).toBe("Home")
    expect(JSON.stringify(resolvedBeforeActivation?.snapshot.pages[0]?.blocks)).toContain("First publish")
    expect(resolvedBeforeActivation?.snapshot.settings.siteName).toBe("Snapshot Studio")
    expect(resolvedBeforeActivation?.snapshot.settings.navHeader?.[0]?.label).toBe("Home")
    expect(resolvedBeforeActivation?.snapshot.theme?.colors?.accent).toBe("#0f766e")

    await activatePublishedSnapshot(payload, { snapshotId: drafted.snapshot.id })
    const resolvedAfterActivation = await resolvePublishedSnapshotByHost(payload, "www.snapshot.test")

    expect(resolvedAfterActivation?.snapshotId).toBe(drafted.snapshot.id)
    expect(resolvedAfterActivation?.snapshot.pages[0]?.title).toBe("Drafted page change")
    expect(resolvedAfterActivation?.snapshot.settings.siteName).toBe("Drafted Settings")
    expect(resolvedAfterActivation?.snapshot.theme?.colors?.accent).toBe("#e11d48")
  })

  it("blocks direct snapshot update/delete access and immutable field mutation", async () => {
    const { protectImmutableSnapshot, PublishedSiteSnapshots } = await import("@/collections/PublishedSiteSnapshots")

    expect(await (PublishedSiteSnapshots.access?.update as any)?.({ req: { user: { role: "super-admin" } } })).toBe(false)
    expect(await (PublishedSiteSnapshots.access?.delete as any)?.({ req: { user: { role: "super-admin" } } })).toBe(false)

    expect(() => protectImmutableSnapshot({
      operation: "update",
      data: { snapshotHash: "tampered" },
      originalDoc: { snapshotHash: "original" },
      req: { context: { publishSnapshotLifecycleMutation: true } },
    })).toThrow("immutable")
    expect(() => protectImmutableSnapshot({
      operation: "update",
      data: { status: "active", tenant: 2 },
      originalDoc: { status: "drafted", tenant: 1 },
      req: { context: { publishSnapshotLifecycleMutation: true } },
    })).toThrow('Published site snapshot field "tenant" is immutable after creation.')
    expect(() => protectImmutableSnapshot({
      operation: "update",
      data: { status: "active" },
      req: { context: {} },
    })).toThrow("immutable")
    expect(protectImmutableSnapshot({
      operation: "update",
      data: { status: "active", tenant: { id: 1 }, sourceGenerationRun: null },
      originalDoc: { status: "drafted", tenant: 1, sourceGenerationRun: undefined },
      req: { context: { publishSnapshotLifecycleMutation: true } },
    })).toEqual({ status: "active", tenant: { id: 1 }, sourceGenerationRun: null })
  })
})
