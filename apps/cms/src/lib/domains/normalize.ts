import "server-only"

const DOMAIN_REGEX =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

const QUALIFIED_TLD_REGEX = /^[a-z]{2,63}(?:\.[a-z]{2,63})*$/
// This is a seed, not a complete public-suffix or provider-offering catalog.
// Callers with authoritative qualified suffix data can extend it through
// `qualifiedTldSuffixes`; ordinary single-label TLDs remain dynamic.
const DEFAULT_QUALIFIED_TLD_SUFFIXES = ["co.uk"] as const

export type NormalizeDomainOptions = {
  qualifiedTldSuffixes?: readonly string[]
}

const qualifiedTldSuffixesFor = (
  options?: NormalizeDomainOptions,
): string[] => [...new Set([
  ...DEFAULT_QUALIFIED_TLD_SUFFIXES,
  ...(options?.qualifiedTldSuffixes ?? []),
].map((suffix) => suffix.trim().toLowerCase()).filter((suffix) =>
  QUALIFIED_TLD_REGEX.test(suffix) && suffix.includes(".")))]
  .sort((left, right) => right.length - left.length)

const domainExtension = (
  domain: string,
  labels: string[],
  options?: NormalizeDomainOptions,
): string => qualifiedTldSuffixesFor(options).find((suffix) =>
    domain === suffix || domain.endsWith(`.${suffix}`)) ?? labels.at(-1) ?? ""

export type NormalizedDomain =
  | {
      ok: true
      domain: string
      name: string
      extension: string
      labels: string[]
    }
  | {
      ok: false
      input: string
      reason: "empty" | "invalid_format" | "invalid_tld" | "too_long"
    }

const cleanDomainInput = (value: unknown): string => {
  if (typeof value !== "string") return ""
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
}

export function normalizeDomain(
  value: unknown,
  options?: NormalizeDomainOptions,
): NormalizedDomain {
  const domain = cleanDomainInput(value)
  if (!domain) return { ok: false, input: "", reason: "empty" }
  if (domain.length > 253) return { ok: false, input: domain, reason: "too_long" }
  if (!DOMAIN_REGEX.test(domain)) return { ok: false, input: domain, reason: "invalid_format" }

  const labels = domain.split(".")
  const extension = domainExtension(domain, labels, options)
  if (!/[a-z]/.test(extension)) return { ok: false, input: domain, reason: "invalid_tld" }
  const name = domain.slice(0, -(extension.length + 1))
  if (!name) return { ok: false, input: domain, reason: "invalid_format" }

  return {
    ok: true,
    domain,
    name,
    extension,
    labels,
  }
}

export function splitDomain(
  value: unknown,
  options?: NormalizeDomainOptions,
): { name: string; extension: string; domain: string } {
  const normalized = normalizeDomain(value, options)
  if (!normalized.ok) throw new Error(`Invalid domain: ${normalized.reason}.`)
  return {
    name: normalized.name,
    extension: normalized.extension,
    domain: normalized.domain,
  }
}
