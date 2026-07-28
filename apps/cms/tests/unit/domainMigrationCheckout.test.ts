import { describe, expect, it } from "vitest"
import type { CompleteZoneExport } from "@siteinabox/contracts/domain-migration"
import { getEnabledTldCapability } from "@siteinabox/contracts/tld-capabilities"

import {
  assessExistingDomainMigrationInput,
  type ExistingDomainPublicEvidence,
} from "@/lib/domains/migrationCheckout"
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

const publicEvidence = (
  overrides: Partial<ExistingDomainPublicEvidence> = {},
): ExistingDomainPublicEvidence => ({
  checkedAt: "2026-07-28T10:00:00.000Z",
  authoritativeNameservers: ["ns1.legacy.example", "ns2.legacy.example"],
  dnssecDsPresent: false,
  probableDnsProvider: "legacy-provider",
  registrar: "Example Registrar",
  supplementalOnly: true,
  ...overrides,
})

const assess = (
  input: Parameters<typeof assessExistingDomainMigrationInput>[0],
) => assessExistingDomainMigrationInput(input, {
  capabilityForTld: (tld, now) => {
    const capability = getEnabledTldCapability(tld, now)
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
  it("requires assisted review for a customer-asserted complete source", () => {
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
      readiness: "ready_assisted",
      domain: "example.nl",
      classification: "assisted_standard",
      sourceZoneHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(result.encryptedInput).not.toContain("opaque-transfer-code")
    const opened = openCheckoutMigrationInput(
      result.encryptedInput!,
      500,
      "example.nl",
      env,
    )
    expect(opened.transferCode).toBe("opaque-transfer-code")
    expect(opened.normalizedSourceZone.records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "TLSA",
        certificateAssociationData: "aa".repeat(32),
        proxied: false,
      }),
    ]))
  })

  it("freezes the EUR 49 assisted classification separately", () => {
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
      readiness: "ready_assisted",
      classification: "assisted_standard",
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
    }).readiness).toBe("custom_quote")
  })
})
