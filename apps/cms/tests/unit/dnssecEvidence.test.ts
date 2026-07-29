import { describe, expect, it } from "vitest"

import {
  dnskeyDsRecord,
  dnskeyKeyTag,
  parseDsRecord,
  registrarDnskeysForDs,
  validateSignedDnssecEvidence,
} from "@/lib/domains/migrationSources/dnssecEvidence"

const key = {
  flags: 257,
  protocol: 3 as const,
  algorithm: 13,
  publicKey: "AQID",
}

describe("DNSSEC migration evidence", () => {
  it("cryptographically binds frozen parent DS evidence to the source DNSKEY", () => {
    const derived = dnskeyDsRecord("example.nl", key, 2)
    const record = [
      derived.keyTag,
      derived.algorithm,
      derived.digestType,
      derived.digest,
    ].join(" ")
    expect(dnskeyKeyTag(key)).toBe(2064)
    expect(parseDsRecord(record)).toEqual(derived)
    expect(validateSignedDnssecEvidence({
      domain: "example.nl",
      parentDsRecords: [record],
      parentDsTtl: 3600,
      dnsKeys: [key],
    })).toEqual({ valid: true })
    expect(validateSignedDnssecEvidence({
      domain: "example.nl",
      parentDsRecords: [record.replace(/.$/, "0")],
      parentDsTtl: 3600,
      dnsKeys: [key],
    })).toEqual({ valid: false, reason: "parent_ds_digest_mismatch" })
  })

  it("submits only supported KSKs referenced by the frozen parent DS", () => {
    const ksk = { ...key, publicKey: "BAUG" }
    const zsk = { ...key, flags: 256, publicKey: "BwgJ" }
    const derived = dnskeyDsRecord("example.nl", ksk, 2)
    const record = [
      derived.keyTag,
      derived.algorithm,
      derived.digestType,
      derived.digest,
    ].join(" ")
    expect(registrarDnskeysForDs({
      domain: "example.nl",
      parentDsRecords: [record],
      dnsKeys: [ksk, zsk],
    })).toEqual([ksk])

    const zskDs = dnskeyDsRecord("example.nl", zsk, 2)
    expect(validateSignedDnssecEvidence({
      domain: "example.nl",
      parentDsRecords: [[
        zskDs.keyTag,
        zskDs.algorithm,
        zskDs.digestType,
        zskDs.digest,
      ].join(" ")],
      parentDsTtl: 3600,
      dnsKeys: [zsk],
    })).toEqual({
      valid: false,
      reason: "parent_ds_references_unsupported_registrar_key",
    })
  })
})
