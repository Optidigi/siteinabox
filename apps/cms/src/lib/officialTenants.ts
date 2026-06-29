export type OfficialTenantLike = {
  slug?: string | null
  domain?: string | null
}

const OFFICIAL_SLUGS = new Set([
  "ami-care",
  "amicare",
  "amicare-zorg",
  "tenant-amicare",
])
const OFFICIAL_DOMAINS = new Set([
  "ami-care.nl",
  "amicare.nl",
  "amicare.optidigi.nl",
])

const normalizeSlug = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase().replace(/_/g, "-")

const normalizeHost = (value: string | null | undefined) => {
  const raw = (value ?? "").trim().toLowerCase()
  if (!raw) return ""
  try {
    return new URL(raw).hostname.replace(/^www\./, "")
  } catch {
    return raw
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .replace(/^www\./, "")
  }
}

export function isOfficialTenant(tenant: OfficialTenantLike | null | undefined): boolean {
  const slug = normalizeSlug(tenant?.slug)
  const host = normalizeHost(tenant?.domain)
  return OFFICIAL_SLUGS.has(slug) || OFFICIAL_DOMAINS.has(host)
}
