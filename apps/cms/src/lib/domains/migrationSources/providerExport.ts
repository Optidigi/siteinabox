import "server-only"

import { execFile as execFileCallback } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import {
  completeZoneExportSchema,
  type CompleteZoneExport,
  type MigrationDnskey,
  type MigrationDnsRecord,
} from "@siteinabox/contracts/domain-migration"
import { splitDomain } from "@/lib/domains/normalize"
import type {
  AcquiredMigrationSource,
  MigrationSourcePublicEvidence,
} from "./types"

const execFile = promisify(execFileCallback)

type BindValidationOptions = {
  execFileImpl?: typeof execFile
  validatorPath?: string
}

const supportedTypes = new Set([
  "A",
  "AAAA",
  "CNAME",
  "NS",
  "TXT",
  "MX",
  "CAA",
  "SRV",
  "TLSA",
  "DNSKEY",
  "RRSIG",
  "NSEC",
  "NSEC3",
  "NSEC3PARAM",
  "SOA",
])

const canonical = (value: string): string =>
  value.trim().toLowerCase().replace(/\.$/, "")

const absoluteName = (value: string, domain: string): string => {
  if (value.includes("\\")) {
    throw new Error("Zone export contains an escaped DNS name that cannot be preserved safely.")
  }
  if (value === "@") return domain
  return value.endsWith(".")
    ? canonical(value)
    : canonical(`${value}.${domain}`)
}

const stripComment = (line: string): string => {
  let quoted = false
  let escaped = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!
    if (escaped) {
      escaped = false
      continue
    }
    if (character === "\\") {
      escaped = true
      continue
    }
    if (character === "\"") quoted = !quoted
    if (character === ";" && !quoted) return line.slice(0, index)
  }
  return line
}

const logicalLines = (text: string): Array<{ text: string; inheritedOwner: boolean }> => {
  const result: Array<{ text: string; inheritedOwner: boolean }> = []
  let current = ""
  let inheritedOwner = false
  let depth = 0
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const withoutComment = stripComment(raw)
    if (!current) inheritedOwner = /^\s/.test(withoutComment)
    let sanitized = ""
    let quoted = false
    let escaped = false
    for (const character of withoutComment) {
      if (escaped) {
        sanitized += character
        escaped = false
        continue
      }
      if (character === "\\") {
        sanitized += character
        escaped = true
        continue
      }
      if (character === "\"") {
        quoted = !quoted
        sanitized += character
        continue
      }
      if (!quoted && character === "(") {
        depth += 1
        sanitized += " "
        continue
      }
      if (!quoted && character === ")") {
        depth -= 1
        sanitized += " "
        continue
      }
      sanitized += character
    }
    current += `${current ? " " : ""}${sanitized.trim()}`
    if (depth < 0) throw new Error("Zone export contains unmatched parentheses.")
    if (depth === 0 && current.trim()) {
      result.push({
        text: current.replace(/\s+/g, " ").trim(),
        inheritedOwner,
      })
      current = ""
    }
  }
  if (depth !== 0 || current.trim()) {
    throw new Error("Zone export contains an incomplete multiline record.")
  }
  return result
}

const tokens = (line: string): string[] => {
  const values: string[] = []
  let value = ""
  let quoted = false
  let escaped = false
  for (const character of line) {
    if (escaped) {
      value += character
      escaped = false
      continue
    }
    if (character === "\\") {
      value += character
      escaped = true
      continue
    }
    if (character === "\"") {
      quoted = !quoted
      value += character
      continue
    }
    if (/\s/.test(character) && !quoted) {
      if (value) values.push(value)
      value = ""
      continue
    }
    value += character
  }
  if (quoted) throw new Error("Zone export contains an unterminated quoted string.")
  if (value) values.push(value)
  return values
}

const integer = (value: string | undefined, field: string, maximum = 65_535): number => {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new Error(`Zone export ${field} is invalid.`)
  }
  return parsed
}

const decodeMasterFileText = (input: string): string => {
  const value = input.startsWith("\"") && input.endsWith("\"")
    ? input.slice(1, -1)
    : input
  let decoded = ""
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!
    if (character !== "\\") {
      decoded += character
      continue
    }
    const decimal = value.slice(index + 1, index + 4)
    if (/^\d{3}$/.test(decimal)) {
      const code = Number(decimal)
      if (code < 32 || code > 126) {
        throw new Error("Zone export contains binary text that cannot be preserved safely.")
      }
      decoded += String.fromCharCode(code)
      index += 3
      continue
    }
    const escaped = value[index + 1]
    if (!escaped) throw new Error("Zone export contains an incomplete escape.")
    decoded += escaped
    index += 1
  }
  return decoded
}

const txtContent = (values: string[]): string =>
  values.map(decodeMasterFileText).join("")

