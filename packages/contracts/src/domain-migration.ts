import { z } from "zod"

const DOMAIN_PATTERN =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/
const RECORD_NAME_PATTERN =
  /^(\*\.)?([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?\.?$/i

const ttlSchema = z.number().int().min(1).max(86_400)
const recordNameSchema = z.string().trim().min(1).max(255).refine(
  (value) => value === "@" || RECORD_NAME_PATTERN.test(value),
  "DNS record names must be @ or absolute names.",
)
const targetNameSchema = z.string().trim().min(1).max(255).refine(
  (value) => RECORD_NAME_PATTERN.test(value),
  "DNS targets must be absolute names.",
)
const commonRecordFields = {
  name: recordNameSchema,
  ttl: ttlSchema,
}

const aRecordSchema = z.object({
  ...commonRecordFields,
  type: z.literal("A"),
  content: z.ipv4(),
}).strict()

const aaaaRecordSchema = z.object({
  ...commonRecordFields,
  type: z.literal("AAAA"),
  content: z.ipv6(),
}).strict()

const nameRecordSchema = z.object({
  ...commonRecordFields,
  type: z.enum(["CNAME", "NS"]),
  content: targetNameSchema,
}).strict()

const txtRecordSchema = z.object({
  ...commonRecordFields,
  type: z.literal("TXT"),
  content: z.string().max(16_384),
}).strict()

const mxRecordSchema = z.object({
  ...commonRecordFields,
  type: z.literal("MX"),
  priority: z.number().int().min(0).max(65_535),
  target: targetNameSchema,
}).strict()

const caaRecordSchema = z.object({
  ...commonRecordFields,
  type: z.literal("CAA"),
  flags: z.number().int().min(0).max(255),
  tag: z.string().trim().min(1).max(15),
  value: z.string().trim().min(1).max(255),
}).strict()

const srvRecordSchema = z.object({
  ...commonRecordFields,
  type: z.literal("SRV"),
  priority: z.number().int().min(0).max(65_535),
  weight: z.number().int().min(0).max(65_535),
  port: z.number().int().min(0).max(65_535),
  target: targetNameSchema,
}).strict()

export const migrationDnsRecordSchema = z.discriminatedUnion("type", [
  aRecordSchema,
  aaaaRecordSchema,
  nameRecordSchema,
  txtRecordSchema,
  mxRecordSchema,
  caaRecordSchema,
  srvRecordSchema,
])

export type MigrationDnsRecord = z.infer<typeof migrationDnsRecordSchema>

export const completeZoneExportSchema = z.object({
  schemaVersion: z.literal(1),
  format: z.literal("siab-complete-zone-v1"),
  domain: z.string().trim().toLowerCase().regex(DOMAIN_PATTERN),
  acquiredAt: z.iso.datetime(),
  authority: z.object({
    mechanism: z.literal("customer_authorized_provider_export"),
    provider: z.string().trim().min(1).max(100),
    complete: z.literal(true),
  }).strict(),
  authoritativeNameservers: z.array(targetNameSchema).min(2).max(13),
  dnssec: z.object({
    status: z.enum(["unsigned", "signed"]),
    parentDsRecords: z.array(z.string().trim().min(1).max(1_024)).max(20),
  }).strict(),
  records: z.array(migrationDnsRecordSchema).min(1).max(500),
}).strict().superRefine((zone, ctx) => {
  const domain = canonicalName(zone.domain)
  const nameservers = new Set(zone.authoritativeNameservers.map(canonicalName))
  if (nameservers.size !== zone.authoritativeNameservers.length) {
    ctx.addIssue({
      code: "custom",
      path: ["authoritativeNameservers"],
      message: "Authoritative nameservers must be unique.",
    })
  }
  zone.records.forEach((record, index) => {
    const name = record.name === "@" ? domain : canonicalName(record.name)
    if (name !== domain && !name.endsWith(`.${domain}`)) {
      ctx.addIssue({
        code: "custom",
        path: ["records", index, "name"],
        message: "Every record owner must be inside the exported zone.",
      })
    }
    if (record.type === "NS" && name === domain) {
      ctx.addIssue({
        code: "custom",
        path: ["records", index],
        message: "Apex NS records belong in authoritativeNameservers, not records.",
      })
    }
  })
  if (zone.dnssec.status === "unsigned" && zone.dnssec.parentDsRecords.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["dnssec", "parentDsRecords"],
      message: "An unsigned source export cannot declare parent DS records.",
    })
  }
})

export type CompleteZoneExport = z.infer<typeof completeZoneExportSchema>

export type NormalizedMigrationDnsRecord = MigrationDnsRecord & {
  proxied: boolean
}

export type NormalizedCompleteZone = Omit<
  CompleteZoneExport,
  "authoritativeNameservers" | "records"
> & {
  authoritativeNameservers: string[]
  records: NormalizedMigrationDnsRecord[]
}

const canonicalName = (value: string): string =>
  value.trim().toLowerCase().replace(/\.$/, "")

const normalizeRecord = (
  record: MigrationDnsRecord,
  domain: string,
): NormalizedMigrationDnsRecord => {
  const name = record.name === "@" ? domain : canonicalName(record.name)
  if (record.type === "CNAME" || record.type === "NS") {
    return { ...record, name, content: canonicalName(record.content), proxied: false }
  }
  if (record.type === "MX") {
    return { ...record, name, target: canonicalName(record.target), proxied: false }
  }
  if (record.type === "SRV") {
    return { ...record, name, target: canonicalName(record.target), proxied: false }
  }
  if (record.type === "CAA") {
    return { ...record, name, tag: record.tag.toLowerCase(), proxied: false }
  }
  if (record.type === "AAAA") {
    return { ...record, name, content: record.content.toLowerCase(), proxied: false }
  }
  return { ...record, name, proxied: false }
}

