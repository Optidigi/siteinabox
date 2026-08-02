import { describe, expect, it, vi } from "vitest"

import {
  verifyAuthoritativeDns,
  verifyDnssecChain,
  verifyHttpsEndpoint,
  verifyParentDsAbsent,
  verifyPreservedDnsRecords,
} from "@/lib/domains/verification"
import type { NormalizedMigrationDnsRecord } from "@siteinabox/contracts/domain-migration"

describe("enabled-TLD domain verification", () => {
  it("requires an authenticated DNSKEY and covering RRSIG from a validating resolver", async () => {
    const key = {
      flags: 257,
      protocol: 3 as const,
      algorithm: 13,
      publicKey: "AQID",
    }
    const parentDs = `12345 13 2 ${"AB".repeat(32)}`
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      Response.json(new URL(String(input)).searchParams.get("type") === "DS"
        ? {
            Status: 0,
            AD: true,
            Answer: [{ type: 43, TTL: 3600, data: parentDs }],
          }
        : {
            Status: 0,
            AD: true,
            Answer: [
              { type: 48, data: "257 3 13 AQID" },
              { type: 46, data: "48 13 2 3600 20300101000000 20260101000000 1 example.nl. signature" },
            ],
          }))
    await expect(verifyDnssecChain("example.nl", {
      ...key,
      parentDsRecords: [parentDs],
    }, {
      fetchImpl: fetchImpl as typeof fetch,
      resolverUrl: "https://resolver.test/dns-query",
    })).resolves.toEqual({
      status: "verified",
      authenticatedData: true,
      dnskeyMatched: true,
      rrsigPresent: true,
      parentDsMatched: true,
      parentDsTtl: 3600,
      reason: null,
    })
    await expect(verifyDnssecChain("example.nl", {
      ...key,
      parentDsRecords: [parentDs],
    }, {
      fetchImpl: vi.fn(async () => Response.json({
        Status: 0,
        AD: false,
        Answer: [{ type: 48, data: "257 3 13 AQID" }],
      })) as typeof fetch,
    })).resolves.toMatchObject({
      status: "pending",
      authenticatedData: false,
      rrsigPresent: false,
      parentDsMatched: false,
    })
  })

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

  it("requires matching DS evidence from every parent authority and recursion", async () => {
    const ds = [{
      keyTag: 12_345,
      algorithm: 13,
      digestType: 2,
      digest: "abcd",
    }]
    const authoritativeResolve = vi.fn(async () => ds)
    await expect(verifyParentDsAbsent("example.nl", {
      resolveParentNsImpl: vi.fn(async () => [
        "ns1.nic.nl",
        "ns2.nic.nl",
      ]),
      authoritativeDsLookupImpl: async () => ({
        records: await authoritativeResolve(),
        ttl: 86_400,
      }),
      resolveRecursiveDsImpl: vi.fn(async () => ds),
    })).resolves.toEqual({
      status: "present",
      records: ["12345 13 2 ABCD"],
      ttl: 86_400,
      reason: "parent_ds_present",
    })
    expect(authoritativeResolve).toHaveBeenCalledTimes(2)

    authoritativeResolve
      .mockResolvedValueOnce(ds)
      .mockResolvedValueOnce([])
    await expect(verifyParentDsAbsent("example.nl", {
      resolveParentNsImpl: vi.fn(async () => [
        "ns1.nic.nl",
        "ns2.nic.nl",
      ]),
      authoritativeDsLookupImpl: async () => ({
        records: await authoritativeResolve(),
        ttl: 86_400,
      }),
      resolveRecursiveDsImpl: vi.fn(async () => ds),
    })).resolves.toMatchObject({
      status: "indeterminate",
      reason: "parent_ds_authoritative_mismatch",
    })
  })

  it("uses the supported dig DS path for authoritative and recursive evidence", async () => {
    const lookup = vi.fn(async (input: {
      hostname: string
      nameserver?: string
      authoritative: boolean
    }) => ({
      records: [],
      ttl: null,
    }))

    await expect(verifyParentDsAbsent("example.nl", {
      resolveParentNsImpl: vi.fn(async () => [
        "ns1.nic.nl",
        "ns2.nic.nl",
      ]),
      digDsLookupImpl: lookup,
    })).resolves.toEqual({
      status: "absent",
      records: [],
      ttl: null,
      reason: null,
    })

    expect(lookup).toHaveBeenCalledWith({
      hostname: "example.nl",
      nameserver: "ns1.nic.nl",
      authoritative: true,
    })
    expect(lookup).toHaveBeenCalledWith({
      hostname: "example.nl",
      nameserver: "ns2.nic.nl",
      authoritative: true,
    })
    expect(lookup).toHaveBeenCalledWith({
      hostname: "example.nl",
      authoritative: false,
    })
  })

  it("keeps an unavailable DS lookup indeterminate", async () => {
    await expect(verifyParentDsAbsent("example.nl", {
      resolveParentNsImpl: vi.fn(async () => [
        "ns1.nic.nl",
        "ns2.nic.nl",
      ]),
      digDsLookupImpl: vi.fn(async () => {
        throw new Error("dns query failed")
      }),
    })).resolves.toMatchObject({
      status: "indeterminate",
      reason: "parent_ds_lookup_failed",
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
    "requires the renderer identity response for %s",
    async (domain) => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 200,
      headers: {
        "x-siab-service": "renderer",
        "x-siab-domain": domain,
      },
    }))
    await expect(verifyHttpsEndpoint(domain, {
      fetchImpl: fetchImpl as typeof fetch,
      expectedDomain: domain,
    })).resolves.toEqual({
      status: "verified",
      httpStatus: 200,
      reason: null,
    })
    expect(fetchImpl).toHaveBeenCalledWith(`https://${domain}/__siab/edge-check`, expect.objectContaining({
      method: "HEAD",
      redirect: "manual",
    }))
    },
  )

  it("requires semantically equivalent preserved records recursively and authoritatively", async () => {
    const records: NormalizedMigrationDnsRecord[] = [
      {
        type: "MX",
        name: "example.nl",
        ttl: 300,
        priority: 10,
        target: "mail.example.nl",
        proxied: false,
      },
      {
        type: "TXT",
        name: "selector._domainkey.example.nl",
        ttl: 300,
        content: "v=DKIM1; p=abcdef",
        proxied: false,
      },
      {
        type: "CAA",
        name: "example.nl",
        ttl: 300,
        flags: 0,
        tag: "issue",
        value: "letsencrypt.org",
        proxied: false,
      },
      {
        type: "SRV",
        name: "_sip._tcp.example.nl",
        ttl: 300,
        priority: 10,
        weight: 20,
        port: 5060,
        target: "sip.example.nl",
        proxied: false,
      },
      {
        type: "NS",
        name: "child.example.nl",
        ttl: 300,
        content: "ns.child.example.net",
        proxied: false,
      },
      {
        type: "A",
        name: "*.apps.example.nl",
        ttl: 300,
        content: "192.0.2.44",
        proxied: false,
      },
      {
        type: "TLSA",
        name: "_443._tcp.example.nl",
        ttl: 300,
        certificateUsage: 3,
        selector: 1,
        matchingType: 1,
        certificateAssociationData: "ab".repeat(32),
        proxied: false,
      },
    ]
    const answer = vi.fn(async (hostname: string, type: string) => {
      if (type === "MX") return [{ priority: 10, exchange: "MAIL.EXAMPLE.NL." }]
      if (type === "TXT") return [["v=DKIM1; ", "p=abcdef"]]
      if (type === "CAA") return [{ critical: 0, issue: "letsencrypt.org" }]
      if (type === "SRV") {
        return [{ priority: 10, weight: 20, port: 5060, name: "sip.example.nl." }]
      }
      if (type === "NS") return ["NS.CHILD.EXAMPLE.NET."]
      if (type === "A") {
        expect(hostname).toBe("siab-preservation-probe.apps.example.nl")
        return ["192.0.2.44"]
      }
      if (type === "TLSA") {
        return [{
          certUsage: 3,
          selector: 1,
          match: 1,
          data: Uint8Array.from(Buffer.from("ab".repeat(32), "hex")).buffer,
        }]
      }
      return []
    })

    await expect(verifyPreservedDnsRecords(
      records,
      ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      {
        recursiveResolveImpl: answer,
        authoritativeResolveImpl: vi.fn(async (_ns, hostname, type) =>
          answer(hostname, type)),
      },
    )).resolves.toEqual({
      status: "verified",
      recursiveEquivalent: true,
      authoritativeEquivalent: true,
      reason: null,
    })
  })

  it("blocks publication evidence on recursive or authoritative record drift", async () => {
    const records: NormalizedMigrationDnsRecord[] = [{
      type: "MX",
      name: "example.nl",
      ttl: 300,
      priority: 10,
      target: "mail.example.nl",
      proxied: false,
    }]
    await expect(verifyPreservedDnsRecords(records, ["ada.ns.cloudflare.com"], {
      recursiveResolveImpl: vi.fn(async () => [{
        priority: 20,
        exchange: "wrong.example.nl",
      }]),
      authoritativeResolveImpl: vi.fn(),
    })).resolves.toMatchObject({
      status: "pending",
      reason: "recursive_preserved_record_mismatch",
    })
    await expect(verifyPreservedDnsRecords(records, ["ada.ns.cloudflare.com"], {
      recursiveResolveImpl: vi.fn(async () => [{
        priority: 10,
        exchange: "mail.example.nl",
      }]),
      authoritativeResolveImpl: vi.fn(async () => [{
        priority: 20,
        exchange: "wrong.example.nl",
      }]),
    })).resolves.toMatchObject({
      status: "pending",
      recursiveEquivalent: true,
      authoritativeEquivalent: false,
      reason: "authoritative_preserved_record_mismatch",
    })
  })
})
