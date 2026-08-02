import { describe, expect, it } from "vitest"
import type { CompleteZoneExport } from "@siteinabox/contracts/domain-migration"
import { tldCapabilityAt } from "@siteinabox/contracts/tld-capabilities"

import {
  assessExistingDomainMigrationInput,
  automaticMigrationSourceEnabled,
  gtldTransferEligibilityDeclarationRequired,
  inspectExistingDomainPublicEvidence,
  publicTransferBlockers,
  type ExistingDomainPublicEvidence,
} from "@/lib/domains/migrationCheckout"
import { dnskeyDsRecord } from "@/lib/domains/migrationSources/dnssecEvidence"
import { openCheckoutMigrationInput } from "@/lib/domains/migrationSecrets"

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
const env = {
  DOMAIN_MIGRATION_ENCRYPTION_KEY: ENCRYPTION_KEY,
  NODE_ENV: "test",
} as NodeJS.ProcessEnv

const zoneExport = (overrides: Partial<CompleteZoneExport> = {}): CompleteZoneExport => ({
  schemaVersion: 1,
  format: "siab-complete-zone-v1",
  domain: "example.nl",
  acquiredAt: "2026-07-28T09:00:00.000Z",
  authority: {
    mechanism: "customer_authorized_provider_export",
    provider: "legacy-provider",
    complete: true,
  },
  authoritativeNameservers: ["ns1.legacy.example", "ns2.legacy.example"],
  dnssec: { status: "unsigned", parentDsRecords: [] },
  records: [
    { type: "A", name: "example.nl", ttl: 300, content: "192.0.2.10" },
    {
      type: "MX",
      name: "example.nl",
      ttl: 3_600,
      priority: 10,
      target: "mail.example.net",
    },
    {
      type: "TLSA",
      name: "_25._tcp.mail.example.nl",
      ttl: 3_600,
      certificateUsage: 3,
      selector: 1,
      matchingType: 1,
      certificateAssociationData: "AA".repeat(32),
    },
  ],
  ...overrides,
})

const cloudflareSource = (zone: CompleteZoneExport) => ({
  mechanism: "cloudflare_api_v1" as const,
  zone,
  refreshCredential: {
    kind: "cloudflare_api_token" as const,
    token: "test-cloudflare-token-1234567890",
    zoneId: "a".repeat(32),
  },
})

