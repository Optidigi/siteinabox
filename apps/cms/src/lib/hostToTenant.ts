export const PLATFORM_PROXY_MODE = "platform"

export const stripAdminPrefix = (host: string): string => {
  const noPort = host.split(":")[0] || host
  return noPort.startsWith("admin.") ? noPort.slice(6) : noPort
}

export const isSuperAdminDomain = (
  domain: string,
  configured: string | undefined,
  isDev = process.env.NODE_ENV === "development"
): boolean => {
  if (!configured) return domain === "localhost"
  if (domain === configured) return true
  // Dev convenience: localhost and Cloudflare quick tunnels are the platform
  // admin host so a demo tunnel can show /login. Production only matches the
  // configured domain.
  if (isDev && (domain === "localhost" || domain.endsWith(".trycloudflare.com"))) return true
  return false
}

export const isPlatformAdminHost = (
  host: string,
  configured: string | undefined = process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN?.trim() || "siteinabox.nl",
  isDev = process.env.NODE_ENV === "development",
): boolean => isSuperAdminDomain(stripAdminPrefix(host), configured, isDev)

export const isMarketingSiteHost = (
  host: string,
  configured: string | undefined = process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN?.trim() || "siteinabox.nl",
): boolean => {
  const hostname = (host.split(":")[0] || host).toLowerCase()
  const domain = (configured || "siteinabox.nl").toLowerCase()
  return hostname === domain || hostname === `www.${domain}`
}

export function platformCmsHost(env: NodeJS.ProcessEnv = process.env): string {
  const domain = env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN?.trim() || "siteinabox.nl"
  if (env.NODE_ENV !== "production" && domain === "localhost") {
    return `localhost:${env.PORT || "3001"}`
  }
  return `admin.${domain}`
}

export function platformCmsOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const host = platformCmsHost(env)
  return host.startsWith("localhost") || host.startsWith("127.")
    ? `http://${host}`
    : `https://${host}`
}
