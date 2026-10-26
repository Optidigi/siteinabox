export type MailDnsRecordType = "MX" | "TXT" | "CNAME"

export type MailDnsRecord = {
  id: string
  type: MailDnsRecordType
  name: string
  content: string
  priority?: number
  proxied: boolean
}

export type MailDnsWriteRecord = Omit<MailDnsRecord, "id"> & { id?: string }

export type MailDnsChange =
  | { action: "create"; record: MailDnsWriteRecord }
  | { action: "update"; id: string; record: MailDnsWriteRecord }
  | { action: "delete"; id: string }
  | { action: "keep"; id: string }

export type MicrosoftServiceDnsRecord = {
  recordType?: string
  label?: string
  text?: string
  mailExchange?: string
  preference?: number
  canonicalName?: string
}

export type MicrosoftDkimTarget = { selector: string; target: string }

export type MicrosoftMailDnsPlan = {
  prepare: MailDnsChange[]
  cutover: MailDnsChange[]
}

export class MailDnsPlanError extends Error {
  readonly code: "multiple_spf" | "unrecognized_mx_provider" | "record_conflict" | "missing_mx"

  constructor(code: MailDnsPlanError["code"]) {
    super(code === "multiple_spf"
      ? "Multiple SPF records exist for this domain; merge them before proceeding."
      : code === "unrecognized_mx_provider"
        ? "This domain has an MX provider other than Cloudflare Email Routing or Microsoft 365."
        : code === "record_conflict"
          ? "An existing DNS record conflicts with a required Microsoft mail record."
          : "Microsoft did not return an MX record for the verified domain.")
    this.name = "MailDnsPlanError"
    this.code = code
  }
}

const normalizedName = (name: string, domain: string): string => {
  const value = name.trim().toLowerCase().replace(/\.$/, "")
  if (!value || value === "@") return domain
  if (value === domain || value.endsWith(`.${domain}`)) return value
  return `${value}.${domain}`
}

const rootName = (record: MailDnsRecord, domain: string): boolean =>
  record.name.trim().toLowerCase().replace(/\.$/, "") === domain

const makeRecord = (input: {
  type: MailDnsRecordType
  name: string
  content: string
  priority?: number
}): MailDnsWriteRecord => ({
  type: input.type,
  name: input.name,
  content: input.content,
  ...(input.priority == null ? {} : { priority: input.priority }),
  proxied: false,
})

const sameRecord = (existing: MailDnsRecord, requested: MailDnsWriteRecord): boolean =>
  existing.type === requested.type &&
  existing.name.toLowerCase().replace(/\.$/, "") === requested.name.toLowerCase().replace(/\.$/, "") &&
  existing.content.toLowerCase().replace(/\.$/, "") === requested.content.toLowerCase().replace(/\.$/, "") &&
  existing.priority === requested.priority &&
  existing.proxied === false

const ensureRecord = (
  existing: readonly MailDnsRecord[],
  requested: MailDnsWriteRecord,
  changes: MailDnsChange[],
) => {
  const sameName = existing.filter((record) =>
    record.type !== "TXT" &&
    record.name.toLowerCase().replace(/\.$/, "") === requested.name.toLowerCase().replace(/\.$/, ""))
  const exact = existing.find((record) => sameRecord(record, requested))
  if (exact) {
    changes.push({ action: "keep", id: exact.id })
    return
  }
  if (sameName.length > 0 && requested.type !== "MX") {
    if (sameName.length !== 1) throw new MailDnsPlanError("record_conflict")
    const conflict = sameName[0]!
    changes.push({ action: "update", id: conflict.id, record: requested })
    return
  }
  changes.push({ action: "create", record: requested })
}

const spfWithMicrosoft = (existing: string | null): string => {
  const include = "include:spf.protection.outlook.com"
  if (!existing) return `v=spf1 ${include} -all`
  if (!/^v=spf1(?:\s|$)/i.test(existing.trim())) throw new MailDnsPlanError("record_conflict")
  if (existing.toLowerCase().includes(include)) return existing
  const tokens = existing.trim().split(/\s+/)
  const qualifierIndex = tokens.findIndex((token) => /^[~?+-]all$/i.test(token))
  tokens.splice(qualifierIndex >= 0 ? qualifierIndex : tokens.length, 0, include)
  return tokens.join(" ")
}