describe("automatic migration source gates", () => {
  it.each([
    ["nameserver lookup", {
      resolveNsImpl: async () => {
        throw new Error("resolver unavailable")
      },
      resolveDsImpl: async () => [],
    }, "nameserver_lookup_failed"],
    ["parent DS lookup", {
      resolveNsImpl: async () => ["ns1.example.test"],
      resolveDsImpl: async () => {
        throw new Error("DS resolver unavailable")
      },
    }, "parent_ds_lookup_failed"],
  ] as const)("classifies a failed %s without weakening preflight safety", async (
    _label,
    resolvers,
    category,
  ) => {
    await expect(inspectExistingDomainPublicEvidence("example.nl", {
      ...resolvers,
      fetchImpl: (async () => new Response(null, { status: 404 })) as typeof fetch,
    })).rejects.toMatchObject({
      name: "ExistingDomainPublicEvidenceError",
      category,
    })
  })

  it("fails closed independently for each source mechanism", () => {
    const sourceEnv = {
      COMMERCE_MIGRATION_SOURCE_CLOUDFLARE_ENABLED: "1",
      COMMERCE_MIGRATION_SOURCE_AXFR_ENABLED: "0",
      COMMERCE_MIGRATION_SOURCE_PROVIDER_EXPORT_ENABLED: "",
    } as unknown as NodeJS.ProcessEnv
    expect(automaticMigrationSourceEnabled(
      "cloudflare_api_v1",
      sourceEnv,
    )).toBe(true)
    expect(automaticMigrationSourceEnabled(
      "authorized_axfr_v1",
      sourceEnv,
    )).toBe(false)
    expect(automaticMigrationSourceEnabled(
      "validated_provider_export_v1",
      sourceEnv,
    )).toBe(false)
  })

  it("detects providers on DNS-label boundaries and discovers registrars via IANA RDAP", async () => {
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input)
      if (url === "https://data.iana.org/rdap/dns.json") {
        return new Response(JSON.stringify({
          services: [
            [["nl"], ["https://rdap.example.test/"]],
            ["malformed"],
          ],
        }), { status: 200 })
      }
      if (url === "https://rdap.example.test/domain/example.nl") {
        return new Response(JSON.stringify({
          objectClassName: "domain",
          ldhName: "example.nl",
          status: [],
          entities: [{
            handle: "REGISTRAR-1",
            roles: ["registrar"],
            vcardArray: [
              "vcard",
              [["fn", {}, "text", "Example Registrar B.V."]],
            ],
          }],
        }), { status: 200 })
      }
      return new Response(null, { status: 404 })
    }
    const evidence = await inspectExistingDomainPublicEvidence("example.nl", {
      now: new Date("2026-07-30T10:00:00.000Z"),
      resolveNsImpl: async () => [
        "ADA.NS.CLOUDFLARE.COM",
        "bob.ns.cloudflare.com.",
        "cloudflare.com.attacker.example",
      ],
      resolveDsImpl: async () => [],
      fetchImpl: fetchImpl as typeof fetch,
    })

    expect(evidence).toMatchObject({
      probableDnsProvider: "cloudflare",
      registrar: "Example Registrar B.V.",
      authoritativeNameservers: [
        "ada.ns.cloudflare.com",
        "bob.ns.cloudflare.com",
        "cloudflare.com.attacker.example",
      ],
      registryStatuses: [],
      registryTransferEvidence: "confirmed",
      transferBlockers: [],
    })
  })

  it("surfaces RDAP transfer locks and the ICANN 60-day windows before source acquisition", async () => {
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input)
      if (url === "https://data.iana.org/rdap/dns.json") {
        return new Response(JSON.stringify({
          services: [[["com"], ["https://rdap.example.test/"]]],
        }), { status: 200 })
      }
      if (url === "https://rdap.example.test/domain/example.com") {
        return new Response(JSON.stringify({
          objectClassName: "domain",
          ldhName: "example.com",
          status: ["clientTransferProhibited", "active"],
          events: [
            {
              eventAction: "registration",
              eventDate: "2026-07-15T10:00:00.000Z",
            },
            {
              eventAction: "expiration",
              eventDate: "2027-07-15T10:00:00.000Z",
            },
          ],
        }), { status: 200 })
      }
      return new Response(null, { status: 404 })
    }

    const evidence = await inspectExistingDomainPublicEvidence("example.com", {
      now: new Date("2026-07-30T10:00:00.000Z"),
      resolveNsImpl: async () => ["ns1.example.test"],
      resolveDsImpl: async () => [],
      fetchImpl: fetchImpl as typeof fetch,
    })

    expect(evidence).toMatchObject({
      registryStatuses: ["active", "client transfer prohibited"],
      registeredAt: "2026-07-15T10:00:00.000Z",
      registryExpiryAt: "2027-07-15T10:00:00.000Z",
      registryTransferEvidence: "confirmed",
      transferBlockers: [
        "icann_initial_registration_60_day_eligibility_risk",
        "rdap_status:client_transfer_prohibited",
      ],
    })
  })

  it.each([
    ["empty response", {}],
    ["wrong domain", {
      objectClassName: "domain",
      ldhName: "other.example",
      status: [],
    }],
    ["invalid statuses", {
      objectClassName: "domain",
      ldhName: "example.com",
      status: "active",
    }],
    ["invalid events", {
      objectClassName: "domain",
      ldhName: "example.com",
      status: [],
      events: [{}],
    }],
  ])("fails closed for malformed RDAP evidence: %s", async (_label, rdap) => {
    const evidence = await inspectExistingDomainPublicEvidence("example.com", {
      now: new Date("2026-07-30T10:00:00.000Z"),
      resolveNsImpl: async () => ["ns1.example.test"],
      resolveDsImpl: async () => [],
      fetchImpl: (async (input: string | URL | Request) => {
        const url = String(input)
        if (url === "https://data.iana.org/rdap/dns.json") {
          return Response.json({
            services: [[["com"], ["https://rdap.example.test/"]]],
          })
        }
        if (url === "https://rdap.example.test/domain/example.com") {
          return Response.json(rdap)
        }
        return new Response(null, { status: 404 })
      }) as typeof fetch,
    })

    expect(evidence.registryTransferEvidence).toBe("unavailable")
    expect(evidence.transferBlockers).toContain(
      "rdap_transfer_evidence_unavailable",
    )
  })

  it("fails closed without ccTLD status evidence but does not add ICANN timing locks", () => {
    expect(publicTransferBlockers({
      tld: "nl",
      evidenceAvailable: false,
      statuses: [],
      registeredAt: "2026-07-15T10:00:00.000Z",
      lastTransferredAt: null,
      now: new Date("2026-07-30T10:00:00.000Z"),
    })).toEqual(["rdap_transfer_evidence_unavailable"])
  })

  it("normalizes transfer states and treats pending restore as a lifecycle blocker", () => {
    expect(publicTransferBlockers({
      tld: "com",
      evidenceAvailable: true,
      statuses: [
        "clientTransferProhibited",
        "server-transfer-prohibited",
        "https://icann.org/epp#pendingRestore",
      ],
      registeredAt: null,
      lastTransferredAt: null,
      now: new Date("2026-07-30T10:00:00.000Z"),
    })).toEqual([
      "rdap_status:client_transfer_prohibited",
      "rdap_status:pending_restore",
      "rdap_status:server_transfer_prohibited",
    ])
  })

  it("treats the exact ICANN 60-day boundary as no longer an unresolved timing risk", () => {
    expect(publicTransferBlockers({
      tld: "com",
      evidenceAvailable: true,
      statuses: [],
      registeredAt: "2026-06-01T10:00:00.000Z",
      lastTransferredAt: null,
      now: new Date("2026-07-31T10:00:00.000Z"),
    })).toEqual([])
  })

  it("requires the immutable eligibility declaration only for ICANN-policy gTLDs", () => {
    expect(gtldTransferEligibilityDeclarationRequired("com")).toBe(true)
    expect(gtldTransferEligibilityDeclarationRequired("shop")).toBe(true)
    expect(gtldTransferEligibilityDeclarationRequired("nl")).toBe(false)
    expect(gtldTransferEligibilityDeclarationRequired("be")).toBe(false)
  })

  it("fails closed when public RDAP transfer evidence is unavailable for a gTLD", async () => {
    const evidence = await inspectExistingDomainPublicEvidence("example.com", {
      now: new Date("2026-07-30T10:00:00.000Z"),
      resolveNsImpl: async () => ["ns1.example.test"],
      resolveDsImpl: async () => [],
      fetchImpl: (async () => new Response(null, { status: 404 })) as typeof fetch,
    })

    expect(evidence).toMatchObject({
      registryTransferEvidence: "unavailable",
      transferBlockers: ["rdap_transfer_evidence_unavailable"],
    })
  })
})

