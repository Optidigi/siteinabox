import { createHash } from "node:crypto"

export class MicrosoftTenantDiscoveryError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`Microsoft tenant discovery failed with HTTP ${status}.`)
    this.name = "MicrosoftTenantDiscoveryError"
    this.status = status
  }
}

const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Public discovery identifies a tenant; callers must separately verify reseller delegation. */
export async function discoverMicrosoftTenant(initialDomain: string, fetchImpl: typeof fetch = fetch): Promise<{ tenantId: string; initialDomain: string } | null> {
  const domain = initialDomain.trim().toLowerCase()
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.onmicrosoft\.com$/.test(domain)) throw new Error("Invalid Microsoft initial domain.")
  let response: Response
  try { response = await fetchImpl(`https://login.microsoftonline.com/${domain}/v2.0/.well-known/openid-configuration`, {
    headers: { accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(30_000),
  }) } catch { throw new MicrosoftTenantDiscoveryError(0) }
  const body: unknown = await response.json().catch(() => null)
  const metadata = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {}
  if (!response.ok) {
    if (response.status === 400 && metadata.error === "invalid_tenant" && Array.isArray(metadata.error_codes) && metadata.error_codes.includes(90002)) return null
    throw new MicrosoftTenantDiscoveryError(response.status)
  }
  if (typeof metadata.issuer !== "string" || typeof metadata.token_endpoint !== "string") throw new Error("Invalid Microsoft tenant metadata.")
  const match = /^https:\/\/login\.microsoftonline\.com\/([^/]+)\/v2\.0$/.exec(metadata.issuer)
  const tenantId = match?.[1]?.toLowerCase()
  if (!tenantId || !guid.test(tenantId) || metadata.token_endpoint.toLowerCase() !== `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`) throw new Error("Inconsistent Microsoft tenant metadata identity.")
  return { tenantId, initialDomain: domain }
}

export type MicrosoftTenantAllocationScope = { tenantId: number; serviceId: number; domain: string }

/** Internal tenant namespaces are allocated by the service, not customer-supplied identity. */
export function microsoftInitialDomainCandidate(scope: MicrosoftTenantAllocationScope, attempt: number): string {
  if (!Number.isSafeInteger(scope.tenantId) || scope.tenantId < 1 || !Number.isSafeInteger(scope.serviceId) || scope.serviceId < 1 || !Number.isInteger(attempt) || attempt < 0 || attempt >= 5) throw new Error("Invalid Microsoft namespace allocation scope.")
  const domain = scope.domain.trim().toLowerCase()
  const base = domain.split(".")[0]!.replace(/[^a-z0-9-]/g, "").replace(/^-+/, "").slice(0, 35).replace(/-+$/, "") || "customer"
  const suffix = createHash("sha256").update(`${scope.tenantId}:${scope.serviceId}:${domain}:${attempt}`).digest("hex").slice(0, 12)
  return `${base}-siab-${suffix}.onmicrosoft.com`
}

export async function allocateMicrosoftInitialDomain(scope: MicrosoftTenantAllocationScope, fetchImpl: typeof fetch = fetch): Promise<{ initialDomain: string; attempt: number }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const initialDomain = microsoftInitialDomainCandidate(scope, attempt)
    if (!await discoverMicrosoftTenant(initialDomain, fetchImpl)) return { initialDomain, attempt }
  }
  throw new Error("Microsoft tenant namespace allocation could not find a free name.")
}
