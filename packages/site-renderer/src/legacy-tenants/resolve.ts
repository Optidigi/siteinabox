import type { SiteSettings } from "@siteinabox/contracts"

export type LegacyTenantId = "amicare"

export type LegacyTenantContext = {
  tenantSlug?: string | null
  domain?: string | null
  settings?: SiteSettings | null
}

function normalizeHost(value: string | null | undefined): string {
  if (!value) return ""
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .replace(/^www\./, "")
  }
}

function normalizeSlug(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/_/g, "-")
}

export function resolveLegacyTenant({
  tenantSlug,
  domain,
}: LegacyTenantContext): LegacyTenantId | null {
  const slug = normalizeSlug(tenantSlug)
  const host = normalizeHost(domain)

  if (
    slug === "amicare" ||
    slug === "ami-care" ||
    slug === "amicare-zorg" ||
    slug === "tenant-amicare" ||
    host === "amicare.optidigi.nl" ||
    host === "ami-care.nl"
  ) {
    return "amicare"
  }

  return null
}
