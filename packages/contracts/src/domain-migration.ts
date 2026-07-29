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
  proxied: z.boolean().optional(),
}

export const migrationDnskeySchema = z.object({
  flags: z.number().int().min(0).max(65_535),
  protocol: z.literal(3),
  algorithm: z.number().int().min(1).max(255),
  publicKey: z.string().trim().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(4_096),
}).strict()
export type MigrationDnskey = z.infer<typeof migrationDnskeySchema>

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

const tlsaRecordSchema = z.object({
  ...commonRecordFields,
  type: z.literal("TLSA"),
  certificateUsage: z.number().int().min(0).max(3),
  selector: z.number().int().min(0).max(1),
  matchingType: z.number().int().min(0).max(2),
  certificateAssociationData: z.string().trim().regex(/^[a-fA-F0-9]+$/).max(16_384),
}).strict()

export const migrationDnsRecordSchema = z.discriminatedUnion("type", [
  aRecordSchema,
  aaaaRecordSchema,
  nameRecordSchema,
  txtRecordSchema,
  mxRecordSchema,
  caaRecordSchema,
  srvRecordSchema,
  tlsaRecordSchema,
])

export type MigrationDnsRecord = z.infer<typeof migrationDnsRecordSchema>

export const migrationSourceMechanisms = [
  "customer_authorized_provider_export_v1",
  "cloudflare_api_v1",
  "authorized_axfr_v1",
  "validated_provider_export_v1",
] as const

export const migrationSourceMechanismSchema = z.enum(migrationSourceMechanisms)
export type MigrationSourceMechanism = z.infer<typeof migrationSourceMechanismSchema>

export const completeZoneExportSchema = z.object({
  schemaVersion: z.literal(1),
  format: z.literal("siab-complete-zone-v1"),
  domain: z.string().trim().toLowerCase().regex(DOMAIN_PATTERN),
  acquiredAt: z.iso.datetime(),
  authority: z.object({
    mechanism: z.enum([
      "customer_authorized_provider_export",
      "cloudflare_api",
      "authorized_axfr",
      "validated_provider_export",
    ]),
    provider: z.string().trim().min(1).max(100),
    complete: z.literal(true),
  }).strict(),
  authoritativeNameservers: z.array(targetNameSchema).min(2).max(13),
  dnssec: z.object({
    status: z.enum(["unsigned", "signed"]),
    parentDsRecords: z.array(z.string().trim().min(1).max(1_024)).max(20),
    parentDsTtl: z.number().int().min(1).max(604_800).nullable().default(null),
    dnsKeys: z.array(migrationDnskeySchema).max(4).default([]),
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
    if (
      record.type === "TLSA" &&
      (
        record.certificateAssociationData.length % 2 !== 0 ||
        (
          record.matchingType === 1 &&
          record.certificateAssociationData.length !== 64
        ) ||
        (
          record.matchingType === 2 &&
          record.certificateAssociationData.length !== 128
        )
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["records", index, "certificateAssociationData"],
        message: "TLSA association data length must match its selected matching type.",
      })
    }
  })
  const byName = new Map<string, Set<string>>()
  zone.records.forEach((record) => {
    const name = record.name === "@" ? domain : canonicalName(record.name)
    const types = byName.get(name) ?? new Set<string>()
    types.add(record.type)
    byName.set(name, types)
  })
  for (const [name, types] of byName) {
    // Cloudflare flattens an apex CNAME/ALIAS while preserving apex MX/TXT.
    // Ordinary non-apex CNAME coexistence remains invalid.
    if (name !== domain && types.has("CNAME") && types.size > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["records"],
        message: `CNAME ${name} conflicts with another record type.`,
      })
    }
  }
  if (zone.dnssec.status === "unsigned" && zone.dnssec.parentDsRecords.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["dnssec", "parentDsRecords"],
      message: "An unsigned source export cannot declare parent DS records.",
    })
  }
})

export type CompleteZoneExport = z.input<typeof completeZoneExportSchema>
type ParsedCompleteZoneExport = z.output<typeof completeZoneExportSchema>

export type NormalizedMigrationDnsRecord = MigrationDnsRecord & {
  proxied: boolean
}

export type NormalizedCompleteZone = Omit<
  ParsedCompleteZoneExport,
  "authoritativeNameservers" | "records"
> & {
  authoritativeNameservers: string[]
  records: NormalizedMigrationDnsRecord[]
}

const canonicalName = (value: string): string =>
  value.trim().toLowerCase().replace(/\.$/, "")

