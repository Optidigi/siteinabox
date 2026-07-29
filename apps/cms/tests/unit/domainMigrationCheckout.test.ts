import { describe, expect, it } from "vitest"
import type { CompleteZoneExport } from "@siteinabox/contracts/domain-migration"
import { tldCapabilityAt } from "@siteinabox/contracts/tld-capabilities"

import {
  assessExistingDomainMigrationInput,
  automaticMigrationSourceEnabled,
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

describe("automatic migration source gates", () => {
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
  it("issues automatic encrypted evidence only from a validated source adapter", () => {
    const acquiredZone = zoneExport({
      authority: {
        mechanism: "validated_provider_export",
        provider: "legacy-provider",
        complete: true,
      },
    })
    const acquiredSource = {
      mechanism: "validated_provider_export_v1" as const,
      zone: acquiredZone,
      refreshCredential: {
        kind: "provider_export" as const,
        sourceSoaSerial: 2026072901,
      },
    }
    const result = assess({
      generationRunId: 500,
      domain: "example.nl",
      zoneExport: acquiredZone,
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      requestedAssistance: false,
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
      sourceMechanism: "validated_provider_export_v1",
      sourceRefreshCredential: {
        kind: "provider_export",
        sourceSoaSerial: 2026072901,
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
      requestedAssistance: false,
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

  it("does not revive assisted checkout when the browser requests it", () => {
    const result = assess({
      generationRunId: 500,
      domain: "example.nl",
      zoneExport: zoneExport(),
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      requestedAssistance: true,
      publicEvidence: publicEvidence(),
      env,
      now: new Date("2026-07-28T10:00:00.000Z"),
    })

    expect(result).toMatchObject({
      readiness: "unsupported",
      classification: null,
      encryptedInput: null,
    })
  })

  it("stops stale exports and signed DNSSEC before ordinary payment", () => {
    expect(assess({
      generationRunId: 500,
      domain: "example.nl",
      zoneExport: zoneExport(),
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      requestedAssistance: false,
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
      requestedAssistance: false,
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
      authority: {
        mechanism: "validated_provider_export",
        provider: "legacy-provider",
        complete: true,
      },
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
      acquiredSource: {
        mechanism: "validated_provider_export_v1",
        zone: signedZone,
        refreshCredential: {
          kind: "provider_export",
          sourceSoaSerial: 2026072901,
        },
      },
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      requestedAssistance: false,
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
      authority: {
        mechanism: "validated_provider_export",
        provider: "legacy-provider",
        complete: true,
      },
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
        requestedAssistance: false,
        publicEvidence: publicEvidence(),
        acquiredSource: {
          mechanism: "validated_provider_export_v1",
          zone: acquiredZone,
          refreshCredential: {
            kind: "provider_export",
            sourceSoaSerial: 2026072901,
          },
        },
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
