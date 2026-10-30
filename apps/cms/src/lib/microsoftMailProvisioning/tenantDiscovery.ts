const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Public discovery identifies a tenant; callers must separately verify reseller delegation. */
export async function discoverMicrosoftTenant(initialDomain: string, fetchImpl: typeof fetch = fetch): Promise<{ tenantId: string; initialDomain: string } | null> {
  const domain = initialDomain.trim().toLowerCase()
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.onmicrosoft\.com$/.test(domain)) throw new Error("Invalid Microsoft initial domain.")
  const response = await fetchImpl(`https://login.microsoftonline.com/${domain}/v2.0/.well-known/openid-configuration`, {
    headers: { accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(30_000),
  })
  const body: unknown = await response.json().catch(() => null)
  const metadata = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {}
  if (!response.ok) {
    if (response.status === 400 && metadata.error === "invalid_tenant" && Array.isArray(metadata.error_codes) && metadata.error_codes.includes(90002)) return null
    throw new Error(`Microsoft tenant discovery failed with HTTP ${response.status}.`)
  }
  if (typeof metadata.issuer !== "string" || typeof metadata.token_endpoint !== "string") throw new Error("Invalid Microsoft tenant metadata.")
  const match = /^https:\/\/login\.microsoftonline\.com\/([^/]+)\/v2\.0$/.exec(metadata.issuer)
  const tenantId = match?.[1]?.toLowerCase()
  if (!tenantId || !guid.test(tenantId) || metadata.token_endpoint.toLowerCase() !== `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`) throw new Error("Inconsistent Microsoft tenant metadata identity.")
  return { tenantId, initialDomain: domain }
}
