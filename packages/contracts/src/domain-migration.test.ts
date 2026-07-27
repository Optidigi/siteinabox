import { describe, expect, it } from "vitest"

import {
  buildAutomaticMigrationTargetZone,
  buildDnssecPreparationPlan,
  completeZoneExportSchema,
  normalizeCompleteZone,
  semanticZoneComparison,
} from "./domain-migration"

const source = {
  schemaVersion: 1,
  format: "siab-complete-zone-v1",
  domain: "example.nl",
  acquiredAt: "2026-07-28T08:00:00.000Z",
  authority: {
    mechanism: "customer_authorized_provider_export",
    provider: "legacy-dns",
    complete: true,
  },
  authoritativeNameservers: ["NS2.LEGACY.EXAMPLE.", "ns1.legacy.example"],
  dnssec: {
    status: "unsigned",
    parentDsRecords: [],
  },
  records: [
    { type: "A", name: "example.nl.", ttl: 300, content: "192.0.2.10" },
    { type: "CNAME", name: "www.example.nl", ttl: 300, content: "example.nl." },
    { type: "MX", name: "example.nl", ttl: 3600, priority: 10, target: "mail.example.net." },
    { type: "TXT", name: "example.nl", ttl: 3600, content: "v=spf1 include:_spf.example.net ~all" },
    { type: "TXT", name: "_dmarc.example.nl", ttl: 3600, content: "v=DMARC1; p=reject" },
    { type: "CNAME", name: "selector._domainkey.example.nl", ttl: 3600, content: "dkim.example.net." },
    { type: "CAA", name: "example.nl", ttl: 3600, flags: 0, tag: "issue", value: "letsencrypt.org" },
    {
      type: "SRV",
      name: "_sip._tcp.example.nl",
      ttl: 3600,
      priority: 10,
      weight: 20,
      port: 5060,
      target: "sip.example.net.",
    },
    { type: "NS", name: "shop.example.nl", ttl: 3600, content: "ns1.shop-host.example." },
  ],
} as const

describe("automatic existing-domain zone contracts", () => {
  it("requires an explicitly complete authoritative source and rejects public enumeration", () => {
    expect(completeZoneExportSchema.parse(source).authority).toMatchObject({
      mechanism: "customer_authorized_provider_export",
      complete: true,
    })
    expect(completeZoneExportSchema.safeParse({
      ...source,
      authority: {
        mechanism: "public_dns_enumeration",
        provider: "resolver",
        complete: true,
      },
    }).success).toBe(false)
    expect(completeZoneExportSchema.safeParse({
      ...source,
      authority: { ...source.authority, complete: false },
    }).success).toBe(false)
    expect(completeZoneExportSchema.safeParse({
      ...source,
      records: [{ type: "A", name: "example.nl", ttl: 300, content: "not-an-ip" }],
    }).success).toBe(false)
  })

  it("replaces only apex/www website address records and preserves mail and services", () => {
    const normalized = normalizeCompleteZone(source)
    const target = buildAutomaticMigrationTargetZone(normalized, {
      rendererTargetHost: "renderer.siteinabox.nl",
    })

    expect(target.records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "CNAME",
        name: "example.nl",
        content: "renderer.siteinabox.nl",
        proxied: true,
      }),
      expect.objectContaining({
        type: "CNAME",
        name: "www.example.nl",
        content: "example.nl",
        proxied: true,
      }),
      expect.objectContaining({ type: "MX", priority: 10, target: "mail.example.net" }),
      expect.objectContaining({ type: "TXT", name: "_dmarc.example.nl" }),
      expect.objectContaining({ type: "CNAME", name: "selector._domainkey.example.nl" }),
      expect.objectContaining({ type: "CAA", value: "letsencrypt.org" }),
      expect.objectContaining({ type: "SRV", target: "sip.example.net" }),
      expect.objectContaining({ type: "NS", name: "shop.example.nl" }),
    ]))
    expect(target.records).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "A", name: "example.nl", content: "192.0.2.10" }),
    ]))
  })

  it("compares zone behavior independently of order, case, trailing dots and TTL", () => {
    const expected = normalizeCompleteZone(source).records
    const actual = normalizeCompleteZone({
      ...source,
      authoritativeNameservers: [...source.authoritativeNameservers].reverse(),
      records: [...source.records].reverse().map((record) => ({
        ...record,
        name: record.name.toUpperCase(),
        ttl: 86400,
      })),
    }).records

    expect(semanticZoneComparison(expected, actual)).toEqual({
      equivalent: true,
      missing: [],
      unexpected: [],
    })
  })

  it("freezes an unsigned DNSSEC plan and blocks cutover while a parent DS remains", () => {
    expect(buildDnssecPreparationPlan({
      sourceStatus: "unsigned",
      parentDsRecords: [],
      checkedAt: "2026-07-28T08:05:00.000Z",
    })).toMatchObject({
      sourceStatus: "unsigned",
      preCutoverAction: "verify_parent_ds_absent",
      cutoverReady: true,
      targetMode: "remain_unsigned",
    })
    expect(buildDnssecPreparationPlan({
      sourceStatus: "unsigned",
      parentDsRecords: ["12345 13 2 ABCD"],
      checkedAt: "2026-07-28T08:05:00.000Z",
    })).toMatchObject({
      cutoverReady: false,
      customerAction: "remove_dnssec_ds",
    })
  })
})