const parseRecord = (
  type: string,
  owner: string,
  ttl: number,
  data: string[],
  domain: string,
): MigrationDnsRecord | null => {
  if (type === "SOA") return null
  if (type === "A" || type === "AAAA") {
    return { type, name: owner, ttl, content: data[0] ?? "" }
  }
  if (type === "CNAME" || type === "NS") {
    return { type, name: owner, ttl, content: absoluteName(data[0] ?? "", domain) }
  }
  if (type === "TXT") return { type, name: owner, ttl, content: txtContent(data) }
  if (type === "MX") {
    return {
      type,
      name: owner,
      ttl,
      priority: integer(data[0], "MX priority"),
      target: absoluteName(data[1] ?? "", domain),
    }
  }
  if (type === "CAA") {
    return {
      type,
      name: owner,
      ttl,
      flags: integer(data[0], "CAA flags", 255),
      tag: (data[1] ?? "").replace(/^"|"$/g, ""),
      value: txtContent(data.slice(2)),
    }
  }
  if (type === "SRV") {
    return {
      type,
      name: owner,
      ttl,
      priority: integer(data[0], "SRV priority"),
      weight: integer(data[1], "SRV weight"),
      port: integer(data[2], "SRV port"),
      target: absoluteName(data[3] ?? "", domain),
    }
  }
  if (type === "TLSA") {
    return {
      type,
      name: owner,
      ttl,
      certificateUsage: integer(data[0], "TLSA certificate usage", 3),
      selector: integer(data[1], "TLSA selector", 1),
      matchingType: integer(data[2], "TLSA matching type", 2),
      certificateAssociationData: data.slice(3).join(""),
    }
  }
  throw new Error(`Zone export record type ${type} is unsupported.`)
}

export type ParsedBindZone = {
  records: MigrationDnsRecord[]
  authoritativeNameservers: string[]
  soaSerial: number
  dnsKeys: MigrationDnskey[]
}

export function parseBindZone(
  text: string,
  domainInput: string,
  options: { requireAxfrEnvelope?: boolean } = {},
): ParsedBindZone {
  if (Buffer.byteLength(text, "utf8") > 256 * 1_024) {
    throw new Error("Zone export exceeds 256 KiB.")
  }
  if (/^\s*\$(INCLUDE|GENERATE)\b/im.test(text)) {
    throw new Error("Zone export includes unsupported external directives.")
  }
  const domain = splitDomain(domainInput).domain
  let origin = domain
  let defaultTtl = 3_600
  let priorOwner = domain
  const records: MigrationDnsRecord[] = []
  const dnsKeys: MigrationDnskey[] = []
  const apexNameservers = new Set<string>()
  const soaSerials: number[] = []
  const recordTypes: string[] = []
  for (const line of logicalLines(text)) {
    const values = tokens(line.text)
    if (values.length === 0) continue
    if (values[0]?.toUpperCase() === "$ORIGIN") {
      origin = absoluteName(values[1] ?? "", domain)
      if (origin !== domain) throw new Error("Zone export origin does not match the domain.")
      continue
    }
    if (values[0]?.toUpperCase() === "$TTL") {
      defaultTtl = integer(values[1], "default TTL", 86_400)
      if (defaultTtl < 1) throw new Error("Zone export default TTL is invalid.")
      continue
    }
    if (values[0]?.startsWith("$")) {
      throw new Error("Zone export contains an unsupported directive.")
    }
    let cursor = 0
    const owner = line.inheritedOwner
      ? priorOwner
      : absoluteName(values[cursor++] ?? "", origin)
    if (owner !== domain && !owner.endsWith(`.${domain}`)) {
      throw new Error("Zone export contains a record outside the selected domain.")
    }
    priorOwner = owner
    let ttl = defaultTtl
    let sawTtl = false
    let sawClass = false
    while (cursor < values.length) {
      const token = values[cursor]!
      const upper = token.toUpperCase()
      if (supportedTypes.has(upper)) break
      if (/^\d+$/.test(token) && !sawTtl) {
        ttl = integer(token, "TTL", 86_400)
        sawTtl = true
        cursor += 1
        continue
      }
      if (upper === "IN" && !sawClass) {
        sawClass = true
        cursor += 1
        continue
      }
      throw new Error("Zone export contains an unsupported record.")
    }
    const type = values[cursor]?.toUpperCase() ?? ""
    if (!supportedTypes.has(type)) {
      throw new Error("Zone export contains an unsupported record.")
    }
    const typeIndex = cursor
    if (ttl < 1) throw new Error("Zone export TTL is invalid.")
    const data = values.slice(typeIndex + 1)
    recordTypes.push(type)
    if (type === "SOA") {
      if (owner !== domain || data.length < 7) {
        throw new Error("Zone export requires a complete apex SOA record.")
      }
      soaSerials.push(integer(data[2], "SOA serial", 4_294_967_295))
      continue
    }
    if (["RRSIG", "NSEC", "NSEC3", "NSEC3PARAM"].includes(type)) continue
    if (type === "DNSKEY") {
      if (owner !== domain || data.length < 4) {
        throw new Error("Zone export DNSKEY record is invalid.")
      }
      const key = {
        flags: integer(data[0], "DNSKEY flags"),
        protocol: integer(data[1], "DNSKEY protocol", 255),
        algorithm: integer(data[2], "DNSKEY algorithm", 255),
        publicKey: data.slice(3).join(""),
      }
      if (key.protocol !== 3 || !/^[A-Za-z0-9+/]+={0,2}$/.test(key.publicKey)) {
        throw new Error("Zone export DNSKEY record is invalid.")
      }
      dnsKeys.push({ ...key, protocol: 3 })
      continue
    }
    const record = parseRecord(type, owner, ttl, data, domain)
    if (!record) continue
    if (record.type === "NS" && owner === domain) {
      apexNameservers.add(canonical(record.content))
    } else {
      records.push(record)
    }
  }
  if (
    new Set(soaSerials).size !== 1 ||
    (
      options.requireAxfrEnvelope
        ? (
            soaSerials.length !== 2 ||
            recordTypes[0] !== "SOA" ||
            recordTypes.at(-1) !== "SOA"
          )
        : soaSerials.length !== 1
    )
  ) {
    throw new Error(
      options.requireAxfrEnvelope
        ? "AXFR requires matching opening and closing SOA records."
        : "Zone export requires exactly one stable SOA record.",
    )
  }
  if (apexNameservers.size < 2) {
    throw new Error("Zone export requires at least two apex nameservers.")
  }
  return {
    records,
    authoritativeNameservers: [...apexNameservers].sort(),
    soaSerial: soaSerials[0]!,
    dnsKeys,
  }
}

