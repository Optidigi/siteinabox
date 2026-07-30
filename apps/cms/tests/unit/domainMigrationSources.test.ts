import { describe, expect, it, vi } from "vitest"
import {
  buildAutomaticMigrationTargetZone,
  normalizeCompleteZone,
  type CompleteZoneExport,
} from "@siteinabox/contracts/domain-migration"
import {
  domainMigrationSourceAuthorityHash,
  domainMigrationSourceContentHash,
} from "@/lib/domains/migrationEvidence"
import {
  acquireAuthorizedAxfr,
} from "@/lib/domains/migrationSources/axfr"
import {
  acquireCloudflareSource,
} from "@/lib/domains/migrationSources/cloudflare"
import {
  acquireValidatedProviderExport,
  parseBindZone,
} from "@/lib/domains/migrationSources/providerExport"
import {
  MigrationSourceChangedError,
  MigrationSourceDnssecTransitionPendingError,
  refreshAutomaticMigrationSource,
} from "@/lib/domains/migrationSources/refresh"
import type {
  AutomaticCheckoutMigrationInput,
} from "@/lib/domains/migrationSecrets"
import { MigrationSourceAuthorizationError } from "@/lib/domains/migrationSources/types"

const BIND_ZONE = `
$ORIGIN example.nl.
$TTL 3600
@ IN SOA ns1.provider.example. hostmaster.example.nl. (
  2026072901 3600 900 1209600 300
)
@ IN NS ns1.provider.example.
@ IN NS ns2.provider.example.
@ 300 IN A 192.0.2.10
@ IN MX 10 mail.example.net.
@ IN TXT "v=spf1 " "include:_spf.example.net ~all"
selector._domainkey IN TXT "v=DKIM1; p=abc"
_dmarc IN TXT "v=DMARC1; p=reject"
_sip._tcp IN SRV 10 20 5060 sip.example.net.
shop IN NS ns1.shop-host.example.
*.preview 300 IN CNAME example.nl.
mx IN A 192.0.2.20
paren IN TXT "literal(parentheses)"
a IN A 192.0.2.21
txt IN TXT "owner-is-a-type"
srv IN A 192.0.2.22
escaped IN TXT "left\\;right\\032value"
`

const publicEvidence = {
  checkedAt: "2026-07-29T10:00:00.000Z",
  authoritativeNameservers: [
    "ns1.provider.example",
    "ns2.provider.example",
  ],
  dnssecDsPresent: false,
  dnssecDsRecords: [],
  dnssecDsTtl: null,
  probableDnsProvider: "example",
  registrar: "Example Registrar",
  supplementalOnly: true as const,
}

const acquiredExport = () => acquireValidatedProviderExport({
  domain: "example.nl",
  provider: "example-provider",
  bindText: BIND_ZONE,
  publicEvidence,
  now: new Date("2026-07-29T10:00:00.000Z"),
})

const checkoutInput = async (
  acquiredInput?: Awaited<ReturnType<typeof acquiredExport>>,
): Promise<AutomaticCheckoutMigrationInput> => {
  const acquired = acquiredInput ?? await acquiredExport()
  return {
  schemaVersion: 2,
  generationRunId: "500",
  domain: "example.nl",
  classification: "automatic",
  sourceMechanism: acquired.mechanism,
  sourceZoneHash: domainMigrationSourceAuthorityHash(
    normalizeCompleteZone(acquired.zone),
  ),
  sourceZone: acquired.zone,
  sourceRefreshCredential: acquired.refreshCredential,
  transferCode: "opaque-epp",
  transferAuthorizationAccepted: true,
  }
}