const normalizeTxtContent = (value: string): string => {
  const trimmed = value.trim()
  const chunks = [...trimmed.matchAll(/"((?:\\.|[^"])*)"/g)]
  if (
    chunks.length === 0 ||
    chunks.map((match) => match[0]).join(" ") !== trimmed.replace(/\s+/g, " ")
  ) {
    return value
  }
  return chunks.map((match) =>
    match[1]!.replace(/\\"/g, "\"").replace(/\\\\/g, "\\")).join("")
}

const normalizeRecord = (
  record: MigrationDnsRecord,
  domain: string,
): NormalizedMigrationDnsRecord => {
  const name = record.name === "@" ? domain : canonicalName(record.name)
  const proxied = record.proxied ?? false
  if (record.type === "CNAME" || record.type === "NS") {
    return { ...record, name, content: canonicalName(record.content), proxied }
  }
  if (record.type === "MX") {
    return { ...record, name, target: canonicalName(record.target), proxied }
  }
  if (record.type === "SRV") {
    return { ...record, name, target: canonicalName(record.target), proxied }
  }
  if (record.type === "CAA") {
    return { ...record, name, tag: record.tag.toLowerCase(), proxied }
  }
  if (record.type === "AAAA") {
    return { ...record, name, content: record.content.toLowerCase(), proxied }
  }
  if (record.type === "TXT") {
    return { ...record, name, content: normalizeTxtContent(record.content), proxied }
  }
  if (record.type === "TLSA") {
    return {
      ...record,
      name,
      certificateAssociationData: record.certificateAssociationData.toLowerCase(),
      proxied,
    }
  }
  return { ...record, name, proxied }
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
  if (record.type === "TLSA") {
    return JSON.stringify([
      ...common,
      record.certificateUsage,
      record.selector,
      record.matchingType,
      record.certificateAssociationData,
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
          content: rendererTargetHost as string,
          proxied: true,
        },
      ]
  return {
    ...source,
    records: uniqueSortedRecords([
      ...source.records
        .filter((record) => !isWebsiteAddressRecord(record, source.domain))
        .map((record) => ({ ...record, proxied: false })),
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
  const expectedByKey = new Map(expected.map((record) => [semanticRecordKey(record), record]))
  const actualByKey = new Map(actual.map((record) => [semanticRecordKey(record), record]))
  const ttlEquivalent = (
    expectedTtl: number,
    actualTtl: number,
  ): boolean =>
    Math.abs(expectedTtl - actualTtl) <= Math.max(
      60,
      Math.round(expectedTtl * 0.2),
    )
  const ttlMismatches = [...expectedKeys].filter((key) => {
    const expectedRecord = expectedByKey.get(key)
    const actualRecord = actualByKey.get(key)
    return expectedRecord && actualRecord
      ? !ttlEquivalent(expectedRecord.ttl, actualRecord.ttl)
      : false
  })
  const missing = [
    ...[...expectedKeys].filter((key) => !actualKeys.has(key)),
    ...ttlMismatches.map((key) => `${key}:ttl`),
  ].sort()
  const unexpected = [
    ...[...actualKeys].filter((key) => !expectedKeys.has(key)),
    ...ttlMismatches.map((key) => `${key}:ttl`),
  ].sort()
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
  parentDsTtl: number | null
  dnsKeys: MigrationDnskey[]
  cutoverReady: boolean
  customerAction: null
  targetMode: "enable_after_cutover"
}

export function buildDnssecPreparationPlan(input: {
  sourceStatus: "unsigned" | "signed"
  parentDsRecords: string[]
  parentDsTtl?: number | null
  dnsKeys?: MigrationDnskey[]
  checkedAt: string
}): DnssecPreparationPlan {
  const parentDsRecords = [...new Set(input.parentDsRecords.map((record) => record.trim()))]
    .filter(Boolean)
    .sort()
  const dnsKeys = input.dnsKeys ?? []
  const signedEvidenceComplete = input.sourceStatus === "signed" &&
    parentDsRecords.length > 0 &&
    input.parentDsTtl != null &&
    dnsKeys.length > 0
  const cutoverReady = (
    input.sourceStatus === "unsigned" && parentDsRecords.length === 0
  ) || signedEvidenceComplete
  return {
    sourceStatus: input.sourceStatus,
    preCutoverAction: input.sourceStatus === "signed"
      ? "remove_parent_ds"
      : "verify_parent_ds_absent",
    parentDsRecords,
    parentDsTtl: input.parentDsTtl ?? null,
    dnsKeys,
    checkedAt: input.checkedAt,
    cutoverReady,
    customerAction: null,
    targetMode: "enable_after_cutover",
  }
}
