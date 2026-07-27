import { describe, expect, it, vi } from "vitest"

import {
  verifyAuthoritativeDns,
  verifyHttpsEndpoint,
  verifyParentDsAbsent,
} from "@/lib/domains/verification"

describe("enabled-TLD domain verification", () => {
  it("treats parent DS lookup only as DNSSEC preparation, never as zone acquisition", async () => {
    await expect(verifyParentDsAbsent("example.nl", {
      resolveDsImpl: vi.fn(async () => []),
    })).resolves.toEqual({
      status: "absent",
      records: [],
      reason: null,
    })
    await expect(verifyParentDsAbsent("example.nl", {
      resolveDsImpl: vi.fn(async () => [{
        keyTag: 12_345,
        algorithm: 13,
        digestType: 2,
        digest: "abcd",
      }]),
    })).resolves.toEqual({
      status: "present",
      records: ["12345 13 2 ABCD"],
      reason: "parent_ds_present",
    })
  })

  it.each(["example.nl", "example.be"])(
    "requires exact delegation and an SOA answer for %s",
    async (domain) => {
    const resolveSoa = vi.fn(async () => ({
      nsname: "ada.ns.cloudflare.com",
      hostmaster: "dns.cloudflare.com",
      serial: 1,
      refresh: 1,
      retry: 1,
      expire: 1,
      minttl: 1,
    }))
    const result = await verifyAuthoritativeDns(
      domain,
      ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      {
        resolveNsImpl: vi.fn(async () => [
          "bob.ns.cloudflare.com",
          "ada.ns.cloudflare.com",
        ]),
        resolve4Impl: vi.fn(async () => ["192.0.2.53"]),
        resolve6Impl: vi.fn(async () => []),
        resolverFactory: () => ({
          setServers: vi.fn(),
          resolveSoa,
        }),
      },
    )

    expect(result).toEqual({
      status: "verified",
      delegatedNameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      respondingNameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      reason: null,
    })
    expect(resolveSoa).toHaveBeenCalledWith(domain)
    },
  )

  it("persists an expected wait when public delegation does not match", async () => {
    await expect(verifyAuthoritativeDns(
      "example.nl",
      ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      {
        resolveNsImpl: vi.fn(async () => ["old.ns.example"]),
      },
    )).resolves.toEqual({
      status: "pending",
      delegatedNameServers: ["old.ns.example"],
      respondingNameServers: [],
      reason: "delegation_mismatch",
    })
  })

  it("waits until every assigned authoritative nameserver answers", async () => {
    const resolveSoa = vi.fn()
      .mockResolvedValueOnce({
        nsname: "ada.ns.cloudflare.com",
        hostmaster: "dns.cloudflare.com",
        serial: 1,
        refresh: 1,
        retry: 1,
        expire: 1,
        minttl: 1,
      })
      .mockRejectedValueOnce(new Error("nameserver unavailable"))
    await expect(verifyAuthoritativeDns(
      "example.nl",
      ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      {
        resolveNsImpl: vi.fn(async () => [
          "ada.ns.cloudflare.com",
          "bob.ns.cloudflare.com",
        ]),
        resolve4Impl: vi.fn(async () => ["192.0.2.53"]),
        resolve6Impl: vi.fn(async () => []),
        resolverFactory: () => ({
          setServers: vi.fn(),
          resolveSoa,
        }),
      },
    )).resolves.toEqual({
      status: "pending",
      delegatedNameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      respondingNameServers: ["ada.ns.cloudflare.com"],
      reason: "authoritative_nameservers_not_responding",
    })
  })

  it.each(["example.nl", "example.be"])(
    "treats a neutral renderer 404 as successful HTTPS transport evidence for %s",
    async (domain) => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }))
    await expect(verifyHttpsEndpoint(domain, {
      fetchImpl: fetchImpl as typeof fetch,
    })).resolves.toEqual({
      status: "verified",
      httpStatus: 404,
      reason: null,
    })
    expect(fetchImpl).toHaveBeenCalledWith(`https://${domain}/`, expect.objectContaining({
      method: "HEAD",
      redirect: "manual",
    }))
    },
  )
})