describe("complete migration source acquisition", () => {
  it("extracts apex DNSKEY evidence without importing DNSSEC proof records", () => {
    const parsed = parseBindZone(
      `${BIND_ZONE}
@ 3600 IN DNSKEY 257 3 13 BAUG
@ 3600 IN RRSIG DNSKEY 13 2 3600 20300101000000 20260101000000 1 example.nl. signature
`,
      "example.nl",
    )
    expect(parsed.dnsKeys).toEqual([{
      flags: 257,
      protocol: 3,
      algorithm: 13,
      publicKey: "BAUG",
    }])
    expect(parsed.records.some((record) =>
      ["DNSKEY", "RRSIG"].includes(record.type))).toBe(false)
  })

  it("parses a complete BIND export and preserves service records semantically", () => {
    const result = parseBindZone(BIND_ZONE, "example.nl")

    expect(result.soaSerial).toBe(2026072901)
    expect(result.authoritativeNameservers).toEqual([
      "ns1.provider.example",
      "ns2.provider.example",
    ])
    expect(result.records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "TXT",
        name: "example.nl",
        content: "v=spf1 include:_spf.example.net ~all",
      }),
      expect.objectContaining({
        type: "NS",
        name: "shop.example.nl",
        content: "ns1.shop-host.example",
      }),
      expect.objectContaining({
        type: "CNAME",
        name: "*.preview.example.nl",
      }),
      expect.objectContaining({
        type: "A",
        name: "mx.example.nl",
        content: "192.0.2.20",
      }),
      expect.objectContaining({
        type: "TXT",
        name: "paren.example.nl",
        content: "literal(parentheses)",
      }),
      expect.objectContaining({
        type: "TXT",
        name: "escaped.example.nl",
        content: "left;right value",
      }),
      expect.objectContaining({
        type: "A",
        name: "a.example.nl",
      }),
      expect.objectContaining({
        type: "TXT",
        name: "txt.example.nl",
      }),
      expect.objectContaining({
        type: "A",
        name: "srv.example.nl",
      }),
    ]))
  })

  it("rejects partial, external, generated, and authority-mismatched exports", async () => {
    expect(() => parseBindZone(
      BIND_ZONE.replace("@ IN NS ns2.provider.example.", ""),
      "example.nl",
    )).toThrow("at least two apex nameservers")
    expect(() => parseBindZone(
      `${BIND_ZONE}\nevil.example.org. IN A 192.0.2.20`,
      "example.nl",
    )).toThrow("outside the selected domain")
    expect(() => parseBindZone(
      `${BIND_ZONE}\n$INCLUDE secrets.zone`,
      "example.nl",
    )).toThrow("unsupported external directives")
    await expect(acquireValidatedProviderExport({
      domain: "example.nl",
      provider: "example-provider",
      bindText: BIND_ZONE,
      publicEvidence: {
        ...publicEvidence,
        authoritativeNameservers: ["ns1.changed.example", "ns2.changed.example"],
      },
    })).rejects.toThrow("do not match current public authority")
  })

  it("requires a matching opening and closing SOA for AXFR evidence", () => {
    expect(() => parseBindZone(
      BIND_ZONE,
      "example.nl",
      { requireAxfrEnvelope: true },
    )).toThrow("opening and closing SOA")
    expect(() => parseBindZone(
      `${BIND_ZONE}\n@ IN SOA ns1.provider.example. hostmaster.example.nl. 2026072901 3600 900 1209600 300`,
      "example.nl",
      { requireAxfrEnvelope: true },
    )).not.toThrow()
    expect(() => parseBindZone(
      `${BIND_ZONE}\n@ IN SOA ns1.provider.example. hostmaster.example.nl. 2026072902 3600 900 1209600 300`,
      "example.nl",
      { requireAxfrEnvelope: true },
    )).toThrow("opening and closing SOA")
  })

  it("uses only the explicit customer Cloudflare token and requires stable captures", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer customer-zone-read-token",
      })
      if (url.includes("/dns_records?")) {
        return Response.json({
          success: true,
          result: [{
            id: "record-1",
            type: "A",
            name: "blog.example.nl",
            ttl: 3600,
            content: "192.0.2.15",
            proxied: true,
          }],
          result_info: {
            page: 1,
            total_pages: 1,
            total_count: 1,
          },
        })
      }
      if (url.endsWith("/dnssec")) {
        return Response.json({
          success: true,
          result: { status: "disabled" },
        })
      }
      return Response.json({
        success: true,
        result: [{
          id: "zone-1",
          name: "example.nl",
          status: "active",
          name_servers: publicEvidence.authoritativeNameservers,
        }],
      })
    })

    const acquired = await acquireCloudflareSource({
      domain: "example.nl",
      token: "customer-zone-read-token",
      options: {
        fetchImpl: fetchImpl as typeof fetch,
        apiBaseUrl: "https://cloudflare.test/client/v4",
        now: () => new Date("2026-07-29T10:00:00.000Z"),
      },
    })

    expect(acquired).toMatchObject({
      mechanism: "cloudflare_api_v1",
      refreshCredential: {
        kind: "cloudflare_api_token",
        token: "customer-zone-read-token",
        zoneId: "zone-1",
      },
      zone: {
        records: [
          expect.objectContaining({
            type: "A",
            name: "blog.example.nl",
            proxied: true,
          }),
        ],
      },
    })
    const source = normalizeCompleteZone(acquired.zone)
    expect(buildAutomaticMigrationTargetZone(source, {
      rendererTargetHost: "renderer.internal.example",
    }).records).toContainEqual(expect.objectContaining({
      type: "A",
      name: "blog.example.nl",
      proxied: false,
    }))
    expect(fetchImpl).toHaveBeenCalledTimes(6)
  })

  it("fails closed on malformed Cloudflare pagination without looping", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/dns_records?")) {
        return Response.json({
          success: true,
          result: [],
          result_info: { page: 1, total_pages: 0, total_count: 0 },
        })
      }
      return Response.json({
        success: true,
        result: [{
          id: "zone-1",
          name: "example.nl",
          status: "active",
          name_servers: publicEvidence.authoritativeNameservers,
        }],
      })
    })
    await expect(acquireCloudflareSource({
      domain: "example.nl",
      token: "customer-zone-read-token",
      options: {
        fetchImpl: fetchImpl as typeof fetch,
        apiBaseUrl: "https://cloudflare.test/client/v4",
      },
    })).rejects.toThrow("pagination")
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("bounds stalled Cloudflare source reads", async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason)
        }, { once: true })
      }))
    await expect(acquireCloudflareSource({
      domain: "example.nl",
      token: "customer-zone-read-token",
      options: {
        fetchImpl: fetchImpl as typeof fetch,
        apiBaseUrl: "https://cloudflare.test/client/v4",
        requestTimeoutMs: 5,
      },
    })).rejects.toBeTruthy()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("classifies revoked Cloudflare and AXFR authority for customer reauthorization", async () => {
    await expect(acquireCloudflareSource({
      domain: "example.nl",
      token: "customer-zone-read-token",
      options: {
        fetchImpl: vi.fn(async () => new Response("forbidden", {
          status: 403,
        })) as typeof fetch,
        apiBaseUrl: "https://cloudflare.test/client/v4",
      },
    })).rejects.toBeInstanceOf(MigrationSourceAuthorizationError)

    const transferFailure = Object.assign(new Error("dig failed"), {
      stdout: "; Transfer failed.",
      stderr: "",
    })
    await expect(acquireAuthorizedAxfr({
      domain: "example.nl",
      nameserver: "ns1.provider.example",
      publicEvidence,
      options: {
        resolve4Impl: vi.fn(async () => ["8.8.8.8"]) as never,
        resolve6Impl: vi.fn(async () => []) as never,
        execFileImpl: vi.fn(async () => {
          throw transferFailure
        }) as never,
      },
    })).rejects.toBeInstanceOf(MigrationSourceAuthorizationError)
  })

  it("rejects AXFR through private or non-authoritative endpoints before dig", async () => {
    const execFileImpl = vi.fn()
    await expect(acquireAuthorizedAxfr({
      domain: "example.nl",
      nameserver: "ns1.provider.example",
      publicEvidence,
      options: {
        resolve4Impl: vi.fn(async () => ["127.0.0.1"]) as never,
        resolve6Impl: vi.fn(async () => []) as never,
        execFileImpl: execFileImpl as never,
      },
    })).rejects.toThrow("public")
    await expect(acquireAuthorizedAxfr({
      domain: "example.nl",
      nameserver: "attacker.example",
      publicEvidence,
      options: { execFileImpl: execFileImpl as never },
    })).rejects.toThrow("current authoritative")
    expect(execFileImpl).not.toHaveBeenCalled()
  })

  it.each([
    "192.0.2.10",
    "198.51.100.10",
    "203.0.113.10",
    "::1",
    "::ffff:127.0.0.1",
    "fe80::1",
    "fd00::1",
    "2001:db8::1",
  ])("rejects special-use AXFR endpoint %s before dig", async (address) => {
    const execFileImpl = vi.fn()
    await expect(acquireAuthorizedAxfr({
      domain: "example.nl",
      nameserver: address,
      publicEvidence: {
        ...publicEvidence,
        authoritativeNameservers: [address, "ns2.provider.example"],
      },
      options: { execFileImpl: execFileImpl as never },
    })).rejects.toThrow("public")
    expect(execFileImpl).not.toHaveBeenCalled()
  })

  it("refreshes provider exports from live authority and stops changed sources", async () => {
    const input = await checkoutInput()
    await expect(refreshAutomaticMigrationSource(input, {
      inspectPublicEvidence: vi.fn(async () => publicEvidence),
      resolveSoaImpl: vi.fn(async () => ({
        nsname: "ns1.provider.example",
        hostmaster: "hostmaster.example.nl",
        serial: 2026072901,
        refresh: 3600,
        retry: 900,
        expire: 1209600,
        minttl: 300,
      })),
    })).resolves.toEqual(input.sourceZone)

    await expect(refreshAutomaticMigrationSource(input, {
      inspectPublicEvidence: vi.fn(async () => publicEvidence),
      resolveSoaImpl: vi.fn(async () => ({
        nsname: "ns1.provider.example",
        hostmaster: "hostmaster.example.nl",
        serial: 2026072902,
        refresh: 3600,
        retry: 900,
        expire: 1209600,
        minttl: 300,
      })),
    })).rejects.toBeInstanceOf(MigrationSourceChangedError)
  })

  it("allows only the governed parent-DS delta in content comparison", async () => {
    const input = await checkoutInput()
    const source = {
      ...normalizeCompleteZone(input.sourceZone),
      dnssec: {
        status: "signed" as const,
        parentDsRecords: ["12345 13 2 " + "AB".repeat(32)],
        parentDsTtl: 3600,
        dnsKeys: [{
          flags: 257,
          protocol: 3 as const,
          algorithm: 13,
          publicKey: "BAUG",
        }],
      },
    }
    const afterDsRemoval = {
      ...source,
      dnssec: {
        ...source.dnssec,
        status: "unsigned",
        parentDsRecords: [],
        parentDsTtl: null,
      },
    }
    expect(domainMigrationSourceAuthorityHash(afterDsRemoval))
      .not.toBe(domainMigrationSourceAuthorityHash(source))
    expect(domainMigrationSourceContentHash(afterDsRemoval))
      .toBe(domainMigrationSourceContentHash(source))
    expect(domainMigrationSourceContentHash({
      ...afterDsRemoval,
      records: afterDsRemoval.records.map((record, index) =>
        index === 0 && "content" in record
          ? { ...record, content: "192.0.2.99" }
          : record),
    })).not.toBe(domainMigrationSourceContentHash(source))
  })

  it("uses fresh public DS evidence for Cloudflare refresh and scopes DS relaxation", async () => {
    const base = await checkoutInput()
    const acceptedZone = {
      ...base.sourceZone,
      authority: {
        mechanism: "cloudflare_api" as const,
        provider: "cloudflare",
        complete: true as const,
      },
      dnssec: {
        status: "signed" as const,
        parentDsRecords: ["12345 13 2 " + "AB".repeat(32)],
        parentDsTtl: 3600,
        dnsKeys: [{
          flags: 257,
          protocol: 3 as const,
          algorithm: 13,
          publicKey: "BAUG",
        }],
      },
    }
    const normalized = normalizeCompleteZone(acceptedZone)
    const input = {
      domain: "example.nl",
      sourceMechanism: "cloudflare_api_v1" as const,
      sourceZoneHash: domainMigrationSourceAuthorityHash(normalized),
      sourceContentHash: domainMigrationSourceContentHash(normalized),
      sourceZone: acceptedZone,
      sourceRefreshCredential: {
        kind: "cloudflare_api_token" as const,
        token: "scoped-cloudflare-token",
        zoneId: "a".repeat(32),
      },
    }
    const changedEvidence = {
      ...publicEvidence,
      dnssecDsPresent: true,
      dnssecDsRecords: ["54321 13 2 " + "CD".repeat(32)],
      dnssecDsTtl: 7200,
    }
    const inspectChanged = vi.fn(async () => changedEvidence)
    const acquireChanged = vi.fn(async (request: {
      publicEvidence?: typeof changedEvidence
    }) => ({
      mechanism: "cloudflare_api_v1" as const,
      refreshCredential: input.sourceRefreshCredential,
      zone: {
        ...acceptedZone,
        dnssec: {
          ...acceptedZone.dnssec,
          parentDsRecords: changedEvidence.dnssecDsRecords,
          parentDsTtl: changedEvidence.dnssecDsTtl,
        },
      },
    }))

    await expect(refreshAutomaticMigrationSource(input, {
      inspectPublicEvidence: inspectChanged,
      acquireCloudflareSource: acquireChanged as never,
    })).rejects.toBeInstanceOf(MigrationSourceChangedError)
    expect(acquireChanged).toHaveBeenCalledWith(expect.objectContaining({
      publicEvidence: changedEvidence,
    }))
    await expect(refreshAutomaticMigrationSource(input, {
      inspectPublicEvidence: inspectChanged,
      acquireCloudflareSource: acquireChanged as never,
    }, "stable_content_after_dnssec_transition")).rejects.toBeInstanceOf(
      MigrationSourceDnssecTransitionPendingError,
    )
    const acquireAxfr = vi.fn()
    await expect(refreshAutomaticMigrationSource({
      ...input,
      sourceMechanism: "authorized_axfr_v1",
      sourceRefreshCredential: {
        kind: "authorized_axfr",
        nameserver: "ns1.provider.example",
        tsigName: null,
        tsigSecret: null,
      },
    }, {
      inspectPublicEvidence: inspectChanged,
      acquireAuthorizedAxfr: acquireAxfr as never,
    }, "stable_content_after_dnssec_transition")).rejects.toBeInstanceOf(
      MigrationSourceDnssecTransitionPendingError,
    )
    expect(acquireAxfr).not.toHaveBeenCalled()

    const absentEvidence = {
      ...publicEvidence,
      dnssecDsPresent: false,
      dnssecDsRecords: [],
      dnssecDsTtl: null,
    }
    await expect(refreshAutomaticMigrationSource(input, {
      inspectPublicEvidence: vi.fn(async () => absentEvidence),
      acquireCloudflareSource: vi.fn(async () => ({
        mechanism: "cloudflare_api_v1" as const,
        refreshCredential: input.sourceRefreshCredential,
        zone: {
          ...acceptedZone,
          dnssec: {
            ...acceptedZone.dnssec,
            status: "unsigned" as const,
            parentDsRecords: [],
            parentDsTtl: null,
          },
        },
      })) as never,
    }, "stable_content_after_dnssec_transition")).resolves.toBeDefined()
  })
})
