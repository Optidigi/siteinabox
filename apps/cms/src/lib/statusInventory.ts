export interface StatusInventoryTenant {
  id: string | number
  domain?: string | null
  status?: string | null
}

export function normalizeInventoryHostname(value: unknown): string | null {
  if (typeof value !== "string") return null
  const rawHostname = value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]
  if (!rawHostname) return null
  const hostname = rawHostname.replace(/\.$/, "")
  if (hostname.length > 253 || !hostname.includes(".")) return null
  if (!hostname.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null
  return hostname
}

export function buildStatusInventory(tenants: StatusInventoryTenant[], now = new Date()) {
  const services = tenants.flatMap((tenant) => {
    if (tenant.status !== "active") return []
    const hostname = normalizeInventoryHostname(tenant.domain)
    if (!hostname) return []
    const tenantId = String(tenant.id)
    return [
      {
        hostname,
        name: hostname,
        description: "Published customer website.",
        healthUrl: `https://${hostname}/healthz`,
        tenantId,
        kind: "tenant-public" as const,
      },
      {
        hostname: `admin.${hostname}`,
        name: `admin.${hostname}`,
        description: "Customer content management.",
        healthUrl: `https://admin.${hostname}/api/health`,
        tenantId,
        kind: "tenant-cms" as const,
      },
    ]
  })
  return {
    source: "siteinabox-platform" as const,
    generation: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    allowEmpty: true,
    services,
  }
}