export function planMicrosoftMailDns(input: {
  domain: string
  existing: readonly MailDnsRecord[]
  verificationRecords: readonly MicrosoftServiceDnsRecord[]
  serviceRecords: readonly MicrosoftServiceDnsRecord[]
  dkimRecords: readonly MicrosoftDkimTarget[]
}): MicrosoftMailDnsPlan {
  const domain = input.domain.trim().toLowerCase().replace(/\.$/, "")
  const prepare: MailDnsChange[] = []
  const cutover: MailDnsChange[] = []

  for (const record of input.verificationRecords) {
    if (record.recordType?.toLowerCase() !== "txt" || !record.text) continue
    const requested = makeRecord({
      type: "TXT",
      name: normalizedName(record.label ?? "@", domain),
      content: record.text,
    })
    if (input.existing.some((candidate) => sameRecord(candidate, requested))) continue
    prepare.push({ action: "create", record: requested })
  }

  const mx = input.serviceRecords
    .filter((record) => record.recordType?.toLowerCase() === "mx" && record.mailExchange)
    .map((record) => makeRecord({
      type: "MX",
      name: normalizedName(record.label ?? "@", domain),
      content: record.mailExchange!,
      priority: Number.isSafeInteger(record.preference) ? record.preference : 0,
    }))
  if (mx.length === 0) throw new MailDnsPlanError("missing_mx")

  const service = input.serviceRecords.filter((record) => record.recordType?.toLowerCase() === "cname" && record.canonicalName)
  for (const record of service) {
    ensureRecord(input.existing, makeRecord({
      type: "CNAME",
      name: normalizedName(record.label ?? "", domain),
      content: record.canonicalName!,
    }), prepare)
  }

  const spfRecords = input.existing.filter((record) =>
    record.type === "TXT" && rootName(record, domain) && /^v=spf1(?:\s|$)/i.test(record.content.trim()))
  if (spfRecords.length > 1) throw new MailDnsPlanError("multiple_spf")
  const spf = spfRecords[0]
  const spfContent = spfWithMicrosoft(spf?.content ?? null)
  if (!spf) {
    prepare.push({ action: "create", record: makeRecord({ type: "TXT", name: domain, content: spfContent }) })
  } else if (spfContent !== spf.content) {
    prepare.push({ action: "update", id: spf.id, record: makeRecord({ type: "TXT", name: domain, content: spfContent }) })
  } else {
    prepare.push({ action: "keep", id: spf.id })
  }

  const dmarcName = `_dmarc.${domain}`
  const existingDmarc = input.existing.filter((record) => record.type === "TXT" && record.name.toLowerCase().replace(/\.$/, "") === dmarcName)
  if (existingDmarc.length === 0) {
    prepare.push({ action: "create", record: makeRecord({ type: "TXT", name: dmarcName, content: "v=DMARC1; p=none;" }) })
  } else if (existingDmarc.length > 1) {
    throw new MailDnsPlanError("record_conflict")
  } else {
    prepare.push({ action: "keep", id: existingDmarc[0]!.id })
  }

  for (const dkim of input.dkimRecords) {
    if (!/^[a-z0-9_-]{1,63}$/i.test(dkim.selector) || !dkim.target.trim()) {
      throw new MailDnsPlanError("record_conflict")
    }
    ensureRecord(input.existing, makeRecord({
      type: "CNAME",
      name: `${dkim.selector}._domainkey.${domain}`,
      content: dkim.target,
    }), prepare)
  }

  const rootMx = input.existing.filter((record) => record.type === "MX" && rootName(record, domain))
  const nonCloudflareMx = rootMx.filter((record) =>
    !record.content.toLowerCase().trim().replace(/\.$/, "").endsWith(".mx.cloudflare.net") &&
    !record.content.toLowerCase().trim().replace(/\.$/, "").endsWith(".mail.protection.outlook.com"))
  if (nonCloudflareMx.length > 0) throw new MailDnsPlanError("unrecognized_mx_provider")

  for (const record of mx) {
    ensureRecord(input.existing, record, cutover)
  }
  for (const record of rootMx) {
    if (record.content.toLowerCase().trim().replace(/\.$/, "").endsWith(".mx.cloudflare.net")) {
      cutover.push({ action: "delete", id: record.id })
    }
  }

  return { prepare, cutover }
}
