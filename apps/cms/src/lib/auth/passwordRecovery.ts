import { platformCmsOrigin } from "@/lib/hostToTenant"

export const SUPER_ADMIN_RESET_TOKEN_TTL_MS = 60 * 60 * 1000

export function getSuperAdminOrigin(env: NodeJS.ProcessEnv = process.env): string {
  return platformCmsOrigin(env)
}

export function buildSuperAdminResetUrl(token: string, env: NodeJS.ProcessEnv = process.env): string {
  return `${getSuperAdminOrigin(env)}/reset-password/${encodeURIComponent(token)}`
}
