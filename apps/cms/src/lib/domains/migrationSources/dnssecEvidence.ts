import "server-only"

import { createHash } from "node:crypto"
import type { MigrationDnskey } from "@siteinabox/contracts/domain-migration"

export type NormalizedDsRecord = {
  keyTag: number
  algorithm: number
  digestType: 1 | 2 | 4
  digest: string
}

const canonicalDomainWire = (domain: string): Buffer => {
  const labels = domain.trim().toLowerCase().replace(/\.$/, "").split(".")
  if (labels.some((label) => label.length === 0 || Buffer.byteLength(label) > 63)) {
    throw new Error("DNSSEC owner name is invalid.")
  }
  return Buffer.concat([
    ...labels.map((label) => {
      const bytes = Buffer.from(label, "ascii")
      return Buffer.concat([Buffer.from([bytes.length]), bytes])
    }),
    Buffer.from([0]),
  ])
}

const dnskeyRdata = (key: MigrationDnskey): Buffer => {
  const publicKey = Buffer.from(key.publicKey.replace(/\s+/g, ""), "base64")
  if (publicKey.length === 0) throw new Error("DNSKEY public key is invalid.")
  const fixed = Buffer.alloc(4)
  fixed.writeUInt16BE(key.flags, 0)
  fixed.writeUInt8(key.protocol, 2)
  fixed.writeUInt8(key.algorithm, 3)
  return Buffer.concat([fixed, publicKey])
}

export const dnskeyKeyTag = (key: MigrationDnskey): number => {
  const rdata = dnskeyRdata(key)
  let accumulator = 0
  for (let index = 0; index < rdata.length; index += 1) {
    accumulator += index & 1 ? rdata[index]! : rdata[index]! << 8
  }
  accumulator += (accumulator >> 16) & 0xffff
  return accumulator & 0xffff
}

export const parseDsRecord = (value: string): NormalizedDsRecord => {
  const parts = value.trim().replace(/\s+/g, " ").split(" ")
  if (parts.length !== 4) throw new Error("Parent DS record is invalid.")
  const [keyTagText, algorithmText, digestTypeText, digestText] = parts
  const keyTag = Number(keyTagText)
  const algorithm = Number(algorithmText)
  const digestType = Number(digestTypeText)
  const digest = digestText?.toUpperCase() ?? ""
  if (
    !Number.isInteger(keyTag) ||
    keyTag < 0 ||
    keyTag > 65_535 ||
    !Number.isInteger(algorithm) ||
    algorithm < 1 ||
    algorithm > 255 ||
    ![1, 2, 4].includes(digestType) ||
    !/^[A-F0-9]+$/.test(digest)
  ) {
    throw new Error("Parent DS record is invalid.")
  }
  const expectedLength = digestType === 1 ? 40 : digestType === 2 ? 64 : 96
  if (digest.length !== expectedLength) throw new Error("Parent DS digest length is invalid.")
  return {
    keyTag,
    algorithm,
    digestType: digestType as 1 | 2 | 4,
    digest,
  }
}

export const dnskeyDsRecord = (
  domain: string,
  key: MigrationDnskey,
  digestType: 1 | 2 | 4,
): NormalizedDsRecord => {
  const algorithm = digestType === 1 ? "sha1" : digestType === 2 ? "sha256" : "sha384"
  const digest = createHash(algorithm)
    .update(Buffer.concat([canonicalDomainWire(domain), dnskeyRdata(key)]))
    .digest("hex")
    .toUpperCase()
  return {
    keyTag: dnskeyKeyTag(key),
    algorithm: key.algorithm,
    digestType,
    digest,
  }
}

export const validateSignedDnssecEvidence = (input: {
  domain: string
  parentDsRecords: string[]
  parentDsTtl: number | null
  dnsKeys: MigrationDnskey[]
}): { valid: true } | { valid: false; reason: string } => {
  if (
    input.parentDsRecords.length === 0 ||
    input.parentDsTtl == null ||
    input.parentDsTtl <= 0 ||
    input.dnsKeys.length === 0 ||
    input.dnsKeys.length > 4
  ) {
    return { valid: false, reason: "signed_dnssec_evidence_incomplete" }
  }
  try {
    const referenced = registrarDnskeysForDs(input)
    if (referenced.length === 0) {
      return { valid: false, reason: "parent_ds_has_no_supported_registrar_key" }
    }
    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error && error.message
        ? error.message
        : "signed_dnssec_evidence_invalid",
    }
  }
}

const OPENPROVIDER_SUPPORTED_DNSSEC_ALGORITHMS = new Set([6, 8, 10, 12, 13, 14])

export const registrarDnskeysForDs = (input: {
  domain: string
  parentDsRecords: string[]
  dnsKeys: MigrationDnskey[]
}): MigrationDnskey[] => {
  const referenced = new Map<string, MigrationDnskey>()
  try {
    const keys = input.dnsKeys.map((key) => ({
      key,
      keyTag: dnskeyKeyTag(key),
    }))
    for (const value of input.parentDsRecords) {
      const ds = parseDsRecord(value)
      const matchingKey = keys.find(
        ({ key, keyTag }) => keyTag === ds.keyTag && key.algorithm === ds.algorithm,
      )
      if (!matchingKey) throw new Error("parent_ds_has_no_matching_dnskey")
      if (
        matchingKey.key.flags !== 257 ||
        !OPENPROVIDER_SUPPORTED_DNSSEC_ALGORITHMS.has(matchingKey.key.algorithm)
      ) {
        throw new Error("parent_ds_references_unsupported_registrar_key")
      }
      const derived = dnskeyDsRecord(input.domain, matchingKey.key, ds.digestType)
      if (derived.digest !== ds.digest) {
        throw new Error("parent_ds_digest_mismatch")
      }
      referenced.set(
        `${matchingKey.key.flags}:${matchingKey.key.protocol}:${matchingKey.key.algorithm}:` +
          matchingKey.key.publicKey.replace(/\s+/g, ""),
        matchingKey.key,
      )
    }
    return [...referenced.values()]
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("parent_ds_")) throw error
    throw new Error("signed_dnssec_evidence_invalid")
  }
}
