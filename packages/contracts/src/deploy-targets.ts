export type RendererDeployTargetId = "ami-care"

export type RendererDeployTarget = {
  readonly id: RendererDeployTargetId
  readonly tenantSlug: string
  readonly productionHost: string
  readonly productionOrigin: `https://${string}`
  readonly siteUrlBuildArg: "AMICARE_SITE_URL"
  readonly legacyAssetPrefixes: readonly string[]
}

export const RENDERER_DEPLOY_TARGETS = [
  {
    id: "ami-care",
    tenantSlug: "ami-care",
    productionHost: "ami-care.nl",
    productionOrigin: "https://ami-care.nl",
    siteUrlBuildArg: "AMICARE_SITE_URL",
    legacyAssetPrefixes: [
      "/_astro/",
      "/media/",
      "/api/tenant-media/7/",
      "/favicon",
      "/apple-touch-icon.png",
      "/manifest.json",
      "/og-default.png",
      "/robots.txt",
      "/sitemap-index.xml",
    ],
  },
] as const satisfies readonly RendererDeployTarget[]

export const RENDERER_PRODUCTION_HOSTS = RENDERER_DEPLOY_TARGETS.map((target) => target.productionHost)

export const RENDERER_DEPLOY_TARGETS_BY_HOST = Object.fromEntries(
  RENDERER_DEPLOY_TARGETS.map((target) => [target.productionHost, target]),
) as Readonly<Record<(typeof RENDERER_PRODUCTION_HOSTS)[number], (typeof RENDERER_DEPLOY_TARGETS)[number]>>

export function isRendererProductionHost(host: string): host is (typeof RENDERER_PRODUCTION_HOSTS)[number] {
  return Object.hasOwn(RENDERER_DEPLOY_TARGETS_BY_HOST, host)
}

export function getRendererDeployTargetByHost(host: string): RendererDeployTarget | null {
  return RENDERER_DEPLOY_TARGETS_BY_HOST[host as keyof typeof RENDERER_DEPLOY_TARGETS_BY_HOST] ?? null
}
