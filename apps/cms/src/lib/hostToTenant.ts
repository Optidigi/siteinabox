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
  // Dev convenience: localhost and Cloudflare quick tunnels are super-admin
  // so a demo tunnel can show /login. Production only matches the configured domain.
  if (isDev && (domain === "localhost" || domain.endsWith(".trycloudflare.com"))) return true
  return false
}
