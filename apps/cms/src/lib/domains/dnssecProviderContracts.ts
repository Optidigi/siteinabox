import "server-only"

import { parseDsRecord } from "@/lib/domains/migrationSources/dnssecEvidence"

const readObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

const integer = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(String(value ?? ""))
  return Number.isSafeInteger(parsed) ? parsed : null
}

export type ParsedCloudflareDnssec = {
  status: "disabled" | "pending" | "active" | "unknown"
  flags: number | null
  algorithm: number | null
  publicKey: string | null
  ds: string | null
  dsTtl: number | null
}

export const parseCloudflareDnssec = (value: unknown): ParsedCloudflareDnssec => {
  const result = readObject(value)
  const providerStatus = typeof result.status === "string"
    ? result.status.trim().toLowerCase()
    : ""
  const rawDs = typeof result.ds === "string" ? result.ds.trim() : ""
  let ds: string | null = null
  let dsTtl: number | null = null
  if (rawDs) {
    const fields = rawDs.replace(/\s+/g, " ").split(" ")
    const dsIndex = fields.findIndex((field) => field.toUpperCase() === "DS")
    const rdata = dsIndex >= 0 ? fields.slice(dsIndex + 1) : fields
    const parsed = parseDsRecord(rdata.join(" "))
    ds = `${parsed.keyTag} ${parsed.algorithm} ${parsed.digestType} ${parsed.digest}`
    const ttl = dsIndex >= 2 && fields[dsIndex - 1]?.toUpperCase() === "IN"
      ? integer(fields[dsIndex - 2])
      : null
    dsTtl = ttl != null && ttl > 0 ? ttl : null
  }
  return {
    status: providerStatus === "active"
      ? "active"
      : ["pending", "pending-disabled"].includes(providerStatus)
        ? "pending"
        : providerStatus === "disabled"
          ? "disabled"
          : "unknown",
    flags: integer(result.flags),
    algorithm: integer(result.algorithm),
    publicKey: typeof result.public_key === "string" && result.public_key.trim()
      ? result.public_key.trim()
      : null,
    ds,
    dsTtl,
  }
}