const semanticRecordKey = (record: NormalizedMigrationDnsRecord): string => {
  const common = [record.type, record.name, record.proxied ? "proxied" : "dns-only"]
  if (record.type === "MX") {
    return JSON.stringify([...common, record.priority, record.target])
  }
  if (record.type === "CAA") {
    return JSON.stringify([...common, record.flags, record.tag, record.value])
  }
  if (record.type === "SRV") {
    return JSON.stringify([
      ...common,
      record.priority,
      record.weight,
      record.port,
      record.target,
    ])
  }
  return JSON.stringify([...common, record.content])
}

const uniqueSortedRecords = (
  records: NormalizedMigrationDnsRecord[],
): NormalizedMigrationDnsRecord[] => {
  const byKey = new Map<string, NormalizedMigrationDnsRecord>()
  for (const record of records) byKey.set(semanticRecordKey(record), record)
  return [...byKey.values()].sort((left, right) =>
    semanticRecordKey(left).localeCompare(semanticRecordKey(right)))
}

export function normalizeCompleteZone(input: unknown): NormalizedCompleteZone {
  const zone = completeZoneExportSchema.parse(input)
  const domain = canonicalName(zone.domain)
  return {
    ...zone,
    domain,
    authoritativeNameservers: [...new Set(
      zone.authoritativeNameservers.map(canonicalName),
    )].sort(),
    records: uniqueSortedRecords(zone.records.map((record) => normalizeRecord(record, domain))),
  }
}

const isWebsiteAddressRecord = (
  record: NormalizedMigrationDnsRecord,
  domain: string,
): boolean =>
  ["A", "AAAA", "CNAME"].includes(record.type) &&
  (record.name === domain || record.name === `www.${domain}`)

export function buildAutomaticMigrationTargetZone(
  source: NormalizedCompleteZone,
  target: { rendererTargetHost?: string; rendererTargetIp?: string },
): NormalizedCompleteZone {
  const rendererTargetHost = target.rendererTargetHost
    ? canonicalName(target.rendererTargetHost)
    : null
  const rendererTargetIp = target.rendererTargetIp?.trim() || null
  if (!rendererTargetHost && !rendererTargetIp) {
    throw new Error("An automatic migration target requires a renderer hostname or IP.")
  }
  if (rendererTargetIp && !z.ipv4().safeParse(rendererTargetIp).success) {
    throw new Error("The automatic migration renderer IP must be a valid IPv4 address.")
  }
  const websiteRecords: NormalizedMigrationDnsRecord[] = rendererTargetIp
    ? [
        {
          type: "A",
          name: source.domain,
          ttl: 300,
          content: rendererTargetIp,
          proxied: true,
        },
        {
          type: "CNAME",
          name: `www.${source.domain}`,
          ttl: 300,
          content: source.domain,
          proxied: true,
        },
      ]
    : [
        {
          type: "CNAME",
          name: source.domain,
          ttl: 300,
          content: rendererTargetHost as string,
          proxied: true,
        },
        {
          type: "CNAME",
          name: `www.${source.domain}`,
          ttl: 300,
          content: source.domain,
          proxied: true,
        },
      ]
  return {
    ...source,
    records: uniqueSortedRecords([
      ...source.records.filter((record) => !isWebsiteAddressRecord(record, source.domain)),
      ...websiteRecords,
    ]),
  }
}

export type SemanticZoneComparison = {
  equivalent: boolean
  missing: string[]
  unexpected: string[]
}

export function semanticZoneComparison(
  expected: NormalizedMigrationDnsRecord[],
  actual: NormalizedMigrationDnsRecord[],
): SemanticZoneComparison {
  const expectedKeys = new Set(expected.map(semanticRecordKey))
  const actualKeys = new Set(actual.map(semanticRecordKey))
  const missing = [...expectedKeys].filter((key) => !actualKeys.has(key)).sort()
  const unexpected = [...actualKeys].filter((key) => !expectedKeys.has(key)).sort()
  return {
    equivalent: missing.length === 0 && unexpected.length === 0,
    missing,
    unexpected,
  }
}

export type DnssecPreparationPlan = {
  sourceStatus: "unsigned" | "signed"
  preCutoverAction: "verify_parent_ds_absent" | "remove_parent_ds"
  parentDsRecords: string[]
  checkedAt: string
  cutoverReady: boolean
  customerAction: "remove_dnssec_ds" | null
  targetMode: "remain_unsigned"
}

export function buildDnssecPreparationPlan(input: {
  sourceStatus: "unsigned" | "signed"
  parentDsRecords: string[]
  checkedAt: string
}): DnssecPreparationPlan {
  const parentDsRecords = [...new Set(input.parentDsRecords.map((record) => record.trim()))]
    .filter(Boolean)
    .sort()
  const cutoverReady = input.sourceStatus === "unsigned" && parentDsRecords.length === 0
  return {
    sourceStatus: input.sourceStatus,
    preCutoverAction: cutoverReady ? "verify_parent_ds_absent" : "remove_parent_ds",
    parentDsRecords,
    checkedAt: input.checkedAt,
    cutoverReady,
    customerAction: cutoverReady ? null : "remove_dnssec_ds",
    targetMode: "remain_unsigned",
  }
}
