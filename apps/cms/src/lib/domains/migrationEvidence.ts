import "server-only"

import { createHash } from "node:crypto"

export const stableDomainMigrationEvidenceString = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(stableDomainMigrationEvidenceString).join(",")}]`
  }
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(
    (key) =>
      `${JSON.stringify(key)}:${stableDomainMigrationEvidenceString(record[key])}`,
  ).join(",")}}`
}

export const domainMigrationEvidenceHash = (value: unknown): string =>
  createHash("sha256").update(stableDomainMigrationEvidenceString(value)).digest("hex")

export const domainMigrationSourceAuthorityHash = (value: unknown): string => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return domainMigrationEvidenceHash(value)
  }
  const source = { ...(value as Record<string, unknown>) }
  delete source.acquiredAt
  return domainMigrationEvidenceHash(source)
}

export const domainMigrationSourceContentHash = (value: unknown): string => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return domainMigrationEvidenceHash(value)
  }
  const source = { ...(value as Record<string, unknown>) }
  delete source.acquiredAt
  const dnssec = source.dnssec
  if (dnssec && typeof dnssec === "object" && !Array.isArray(dnssec)) {
    const stableDnssec = { ...(dnssec as Record<string, unknown>) }
    delete stableDnssec.status
    delete stableDnssec.parentDsRecords
    delete stableDnssec.parentDsTtl
    source.dnssec = stableDnssec
  }
  return domainMigrationEvidenceHash(source)
}
