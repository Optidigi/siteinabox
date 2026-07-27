import { describe, expect, it } from "vitest"
import { amicarePublishedSiteSnapshot } from "./fixtures/tenants"
import {
  normalizePublicDomainHost,
  rendererActiveDomainRoutingSchema,
  rendererSnapshotEnvelopeSchema,
} from "./renderer-routing"

const snapshot = {
  ...amicarePublishedSiteSnapshot,
  tenantId: "42",
  tenantSlug: "routing-studio",
  domain: "routing.example.com",
  siteUrl: "https://routing.example.com",
  manifest: {
    ...amicarePublishedSiteSnapshot.manifest,
    tenantId: "42",
  },
  settings: {
    ...amicarePublishedSiteSnapshot.settings,
    siteUrl: "https://routing.example.com",
  },
}

const envelope = {
  routing: {
    version: 1 as const,
    requestedHost: "www.routing.example.com",
    canonicalHost: "routing.example.com",
    activeHosts: ["routing.example.com", "www.routing.example.com"],
  },
  tenant: {
    id: 42,
    slug: "routing-studio",
    domain: "routing.example.com",
    status: "active" as const,
  },
  snapshotId: 9,
  snapshot,
}

describe("renderer active-domain routing contract", () => {
  it("normalizes public domains without assuming a TLD", () => {
    expect(normalizePublicDomainHost("WWW.Example.COM:443")).toBe("www.example.com")
    expect(normalizePublicDomainHost("zorg.example.nl.")).toBe("zorg.example.nl")
    expect(normalizePublicDomainHost("127.0.0.1")).toBeNull()
    expect(normalizePublicDomainHost("example.com,attacker.test")).toBeNull()
    expect(normalizePublicDomainHost("localhost")).toBeNull()
  })

  it("requires canonical and requested hosts in the explicit active allowlist", () => {
    expect(rendererActiveDomainRoutingSchema.safeParse(envelope.routing).success).toBe(true)
    expect(rendererActiveDomainRoutingSchema.safeParse({
      ...envelope.routing,
      activeHosts: ["routing.example.com"],
    }).success).toBe(false)
    expect(rendererActiveDomainRoutingSchema.safeParse({
      ...envelope.routing,
      activeHosts: ["routing.example.com", "routing.example.com"],
    }).success).toBe(false)
  })

  it("rejects cross-tenant and cross-domain snapshot envelopes", () => {
    expect(rendererSnapshotEnvelopeSchema.safeParse(envelope).success).toBe(true)
    expect(rendererSnapshotEnvelopeSchema.safeParse({
      ...envelope,
      snapshot: { ...snapshot, tenantId: "99" },
    }).success).toBe(false)
    expect(rendererSnapshotEnvelopeSchema.safeParse({
      ...envelope,
      snapshot: { ...snapshot, domain: "another.example.com" },
    }).success).toBe(false)
  })
})
