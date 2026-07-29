export type RendererDeployTargetId = string

export type RendererDeployTarget = {
  readonly id: RendererDeployTargetId
  readonly tenantSlug: string
  readonly productionHost: string
  readonly productionOrigin: `https://${string}`
}

// Production customer hosts are managed-domain data reconciled to Cloudflare
// Tunnel ingress. Keep this list empty: adding a hostname here would create a
// competing static routing authority and bypass lifecycle state.
export const RENDERER_DEPLOY_TARGETS: readonly RendererDeployTarget[] = []

export const RENDERER_PRODUCTION_HOSTS = RENDERER_DEPLOY_TARGETS.map((target) => target.productionHost)

// Temporary, audited adoption bridge for verified tenants that were live
// before commerce-owned managed-domain records existed. This list grants no
// provider-write authority and must shrink to empty after each host receives a
// durable managed-domain import with its original ownership evidence.
export const LEGACY_RENDERER_DOMAIN_ADOPTION_HOSTS = [
  "ami-care.nl",
] as const

export function isLegacyRendererDomainAdoptionHost(host: string): boolean {
  return (LEGACY_RENDERER_DOMAIN_ADOPTION_HOSTS as readonly string[]).includes(host)
}

export const RENDERER_DEPLOY_TARGETS_BY_HOST: Readonly<Record<string, RendererDeployTarget>> = Object.fromEntries(
  RENDERER_DEPLOY_TARGETS.map((target) => [target.productionHost, target]),
)

export function isRendererProductionHost(host: string): boolean {
  return Object.hasOwn(RENDERER_DEPLOY_TARGETS_BY_HOST, host)
}

export function getRendererDeployTargetByHost(host: string): RendererDeployTarget | null {
  return RENDERER_DEPLOY_TARGETS_BY_HOST[host] ?? null
}
