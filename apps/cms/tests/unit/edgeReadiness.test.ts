import { describe, expect, it, vi } from "vitest"
import {
  canonicalEdgeRequestHost,
  resolveManagedDomainEdgeIdentity,
} from "@/lib/domains/edgeReadiness"
import { asPayload } from "../_helpers/mockPayload"

const managedDomain = {
  id: 41,
  tenant: 12,
  originatingOrder: 90,
  domainNameAscii: "example.nl",
  state: "registration_pending",
  custodyStatus: "managed",
  cloudflareZoneId: "zone-1",
}

const payload = () => asPayload({
  find: vi.fn(async ({ collection }: { collection: string }) => ({
    docs: collection === "managed-domains" ? [managedDomain] : [],
    totalDocs: collection === "managed-domains" ? 1 : 0,
  })),
  findByID: vi.fn(async ({ collection }: { collection: string }) =>
    collection === "orders"
      ? { id: 90, paymentStatus: "paid", state: "fulfillment_pending" }
      : {
          id: 12,
          domain: "preview.example.invalid",
          status: "preview",
        }),
})

describe("domain-bound edge readiness", () => {
  it.each([
    ["renderer", "example.nl"],
    ["renderer", "www.example.nl"],
    ["cms", "admin.example.nl"],
  ] as const)("resolves an eligible %s host", async (surface, host) => {
    await expect(resolveManagedDomainEdgeIdentity(
      payload(),
      host,
      surface,
    )).resolves.toEqual({ domain: "example.nl", tenantId: "12" })
  })

  it.each([
    ["renderer", "admin.example.nl"],
    ["cms", "example.nl"],
    ["cms", "admin.other.nl"],
  ] as const)("rejects a cross-surface or unknown %s host", async (surface, host) => {
    await expect(resolveManagedDomainEdgeIdentity(
      payload(),
      host,
      surface,
    )).resolves.toBeNull()
  })

  it("rejects a forged forwarded host on the platform admin hostname", () => {
    expect(canonicalEdgeRequestHost(new Headers({
      host: "admin.siteinabox.nl",
      "x-forwarded-host": "admin.example.nl",
    }))).toBeNull()
    expect(canonicalEdgeRequestHost(new Headers({
      host: "admin.example.nl",
      "x-forwarded-host": "admin.example.nl",
    }))).toBe("admin.example.nl")
  })
})
