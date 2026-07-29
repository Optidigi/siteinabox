import { describe, expect, it, vi } from "vitest"

import { CloudflareDnsRecordConflictError } from "@/lib/domains/cloudflare"
import type { CloudflareDnsRecordRequest } from "@/lib/domains/cloudflare"
import { reconcileCommerceEdgeRouting } from "@/lib/domains/edgeRouting"
import { CloudflareTunnelApiError } from "@/lib/domains/cloudflareTunnels"
import { asPayload } from "../_helpers/mockPayload"

const domain = {
  id: 41,
  domainNameAscii: "example.nl",
  state: "active",
  custodyStatus: "managed",
  cloudflareZoneId: "zone-1",
  cloudflareDnsRecordIds: [],
  edgeRoutingStatus: "pending",
  httpsStatus: "pending",
  adminHttpsStatus: "pending",
}

const tunnel = (kind: "renderer" | "cms") => ({
  tunnel: {
    id: kind === "renderer"
      ? "11111111-1111-4111-8111-111111111111"
      : "22222222-2222-4222-8222-222222222222",
    name: `siteinabox-${kind}`,
    status: "healthy" as const,
    remotelyManaged: true,
    raw: null,
  },
  ingress: [{ service: "http_status:404" as const }],
  configurationVersion: 3,
  connected: true,
  changed: false,
})

const setup = () => {
  const stored: Omit<typeof domain, "cloudflareDnsRecordIds"> & {
    cloudflareDnsRecordIds: string[]
  } = {
    ...domain,
    cloudflareDnsRecordIds: [],
  }
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    Object.assign(stored, data)
    return { ...stored }
  })
  const payload = asPayload({
    find: vi.fn(async () => ({ docs: [{ ...stored }], totalDocs: 1 })),
    findByID: vi.fn(),
    update,
  })
  const records = [
    {
      type: "CNAME" as const,
      name: "example.nl",
      content: "11111111-1111-4111-8111-111111111111.cfargotunnel.com",
      ttl: 1,
      proxied: true,
    },
    {
      type: "CNAME" as const,
      name: "www.example.nl",
      content: "11111111-1111-4111-8111-111111111111.cfargotunnel.com",
      ttl: 1,
      proxied: true,
    },
    {
      type: "CNAME" as const,
      name: "admin.example.nl",
      content: "22222222-2222-4222-8222-222222222222.cfargotunnel.com",
      ttl: 1,
      proxied: true,
    },
  ]
  return { payload, stored, update, records }
}

