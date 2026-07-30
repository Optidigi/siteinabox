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

const payload = (tenantStatus = "preview") => asPayload({
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
          status: tenantStatus,
  }),
})

const adoptedPayload = (
  options: {
    domainVerification?: "verified" | "pending"
    snapshotStatus?: "active" | "superseded"
    managedDomainExists?: boolean
    tenantStatus?: "active" | "suspended"
    adoptionState?: "adopted" | "not_adopted" | "revoked"
    wwwAliasCount?: number
    foreignWwwAlias?: boolean
    wwwCanonicalConflict?: boolean
    domain?: string
    adoptedDomain?: string
  } = {},
) => {
  const domain = options.domain ?? "ami-care.nl"
  const wwwHost = `www.${domain}`
  const tenant = {
    id: 1,
    domain,
    status: options.tenantStatus ?? "active",
    domainVerification: {
      status: options.domainVerification ?? "verified",
    },
    preCommerceRoutingAdoption: {
      state: options.adoptionState ?? "adopted",
      adoptedDomain:
        options.adoptionState === "not_adopted"
          ? null
          : options.adoptedDomain ?? domain,
      evidenceVersion:
        options.adoptionState === "not_adopted"
          ? null
          : "pre-commerce-routing-v1",
      adoptedAt:
        options.adoptionState === "not_adopted"
          ? null
          : "2026-07-30T09:59:23.000Z",
      revokedAt:
        options.adoptionState === "revoked"
          ? "2026-07-30T10:00:00.000Z"
          : null,
    },
    activeSnapshot: 154,
  }
  return asPayload({
    find: vi.fn(async ({
      collection,
      where,
    }: {
      collection: string
      where?: unknown
    }) => ({
      docs: collection === "managed-domains"
        ? options.managedDomainExists &&
            !JSON.stringify(where).includes('"state"')
          ? [{ id: 99, domainNameAscii: tenant.domain }]
          : []
        : collection === "tenants"
          ? JSON.stringify(where).includes(wwwHost)
            ? options.wwwCanonicalConflict
              ? [{ id: 2, domain: wwwHost, status: "active" }]
              : []
            : [tenant]
          : collection === "site-settings"
            ? [{
                id: 5,
                tenant: options.foreignWwwAlias ? 2 : tenant.id,
                aliases: Array.from(
                  { length: options.wwwAliasCount ?? 1 },
                  (_, index) => ({
                    id: `alias-${index}`,
                    host: wwwHost,
                  }),
                ),
              }]
            : [],
    })),
    findByID: vi.fn(async ({ collection }: { collection: string }) =>
      collection === "published-site-snapshots"
        ? {
            id: 154,
            tenant: tenant.id,
            domain: tenant.domain,
            status: options.snapshotStatus ?? "active",
          }
        : tenant),
  })
}

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

  it("keeps suspended customer administration reachable while public rendering is blocked", async () => {
    await expect(resolveManagedDomainEdgeIdentity(
      payload("suspended"),
      "admin.example.nl",
      "cms",
    )).resolves.toEqual({ domain: "example.nl", tenantId: "12" })
    await expect(resolveManagedDomainEdgeIdentity(
      payload("suspended"),
      "example.nl",
      "renderer",
    )).resolves.toBeNull()
  })

  it.each([
    ["renderer", "ami-care.nl"],
    ["renderer", "www.ami-care.nl"],
    ["cms", "admin.ami-care.nl"],
  ] as const)("resolves the durably adopted %s identity", async (surface, host) => {
    await expect(resolveManagedDomainEdgeIdentity(
      adoptedPayload(),
      host,
      surface,
    )).resolves.toEqual({ domain: "ami-care.nl", tenantId: "1" })
  })

  it("uses durable tenant evidence instead of a static hostname list", async () => {
    await expect(resolveManagedDomainEdgeIdentity(
      adoptedPayload({ domain: "historical.example" }),
      "historical.example",
      "renderer",
    )).resolves.toEqual({
      domain: "historical.example",
      tenantId: "1",
    })
  })

  it("does not carry adoption authority to a changed tenant domain", async () => {
    await expect(resolveManagedDomainEdgeIdentity(
      adoptedPayload({
        domain: "retargeted.example",
        adoptedDomain: "ami-care.nl",
      }),
      "retargeted.example",
      "renderer",
    )).resolves.toBeNull()
  })

  it("rejects adopted identity when evidence, verification, snapshot, or managed-domain precedence fails", async () => {
    await expect(resolveManagedDomainEdgeIdentity(
      adoptedPayload({ adoptionState: "not_adopted" }),
      "ami-care.nl",
      "renderer",
    )).resolves.toBeNull()
    await expect(resolveManagedDomainEdgeIdentity(
      adoptedPayload({ adoptionState: "revoked" }),
      "ami-care.nl",
      "renderer",
    )).resolves.toBeNull()
    await expect(resolveManagedDomainEdgeIdentity(
      adoptedPayload({ domainVerification: "pending" }),
      "ami-care.nl",
      "renderer",
    )).resolves.toBeNull()
    await expect(resolveManagedDomainEdgeIdentity(
      adoptedPayload({ snapshotStatus: "superseded" }),
      "ami-care.nl",
      "renderer",
    )).resolves.toBeNull()
    await expect(resolveManagedDomainEdgeIdentity(
      adoptedPayload({ managedDomainExists: true }),
      "ami-care.nl",
      "renderer",
    )).resolves.toBeNull()
  })

  it("requires exactly one explicit www alias for the adopted renderer", async () => {
    await expect(resolveManagedDomainEdgeIdentity(
      adoptedPayload({ wwwAliasCount: 0 }),
      "www.ami-care.nl",
      "renderer",
    )).resolves.toBeNull()
    await expect(resolveManagedDomainEdgeIdentity(
      adoptedPayload({ wwwAliasCount: 2 }),
      "www.ami-care.nl",
      "renderer",
    )).resolves.toBeNull()
  })

  it("rejects a globally conflicting adopted www owner", async () => {
    await expect(resolveManagedDomainEdgeIdentity(
      adoptedPayload({ foreignWwwAlias: true }),
      "www.ami-care.nl",
      "renderer",
    )).resolves.toBeNull()
    await expect(resolveManagedDomainEdgeIdentity(
      adoptedPayload({ wwwCanonicalConflict: true }),
      "www.ami-care.nl",
      "renderer",
    )).resolves.toBeNull()
  })

  it("keeps suspended adopted administration reachable while blocking rendering", async () => {
    const suspended = adoptedPayload({ tenantStatus: "suspended" })
    await expect(resolveManagedDomainEdgeIdentity(
      suspended,
      "admin.ami-care.nl",
      "cms",
    )).resolves.toEqual({ domain: "ami-care.nl", tenantId: "1" })
    await expect(resolveManagedDomainEdgeIdentity(
      suspended,
      "ami-care.nl",
      "renderer",
    )).resolves.toBeNull()
  })
})