const validateAndCanonicalizeBindZone = async (
  domain: string,
  bindText: string,
  options?: BindValidationOptions,
): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "siab-zone-"))
  const sourcePath = join(directory, "source.zone")
  try {
    await writeFile(sourcePath, bindText, { encoding: "utf8", mode: 0o600 })
    const result = await (options?.execFileImpl ?? execFile)(
      options?.validatorPath ?? "/usr/bin/named-checkzone",
      [
        "-i",
        "none",
        "-k",
        "fail",
        "-m",
        "fail",
        "-n",
        "fail",
        "-r",
        "fail",
        "-M",
        "fail",
        "-S",
        "fail",
        "-W",
        "warn",
        "-D",
        "-o",
        "-",
        domain,
        sourcePath,
      ],
      {
        timeout: 10_000,
        maxBuffer: 300 * 1_024,
        encoding: "utf8",
      },
    )
    if (!result.stdout.trim()) {
      throw new Error("BIND validation returned no canonical zone.")
    }
    return result.stdout
  } catch {
    throw new Error("The BIND zone export failed authoritative validation.")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export async function acquireValidatedProviderExport(input: {
  domain: string
  provider: string
  bindText: string
  publicEvidence: MigrationSourcePublicEvidence
  now?: Date
  requireAxfrEnvelope?: boolean
  validationOptions?: BindValidationOptions
}): Promise<AcquiredMigrationSource> {
  const domain = splitDomain(input.domain).domain
  if (input.requireAxfrEnvelope) {
    parseBindZone(input.bindText, domain, { requireAxfrEnvelope: true })
  }
  const canonicalZone = await validateAndCanonicalizeBindZone(
    domain,
    input.bindText,
    input.validationOptions,
  )
  const parsed = parseBindZone(canonicalZone, domain)
  const expectedNameservers = [...new Set(
    input.publicEvidence.authoritativeNameservers.map(canonical),
  )].sort()
  if (
    parsed.authoritativeNameservers.join("\n") !== expectedNameservers.join("\n")
  ) {
    throw new Error("Zone export nameservers do not match current public authority.")
  }
  const zone = completeZoneExportSchema.parse({
    schemaVersion: 1,
    format: "siab-complete-zone-v1",
    domain,
    acquiredAt: (input.now ?? new Date()).toISOString(),
    authority: {
      mechanism: "validated_provider_export",
      provider: input.provider.trim(),
      complete: true,
    },
    authoritativeNameservers: parsed.authoritativeNameservers,
    dnssec: {
      status: input.publicEvidence.dnssecDsPresent ? "signed" : "unsigned",
      parentDsRecords: input.publicEvidence.dnssecDsRecords ?? [],
      parentDsTtl: input.publicEvidence.dnssecDsTtl ?? null,
      dnsKeys: parsed.dnsKeys,
    },
    records: parsed.records,
  } satisfies CompleteZoneExport)
  return {
    mechanism: "validated_provider_export_v1",
    zone,
    refreshCredential: {
      kind: "provider_export",
      sourceSoaSerial: parsed.soaSerial,
    },
  }
}