describe("automatic Cloudflare edge routing", () => {
  it("performs no Payload or provider call when provider writes are disabled", async () => {
    const fixture = setup()
    const reconcileTunnel = vi.fn()

    await expect(reconcileCommerceEdgeRouting(fixture.payload, {
      providerWritesAllowed: () => false,
      reconcileTunnel,
    })).rejects.toThrow("does not allow Cloudflare edge provider writes")

    expect(fixture.payload.find).not.toHaveBeenCalled()
    expect(reconcileTunnel).not.toHaveBeenCalled()
  })

  it("activates only after exact DNS, certificates, tunnels, and service probes pass", async () => {
    const fixture = setup()
    const reconcileDnsRecord = vi.fn(async (
      _zoneId: string,
      record: CloudflareDnsRecordRequest,
    ) => ({
      id: `record-${record.name}`,
      ...record,
      raw: null,
      ownershipDisposition: "created" as const,
    }))
    const result = await reconcileCommerceEdgeRouting(fixture.payload, {
      providerWritesAllowed: () => true,
      now: () => "2026-07-29T20:00:00.000Z",
      reconcileTunnel: vi.fn(async (kind) => tunnel(kind)),
      buildDnsRecords: vi.fn(() => fixture.records),
      assertDnsRecordsReconciliable: vi.fn(async () => ({
        unownedMatchingRecordIds: [],
      })),
      reconcileDnsRecord,
      getHostnameCertificate: vi.fn(async (_zoneId, hostname) => ({
        hostname,
        universalSslEnabled: true,
        covered: true,
        certificateStatuses: ["active"],
        raw: null,
      })),
      verifyHttps: vi.fn(async () => ({
        status: "verified" as const,
        httpStatus: 200,
        reason: null,
      })),
    })

    expect(result).toEqual({ examined: 1, active: 1, pending: 0, failed: 0 })
    expect(reconcileDnsRecord).toHaveBeenCalledTimes(3)
    expect(fixture.stored).toMatchObject({
      edgeRoutingStatus: "active",
      httpsStatus: "verified",
      adminHttpsStatus: "verified",
      reconciliationRequired: false,
    })
  })

  it("persists provider/tunnel outages as resumable pending state", async () => {
    const fixture = setup()
    const result = await reconcileCommerceEdgeRouting(fixture.payload, {
      providerWritesAllowed: () => true,
      now: () => "2026-07-29T20:00:00.000Z",
      reconcileTunnel: vi.fn(async () => {
        throw new Error("provider unavailable")
      }),
      buildDnsRecords: vi.fn(() => fixture.records),
      assertDnsRecordsReconciliable: vi.fn(async () => ({
        unownedMatchingRecordIds: [],
      })),
    })

    expect(result).toEqual({ examined: 1, active: 0, pending: 1, failed: 0 })
    expect(fixture.stored).toMatchObject({
      edgeRoutingStatus: "pending",
      reconciliationRequired: true,
    })
  })

  it.each([403, 422])(
    "persists permanent Cloudflare HTTP %s failures as an actionable failed state",
    async (status) => {
    const fixture = setup()
    const result = await reconcileCommerceEdgeRouting(fixture.payload, {
      providerWritesAllowed: () => true,
      now: () => "2026-07-29T20:00:00.000Z",
      reconcileTunnel: vi.fn(async () => {
        throw new CloudflareTunnelApiError("Tunnel read", status)
      }),
      buildDnsRecords: vi.fn(() => fixture.records),
      assertDnsRecordsReconciliable: vi.fn(async () => ({
        unownedMatchingRecordIds: [],
      })),
    })

    expect(result).toEqual({ examined: 1, active: 0, pending: 0, failed: 1 })
    expect(fixture.stored).toMatchObject({
      edgeRoutingStatus: "failed",
      reconciliationRequired: true,
    })
    },
  )

  it("fails closed on an unowned DNS collision", async () => {
    const fixture = setup()
    const result = await reconcileCommerceEdgeRouting(fixture.payload, {
      providerWritesAllowed: () => true,
      now: () => "2026-07-29T20:00:00.000Z",
      reconcileTunnel: vi.fn(async (kind) => tunnel(kind)),
      buildDnsRecords: vi.fn(() => fixture.records),
      assertDnsRecordsReconciliable: vi.fn(async () => {
        throw new CloudflareDnsRecordConflictError("admin.example.nl")
      }),
      reconcileDnsRecord: vi.fn(async () => {
        throw new Error("must not be called")
      }),
      getHostnameCertificate: vi.fn(),
      verifyHttps: vi.fn(),
    })

    expect(result).toEqual({ examined: 1, active: 0, pending: 0, failed: 1 })
    expect(fixture.stored).toMatchObject({
      edgeRoutingStatus: "failed",
      reconciliationRequired: true,
    })
  })

  it("performs no DNS mutation while a Tunnel is disconnected", async () => {
    const fixture = setup()
    const reconcileDnsRecord = vi.fn()
    const assertDnsRecordsReconciliable = vi.fn()
    const result = await reconcileCommerceEdgeRouting(fixture.payload, {
      providerWritesAllowed: () => true,
      now: () => "2026-07-29T20:00:00.000Z",
      reconcileTunnel: vi.fn(async (kind) => ({
        ...tunnel(kind),
        connected: kind === "renderer",
      })),
      buildDnsRecords: vi.fn(() => fixture.records),
      assertDnsRecordsReconciliable,
      reconcileDnsRecord,
    })
    expect(result).toEqual({ examined: 1, active: 0, pending: 1, failed: 0 })
    expect(assertDnsRecordsReconciliable).not.toHaveBeenCalled()
    expect(reconcileDnsRecord).not.toHaveBeenCalled()
  })

  it("preserves existing non-edge record ownership evidence", async () => {
    const fixture = setup()
    fixture.stored.cloudflareDnsRecordIds = ["mx", "dkim", "dmarc"]
    await reconcileCommerceEdgeRouting(fixture.payload, {
      providerWritesAllowed: () => true,
      now: () => "2026-07-29T20:00:00.000Z",
      reconcileTunnel: vi.fn(async (kind) => tunnel(kind)),
      buildDnsRecords: vi.fn(() => fixture.records),
      assertDnsRecordsReconciliable: vi.fn(async () => ({
        unownedMatchingRecordIds: [],
      })),
      reconcileDnsRecord: vi.fn(async (_zoneId, record) => ({
        id: `edge-${record.name}`,
        ...record,
        raw: null,
        ownershipDisposition: "created" as const,
      })),
      getHostnameCertificate: vi.fn(async (_zoneId, hostname) => ({
        hostname,
        universalSslEnabled: true,
        covered: true,
        certificateStatuses: ["active"],
        raw: null,
      })),
      verifyHttps: vi.fn(async () => ({
        status: "verified" as const,
        httpStatus: 200,
        reason: null,
      })),
    })
    expect(fixture.stored.cloudflareDnsRecordIds).toEqual(expect.arrayContaining([
      "mx",
      "dkim",
      "dmarc",
      "edge-example.nl",
      "edge-www.example.nl",
      "edge-admin.example.nl",
    ]))
  })

  it("does not adopt an exact unowned record inserted after preflight", async () => {
    const fixture = setup()
    await reconcileCommerceEdgeRouting(fixture.payload, {
      providerWritesAllowed: () => true,
      now: () => "2026-07-29T20:00:00.000Z",
      reconcileTunnel: vi.fn(async (kind) => tunnel(kind)),
      buildDnsRecords: vi.fn(() => fixture.records),
      assertDnsRecordsReconciliable: vi.fn(async () => ({
        unownedMatchingRecordIds: [],
      })),
      reconcileDnsRecord: vi.fn(async (_zoneId, record) => ({
        id: record.name === "example.nl"
          ? "foreign-example"
          : `edge-${record.name}`,
        ...record,
        raw: null,
        ownershipDisposition: record.name === "example.nl"
          ? "unowned_reused" as const
          : "created" as const,
      })),
      getHostnameCertificate: vi.fn(async (_zoneId, hostname) => ({
        hostname,
        universalSslEnabled: true,
        covered: true,
        certificateStatuses: ["active"],
        raw: null,
      })),
      verifyHttps: vi.fn(async () => ({
        status: "verified" as const,
        httpStatus: 200,
        reason: null,
      })),
    })
    expect(fixture.stored.cloudflareDnsRecordIds).not.toContain("foreign-example")
    expect(fixture.stored.cloudflareDnsRecordIds).toEqual(expect.arrayContaining([
      "edge-www.example.nl",
      "edge-admin.example.nl",
    ]))
  })
})
