import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { amicarePublishedSiteSnapshot } from "@siteinabox/contracts/fixtures/tenants"

const mocks = vi.hoisted(() => ({
  payload: {
    find: vi.fn(),
    findByID: vi.fn(),
  },
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => mocks.payload),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

import { GET } from "@/app/(payload)/api/renderer/snapshot/route"

const ORIGINAL_ENV = { ...process.env }

const snapshot = {
  ...amicarePublishedSiteSnapshot,
  tenantId: "1",
  tenantSlug: "snapshot-studio",
  domain: "snapshot.test",
  siteUrl: "https://snapshot.test",
  settings: {
    ...amicarePublishedSiteSnapshot.settings,
    siteUrl: "https://snapshot.test",
    aliases: [{ host: "www.snapshot.test" }],
  },
  manifest: {
    ...amicarePublishedSiteSnapshot.manifest,
    tenantId: "1",
  },
}

const tenant = {
  id: 1,
  slug: "snapshot-studio",
  domain: "snapshot.test",
  status: "active",
  activeSnapshot: 10,
}

const siteSettings = {
  id: 20,
  tenant: 1,
  aliases: [{ host: "www.snapshot.test" }],
}

const activeSnapshot = {
  id: 10,
  tenant: 1,
  status: "active",
  domain: "snapshot.test",
  snapshot,
}

function installPayloadState({
  tenantDoc = tenant,
  snapshotDoc = activeSnapshot,
  settingsDocs = [siteSettings],
}: {
  tenantDoc?: any
  snapshotDoc?: any
  settingsDocs?: any[]
} = {}) {
  mocks.payload.findByID.mockImplementation(async ({ collection, id }: any) => {
    if (collection === "tenants" && String(id) === "1") return tenantDoc
    if (collection === "published-site-snapshots" && String(id) === "10") return snapshotDoc
    throw new Error(`Missing ${collection} ${id}`)
  })
  mocks.payload.find.mockImplementation(async ({ collection, where }: any) => {
    if (collection === "tenants") {
      const domain = where?.domain?.equals
      return { docs: tenantDoc && domain === tenantDoc.domain ? [tenantDoc] : [] }
    }
    if (collection === "site-settings") return { docs: settingsDocs }
    if (collection === "published-site-snapshots") return { docs: snapshotDoc ? [snapshotDoc] : [] }
    return { docs: [] }
  })
}

const request = (url: string, headers: Record<string, string> = {}) =>
  new NextRequest(url, { headers })

describe("renderer snapshot route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "production", SIAB_RENDERER_API_TOKEN: "route-secret" }
    installPayloadState()
  })

  it("requires the configured bearer token in production", async () => {
    expect((await GET(request("https://admin.test/api/renderer/snapshot?host=snapshot.test"))).status).toBe(401)
    expect((await GET(request("https://admin.test/api/renderer/snapshot?host=snapshot.test", {
      authorization: "Bearer wrong",
    }))).status).toBe(401)

    const res = await GET(request("https://admin.test/api/renderer/snapshot?host=snapshot.test", {
      authorization: "Bearer route-secret",
    }))

    expect(res.status).toBe(200)
  })

  it("denies production requests when no token is configured", async () => {
    delete process.env.SIAB_RENDERER_API_TOKEN

    const res = await GET(request("https://admin.test/api/renderer/snapshot?host=snapshot.test"))

    expect(res.status).toBe(401)
  })

  it("requires a host from query or forwarded headers", async () => {
    const res = await GET(request("https://admin.test/api/renderer/snapshot", {
      authorization: "Bearer route-secret",
    }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ message: "host is required" })
  })

  it("returns 404 for unknown hosts", async () => {
    const res = await GET(request("https://admin.test/api/renderer/snapshot?host=unknown.test", {
      authorization: "Bearer route-secret",
    }))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ message: "No active published snapshot for host" })
  })

  it("resolves alias hosts to the tenant active snapshot", async () => {
    const res = await GET(request("https://admin.test/api/renderer/snapshot?host=www.snapshot.test", {
      authorization: "Bearer route-secret",
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.tenant).toMatchObject({ id: 1, slug: "snapshot-studio", domain: "snapshot.test", status: "active" })
    expect(body.snapshot.domain).toBe("snapshot.test")
  })

  it("returns 404 for inactive tenants", async () => {
    installPayloadState({ tenantDoc: { ...tenant, status: "suspended" } })

    const res = await GET(request("https://admin.test/api/renderer/snapshot?host=snapshot.test", {
      authorization: "Bearer route-secret",
    }))

    expect(res.status).toBe(404)
  })

  it("returns 422 when the stored active snapshot fails contract validation", async () => {
    installPayloadState({
      snapshotDoc: {
        ...activeSnapshot,
        snapshot: { ...snapshot, pages: [{ slug: "index" }] },
      },
    })

    const res = await GET(request("https://admin.test/api/renderer/snapshot?host=snapshot.test", {
      authorization: "Bearer route-secret",
    }))
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.message).toContain("Stored published site snapshot failed contract validation")
  })

  it("uses X-Forwarded-Host when the host query is absent", async () => {
    const res = await GET(request("https://admin.test/api/renderer/snapshot", {
      authorization: "Bearer route-secret",
      "x-forwarded-host": "snapshot.test",
    }))

    expect(res.status).toBe(200)
  })
})
