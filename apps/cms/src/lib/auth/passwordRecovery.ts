const DEFAULT_SUPER_ADMIN_DOMAIN = "siteinabox.nl"
const DEFAULT_RESET_TOKEN_TTL_MS = 60 * 60 * 1000

export const SUPER_ADMIN_RESET_TOKEN_TTL_MS = DEFAULT_RESET_TOKEN_TTL_MS

export function getSuperAdminOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const domain = env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN?.trim() || DEFAULT_SUPER_ADMIN_DOMAIN
  if (env.NODE_ENV !== "production" && domain === "localhost") {
    return `http://localhost:${env.PORT || "3001"}`
  }
  return `https://admin.${domain}`
}

export function buildSuperAdminResetUrl(token: string, env: NodeJS.ProcessEnv = process.env): string {
  return `${getSuperAdminOrigin(env)}/reset-password/${encodeURIComponent(token)}`
}