const publicEvidence = (
  overrides: Partial<ExistingDomainPublicEvidence> = {},
): ExistingDomainPublicEvidence => ({
  checkedAt: "2026-07-28T10:00:00.000Z",
  authoritativeNameservers: ["ns1.legacy.example", "ns2.legacy.example"],
  dnssecDsPresent: false,
  dnssecDsRecords: [],
  dnssecDsTtl: null,
  probableDnsProvider: "legacy-provider",
  registrar: "Example Registrar",
  supplementalOnly: true,
  ...overrides,
})

const assess = (
  input: Parameters<typeof assessExistingDomainMigrationInput>[0],
) => assessExistingDomainMigrationInput(input, {
  capabilityForTld: (tld, _operation, now) => {
    const capability = tldCapabilityAt(tld, now)
    return capability
      ? {
          ...capability,
          dnssec: {
            ...capability.dnssec,
            productionEvidenceComplete: true,
          },
        }
      : null
  },
})

describe("existing-domain checkout preflight", () => {
  it("freezes the gTLD eligibility declaration into encrypted migration evidence", () => {
    const comZone = zoneExport({
      domain: "example.com",
      authority: { mechanism: "cloudflare_api", provider: "cloudflare", complete: true },
      records: [{
        type: "A",
        name: "example.com",
        ttl: 300,
        content: "192.0.2.10",
      }],
    })
    const acquiredSource = cloudflareSource(comZone)
    const baseInput = {
      generationRunId: 500,
      domain: "example.com",
      zoneExport: comZone,
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      publicEvidence: publicEvidence({
        registryTransferEvidence: "confirmed",
        transferBlockers: [],
      }),
      acquiredSource,
      env,
      now: new Date("2026-07-28T10:00:00.000Z"),
    }

    expect(assess(baseInput)).toMatchObject({
      readiness: "unsupported",
      sourceZone: null,
      encryptedInput: null,
    })
    const accepted = assess({
      ...baseInput,
      gtldTransferEligibilityAccepted: true,
    })
    expect(accepted).toMatchObject({
      readiness: "ready_automatic",
      classification: "automatic",
    })
    expect(openCheckoutMigrationInput(
      accepted.encryptedInput!,
      500,
      "example.com",
      env,
    )).toMatchObject({
      gtldTransferEligibilityAccepted: true,
    })
  })

  it("stops before reading transfer secrets when public registry evidence is blocked", () => {
    const result = assess({
      generationRunId: 500,
      domain: "example.nl",
      zoneExport: zoneExport(),
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      publicEvidence: publicEvidence({
        transferBlockers: ["rdap_status:client_transfer_prohibited"],
      }),
      env,
      now: new Date("2026-07-28T10:00:00.000Z"),
    })

    expect(result).toMatchObject({
      readiness: "unsupported",
      classification: null,
      sourceZone: null,
      encryptedInput: null,
    })
  })

  it("issues automatic encrypted evidence only from a validated source adapter", () => {
    const acquiredZone = zoneExport({
      authority: { mechanism: "cloudflare_api", provider: "cloudflare", complete: true },
    })
    const acquiredSource = cloudflareSource(acquiredZone)
    const result = assess({
      generationRunId: 500,
      domain: "example.nl",
      zoneExport: acquiredZone,
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      publicEvidence: publicEvidence(),
      acquiredSource,
      env,
      now: new Date("2026-07-28T10:00:00.000Z"),
    })

    expect(result).toMatchObject({
      readiness: "ready_automatic",
      classification: "automatic",
      sourceZoneHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      encryptedInput: expect.stringMatching(/^v1\./),
    })
    const opened = openCheckoutMigrationInput(
      result.encryptedInput!,
      500,
      "example.nl",
      env,
    )
    expect(opened).toMatchObject({
      schemaVersion: 2,
      sourceMechanism: "cloudflare_api_v1",
      sourceRefreshCredential: {
        kind: "cloudflare_api_token",
        zoneId: "a".repeat(32),
      },
      transferCode: "opaque-transfer-code",
    })
  })

  it("stops a customer-asserted source before payment", () => {
    const result = assess({
      generationRunId: 500,
      domain: "example.nl",
      zoneExport: zoneExport(),
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      publicEvidence: publicEvidence(),
      env,
      now: new Date("2026-07-28T10:00:00.000Z"),
    })

    expect(result).toMatchObject({
      readiness: "unsupported",
      domain: "example.nl",
      classification: null,
      sourceZoneHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      encryptedInput: null,
    })
    expect(result.sourceZone?.records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "TLSA",
        certificateAssociationData: "aa".repeat(32),
        proxied: false,
      }),
    ]))
  })

  it("rejects a crafted retired provider-export adapter before payment", () => {
    const retiredZone = zoneExport({
      authority: {
        mechanism: "validated_provider_export",
        provider: "retired-provider",
        complete: true,
      },
    })
    const result = assess({
      generationRunId: 500,
      domain: "example.nl",
      zoneExport: retiredZone,
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      publicEvidence: publicEvidence(),
      acquiredSource: {
        mechanism: "validated_provider_export_v1",
        zone: retiredZone,
        refreshCredential: {
          kind: "provider_export",
          sourceSoaSerial: 2026072901,
        },
      } as never,
      env,
      now: new Date("2026-07-28T10:00:00.000Z"),
    })

    expect(result).toMatchObject({
      readiness: "unsupported",
      classification: null,
      encryptedInput: null,
      reason: "source_authority_mismatch",
    })
  })

  it("stops stale exports and signed DNSSEC before ordinary payment", () => {
    expect(assess({
      generationRunId: 500,
      domain: "example.nl",
      zoneExport: zoneExport(),
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      publicEvidence: publicEvidence({
        authoritativeNameservers: ["changed1.example", "changed2.example"],
      }),
      env,
      now: new Date("2026-07-28T10:00:00.000Z"),
    }).readiness).toBe("unsupported")

    expect(assess({
      generationRunId: 500,
      domain: "example.nl",
      zoneExport: zoneExport({
        dnssec: { status: "signed", parentDsRecords: ["12345 13 2 AABB"] },
      }),
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      publicEvidence: publicEvidence({ dnssecDsPresent: true }),
      env,
      now: new Date("2026-07-28T10:00:00.000Z"),
    }).readiness).toBe("unsupported")
  })

  it("accepts a complete cryptographically bound signed source for automation", () => {
    const key = {
      flags: 257,
      protocol: 3 as const,
      algorithm: 13,
      publicKey: "BAUG",
    }
    const ds = dnskeyDsRecord("example.nl", key, 2)
    const dsRecord = [
      ds.keyTag,
      ds.algorithm,
      ds.digestType,
      ds.digest,
    ].join(" ")
    const signedZone = zoneExport({
      authority: { mechanism: "cloudflare_api", provider: "cloudflare", complete: true },
      dnssec: {
        status: "signed",
        parentDsRecords: [dsRecord],
        parentDsTtl: 3600,
        dnsKeys: [key],
      },
    })
    expect(assess({
      generationRunId: 500,
      domain: "example.nl",
      zoneExport: signedZone,
      acquiredSource: cloudflareSource(signedZone),
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      publicEvidence: publicEvidence({
        dnssecDsPresent: true,
        dnssecDsRecords: [dsRecord],
        dnssecDsTtl: 3600,
      }),
      env,
      now: new Date("2026-07-28T10:00:00.000Z"),
    })).toMatchObject({
      readiness: "ready_automatic",
      classification: "automatic",
      encryptedInput: expect.any(String),
    })
  })

  it("stops zones that cannot fit the guaranteed destination quota before payment", () => {
    const acquiredZoneWith = (count: number) => zoneExport({
      authority: { mechanism: "cloudflare_api", provider: "cloudflare", complete: true },
      records: Array.from({ length: count }, (_, index) => ({
        type: "A" as const,
        name: `host-${index}.example.nl`,
        ttl: 300,
        content: "192.0.2.10",
      })),
    })
    const assessZone = (count: number) => {
      const acquiredZone = acquiredZoneWith(count)
      return assess({
        generationRunId: 500,
        domain: "example.nl",
        zoneExport: acquiredZone,
        transferCode: "opaque-transfer-code",
        transferAuthorizationAccepted: true,
        publicEvidence: publicEvidence(),
        acquiredSource: cloudflareSource(acquiredZone),
        env,
        now: new Date("2026-07-28T10:00:00.000Z"),
      })
    }
    expect(assessZone(198)).toMatchObject({
      readiness: "ready_automatic",
      classification: "automatic",
      encryptedInput: expect.any(String),
    })
    const result = assessZone(199)

    expect(result).toMatchObject({
      readiness: "unsupported",
      classification: null,
      encryptedInput: null,
    })
    expect(result.message).toContain("te veel records")
  })
})
